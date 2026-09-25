import IORedis from "ioredis";

/**
 * صف واقعی (Redis/BullMQ) کاملاً اختیاری است: اگر REDIS_URL تنظیم نشده باشد، کل
 * برنامه دقیقاً مثل قبل با تایمرهای درون‌حافظه‌ای کار می‌کند (بدون خطا، بدون نیاز
 * به Redis برای اجرای محلی/تست). فقط وقتی REDIS_URL ست شود، صف واقعی فعال می‌شود:
 *  - پاسخ‌های debounce شده در Redis ماندگارند (با ری‌استارت سرور از بین نمی‌روند)
 *  - ارسال کمپین‌های خیلی بزرگ به‌جای یک حلقه‌ی ساده، به Worker با نرخ و تلاش مجدد
 *    داخلی سپرده می‌شود
 */
export const isQueueEnabled = !!process.env.REDIS_URL;

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!isQueueEnabled) {
    throw new Error("REDIS_URL تنظیم نشده؛ getRedisConnection() نباید صدا زده شود.");
  }
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });
    connection.on("error", (err) => console.error("[redis] خطای اتصال:", err.message));
  }
  return connection;
}
