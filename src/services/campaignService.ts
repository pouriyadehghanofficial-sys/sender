import { listContactsByProduct, updateContactStatus, setContactBaleChatId, markPendingContactsPassive, getContactById } from "../db/contactRepository";
import {
  isCampaignQueueEnabled,
  enqueuePendingContactsForCampaign,
  CampaignSendJobData,
} from "../queue/campaignQueue";
import { sweepUnansweredChats } from "./replyService";
import { getProductById } from "../db/productRepository";
import { getSetting, setSetting, SettingKeys } from "../db/settingsRepository";
import { sendSafirMessage } from "../providers/baleSafirClient";
import { ContactStatus } from "../db/enums";
import { CampaignStatus, getCampaignStatus, updateCampaignProgress, updateCampaignStatus, getCampaignOwnedByUser } from "../db/campaignRepository";
import { logActivity } from "../db/activityLogRepository";

export interface CampaignProgress {
  total: number;
  sent: number;
  failed: number;
  noBale: number;
  done: boolean;
}

/**
 * حالت‌های کمپین (همان سه گزینه‌ی پنل):
 *  - "send"           گزینه ۱: فقط ارسال پیام اولیه (یک متن یکسان برای همه). AI خاموش می‌شود؛ پاسخ کاربران فقط ذخیره می‌شود.
 *  - "listen"         گزینه ۲: چیزی ارسال نمی‌شود؛ AI روشن می‌شود و به هر پیام جدیدِ کاربران با محصول انتخاب‌شده جواب می‌دهد.
 *  - "listen_catchup" گزینه ۳: مثل گزینه ۲ + همان لحظه همه‌ی گفتگوهای بی‌پاسخ (کاربر نوشته، ما جواب نداده‌ایم) پاسخ داده می‌شوند.
 */
export type CampaignMode = "send" | "listen" | "listen_catchup";

const DELAY_BETWEEN_MESSAGES_MS = 1500;
/** اگر این تعداد ارسال متوالی ناموفق بود (مثلاً کلید سفیر باطل یا قطعی)، کمپین متوقف می‌شود تا ۱۰ هزار مخاطب الکی failed نشوند */
const MAX_CONSECUTIVE_FAILURES = 20;
const MAX_SEND_ATTEMPTS = 3;

/**
 * قفل ساده درون‌حافظه‌ای: از اجرای دو کمپین هم‌زمان روی یک محصول جلوگیری می‌کند.
 * چون sendCampaign فقط مخاطبین status='pending' را می‌فرستد، اگر سرور وسط کار
 * (قطعی برق/اینترنت/کرش) از کار بیفتد، کافیست دوباره همین تابع صدا زده شود —
 * خودش از همان‌جا که مانده ادامه می‌دهد؛ نیازی به ذخیره progress جداگانه نیست.
 */
const runningCampaigns = new Set<string>();

