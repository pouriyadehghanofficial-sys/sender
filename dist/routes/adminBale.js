"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const baleBotClient_1 = require("../providers/baleBotClient");
const settingsRepository_1 = require("../db/settingsRepository");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
/**
 * POST /admin/bale/setup-webhook
 * body (اختیاری): { webhookUrl?: string }
 * اگر webhookUrl داده نشود، از WEBHOOK_BASE_URL در .env + مسیر /webhook/bale ساخته می‌شود.
 */
router.post("/setup-webhook", async (req, res) => {
    try {
        const botToken = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.BALE_BOT_TOKEN);
        if (!botToken) {
            return res.status(400).json({ error: "ابتدا bale_bot_token را در تنظیمات وارد کنید." });
        }
        // اگر WEBHOOK_SECRET تنظیم شده باشد، در انتهای مسیر وبهوک اضافه می‌شود تا فقط
        // درخواست‌هایی که این رمز را دارند پردازش شوند (جلوگیری از جعل پیام توسط افراد ناشناس).
        const secretSuffix = process.env.WEBHOOK_SECRET ? `/${process.env.WEBHOOK_SECRET}` : "";
        const base = req.body?.webhookUrl ?? `${process.env.WEBHOOK_BASE_URL}/webhook/bale${secretSuffix}`;
        const result = await (0, baleBotClient_1.setBaleWebhook)({ botToken }, base);
        res.json({ message: "درخواست تنظیم وبهوک ارسال شد.", webhookUrl: base, baleResponse: result });
    }
    catch (err) {
        console.error("خطا در تنظیم وبهوک بازو:", err);
        res.status(500).json({ error: "خطا در تنظیم وبهوک. جزئیات در لاگ سرور." });
    }
});
/** ذخیره تنظیمات کلی از پنل مدیریت (توکن بازو، کلید سفیر و ...) */
router.post("/settings", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const allowedKeys = [
        settingsRepository_1.SettingKeys.BALE_BOT_TOKEN,
        settingsRepository_1.SettingKeys.BALE_SAFIR_KEY,
        settingsRepository_1.SettingKeys.ADMIN_NOTIFY_TARGET,
        settingsRepository_1.SettingKeys.ADMIN_NOTIFY_METHOD,
        settingsRepository_1.SettingKeys.SMTP_HOST,
        settingsRepository_1.SettingKeys.SMTP_PORT,
        settingsRepository_1.SettingKeys.SMTP_USER,
        settingsRepository_1.SettingKeys.SMTP_PASS,
        settingsRepository_1.SettingKeys.SMTP_FROM,
        settingsRepository_1.SettingKeys.ESCALATION_MESSAGE_THRESHOLD,
        settingsRepository_1.SettingKeys.ESCALATION_KEYWORDS,
        settingsRepository_1.SettingKeys.ESCALATION_CUSTOM_INSTRUCTIONS,
    ];
    const body = req.body ?? {};
    const updated = [];
    for (const key of allowedKeys) {
        if (typeof body[key] === "string" && body[key].trim()) {
            await (0, settingsRepository_1.setSetting)(key, body[key]);
            updated.push(key);
        }
    }
    res.json({ updatedKeys: updated });
}));
exports.default = router;
