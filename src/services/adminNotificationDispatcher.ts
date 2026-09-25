import { getSetting, SettingKeys } from "../db/settingsRepository";
import { sendEmailNotification, sendBaleNotification } from "./notificationService";

/**
 * بر اساس settings.admin_notify_method تصمیم می‌گیرد از کدام کانال (بله یا ایمیل)
 * اعلان تکمیل سفارش را برای مالک کسب‌وکار بفرستد.
 * این فایل عمداً از notificationService.ts جدا شده تا بخش خالص (ساخت متن/mail options)
 * بدون وابستگی به دیتابیس/Prisma قابل تست باشد.
 */
export async function sendAdminNotification(text: string): Promise<void> {
  const method = (await getSetting(SettingKeys.ADMIN_NOTIFY_METHOD)) || "bale";
  const target = await getSetting(SettingKeys.ADMIN_NOTIFY_TARGET);

  if (!target) {
    console.error("[notification] admin_notify_target در تنظیمات وارد نشده؛ اعلان ارسال نشد.");
    return;
  }

  if (method === "email") {
    const host = await getSetting(SettingKeys.SMTP_HOST);
    const port = await getSetting(SettingKeys.SMTP_PORT);
    const user = await getSetting(SettingKeys.SMTP_USER);
    const pass = await getSetting(SettingKeys.SMTP_PASS);
    const from = (await getSetting(SettingKeys.SMTP_FROM)) || user;

    if (!host || !port || !user || !pass) {
      console.error("[notification] تنظیمات SMTP کامل نیست (host/port/user/pass)؛ اعلان ایمیلی ارسال نشد.");
      return;
    }

    await sendEmailNotification({ host, port: Number(port), user, pass, from: from!, to: target }, text);
    return;
  }

  const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
  if (!botToken) {
    console.error("[notification] bale_bot_token در تنظیمات وارد نشده؛ اعلان ارسال نشد.");
    return;
  }
  await sendBaleNotification({ botToken }, target, text);
}