export function isCampaignRunning(productId: string): boolean {
  return runningCampaigns.has(productId);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

/** خطاهای موقتی (rate limit، ۵xx، شبکه) که ارزش تلاش دوباره دارند */
function isTransientFailure(message: string): boolean {
  return /^\[(429|5\d\d)\]/.test(message) || message.startsWith("خطای شبکه");
}

/**
 * ارسال گروهی پیام معرفی محصول (گزینه ۱) یا فعال‌سازی پاسخ‌گویی (گزینه ۲ و ۳).
 * در حالت ارسال، فاصله‌ی DELAY_BETWEEN_MESSAGES_MS بین هر پیام است و وضعیت هر مخاطب فوراً ذخیره
 * می‌شود؛ خطای یک مخاطب هرگز کل کمپین را نمی‌خواباند و با قطع شدن سرور می‌شود از همان‌جا ادامه داد.
 */
export async function sendCampaign(
  productId: string,
  onProgress?: (p: CampaignProgress) => void,
  options?: {
    initialMessageText?: string;
    initialMessagePhoto?: string;
    mode?: CampaignMode;
    /** سازگاری با نسخه‌ی قبل: true یعنی mode = "listen" */
    isPassiveMode?: boolean;
  }
): Promise<CampaignProgress> {
  if (runningCampaigns.has(productId)) {
    throw new Error("یک کمپین برای این محصول در حال اجراست؛ صبر کنید تمام شود یا دوباره تلاش کنید.");
  }
  runningCampaigns.add(productId);

  try {
    const product = await getProductById(productId);
    if (!product) throw new Error("محصول یافت نشد.");

    const mode: CampaignMode = options?.mode ?? (options?.isPassiveMode ? "listen" : "send");

    // ----- گزینه ۲ و ۳: فقط گوش‌به‌زنگ -----
    if (mode === "listen" || mode === "listen_catchup") {
      // ثبت محصول انتخاب‌شده و روشن کردن AI؛ وبهوک از این به بعد به هر پیام جدید با این محصول جواب می‌دهد
      await setSetting(SettingKeys.PASSIVE_PRODUCT_ID, productId);
      await setSetting(SettingKeys.AUTO_REPLY_MODE, "ai");

      const count = await markPendingContactsPassive(productId, null);
      const progress: CampaignProgress = { total: count, sent: count, failed: 0, noBale: 0, done: true };
      onProgress?.({ ...progress });

      if (mode === "listen_catchup") {
        // در پس‌زمینه: به همه‌ی گفتگوهایی که آخرین پیامشان از کاربر است و جواب نگرفته‌اند، نفر به نفر جواب بده
        void sweepUnansweredChats().catch((err) => console.error("[campaign] خطا در بررسی پیام‌های بی‌پاسخ:", err));
      }
      return progress;
    }

    // ----- گزینه ۱: ارسال پیام اولیه (بدون AI) -----
    const apiKey = await getSetting(SettingKeys.BALE_SAFIR_KEY);
    if (!apiKey) {
      throw new Error("کلید سفیر بله (bale_safir_key) در تنظیمات وارد نشده است.");
    }
    const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
    if (!botToken) {
      throw new Error("توکن ربات (bale_bot_token) برای استخراج bot_id تنظیم نشده است.");
    }
    const botId = parseInt(botToken.split(":")[0], 10);
    if (isNaN(botId)) {
      throw new Error("توکن ربات نامعتبر است (bot_id یافت نشد).");
    }

    // گزینه ۱ فقط ارسال است: AI برای پیام‌های ورودی خاموش می‌شود (پیام‌ها ذخیره می‌شوند و با گزینه ۳ می‌شود جواب داد)
    await setSetting(SettingKeys.AUTO_REPLY_MODE, "off");

    const pendingContacts = await listContactsByProduct(productId, null, ContactStatus.PENDING);
    const progress: CampaignProgress = { total: pendingContacts.length, sent: 0, failed: 0, noBale: 0, done: false };

    // یک متن یکسان برای همه
    const introText =
      options?.initialMessageText?.trim() ||
      `سلام! محصول «${product.name}» را معرفی می‌کنیم.\n${truncate(product.descriptionText, 300)}`;

    // اگر Redis تنظیم شده، به‌جای حلقه‌ی ساده‌ی زیر، ارسال به صف واقعی سپرده می‌شود:
    // ماندگار در برابر قطعی سرور، با کنترل نرخ و همزمانی داخلیِ Worker (مناسب کمپین‌های خیلی بزرگ).
    // وضعیت هر مخاطب (sent/failed/no_bale) همچنان در دیتابیس ثبت می‌شود، پس گزارش/پولینگ پنل
    // بدون هیچ تغییری همان‌طور که هست کار می‌کند.
    if (isCampaignQueueEnabled) {
      await enqueuePendingContactsForCampaign(
        productId,
        pendingContacts.map((c: { id: string }) => c.id),
        introText,
        options?.initialMessagePhoto || undefined
      );
      progress.done = false; // ارسال واقعی در پس‌زمینه توسط Worker انجام می‌شود
      onProgress?.({ ...progress });
      return progress;
    }

    let consecutiveFailures = 0;

    for (const contact of pendingContacts) {
      try {
        let outcome = await sendSafirMessage({
          apiKey,
          botId,
          phone: contact.phone,
          text: introText,
          photoUrl: options?.initialMessagePhoto || undefined,
        });

        for (let attempt = 2; attempt <= MAX_SEND_ATTEMPTS && outcome.kind === "failed" && isTransientFailure(outcome.message); attempt++) {
          await sleep(3000 * attempt);
          outcome = await sendSafirMessage({
            apiKey,
            botId,
            phone: contact.phone,
            text: introText,
            photoUrl: options?.initialMessagePhoto || undefined,
          });
        }

        if (outcome.kind === "sent") {
          await updateContactStatus(contact.id, ContactStatus.SENT, { sentAt: new Date(), errorMessage: null });
          if (outcome.chatId) {
            // ممکن است این chatId قبلاً به مخاطب دیگری (مثلاً شماره تکراری) داده شده باشد؛ خطا کل کمپین را نمی‌خواباند
            await setContactBaleChatId(contact.id, outcome.chatId).catch((err) =>
              console.warn(`[campaign ${productId}] ذخیره chatId برای ${contact.id} ممکن نشد:`, (err as Error)?.message)
            );
          }
          progress.sent++;
          consecutiveFailures = 0;
        } else if (outcome.kind === "no_bale") {
          await updateContactStatus(contact.id, ContactStatus.NO_BALE, { errorMessage: outcome.message });
          progress.noBale++;
          consecutiveFailures = 0;
        } else {
          await updateContactStatus(contact.id, ContactStatus.FAILED, { errorMessage: outcome.message });
          progress.failed++;
          consecutiveFailures++;
        }
      } catch (err) {
        // خطای غیرمنتظره (مثلاً دیتابیس) برای یک مخاطب: ثبت و ادامه
        console.error(`[campaign ${productId}] خطا برای مخاطب ${contact.id}:`, err);
        await updateContactStatus(contact.id, ContactStatus.FAILED, { errorMessage: (err as Error)?.message ?? "خطای ناشناخته" }).catch(() => undefined);
        progress.failed++;
        consecutiveFailures++;
      }

      onProgress?.({ ...progress });

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `[campaign ${productId}] ${MAX_CONSECUTIVE_FAILURES} ارسال متوالی ناموفق بود؛ کمپین متوقف شد. ` +
            `مخاطبین باقی‌مانده pending هستند — بعد از رفع مشکل (کلید سفیر/اینترنت) دوباره «ادامه ارسال» بزنید.`
        );
        break;
      }

      await sleep(DELAY_BETWEEN_MESSAGES_MS);
    }

    progress.done = consecutiveFailures < MAX_CONSECUTIVE_FAILURES;
    onProgress?.({ ...progress });
    return progress;
  } finally {
    runningCampaigns.delete(productId);
  }
}

