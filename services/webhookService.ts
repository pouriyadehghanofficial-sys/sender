import { IncomingBaleMessage } from "./baleWebhookParser";
import {
  findContactByBaleChatId,
  createAdHocContactFromChat,
} from "../db/contactRepository";
import {
  findOrCreateActiveConversation,
  getConversationById,
  markConversationEscalated,
} from "../db/conversationRepository";
import { addMessage, listMessagesForConversation, messageExistsByExternalId } from "../db/messageRepository";
import { getProductById, getDefaultProductForWebhook } from "../db/productRepository";
import { buildSystemPrompt } from "./productService";
import { askAI } from "./aiService";
import { parseAiResponseTags } from "../utils/orderTag";
import { checkEscalationTrigger, DEFAULT_ESCALATION_THRESHOLD, DEFAULT_ESCALATION_KEYWORDS } from "../utils/escalation";
import { buildEscalationNotificationText } from "./notificationService";
import { sendAdminNotification } from "./adminNotificationDispatcher";
import { getSetting, SettingKeys } from "../db/settingsRepository";
import { MessageSender } from "../db/enums";
import { recordError } from "../utils/runtimeStats";
import { ChatMessage } from "../providers/types";

const FALLBACK_SYSTEM_PROMPT =
  "شما دستیار فروش هستید. چون اطلاعات محصول مشخصی برای این مکالمه ثبت نشده، " +
  "به کاربر بگو که همکاران به‌زودی پیگیری می‌کنند و از او بخواه نام محصول موردنظرش را بگوید.";

const ESCALATION_HANDOFF_TEXT =
  "پیام شما دریافت شد و به همکاران ما ارجاع داده شد؛ به‌زودی شخصاً پاسخ می‌دهند. 🙏";
const AI_FAILURE_HANDOFF_TEXT =
  "متاسفانه در حال حاضر امکان پاسخگویی خودکار نیست. پیام شما ثبت شد و همکاران به‌زودی پیگیری می‌کنند.";

export interface ProcessedIncomingMessage {
  skippedAsDuplicate: boolean;
  displayText: string;
  sendReply: boolean;
  orderConfirmed: boolean;
  conversationId: string;
  chatId: string;
  /** شناسه‌ی پیام AI ذخیره‌شده؛ اگر ارسال به کاربر ناموفق بود پاک می‌شود تا بعداً دوباره تلاش شود */
  aiMessageId?: string;
  /** اگر sendReply=false: چرا جواب داده نشد ("needs_human" | "already_answered" | "ai_retry") */
  skipReason?: string;
}

/** شمار شکست‌های پشت‌سرهم AI برای هر مکالمه؛ فقط بعد از چند شکست متوالی مکالمه به انسان ارجاع می‌شود */
const AI_FAILURES_BEFORE_ESCALATION = 3;
const aiFailureCounts = new Map<string, number>();

/** حداکثر تعداد پیام آخر مکالمه که به AI داده می‌شود (کنترل هزینه‌ی توکن در مکالمه‌های طولانی) */
const MAX_HISTORY_MESSAGES_FOR_AI = 30;

type HistoryMessage = { sender: string; text: string };

/**
 * پیام‌های پشت‌سرهم کاربر (مثلاً «سلام» ← «قیمت» ← «چنده؟») را یک پیام واحد در نظر می‌گیرد؛
 * هم برای تشخیص کلمه کلیدی ارجاع، هم برای اینکه AI یک درخواست جامع ببیند.
 */
function latestUserBurst(history: HistoryMessage[]): string {
  const parts: string[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].sender !== MessageSender.USER) break;
    parts.unshift(history[i].text);
  }
  return parts.join("\n");
}

/** تعداد «نوبت»های کاربر: چند پیام پشت‌سرهم یک نوبت حساب می‌شود، نه چند پیام جدا */
function countUserTurns(history: HistoryMessage[]): number {
  let turns = 0;
  let prevWasUser = false;
  for (const m of history) {
    const isUser = m.sender === MessageSender.USER;
    if (isUser && !prevWasUser) turns++;
    prevWasUser = isUser;
  }
  return turns;
}

