/**
 * اگر بازو دو پیام از یک کاربر را خیلی نزدیک به هم بفرستد (یا وبهوک را دوباره صدا بزند
 * قبل از اینکه پردازش قبلی تمام شود)، دو درخواست HTTP همزمان می‌توانند برای یک chatId
 * پردازش شوند و باعث race condition در تاریخچه‌ی مکالمه یا دو پاسخ به‌هم‌ریخته از AI شوند.
 * این تابع تضمین می‌کند کارهای مربوط به یک کلید (مثلاً chatId) همیشه پشت سر هم و هیچ‌وقت
 * همزمان اجرا نشوند، بدون اینکه کل سرور یا سایر کاربران را بلاک کند.
 */
const queues = new Map<string, Promise<unknown>>();

export function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn); // حتی اگر قبلی خطا داد، بعدی اجرا شود
  // یک catch بی‌صدا فقط برای جلوگیری از unhandled rejection روی زنجیره‌ی داخلی queues؛
  // خطای واقعی همچنان از طریق promise برگشتی به caller می‌رسد.
  const tail = next.catch(() => undefined);
  queues.set(key, tail);
  // وقتی صف این کلید خالی شد، ورودی Map را پاک می‌کنیم تا با ده‌ها هزار کاربر حافظه بی‌نهایت رشد نکند.
  tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return next;
}