/**
 * ارسال پیام معرفی محصول برای یک مخاطب واحد؛ همان منطق حلقه‌ی sendCampaign، اما به‌شکل
 * یک تابع مستقل تا Worker صف Redis (campaignQueue.ts) بتواند برای هر job جداگانه صدایش بزند.
 */
export async function sendIntroToContactJob(data: CampaignSendJobData): Promise<"sent" | "failed" | "no_bale"> {
  const contact = await getContactById(data.contactId);
  if (!contact) return "failed";

  const apiKey = await getSetting(SettingKeys.BALE_SAFIR_KEY);
  const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
  if (!apiKey || !botToken) {
    await updateContactStatus(contact.id, ContactStatus.FAILED, { errorMessage: "کلید سفیر یا توکن ربات تنظیم نشده است." });
    return "failed";
  }
  const botId = parseInt(botToken.split(":")[0], 10);
  if (isNaN(botId)) {
    await updateContactStatus(contact.id, ContactStatus.FAILED, { errorMessage: "توکن ربات نامعتبر است." });
    return "failed";
  }

  let outcome = await sendSafirMessage({ apiKey, botId, phone: contact.phone, text: data.introText, photoUrl: data.photoUrl });
  for (let attempt = 2; attempt <= MAX_SEND_ATTEMPTS && outcome.kind === "failed" && isTransientFailure(outcome.message); attempt++) {
    await sleep(3000 * attempt);
    outcome = await sendSafirMessage({ apiKey, botId, phone: contact.phone, text: data.introText, photoUrl: data.photoUrl });
  }

  if (outcome.kind === "sent") {
    await updateContactStatus(contact.id, ContactStatus.SENT, { sentAt: new Date(), errorMessage: null });
    if (outcome.chatId) await setContactBaleChatId(contact.id, outcome.chatId).catch(() => undefined);
    return "sent";
  }
  if (outcome.kind === "no_bale") {
    await updateContactStatus(contact.id, ContactStatus.NO_BALE, { errorMessage: outcome.message });
    return "no_bale";
  }
  await updateContactStatus(contact.id, ContactStatus.FAILED, { errorMessage: outcome.message });
  return "failed";
}

// ---------------------------------------------------------------------------
// نسخه‌ی چندمستأجری (پلتفرم API) — روی یک رکورد Campaign ماندگار کار می‌کند و
// pause/resume/cancel واقعی دارد (وسط حلقه‌ی ارسال، وضعیت را از دیتابیس می‌خواند).
// ---------------------------------------------------------------------------
const runningCampaignIds = new Set<string>();

export function isTenantCampaignRunning(campaignId: string): boolean {
  return runningCampaignIds.has(campaignId);
}

/**
 * اجرای یک کمپین ماندگار. اگر قبلاً شروع شده و paused بوده، از همان مخاطبین
 * pending باقی‌مانده ادامه می‌دهد (resume واقعی). اگر وسط اجرا کسی وضعیت را در
 * دیتابیس به paused/cancelled تغییر دهد (از طریق endpoint pause/cancel)، همین
 * حلقه در همان لحظه متوقف می‌شود — نیازی به سیگنال درون‌حافظه‌ای بین request ها نیست.
 */
