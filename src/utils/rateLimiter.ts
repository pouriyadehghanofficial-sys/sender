/**
 * جلوگیری از اینکه یک کاربر (یا یک اسکریپت مخرب که وانمود می‌کند بازوست) با ارسال
 * پیام‌های پشت‌سرهم، باعث صدها فراخوانی گران‌قیمت AI یا قطعی سرویس شود.
 * پنجره‌ی لغزان ساده: حداکثر maxCalls بار در windowMs میلی‌ثانیه برای هر کلید.
 */
const callTimestamps = new Map<string, number[]>();

export function isRateLimited(key: string, maxCalls: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = callTimestamps.get(key) ?? [];
  const withinWindow = existing.filter((t) => now - t < windowMs);

  if (withinWindow.length >= maxCalls) {
    callTimestamps.set(key, withinWindow);
    return true;
  }

  withinWindow.push(now);
  callTimestamps.set(key, withinWindow);
  return false;
}
