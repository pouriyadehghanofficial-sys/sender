"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const baleWebhookParser_1 = require("../services/baleWebhookParser");
const webhookService_1 = require("../services/webhookService");
const orderService_1 = require("../services/orderService");
const baleBotClient_1 = require("../providers/baleBotClient");
const settingsRepository_1 = require("../db/settingsRepository");
const chatMutex_1 = require("../utils/chatMutex");
const rateLimiter_1 = require("../utils/rateLimiter");
const router = (0, express_1.Router)();
const debounceTimers = new Map();
// حداکثر ۲۰ پیام در هر ۲ دقیقه برای هر chatId — جلوی هرزنامه/باگ حلقه‌ی بی‌نهایت/هزینه
// سرسام‌آور فراخوانی AI را می‌گیرد. اگر کسب‌وکارتان واقعاً به نرخ بالاتر نیاز دارد،
// همین دو عدد را تغییر دهید.
const RATE_LIMIT_MAX_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;
/**
 * مسیر شامل :secret است: اگر WEBHOOK_SECRET در .env تنظیم شده باشد، فقط درخواست‌هایی
 * که همان رمز را در مسیر دارند پردازش می‌شوند — تا هر کسی که آدرس سرور را حدس بزند
 * نتواند پیام جعلی بفرستد و هزینه‌ی AI شما را بالا ببرد یا سفارش قلابی بسازد.
 */
router.post("/:secret?", async (req, res) => {
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (expectedSecret && req.params.secret !== expectedSecret) {
        console.warn("[webhook/bale] درخواست با رمز نامعتبر یا بدون رمز رد شد.");
        return res.status(404).json({ ok: false });
    }
    // بازو معمولاً انتظار پاسخ سریع دارد؛ ابتدا ۲۰۰ را برمی‌گردانیم، سپس پردازش می‌کنیم —
    // اما چون پاسخ AI هم باید ارسال شود، همین‌جا با await کامل پیش می‌رویم (ساده‌تر و
    // قابل‌اعتمادتر برای پروژه با ترافیک کم؛ برای ترافیک بالا می‌توان صف اضافه کرد).
    try {
        // برای دیباگ ساختار واقعی payload بازو (طبق یادداشت در baleWebhookParser.ts)
        console.log("[webhook/bale] payload خام:", JSON.stringify(req.body));
        const incoming = (0, baleWebhookParser_1.parseIncomingBaleWebhook)(req.body);
        if (!incoming) {
            console.warn("[webhook/bale] payload قابل تجزیه نبود، نادیده گرفته شد.");
            return res.status(200).json({ ok: true, ignored: true });
        }
        if ((0, rateLimiter_1.isRateLimited)(incoming.chatId, RATE_LIMIT_MAX_MESSAGES, RATE_LIMIT_WINDOW_MS)) {
            console.warn(`[webhook/bale] chatId=${incoming.chatId} به سقف نرخ پیام رسید؛ این پیام نادیده گرفته شد.`);
            return res.status(200).json({ ok: true, rateLimited: true });
        }
        // ۱. فقط پیام را در دیتابیس ذخیره می‌کنیم
        const saved = await (0, chatMutex_1.runExclusive)(incoming.chatId, () => (0, webhookService_1.saveIncomingBaleMessage)(incoming));
        // ۲. برای جلوگیری از ارسال پیام‌های تکی توسط AI (Debounce)
        if (debounceTimers.has(incoming.chatId)) {
            clearTimeout(debounceTimers.get(incoming.chatId));
        }
        debounceTimers.set(incoming.chatId, setTimeout(async () => {
            debounceTimers.delete(incoming.chatId);
            try {
                const result = await (0, chatMutex_1.runExclusive)(incoming.chatId, () => (0, webhookService_1.processAiForChat)(incoming.chatId));
                if (!result || !result.sendReply)
                    return;
                const botToken = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.BALE_BOT_TOKEN);
                if (!botToken) {
                    console.error("[webhook/bale] bale_bot_token تنظیم نشده است.");
                    return;
                }
                await (0, baleBotClient_1.sendBaleMessage)({ botToken }, result.chatId, result.displayText);
                if (result.orderConfirmed) {
                    (0, orderService_1.completeOrder)(result.conversationId).catch(err => console.error(`[webhook/bale] خطا در ثبت سفارش:`, err));
                }
            }
            catch (err) {
                console.error("[webhook/bale/ai] خطا در اجرای هوش مصنوعی پس از دیبانس:", err);
            }
        }, 5000)); // 5 ثانیه تاخیر برای جمع‌آوری پیام‌های کاربر
        res.status(200).json({ ok: true });
    }
    catch (err) {
        console.error("[webhook/bale] خطا در پردازش پیام ورودی:", err);
        res.status(200).json({ ok: false });
    }
});
exports.default = router;
