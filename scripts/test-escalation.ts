import { checkEscalationTrigger } from "../src/utils/escalation";

function main() {
  console.log("=== تست: تشخیص ارجاع به اپراتور انسانی ===\n");
  const checks: { name: string; pass: boolean }[] = [];

  const byKeyword = checkEscalationTrigger("میشه با اپراتور صحبت کنم؟", 2);
  console.log("کلمه کلیدی:", byKeyword);
  checks.push({ name: "تشخیص با کلمه کلیدی", pass: byKeyword.shouldEscalate && byKeyword.reason === "keyword" });

  const byLimit = checkEscalationTrigger("سوال بعدی من اینه", 10, { threshold: 10 });
  console.log("رسیدن به سقف پیام:", byLimit);
  checks.push({ name: "تشخیص با سقف تعداد پیام", pass: byLimit.shouldEscalate && byLimit.reason === "message_limit" });

  const normal = checkEscalationTrigger("قیمتش چنده؟", 2, { threshold: 10 });
  console.log("پیام عادی:", normal);
  checks.push({ name: "پیام عادی escalate نمی‌شود", pass: !normal.shouldEscalate });

  const underLimit = checkEscalationTrigger("باشه ممنون", 9, { threshold: 10 });
  checks.push({ name: "یکی مانده به سقف -> escalate نمی‌شود", pass: !underLimit.shouldEscalate });

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
