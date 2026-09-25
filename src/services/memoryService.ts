import { askAI } from "./aiService";
import { getContactMemory, updateContactMemory } from "../db/contactRepository";
import { recordError } from "../utils/runtimeStats";

const MAX_MEMORY_CHARS = 600;

const MEMORY_SYSTEM_PROMPT = `کارت این است که «حافظه‌ی مشتری» را برای یک فروشنده به‌روز نگه داری، نه اینکه با مشتری حرف بزنی.
یک خلاصه‌ی کوتاه (حداکثر چند جمله، فارسی، تیتروار) از نکات ماندگار و مفید درباره‌ی این مشتری بنویس؛ مثلاً:
اسمش (اگر گفته)، چه محصول/سوالی برایش مهم بوده، چه چیزهایی قبلاً به او گفته شده (تا دوباره تکرار نشود)،
ترجیحات یا اعتراض‌هایش (مثلاً قیمت برایش مهم است)، و وضعیت فعلی (مثلاً هنوز تصمیم نگرفته/سفارش داد).
فقط نکات ماندگار و کوتاه؛ گفتگوی کامل یا جزئیات بی‌اهمیت را ننویس. فقط خروجی خلاصه‌ی نهایی را بده، بدون مقدمه.`;

/**
 * بعد از هر پاسخ موفق AI صدا زده می‌شود (بدون توقف پاسخ به کاربر): خلاصه‌ی حافظه‌ی این
 * مشتری را با آخرین رد و بدل پیام به‌روز می‌کند تا در مکالمه‌های بعدی (حتی بعد از پایان
 * این مکالمه) AI بداند قبلاً چه گذشته و سلام/توضیح تکراری ندهد.
 * تمام خطاها بی‌صدا مدیریت می‌شوند تا هیچ‌وقت جریان اصلی پاسخ‌گویی را خراب نکند.
 */
export async function updateContactMemoryAsync(
  contactId: string,
  latestUserText: string,
  latestAiText: string
): Promise<void> {
  try {
    const previous = (await getContactMemory(contactId)) ?? "";
    const prompt =
      (previous ? `حافظه‌ی قبلی:\n${previous}\n\n` : "") +
      `آخرین پیام مشتری:\n${latestUserText}\n\nآخرین پاسخ فروشنده:\n${latestAiText}\n\nحافظه‌ی به‌روزشده:`;

    const updated = await askAI([{ role: "user", content: prompt }], MEMORY_SYSTEM_PROMPT);
    const trimmed = updated.trim().slice(0, MAX_MEMORY_CHARS);
    if (trimmed) await updateContactMemory(contactId, trimmed);
  } catch (err) {
    // به‌روزرسانی حافظه هیچ‌وقت نباید باعث خطا در پاسخ‌گویی اصلی شود؛ فقط لاگ می‌کنیم
    recordError("memoryUpdate", err);
    console.error(`[memory] خطا در به‌روزرسانی حافظه‌ی contactId=${contactId}:`, err);
  }
}
