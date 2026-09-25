import nodemailer from "nodemailer";
import { sendBaleMessage, BaleBotConfig } from "../providers/baleBotClient";

export interface EscalationNotificationDetails {
  customerName: string;
  customerPhone: string;
  productName: string;
  reason: "keyword" | "message_limit" | "ai_failure" | "ai_requested";
  conversationSummary: string;
}

/** ساخت متن اعلان ارجاع مکالمه به اپراتور انسانی — تابع خالص، قابل تست */
export function buildEscalationNotificationText(details: EscalationNotificationDetails): string {
  const reasonText: Record<EscalationNotificationDetails["reason"], string> = {
    keyword: "کاربر درخواست صحبت با اپراتور کرد",
    message_limit: "تعداد پیام‌های رد و بدل شده زیاد شد",
    ai_failure: "هوش مصنوعی موقتاً در دسترس نیست",
    ai_requested: "خودِ هوش مصنوعی تشخیص داد باید ارجاع بدهد (احتمالاً جواب سوال را نمی‌دانست)",
  };
  return [
    "🔔 این مکالمه نیاز به پیگیری شما دارد!",
    `دلیل: ${reasonText[details.reason]}`,
    `مشتری: ${details.customerName}`,
    `شماره: ${details.customerPhone}`,
    `محصول: ${details.productName}`,
    "",
    "چند پیام آخر:",
    details.conversationSummary,
  ].join("\n");
}

export interface OrderNotificationDetails {
  customerName: string;
  customerPhone: string;
  productName: string;
  conversationSummary: string;
}

/** ساخت متن اعلان — تابع خالص، مستقل از شبکه، به‌راحتی قابل تست */
export function buildOrderNotificationText(details: OrderNotificationDetails): string {
  return [
    "🎉 سفارش جدید تایید شد!",
    `مشتری: ${details.customerName}`,
    `شماره: ${details.customerPhone}`,
    `محصول: ${details.productName}`,
    "",
    "خلاصه مکالمه:",
    details.conversationSummary,
  ].join("\n");
}

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
}

/** ساخت mail options — تابع خالص، جدا از ارسال واقعی، برای تست‌پذیری */
export function buildMailOptions(config: EmailConfig, text: string) {
  return {
    from: config.from,
    to: config.to,
    subject: "🎉 سفارش جدید در ربات فروش",
    text,
  };
}

export async function sendEmailNotification(config: EmailConfig, text: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
  await transporter.sendMail(buildMailOptions(config, text));
}

export async function sendBaleNotification(
  botConfig: BaleBotConfig,
  targetChatId: string,
  text: string
): Promise<void> {
  await sendBaleMessage(botConfig, targetChatId, text);
}
