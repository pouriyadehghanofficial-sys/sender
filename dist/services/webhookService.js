"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveIncomingBaleMessage = saveIncomingBaleMessage;
exports.processAiForChat = processAiForChat;
exports.getConversationWithDetails = getConversationWithDetails;
const contactRepository_1 = require("../db/contactRepository");
const conversationRepository_1 = require("../db/conversationRepository");
const messageRepository_1 = require("../db/messageRepository");
const productRepository_1 = require("../db/productRepository");
const productService_1 = require("./productService");
const aiService_1 = require("./aiService");
const orderTag_1 = require("../utils/orderTag");
const escalation_1 = require("../utils/escalation");
const notificationService_1 = require("./notificationService");
const adminNotificationDispatcher_1 = require("./adminNotificationDispatcher");
const settingsRepository_1 = require("../db/settingsRepository");
const enums_1 = require("../db/enums");
const FALLBACK_SYSTEM_PROMPT = "شما دستیار فروش هستید. چون اطلاعات محصول مشخصی برای این مکالمه ثبت نشده، " +
    "به کاربر بگو که همکاران به‌زودی پیگیری می‌کنند و از او بخواه نام محصول موردنظرش را بگوید.";
const ESCALATION_HANDOFF_TEXT = "پیام شما دریافت شد و به همکاران ما ارجاع داده شد؛ به‌زودی شخصاً پاسخ می‌دهند. 🙏";
const AI_FAILURE_HANDOFF_TEXT = "متاسفانه در حال حاضر امکان پاسخگویی خودکار نیست. پیام شما ثبت شد و همکاران به‌زودی پیگیری می‌کنند.";
async function getEscalationSettings() {
    const thresholdRaw = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.ESCALATION_MESSAGE_THRESHOLD);
    const keywordsRaw = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.ESCALATION_KEYWORDS);
    const customInstructions = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.ESCALATION_CUSTOM_INSTRUCTIONS);
    const threshold = thresholdRaw ? Number(thresholdRaw) || escalation_1.DEFAULT_ESCALATION_THRESHOLD : escalation_1.DEFAULT_ESCALATION_THRESHOLD;
    const keywords = keywordsRaw ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean) : escalation_1.DEFAULT_ESCALATION_KEYWORDS;
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
async function saveIncomingBaleMessage(incoming) {
    // idempotency — اگر این پیام قبلاً ذخیره شده
    const alreadyProcessed = await (0, messageRepository_1.messageExistsByExternalId)(incoming.externalMessageId);
    if (alreadyProcessed) {
        return { skippedAsDuplicate: true, chatId: incoming.chatId };
    }
    // پیدا کردن یا ساختن مخاطب بر اساس chat_id بازو
    let contact = await (0, contactRepository_1.findContactByBaleChatId)(incoming.chatId);
    if (!contact) {
        contact = await (0, contactRepository_1.createAdHocContactFromChat)(incoming.chatId, incoming.senderName ?? "کاربر بله");
    }
    // پیدا کردن یا ساختن مکالمه فعال
    const conversationBasic = await (0, conversationRepository_1.findOrCreateActiveConversation)(contact.id, contact.productId);
    // ذخیره پیام کاربر
    await (0, messageRepository_1.addMessage)(conversationBasic.id, enums_1.MessageSender.USER, incoming.text, incoming.externalMessageId);
    return { skippedAsDuplicate: false, chatId: incoming.chatId };
}
/**
 * مرحله ۲: پس از پایان debounce، تمام پیام‌های کاربر که بعد از آخرین پاسخ AI جمع شده‌اند
 * را یکجا به AI می‌دهد و یک پاسخ واحد برمی‌گرداند.
 */
