import { Router } from "express";
import { setBaleWebhook } from "../providers/baleBotClient";
import { getSetting, setSetting, SettingKeys } from "../db/settingsRepository";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/**
 * POST /admin/bale/setup-webhook
 * body (اختیاری): { webhookUrl?: string }
 * اگر webhookUrl داده نشود، از WEBHOOK_BASE_URL در .env + مسیر /webhook/bale ساخته می‌شود.
 */
router.post("/setup-webhook", async (req, res) => {
  try {
    const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
    if (!botToken) {
      return res.status(400).json({ error: "ابتدا bale_bot_token را در تنظیمات وارد کنید." });
    }

    // اگر WEBHOOK_SECRET تنظیم شده باشد، در انتهای مسیر وبهوک اضافه می‌شود تا فقط
    // درخواست‌هایی که این رمز را دارند پردازش شوند (جلوگیری از جعل پیام توسط افراد ناشناس).
    const secretSuffix = process.env.WEBHOOK_SECRET ? `/${process.env.WEBHOOK_SECRET}` : "";
    const base = req.body?.webhookUrl ?? `${process.env.WEBHOOK_BASE_URL}/webhook/bale${secretSuffix}`;
    const result = await setBaleWebhook({ botToken }, base);

    res.json({ message: "درخواست تنظیم وبهوک ارسال شد.", webhookUrl: base, baleResponse: result });
  } catch (err) {
    console.error("خطا در تنظیم وبهوک بازو:", err);
    res.status(500).json({ error: "خطا در تنظیم وبهوک. جزئیات در لاگ سرور." });
  }
});

/** ذخیره تنظیمات کلی از پنل مدیریت (توکن بازو، کلید سفیر و ...) */
router.post("/settings", asyncHandler(async (req, res) => {
  const allowedKeys = [
    SettingKeys.BALE_BOT_TOKEN,
    SettingKeys.BALE_SAFIR_KEY,
    SettingKeys.ADMIN_NOTIFY_TARGET,
    SettingKeys.ADMIN_NOTIFY_METHOD,
    SettingKeys.SMTP_HOST,
    SettingKeys.SMTP_PORT,
    SettingKeys.SMTP_USER,
    SettingKeys.SMTP_PASS,
    SettingKeys.SMTP_FROM,
    SettingKeys.ESCALATION_MESSAGE_THRESHOLD,
    SettingKeys.ESCALATION_KEYWORDS,
    SettingKeys.ESCALATION_CUSTOM_INSTRUCTIONS,
  ];
  const body = req.body ?? {};
  const updated: string[] = [];
  for (const key of allowedKeys) {
    if (typeof body[key] === "string" && body[key].trim()) {
      await setSetting(key, body[key]);
      updated.push(key);
    }
  }
  res.json({ updatedKeys: updated });
}));

export default router;
