import * as XLSX from "xlsx";
import { normalizeIranianPhone } from "../utils/phone";

export interface ParsedExcelPreview {
  columns: string[];
  sampleRows: string[][];
  totalDataRows: number;
}

/** خواندن اولین شیت اکسل و برگرداندن هدر + چند ردیف نمونه برای نگاشت دستی ستون‌ها */
export function parseExcelForPreview(buffer: Buffer): { preview: ParsedExcelPreview; allRows: string[][] } {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("فایل اکسل هیچ شیتی ندارد.");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

  if (rows.length === 0) {
    throw new Error("فایل اکسل خالی است.");
  }

  const columns = (rows[0] as unknown[]).map((c) => String(c ?? "").trim());
  const dataRows = rows.slice(1).map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()));
  // حذف ردیف‌های کاملاً خالی
  const nonEmptyRows = dataRows.filter((r) => r.some((cell) => cell !== ""));

  return {
    preview: {
      columns,
      sampleRows: nonEmptyRows.slice(0, 5),
      totalDataRows: nonEmptyRows.length,
    },
    allRows: nonEmptyRows,
  };
}

export interface ClassifiedImportResult {
  validInputs: { name: string; phone: string; productCode?: string | null }[];
  imported: number;
  duplicates: number;
  invalid: number;
}

/** دسته‌بندی خالص ردیف‌های نگاشت‌شده به معتبر/تکراری/نامعتبر — بدون هیچ وابستگی به دیتابیس */
export function classifyMappedRows(mapped: MappedContactRow[]): ClassifiedImportResult {
  const validInputs: ClassifiedImportResult["validInputs"] = [];
  const seenPhones = new Set<string>();
  let duplicates = 0;
  let invalid = 0;

  for (const row of mapped) {
    if (!row.name || !row.normalizedPhone) {
      invalid++;
      continue;
    }
    if (seenPhones.has(row.normalizedPhone)) {
      duplicates++;
      continue;
    }
    seenPhones.add(row.normalizedPhone);
    validInputs.push({ name: row.name, phone: row.normalizedPhone, productCode: row.productCode });
  }

  return { validInputs, imported: validInputs.length, duplicates, invalid };
}

export interface ColumnMapping {
  nameColumnIndex: number;
  phoneColumnIndex: number;
  productCodeColumnIndex?: number | null;
}

export interface MappedContactRow {
  name: string;
  rawPhone: string;
  normalizedPhone: string | null;
  productCode?: string | null;
}

/** اعمال نگاشت ستون‌ها روی ردیف‌های خام و نرمال‌سازی شماره تلفن هر ردیف */
export function applyColumnMapping(allRows: string[][], mapping: ColumnMapping): MappedContactRow[] {
  return allRows.map((row) => {
    const rawPhone = row[mapping.phoneColumnIndex] ?? "";
    return {
      name: row[mapping.nameColumnIndex] ?? "",
      rawPhone,
      normalizedPhone: normalizeIranianPhone(rawPhone),
      productCode:
        mapping.productCodeColumnIndex != null ? row[mapping.productCodeColumnIndex] ?? null : null,
    };
  });
}
