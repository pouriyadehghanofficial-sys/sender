/**
 * پیش‌فرض‌ها «خاموش» هستند: فقط شرایطی که مالک خودش در پنل تعیین کند باعث ارجاع می‌شود.
 *  - سقف تعداد پیام: 0 یعنی غیرفعال
 *  - کلمات کلیدی: خالی یعنی غیرفعال
 */
export const DEFAULT_ESCALATION_THRESHOLD = 0;
export const DEFAULT_ESCALATION_KEYWORDS: string[] = [];

export interface EscalationCheckResult {
  shouldEscalate: boolean;
  reason: "keyword" | "message_limit" | null;
  matchedKeyword?: string;
}

/**
 * تشخیص می‌دهد آیا مکالمه باید به اپراتور انسانی ارجاع شود یا نه.
 * دو محرک دارد (هر دو فقط اگر مالک تنظیمشان کرده باشد):
 *  ۱) کاربر یکی از کلمات کلیدیِ تعیین‌شده را گفته باشد
 *  ۲) تعداد نوبت‌های کاربر به سقف تعیین‌شده رسیده باشد (threshold > 0)
 * تابع خالص است (بدون وابستگی به دیتابیس یا شبکه) تا به‌راحتی تست شود.
 */
export function checkEscalationTrigger(
  latestUserMessage: string,
  userMessageCountInConversation: number,
  options?: { keywords?: string[]; threshold?: number }
): EscalationCheckResult {
  const keywords = options?.keywords ?? DEFAULT_ESCALATION_KEYWORDS;
  const threshold = options?.threshold ?? DEFAULT_ESCALATION_THRESHOLD;

  const normalized = latestUserMessage.toLowerCase();
  const matched = keywords.find((k) => k.trim() && normalized.includes(k.trim().toLowerCase()));
  if (matched) {
    return { shouldEscalate: true, reason: "keyword", matchedKeyword: matched };
  }

  if (threshold > 0 && userMessageCountInConversation >= threshold) {
    return { shouldEscalate: true, reason: "message_limit" };
  }

  return { shouldEscalate: false, reason: null };
}
