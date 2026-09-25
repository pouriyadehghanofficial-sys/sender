/**
 * یک‌بار اجرا:  npx tsx scripts/reset-escalation.ts
 *  ۱) تنظیمات ارجاع قبلی (سقف تعداد پیام و کلمات کلیدی) را چاپ و پاک می‌کند
 *     (پیش‌فرض جدید = خاموش؛ «توضیحات آزاد برای AI» دست‌نخورده می‌ماند)
 *  ۲) همه‌ی گفتگوهای ارجاع‌شده را آزاد می‌کند تا AI دوباره جواب بدهد
 */
import { prisma } from "../src/db/client";

async function main() {
  const keys = ["escalation_message_threshold", "escalation_keywords"];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  console.log("تنظیمات ارجاع فعلی:", rows.length ? rows : "(چیزی ذخیره نشده بود)");
  await prisma.setting.deleteMany({ where: { key: { in: keys } } });

  const byReason = await prisma.conversation.groupBy({
    by: ["escalationReason"],
    where: { needsHuman: true },
    _count: { _all: true },
  });
  console.log("گفتگوهای ارجاع‌شده به تفکیک دلیل:", byReason.length ? byReason : "(هیچ)");

  const r = await prisma.conversation.updateMany({
    where: { needsHuman: true },
    data: { needsHuman: false, escalatedAt: null, escalationReason: null },
  });
  console.log(`${r.count} گفتگو آزاد شد. حالا سرور را دوباره اجرا کن.`);
}

main().finally(() => prisma.$disconnect());