async function processAiForChat(chatId) {
    // پیدا کردن مخاطب
    const contact = await (0, contactRepository_1.findContactByBaleChatId)(chatId);
    if (!contact)
        return null;
    // پیدا کردن مکالمه فعال
    const conversationBasic = await (0, conversationRepository_1.findOrCreateActiveConversation)(contact.id, contact.productId);
    // خواندن کل تاریخچه مکالمه
    const conversation = await (0, conversationRepository_1.getConversationById)(conversationBasic.id);
    const history = conversation?.messages ?? (await (0, messageRepository_1.listMessagesForConversation)(conversationBasic.id));
    // اگر مکالمه قبلاً به انسان ارجاع شده، AI دخالت نمی‌کند
    if (conversation?.needsHuman) {
        return {
            skippedAsDuplicate: false,
            displayText: "",
            sendReply: false,
            orderConfirmed: false,
            conversationId: conversationBasic.id,
            chatId,
        };
    }
    // آخرین پیام کاربر را پیدا می‌کنیم (برای چک escalation keyword)
    const lastUserMessage = [...history]
        .reverse()
        .find((m) => m.sender === enums_1.MessageSender.USER);
    const lastUserText = lastUserMessage?.text ?? "";
    const userMessageCount = history.filter((m) => m.sender === enums_1.MessageSender.USER).length;
    const { threshold, keywords, customInstructions } = await getEscalationSettings();
    const escalation = (0, escalation_1.checkEscalationTrigger)(lastUserText, userMessageCount, { threshold, keywords });
    const productId = conversationBasic.productId ?? contact.productId;
    const product = productId ? await (0, productRepository_1.getProductById)(productId) : null;
    if (escalation.shouldEscalate) {
        const reason = escalation.reason === "keyword" ? "keyword" : "message_limit";
        await (0, conversationRepository_1.markConversationEscalated)(conversationBasic.id, reason);
        await (0, messageRepository_1.addMessage)(conversationBasic.id, enums_1.MessageSender.AI, ESCALATION_HANDOFF_TEXT);
        await (0, adminNotificationDispatcher_1.sendAdminNotification)((0, notificationService_1.buildEscalationNotificationText)({
            customerName: contact.name,
            customerPhone: contact.phone,
            productName: product?.name ?? "نامشخص",
            reason,
            conversationSummary: summarizeForNotification(history),
        })).catch((err) => console.error("[webhookService] خطا در ارسال اعلان ارجاع:", err));
        return {
            skippedAsDuplicate: false,
            displayText: ESCALATION_HANDOFF_TEXT,
            sendReply: true,
            orderConfirmed: false,
            conversationId: conversationBasic.id,
            chatId,
        };
    }
    // ساخت chatMessages از تاریخچه کامل
    const chatMessages = history.map((m) => ({
        role: m.sender === enums_1.MessageSender.USER ? "user" : "assistant",
        content: m.text,
    }));
    const systemPrompt = product ? (0, productService_1.buildSystemPrompt)(product, customInstructions) : FALLBACK_SYSTEM_PROMPT;
    let aiRawResponse;
    try {
        aiRawResponse = await (0, aiService_1.askAI)(chatMessages, systemPrompt);
    }
    catch (err) {
        console.error(`[webhookService] askAI کاملاً ناموفق بود؛ ارجاع خودکار به انسان:`, err);
        await (0, conversationRepository_1.markConversationEscalated)(conversationBasic.id, "ai_failure");
        await (0, messageRepository_1.addMessage)(conversationBasic.id, enums_1.MessageSender.AI, AI_FAILURE_HANDOFF_TEXT);
        await (0, adminNotificationDispatcher_1.sendAdminNotification)((0, notificationService_1.buildEscalationNotificationText)({
            customerName: contact.name,
            customerPhone: contact.phone,
            productName: product?.name ?? "نامشخص",
            reason: "ai_failure",
            conversationSummary: summarizeForNotification(history),
        })).catch((notifyErr) => console.error("[webhookService] خطا در ارسال اعلان خرابی AI:", notifyErr));
        return {
            skippedAsDuplicate: false,
            displayText: AI_FAILURE_HANDOFF_TEXT,
            sendReply: true,
            orderConfirmed: false,
            conversationId: conversationBasic.id,
            chatId,
        };
    }
    const { displayText, orderConfirmed, needsHuman: aiRequestedHuman } = (0, orderTag_1.parseAiResponseTags)(aiRawResponse);
    await (0, messageRepository_1.addMessage)(conversationBasic.id, enums_1.MessageSender.AI, aiRawResponse);
    if (aiRequestedHuman) {
        await (0, conversationRepository_1.markConversationEscalated)(conversationBasic.id, "ai_requested");
        await (0, adminNotificationDispatcher_1.sendAdminNotification)((0, notificationService_1.buildEscalationNotificationText)({
            customerName: contact.name,
            customerPhone: contact.phone,
            productName: product?.name ?? "نامشخص",
            reason: "ai_requested",
            conversationSummary: summarizeForNotification(history),
        })).catch((err) => console.error("[webhookService] خطا در ارسال اعلان ارجاع توسط AI:", err));
    }
    return {
        skippedAsDuplicate: false,
        displayText,
        sendReply: true,
        orderConfirmed,
        conversationId: conversationBasic.id,
        chatId,
    };
}
function summarizeForNotification(messages, max = 6) {
    return messages
        .slice(-max)
        .map((m) => `${m.sender === enums_1.MessageSender.USER ? "کاربر" : "دستیار"}: ${m.text}`)
        .join("\n");
}
/** برای استفاده در فاز ۷ (بررسی مجدد مکالمه بعد از تشخیص سفارش) */
async function getConversationWithDetails(conversationId) {
    return (0, conversationRepository_1.getConversationById)(conversationId);
}
