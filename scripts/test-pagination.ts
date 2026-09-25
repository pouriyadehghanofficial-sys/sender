import { parsePagination, buildPaginatedResult } from "../src/utils/pagination";

function main() {
  console.log("=== تست: ابزار صفحه‌بندی ===\n");
  const checks: { name: string; pass: boolean }[] = [];

  const defaults = parsePagination({});
  checks.push({ name: "پیش‌فرض: page=1, pageSize=20", pass: defaults.page === 1 && defaults.pageSize === 20 });

  const custom = parsePagination({ page: "3", pageSize: "10" });
  checks.push({ name: "page=3 pageSize=10 -> skip=20 take=10", pass: custom.skip === 20 && custom.take === 10 });

  const negative = parsePagination({ page: "-5", pageSize: "-10" });
  checks.push({ name: "مقادیر منفی -> برمی‌گردد به پیش‌فرض امن", pass: negative.page === 1 && negative.pageSize === 20 });

  const tooLarge = parsePagination({ pageSize: "99999" });
  checks.push({ name: "pageSize خیلی بزرگ -> سقف ۱۰۰", pass: tooLarge.pageSize === 100 });

  const result = buildPaginatedResult(["a", "b"], 45, { page: 2, pageSize: 20, skip: 20, take: 20 });
  console.log("نتیجه صفحه‌بندی نمونه:", result);
  checks.push({ name: "totalPages درست محاسبه شد (45/20 -> 3)", pass: result.totalPages === 3 });
  checks.push({ name: "page و pageSize در خروجی حفظ شدند", pass: result.page === 2 && result.pageSize === 20 });

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