/** تبدیل تاریخچه به فرمت AI؛ پیام‌های هم‌نقش پشت‌سرهم ادغام می‌شوند (بعضی مدل‌ها نقش‌های متناوب می‌خواهند) */
function toChatMessages(history: HistoryMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  for (const m of history) {
    const role: ChatMessage["role"] = m.sender === MessageSender.USER ? "user" : "assistant";
    const last = merged[merged.length - 1];
    if (last && last.role === role) last.content += "\n" + m.text;
    else merged.push({ role, content: m.text });
  }
  const trimmed = merged.slice(-MAX_HISTORY_MESSAGES_FOR_AI);
  // مکالمه باید با پیام کاربر شروع شود
  while (trimmed.length > 0 && trimmed[0].role !== "user") trimmed.shift();
  return trimmed;
}

/**
 * محصولِ مخاطبِ بدون محصول: اول محصولی که آخرین کمپین «گوش‌به‌زنگ» برایش شروع شده،
 * اگر نبود یا غیرفعال شده بود، جدیدترین محصول فعال.
 */
async function resolveFallbackProduct() {
  const passiveProductId = await getSetting(SettingKeys.PASSIVE_PRODUCT_ID);
  if (passiveProductId) {
    const p = await getProductById(passiveProductId);
    if (p && p.isActive) return p;
  }
  return getDefaultProductForWebhook();
}

async function getEscalationSettings() {
  const thresholdRaw = await getSetting(SettingKeys.ESCALATION_MESSAGE_THRESHOLD);
  const keywordsRaw = await getSetting(SettingKeys.ESCALATION_KEYWORDS);
  const customInstructions = await getSetting(SettingKeys.ESCALATION_CUSTOM_INSTRUCTIONS);
  const threshold = thresholdRaw ? Number(thresholdRaw) || DEFAULT_ESCALATION_THRESHOLD : DEFAULT_ESCALATION_THRESHOLD;
  const keywords = keywordsRaw ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean) : DEFAULT_ESCALATION_KEYWORDS;
  return { threshold, keywords, customInstructions: customInstructions ?? "" };
}

/**
 * پردازش کامل یک پیام ورودی از webhook بازو:
 * تطبیق مخاطب → مکالمه → ذخیره پیام کاربر → فراخوانی AI → ذخیره پاسخ → تشخیص تگ سفارش.
 * ارسال پاسخ به کاربر (sendBaleMessage) در لایه route انجام می‌شود، نه اینجا،
 * تا این تابع بدون وابستگی به شبکه‌ی بازو هم قابل تست باشد.
 */
/**
 * مرحله ۱: فقط پیام کاربر را ذخیره می‌کند و مخاطب/مکالمه را ایجاد می‌کند.
 * بدون صدا زدن AI — برگشتی سریع به بازو.
 */
export async function saveIncomingBaleMessage(
  incoming: IncomingBaleMessage
): Promise<{ skippedAsDuplicate: boolean; chatId: string }> {
  // idempotency — اگر این پیام قبلاً ذخیره شده
  const alreadyProcessed = await messageExistsByExternalId(incoming.externalMessageId);
  if (alreadyProcessed) {
    return { skippedAsDuplicate: true, chatId: incoming.chatId };
  }

  // پیدا کردن یا ساختن مخاطب بر اساس chat_id بازو
  let contact = await findContactByBaleChatId(incoming.chatId);
  if (!contact) {
    // حالت passive: مخاطب از قبل chatId ندارد، پس محصول کمپین گوش‌به‌زنگ (یا پیش‌فرض) را به او می‌دهیم
    // تا AI به‌جای FALLBACK_SYSTEM_PROMPT بر اساس محصول جواب بدهد.
    const defaultProduct = await resolveFallbackProduct();
    contact = await createAdHocContactFromChat(
      incoming.chatId,
      incoming.senderName ?? "کاربر بله",
      defaultProduct?.id ?? null
    );
  }

  // پیدا کردن یا ساختن مکالمه فعال
  const conversationBasic = await findOrCreateActiveConversation(contact.id, contact.productId);

  // ذخیره پیام کاربر
  await addMessage(conversationBasic.id, MessageSender.USER, incoming.text, incoming.externalMessageId);

  return { skippedAsDuplicate: false, chatId: incoming.chatId };
}

