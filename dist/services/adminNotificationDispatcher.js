"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAdminNotification = sendAdminNotification;
const settingsRepository_1 = require("../db/settingsRepository");
const notificationService_1 = require("./notificationService");
/**
 * بر اساس settings.admin_notify_method تصمیم می‌گیرد از کدام کانال (بله یا ایمیل)
 * اعلان تکمیل سفارش را برای مالک کسب‌وکار بفرستد.
 * این فایل عمداً از notificationService.ts جدا شده تا بخش خالص (ساخت متن/mail options)
 * بدون وابستگی به دیتابیس/Prisma قابل تست باشد.
 */
async function sendAdminNotification(text) {
    const method = (await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.ADMIN_NOTIFY_METHOD)) || "bale";
    const target = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.ADMIN_NOTIFY_TARGET);
    if (!target) {
        console.error("[notification] admin_notify_target در تنظیمات وارد نشده؛ اعلان ارسال نشد.");
        return;
    }
    if (method === "email") {
        const host = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.SMTP_HOST);
        const port = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.SMTP_PORT);
        const user = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.SMTP_USER);
        const pass = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.SMTP_PASS);
        const from = (await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.SMTP_FROM)) || user;
        if (!host || !port || !user || !pass) {
            console.error("[notification] تنظیمات SMTP کامل نیست (host/port/user/pass)؛ اعلان ایمیلی ارسال نشد.");
            return;
        }
        await (0, notificationService_1.sendEmailNotification)({ host, port: Number(port), user, pass, from: from, to: target }, text);
        return;
    }
    const botToken = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.BALE_BOT_TOKEN);
    if (!botToken) {
        console.error("[notification] bale_bot_token در تنظیمات وارد نشده؛ اعلان ارسال نشد.");
        return;
    }
    await (0, notificationService_1.sendBaleNotification)({ botToken }, target, text);
}
