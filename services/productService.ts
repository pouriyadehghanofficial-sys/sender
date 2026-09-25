export interface ProductForPrompt {
  name: string;
  descriptionText: string;
}

/**
 * ساخت system prompt.
 *
 * برخلاف نسخه‌ی قبلی، اینجا هیچ پرسونا/لحن/قانون ثابتی روی متن تو اضافه نمی‌شود.
 * هرچه در «توضیحات محصول» بنویسی — چه فقط مشخصات خام باشد، چه یک پرامپت کامل با
 * اسم، پرسونا، لحن و قوانین (مثل قانون «قیمت را نگو مگر بپرسد») — دقیقاً همان،
 * بدون رقیب و بدون رقیق شدن، به مدل داده می‌شود. فقط یک بخش فنی کوتاه برای دو
 * تگ مخفی سیستم اضافه می‌شود که بدون آن‌ها ثبت سفارش و ارجاع کار نمی‌کند.
 */
export function buildSystemPrompt(product: ProductForPrompt, escalationInstructions?: string): string {
  const ownerConditions = escalationInstructions?.trim();

  const escalationRule = ownerConditions
    ? `اگر یکی از این شرایط رخ داد، مودبانه بگو موضوع را با همکاران در میان می‌گذاری و دقیقاً این عبارت را در انتهای همان پاسخ بنویس: [NEEDS_HUMAN]\nشرایط ارجاع: ${ownerConditions}\nدر هیچ حالت دیگری این تگ را ننویس.`
    : `تگ [NEEDS_HUMAN] را در هیچ حالتی ننویس؛ خودت تا آخر مکالمه را پیش ببر.`;

  return `${product.descriptionText}

---
(راهنمای فنی سیستم — بخشی از پاسخ نیست و به مشتری نشان داده نمی‌شود)
اگر مشتری تصمیم قطعی به خرید گرفت و جزئیات لازم سفارش را تایید کرد، دقیقاً این عبارت را در انتهای پاسخت اضافه کن: [ORDER_CONFIRMED]
${escalationRule}
این دو تگ را فقط در انتهای پاسخ بنویس و در متنی که مشتری می‌بیند توضیحی درباره‌شان نده.`;
}