/**
 * مرحله ۲: پس از پایان debounce، تمام پیام‌های کاربر که بعد از آخرین پاسخ AI جمع شده‌اند
 * را یکجا به AI می‌دهد و یک پاسخ واحد برمی‌گرداند.
 */
export async function processAiForChat(
  chatId: string
): Promise<ProcessedIncomingMessage | null> {
  // پیدا کردن مخاطب
  const contact = await findContactByBaleChatId(chatId);
  if (!contact) return null;

  // پیدا کردن مکالمه فعال
  const conversationBasic = await findOrCreateActiveConversation(contact.id, contact.productId);

  // خواندن کل تاریخچه مکالمه
  const conversation = await getConversationById(conversationBasic.id);
  const history = conversation?.messages ?? (await listMessagesForConversation(conversationBasic.id));

  const skipResult = (skipReason: string): ProcessedIncomingMessage => ({
    skipReason,
    skippedAsDuplicate: false,
    displayText: "",
    sendReply: false,
    orderConfirmed: false,
    conversationId: conversationBasic.id,
    chatId,
  });

  // اگر مکالمه قبلاً به انسان ارجاع شده، AI دخالت نمی‌کند
  if ((conversation as any)?.needsHuman) {
    console.warn(
      `[webhookService] chatId=${chatId} قبلاً به انسان ارجاع شده (دلیل: ${(conversation as any)?.escalationReason ?? "نامشخص"}) — AI جواب نمی‌دهد.`
    );
    return skipResult("needs_human");
  }

  // اگر آخرین پیام مکالمه از کاربر نیست، یعنی قبلاً جواب داده شده (یا اپراتور جواب داده)
  // → جلوگیری از پاسخ دوباره وقتی debounce و «بررسی پیام‌های بی‌پاسخ» هم‌زمان اجرا شوند.
  const lastMessage = history[history.length - 1] as HistoryMessage | undefined;
  if (!lastMessage || lastMessage.sender !== MessageSender.USER) {
    return skipResult("already_answered");
  }

  // همه‌ی پیام‌های پشت‌سرهم کاربر را یکجا بررسی می‌کنیم
  const lastUserText = latestUserBurst(history as HistoryMessage[]);
  const userMessageCount = countUserTurns(history as HistoryMessage[]);

  const { threshold, keywords, customInstructions } = await getEscalationSettings();
  const escalation = checkEscalationTrigger(lastUserText, userMessageCount, { threshold, keywords });

  const productId = conversationBasic.productId ?? contact.productId;
  // مخاطب ad-hoc = کسی که خودش به بات پیام داده (گزینه ۲ و ۳): همیشه با محصولِ آخرین کمپین
  // گوش‌به‌زنگ جواب می‌گیرد. برای بقیه محصول خودِ مخاطب؛ و اگر محصولی نداشت، محصول پیش‌فرض.
  const isAdHoc = contact.phone.startsWith("bale-chat:");
  let product = isAdHoc ? await resolveFallbackProduct() : null;
  if (!product) product = productId ? await getProductById(productId) : await resolveFallbackProduct();

  if (escalation.shouldEscalate) {
    const reason = escalation.reason === "keyword" ? "keyword" : "message_limit";
    await markConversationEscalated(conversationBasic.id, reason);
    const handoffMsg = await addMessage(conversationBasic.id, MessageSender.AI, ESCALATION_HANDOFF_TEXT);

    await sendAdminNotification(
      buildEscalationNotificationText({
        customerName: contact.name,
        customerPhone: contact.phone,
        productName: product?.name ?? "نامشخص",
        reason,
        conversationSummary: summarizeForNotification(history),
      })
    ).catch((err) => console.error("[webhookService] خطا در ارسال اعلان ارجاع:", err));

    return {
      skippedAsDuplicate: false,
      displayText: ESCALATION_HANDOFF_TEXT,
      sendReply: true,
      orderConfirmed: false,
      conversationId: conversationBasic.id,
      chatId,
      aiMessageId: handoffMsg.id,
    };
  }

  const chatMessages: ChatMessage[] = toChatMessages(history as HistoryMessage[]);
  const systemPrompt = product ? buildSystemPrompt(product, customInstructions) : FALLBACK_SYSTEM_PROMPT;

  let aiRawResponse: string;
  try {
    aiRawResponse = await askAI(chatMessages, systemPrompt);
  } catch (err) {
    const failures = (aiFailureCounts.get(conversationBasic.id) ?? 0) + 1;
    aiFailureCounts.set(conversationBasic.id, failures);
    recordError("askAI", err);
    if (failures < AI_FAILURES_BEFORE_ESCALATION) {
      // خرابی موقت AI نباید مکالمه را برای همیشه ساکت کند: بدون ارجاع، بعداً دوباره تلاش می‌شود
      console.error(`[webhookService] askAI ناموفق بود (دفعه ${failures}/${AI_FAILURES_BEFORE_ESCALATION})؛ بعداً دوباره تلاش می‌شود:`, err);
      return skipResult("ai_retry");
    }
    aiFailureCounts.delete(conversationBasic.id);
    console.error(`[webhookService] askAI ${AI_FAILURES_BEFORE_ESCALATION} بار پشت‌سرهم ناموفق بود؛ ارجاع خودکار به انسان:`, err);
    await markConversationEscalated(conversationBasic.id, "ai_failure");
    const failureMsg = await addMessage(conversationBasic.id, MessageSender.AI, AI_FAILURE_HANDOFF_TEXT);

    await sendAdminNotification(
      buildEscalationNotificationText({
        customerName: contact.name,
        customerPhone: contact.phone,
        productName: product?.name ?? "نامشخص",
        reason: "ai_failure",
        conversationSummary: summarizeForNotification(history),
      })
    ).catch((notifyErr) => console.error("[webhookService] خطا در ارسال اعلان خرابی AI:", notifyErr));

    return {
      skippedAsDuplicate: false,
      displayText: AI_FAILURE_HANDOFF_TEXT,
      sendReply: true,
      orderConfirmed: false,
      conversationId: conversationBasic.id,
      chatId,
      aiMessageId: failureMsg.id,
    };
  }

  aiFailureCounts.delete(conversationBasic.id);
  const { displayText, orderConfirmed, needsHuman: aiRequestedHuman } = parseAiResponseTags(aiRawResponse);

  const aiMsg = await addMessage(conversationBasic.id, MessageSender.AI, aiRawResponse);

  if (aiRequestedHuman) {
    await markConversationEscalated(conversationBasic.id, "ai_requested");

    await sendAdminNotification(
      buildEscalationNotificationText({
        customerName: contact.name,
        customerPhone: contact.phone,
        productName: product?.name ?? "نامشخص",
        reason: "ai_requested",
        conversationSummary: summarizeForNotification(history),
      })
    ).catch((err) => console.error("[webhookService] خطا در ارسال اعلان ارجاع توسط AI:", err));
  }

  return {
    skippedAsDuplicate: false,
    displayText,
    sendReply: true,
    orderConfirmed,
    conversationId: conversationBasic.id,
    chatId,
    aiMessageId: aiMsg.id,
  };
}

function summarizeForNotification(messages: { sender: string; text: string }[], max = 6): string {
  return messages
    .slice(-max)
    .map((m) => `${m.sender === MessageSender.USER ? "کاربر" : "دستیار"}: ${m.text}`)
    .join("\n");
}

/** برای استفاده در فاز ۷ (بررسی مجدد مکالمه بعد از تشخیص سفارش) */
export async function getConversationWithDetails(conversationId: string) {
  return getConversationById(conversationId);
}