export async function runTenantCampaign(
  campaignId: string,
  userId: string,
  productId: string,
  apiKeyId?: string | null
): Promise<void> {
  if (runningCampaignIds.has(campaignId)) return; // از قبل در حال اجراست، دوباره شروع نکن
  runningCampaignIds.add(campaignId);

  try {
    const product = await getProductById(productId);
    if (!product) throw new Error("محصول یافت نشد.");

    const apiKey = await getSetting(SettingKeys.BALE_SAFIR_KEY);
    if (!apiKey) throw new Error("کلید سفیر بله (bale_safir_key) در تنظیمات وارد نشده است.");

    const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
    if (!botToken) {
      throw new Error("توکن ربات (bale_bot_token) برای استخراج bot_id تنظیم نشده است.");
    }
    const botIdStr = botToken.split(":")[0];
    const botId = parseInt(botIdStr, 10);
    if (isNaN(botId)) {
      throw new Error("توکن ربات نامعتبر است (bot_id یافت نشد).");
    }

    const introText = `سلام! محصول «${product.name}» را معرفی می‌کنیم.\n${truncate(product.descriptionText, 300)}`;

    const pendingContacts = await listContactsByProduct(productId, userId, ContactStatus.PENDING);

    // مهم: اگر این resume یک کمپین متوقف‌شده است (نه شروع اول)، total/processed/successful/failed
    // باید از همان مقداری که قبل از pause ذخیره شده بود ادامه پیدا کنند، نه اینکه دوباره صفر شوند
    // یا total روی تعداد مخاطبین *باقیمانده* (کمتر از واقعی) تنظیم شود.
    const existingCampaign = await getCampaignOwnedByUser(campaignId, userId);
    const isFreshStart = !existingCampaign || existingCampaign.totalContacts === 0;

    let successful = isFreshStart ? 0 : existingCampaign.successful;
    let failed = isFreshStart ? 0 : existingCampaign.failed;
    let processed = isFreshStart ? 0 : existingCampaign.processed;

    if (isFreshStart) {
      await updateCampaignProgress(campaignId, { totalContacts: pendingContacts.length });
    }

    for (const contact of pendingContacts) {
      // قبل از هر پیام، وضعیت واقعی کمپین را از دیتابیس می‌خوانیم — این همان مکانیزم
      // pause/cancel واقعی است (نه یک flag درون‌حافظه‌ای که با ری‌استارت سرور از بین برود)
      const currentStatus = await getCampaignStatus(campaignId);
      if (currentStatus === CampaignStatus.PAUSED || currentStatus === CampaignStatus.CANCELLED) {
        return; // حلقه همین‌جا متوقف می‌شود؛ مخاطبین باقیمانده pending می‌مانند برای resume بعدی
      }

      const outcome = await sendSafirMessage({
        apiKey,
        botId,
        phone: contact.phone,
        text: introText,
        button: { type: "copy_text", value: `کد محصول: ${product.shortCode}`, label: "شروع گفتگو" },
      });

      if (outcome.kind === "sent") {
        await updateContactStatus(contact.id, ContactStatus.SENT, { sentAt: new Date(), errorMessage: null });
        if (outcome.chatId) await setContactBaleChatId(contact.id, outcome.chatId);
        successful++;
      } else if (outcome.kind === "no_bale") {
        await updateContactStatus(contact.id, ContactStatus.NO_BALE, { errorMessage: outcome.message });
        failed++;
      } else {
        await updateContactStatus(contact.id, ContactStatus.FAILED, { errorMessage: outcome.message });
        failed++;
      }
      processed++;

      await updateCampaignProgress(campaignId, { processed, successful, failed });
      await sleep(DELAY_BETWEEN_MESSAGES_MS);
    }

    // اگر تا اینجا رسیدیم یعنی همه‌ی مخاطبین pending این دور تمام شدند. فقط وقتی
    // واقعاً هنوز "running" است کمپین را completed کن — اگر درست همزمان با پردازش
    // آخرین مخاطب، کاربر pause را زده باشد (status الان "paused" است)، نباید این
    // را نادیده بگیریم و completed کنیم؛ باید paused بماند تا با resume به‌درستی
    // نهایی شود (که چون دیگر مخاطب pending ای نمانده، فوراً completed می‌شود).
    const finalStatus = await getCampaignStatus(campaignId);
    if (finalStatus === CampaignStatus.RUNNING) {
      await updateCampaignStatus(campaignId, CampaignStatus.COMPLETED);
      await logActivity({
        userId,
        apiKeyId,
        action: "campaign_completed",
        resourceType: "campaign",
        resourceId: campaignId,
        metadata: { successful, failed, processed },
      });
    }
  } catch (err) {
    console.error(`[runTenantCampaign] خطا در کمپین ${campaignId}:`, err);
    await logActivity({
      userId,
      apiKeyId,
      action: "campaign_error",
      resourceType: "campaign",
      resourceId: campaignId,
      metadata: { message: (err as Error)?.message },
    }).catch(() => undefined);
  } finally {
    runningCampaignIds.delete(campaignId);
  }
}
