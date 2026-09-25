/**
 * آمار زنده‌ی درون‌حافظه‌ای (از لحظه‌ی روشن شدن سرور) برای عیب‌یابی پاسخ‌گویی:
 * پنل با آن نشان می‌دهد پیام از بله رسیده یا نه، آخرین پاسخ کی ارسال شد و آخرین خطا چه بود.
 */
export const runtimeStats = {
  startedAt: new Date(),
  webhookReceived: 0,
  webhookRejectedSecret: 0,
  webhookUnparsable: 0,
  messagesSaved: 0,
  lastWebhookAt: null as Date | null,
  repliesSent: 0,
  lastReplyAt: null as Date | null,
  lastSkip: null as { chatId: string; reason: string; at: Date } | null,
  lastError: null as { where: string; message: string; at: Date } | null,
};

export function recordError(where: string, err: unknown) {
  const anyErr = err as any;
  const detail = anyErr?.response?.data ? JSON.stringify(anyErr.response.data) : anyErr?.message ?? String(err);
  runtimeStats.lastError = { where, message: String(detail).slice(0, 400), at: new Date() };
}

export function recordSkip(chatId: string, reason: string) {
  runtimeStats.lastSkip = { chatId, reason, at: new Date() };
}
