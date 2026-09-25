import { listActivePromptVariants } from "../db/promptVariantRepository";

export interface SelectableVariant {
  id: string;
  name: string;
  descriptionText: string;
  weight: number;
}

/** انتخاب تصادفی وزن‌دار از بین نسخه‌های فعال؛ خالص و قابل تست بدون دیتابیس */
export function pickWeightedVariant<T extends { weight: number }>(variants: T[]): T | null {
  const active = variants.filter((v) => v.weight > 0);
  if (active.length === 0) return null;
  const total = active.reduce((sum, v) => sum + v.weight, 0);
  let r = Math.random() * total;
  for (const v of active) {
    r -= v.weight;
    if (r <= 0) return v;
  }
  return active[active.length - 1];
}

/**
 * برای یک مکالمه‌ی تازه‌ساز: اگر محصول نسخه‌ی(های) فعال A/B داشته باشد، یکی را (وزن‌دار)
 * انتخاب می‌کند؛ در غیر این صورت null برمی‌گرداند تا از پرامپت پیش‌فرض محصول استفاده شود.
 * فقط یک‌بار (در لحظه‌ی ساخت مکالمه) باید صدا زده شود تا همان مشتری در طول مکالمه
 * همیشه یک نسخه‌ی ثابت را ببیند (نه هر پیام یک نسخه‌ی تصادفی جدید).
 */
export async function selectPromptVariantForNewConversation(productId: string): Promise<SelectableVariant | null> {
  const variants = await listActivePromptVariants(productId);
  return pickWeightedVariant<SelectableVariant>(variants as unknown as SelectableVariant[]);
}
