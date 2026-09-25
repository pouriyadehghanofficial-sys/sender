import { applyColumnMapping, classifyMappedRows } from "../src/services/contactImportService";

function main() {
  console.log("=== تست: دسته‌بندی import مخاطبین (API v1، بخش ۴) ===\n");

  const rows = [
    ["علی رضایی", "09123456789"],
    ["سارا احمدی", "09123456789"], // شماره تکراری با ردیف بالا
    ["", "09351234567"], // نام خالی -> نامعتبر
    ["محمد کاظمی", "شماره اشتباه"], // شماره نامعتبر
    ["نیلوفر", "09121112233"],
    ["نیلوفر (دوباره)", "09121112233"], // تکراری دیگر
  ];

  const mapped = applyColumnMapping(rows, { nameColumnIndex: 0, phoneColumnIndex: 1 });
  const result = classifyMappedRows(mapped);

  console.log("نتیجه دسته‌بندی:", result);

  const checks: { name: string; pass: boolean }[] = [
    { name: "۲ مخاطب معتبر و یکتا شناسایی شدند", pass: result.imported === 2 },
    { name: "۲ ردیف تکراری شناسایی شدند", pass: result.duplicates === 2 },
    { name: "۲ ردیف نامعتبر شناسایی شدند", pass: result.invalid === 2 },
    { name: "مجموع = تعداد کل ردیف‌ها", pass: result.imported + result.duplicates + result.invalid === rows.length },
    { name: "شماره‌های معتبر نرمال‌سازی شدند", pass: result.validInputs.every((v) => v.phone.startsWith("98")) },
  ];

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
