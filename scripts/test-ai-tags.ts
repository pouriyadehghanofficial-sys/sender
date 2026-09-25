import { parseAiResponseTags, detectAndStripOrderConfirmed } from "../src/utils/orderTag";
import { parseModelList } from "../src/utils/modelList";

function main() {
  console.log("=== تست: تگ [NEEDS_HUMAN] + سازگاری با [ORDER_CONFIRMED] + parseModelList ===\n");
  const checks: { name: string; pass: boolean }[] = [];

  // --- سناریوی دقیقاً همان چیزی که کاربر گزارش داد: AI می‌گوید «از فروشنده می‌پرسم» ---
  const aiSaysWillAsk = "این سوال رو باید از فروشنده بپرسم تا مطمئن بشم درست جواب می‌دم.\n[NEEDS_HUMAN]";
  const tags1 = parseAiResponseTags(aiSaysWillAsk);
  console.log("سناریوی «از فروشنده می‌پرسم»:", tags1);
  checks.push({ name: "needsHuman=true تشخیص داده شد", pass: tags1.needsHuman === true });
  checks.push({ name: "تگ از متن نمایشی حذف شد", pass: !tags1.displayText.includes("[NEEDS_HUMAN]") });
  checks.push({ name: "orderConfirmed=false در این سناریو", pass: tags1.orderConfirmed === false });

  // --- سفارش قطعی، بدون نیاز به انسان ---
  const orderTags = parseAiResponseTags("باشه ثبت شد، ممنون از خریدتون.\n[ORDER_CONFIRMED]");
  checks.push({ name: "orderConfirmed=true وقتی فقط تگ سفارش هست", pass: orderTags.orderConfirmed === true });
  checks.push({ name: "needsHuman=false وقتی فقط تگ سفارش هست", pass: orderTags.needsHuman === false });

  // --- پیام عادی بدون هیچ تگی ---
  const normalTags = parseAiResponseTags("قیمتش ۲۵۰ هزار تومنه.");
  checks.push({ name: "بدون تگ -> هر دو false", pass: !normalTags.orderConfirmed && !normalTags.needsHuman });

  // --- سازگاری قدیمی: detectAndStripOrderConfirmed هنوز کار می‌کند ---
  const oldFn = detectAndStripOrderConfirmed("ثبت شد.\n[ORDER_CONFIRMED]");
  checks.push({ name: "تابع قدیمی detectAndStripOrderConfirmed هنوز کار می‌کند", pass: oldFn.orderConfirmed === true });

  // --- parseModelList: یک مدل ---
  const single = parseModelList("claude-sonnet-4-6");
  checks.push({ name: "یک مدل تنها -> آرایه با یک عضو", pass: single.length === 1 && single[0] === "claude-sonnet-4-6" });

  // --- parseModelList: چند مدل با کاما و فاصله‌های نامنظم ---
  const multi = parseModelList("claude-sonnet-4-6,  claude-haiku-4-5 ,claude-opus-5");
  console.log("چند مدل تجزیه‌شده:", multi);
  checks.push({ name: "۳ مدل درست تجزیه شد", pass: multi.length === 3 });
  checks.push({ name: "فاصله‌های اضافی trim شدند", pass: multi[1] === "claude-haiku-4-5" });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌ها پاس شدند.");
}

main();
