export interface IncomingBaleMessage {
  chatId: string;
  text: string;
  externalMessageId: string;
  senderName?: string;
}

/**
 * ⚠️ ساختار دقیق webhook بازو در این پروژه مستند نشده بود (docs.bale.ai در دسترس نبود).
 * Bale Bot API از الگوی `tapi.bale.ai/bot<TOKEN>/...` استفاده می‌کند که شبیه Telegram Bot API
 * است، پس این تابع بر همان اساس (update.message.{chat,from,text,message_id}) نوشته شده.
 * قبل از اتصال واقعی: یک پیام تستی بفرستید، payload خام را لاگ بگیرید (خط
 * `console.log(JSON.stringify(req.body))` در routes/webhookBale.ts از قبل هست) و در صورت
 * تفاوت فیلدها، همین‌جا اصلاح کنید.
 */
export function parseIncomingBaleWebhook(payload: unknown): IncomingBaleMessage | null {
  const body = payload as any;
  const message = body?.message ?? body?.update?.message ?? body?.result?.message;
  if (!message) return null;

  const chatId = message.chat?.id ?? message.from?.id;
  const text: string | undefined = message.text ?? message.caption;
  const messageId = message.message_id ?? message.id;

  if (chatId == null || !text) return null;

  return {
    chatId: String(chatId),
    text: String(text),
    externalMessageId: `bale:${chatId}:${messageId ?? Date.now()}`,
    senderName: message.from?.first_name ?? message.from?.username,
  };
}
