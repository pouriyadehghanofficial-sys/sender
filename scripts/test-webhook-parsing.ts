import { parseIncomingBaleWebhook } from "../src/services/baleWebhookParser";
import { detectAndStripOrderConfirmed } from "../src/utils/orderTag";

function main() {
  console.log("=== تست فاز ۶ (بخش ۱): پارسر webhook + تگ سفارش ===\n");
  const checks: { name: string; pass: boolean }[] = [];

  // --- تست پارسر webhook ---
  const samplePayload = {
    update_id: 12345,
    message: {
      message_id: 999,
      from: { id: 55555, first_name: "علی" },
      chat: { id: 55555, type: "private" },
      date: 1700000000,
      text: "این محصول چند تومنه؟",
    },
  };

  const parsed = parseIncomingBaleWebhook(samplePayload);
  console.log("payload تجزیه‌شده:", parsed);
  checks.push({ name: "chatId درست استخراج شد", pass: parsed?.chatId === "55555" });
  checks.push({ name: "text درست استخراج شد", pass: parsed?.text === "این محصول چند تومنه؟" });
  checks.push({ name: "externalMessageId شامل message_id است", pass: !!parsed?.externalMessageId.includes("999") });
  checks.push({ name: "senderName استخراج شد", pass: parsed?.senderName === "علی" });

  const emptyParsed = parseIncomingBaleWebhook({ foo: "bar" });
  checks.push({ name: "payload نامعتبر -> null برمی‌گرداند", pass: emptyParsed === null });

  // --- تست تگ سفارش ---
  const withTag = detectAndStripOrderConfirmed(
    "بله سفارش شما ثبت شد، ممنون از خرید.\n[ORDER_CONFIRMED]"
  );
  console.log("\nنتیجه تشخیص تگ (وجود دارد):", withTag);
  checks.push({ name: "تگ تشخیص داده شد", pass: withTag.orderConfirmed === true });
  checks.push({ name: "تگ از متن نمایشی حذف شد", pass: !withTag.displayText.includes("[ORDER_CONFIRMED]") });

  const withoutTag = detectAndStripOrderConfirmed("قیمت این محصول ۲۵۰ هزار تومان است.");
  console.log("نتیجه تشخیص تگ (وجود ندارد):", withoutTag);
  checks.push({ name: "بدون تگ -> orderConfirmed=false", pass: withoutTag.orderConfirmed === false });
  checks.push({ name: "متن بدون تگ دست‌نخورده می‌ماند", pass: withoutTag.displayText === "قیمت این محصول ۲۵۰ هزار تومان است." });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌های بخش ۱ پاس شدند.");
}

main();
