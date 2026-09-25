import { prisma } from "./client";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
}

/** کلیدهای شناخته‌شده‌ی تنظیمات عمومی پروژه */
export const SettingKeys = {
  BALE_BOT_TOKEN: "bale_bot_token",
  BALE_SAFIR_KEY: "bale_safir_key",
  ADMIN_NOTIFY_TARGET: "admin_notify_target",
  ADMIN_NOTIFY_METHOD: "admin_notify_method",
  SMTP_HOST: "smtp_host",
  SMTP_PORT: "smtp_port",
  SMTP_USER: "smtp_user",
  SMTP_PASS: "smtp_pass",
  SMTP_FROM: "smtp_from",
  ESCALATION_MESSAGE_THRESHOLD: "escalation_message_threshold",
  ESCALATION_KEYWORDS: "escalation_keywords",
  ESCALATION_CUSTOM_INSTRUCTIONS: "escalation_custom_instructions",
  /** محصولی که آخرین کمپین «گزینه دوم (گوش‌به‌زنگ)» برایش شروع شده؛ وبهوک برای مخاطبِ ناشناس از آن استفاده می‌کند */
  PASSIVE_PRODUCT_ID: "passive_product_id",
  /**
   * وضعیت پاسخ‌گویی خودکار: "ai" یعنی AI به پیام‌های ورودی جواب می‌دهد، "off" یعنی فقط ذخیره می‌شوند.
   * آخرین کمپینی که شروع شود آن را تعیین می‌کند: گزینه ۱ → off، گزینه ۲ و ۳ → ai. اگر تنظیم نشده باشد "ai" است.
   */
  AUTO_REPLY_MODE: "auto_reply_mode",
} as const;
