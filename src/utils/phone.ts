/**
 * نرمال‌سازی شماره موبایل ایران به فرمت بین‌المللی بدون علامت + برای سفیر بله: 98912xxxxxxx
 * ورودی‌های پشتیبانی‌شده:
 *   09123456789   -> 989123456789
 *   9123456789    -> 989123456789
 *   00989123456789-> 989123456789
 *   +989123456789 -> 989123456789
 *   989123456789  -> 989123456789 (بدون تغییر)
 * اگر فرمت قابل تشخیص نباشد، null برمی‌گرداند تا در فاز آپلود به کاربر خطا نمایش داده شود.
 */
export function normalizeIranianPhone(raw: string): string | null {
  if (!raw) return null;

  // حذف فاصله، خط تیره، پرانتز و تبدیل ارقام فارسی/عربی به انگلیسی
  const digitsMap: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  let cleaned = String(raw)
    .trim()
    .split("")
    .map((ch) => digitsMap[ch] ?? ch)
    .join("")
    .replace(/[\s\-()]/g, "");

  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("0098")) cleaned = cleaned.slice(2); // 0098xxx -> 98xxx
  if (cleaned.startsWith("00")) cleaned = cleaned.slice(2);

  if (!/^\d+$/.test(cleaned)) return null;

  if (cleaned.startsWith("98") && cleaned.length === 12) {
    return cleaned;
  }
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    return "98" + cleaned.slice(1);
  }
  if (cleaned.length === 10 && cleaned.startsWith("9")) {
    return "98" + cleaned;
  }

  return null;
}
