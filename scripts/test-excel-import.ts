import * as XLSX from "xlsx";
import { parseExcelForPreview, applyColumnMapping } from "../src/services/contactImportService";
import { normalizeIranianPhone } from "../src/utils/phone";

function buildSampleExcelBuffer(): Buffer {
  const data = [
    ["نام مشتری", "شماره تماس", "کد محصول", "یادداشت"],
    ["علی رضایی", "09123456789", "TEST-CREAM-01", "از اینستاگرام"],
    ["سارا احمدی", "+989351234567", "", "بدون کد محصول خاص"],
    ["محمد کاظمی", "شماره اشتباه", "TEST-CREAM-01", "این ردیف باید رد شود"],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function main() {
  console.log("=== تست فاز ۴: پارس اکسل + نگاشت ستون‌ها + نرمال‌سازی شماره ===\n");

  const buffer = buildSampleExcelBuffer();
  const { preview, allRows } = parseExcelForPreview(buffer);

  console.log("ستون‌های شناسایی‌شده:", preview.columns);
  console.log("تعداد ردیف داده:", preview.totalDataRows);
  console.log("نمونه ردیف‌ها:", preview.sampleRows);

  const checks: { name: string; pass: boolean }[] = [];
  checks.push({ name: "۳ ردیف داده شناسایی شد", pass: preview.totalDataRows === 3 });
  checks.push({
    name: "ستون‌ها به‌درستی خوانده شدند",
    pass: preview.columns.join(",") === "نام مشتری,شماره تماس,کد محصول,یادداشت",
  });

  const mapped = applyColumnMapping(allRows, {
    nameColumnIndex: 0,
    phoneColumnIndex: 1,
    productCodeColumnIndex: 2,
  });

  console.log("\n--- نتیجه نگاشت هر ردیف ---");
  mapped.forEach((r, i) => console.log(`ردیف ${i + 1}:`, r));

  const valid = mapped.filter((r) => r.name && r.normalizedPhone);
  const invalid = mapped.filter((r) => !r.name || !r.normalizedPhone);

  checks.push({ name: "دو ردیف معتبر (شماره درست) شناسایی شدند", pass: valid.length === 2 });
  checks.push({ name: "یک ردیف با شماره نامعتبر رد شد", pass: invalid.length === 1 });
  checks.push({
    name: "شماره 09123456789 به 989123456789 نرمال شد",
    pass: normalizeIranianPhone("09123456789") === "989123456789",
  });
  checks.push({
    name: "شماره +989351234567 به 989351234567 نرمال شد",
    pass: normalizeIranianPhone("+989351234567") === "989351234567",
  });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }

  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌های فاز ۴ پاس شدند.");
}

main();
