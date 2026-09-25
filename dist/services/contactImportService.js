"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseExcelForPreview = parseExcelForPreview;
exports.classifyMappedRows = classifyMappedRows;
exports.applyColumnMapping = applyColumnMapping;
const XLSX = __importStar(require("xlsx"));
const phone_1 = require("../utils/phone");
/** خواندن اولین شیت اکسل و برگرداندن هدر + چند ردیف نمونه برای نگاشت دستی ستون‌ها */
function parseExcelForPreview(buffer) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
        throw new Error("فایل اکسل هیچ شیتی ندارد.");
    }
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    if (rows.length === 0) {
        throw new Error("فایل اکسل خالی است.");
    }
    const columns = rows[0].map((c) => String(c ?? "").trim());
    const dataRows = rows.slice(1).map((r) => r.map((c) => String(c ?? "").trim()));
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
/** دسته‌بندی خالص ردیف‌های نگاشت‌شده به معتبر/تکراری/نامعتبر — بدون هیچ وابستگی به دیتابیس */
function classifyMappedRows(mapped) {
    const validInputs = [];
    const seenPhones = new Set();
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
/** اعمال نگاشت ستون‌ها روی ردیف‌های خام و نرمال‌سازی شماره تلفن هر ردیف */
function applyColumnMapping(allRows, mapping) {
    return allRows.map((row) => {
        const rawPhone = row[mapping.phoneColumnIndex] ?? "";
        return {
            name: row[mapping.nameColumnIndex] ?? "",
            rawPhone,
            normalizedPhone: (0, phone_1.normalizeIranianPhone)(rawPhone),
            productCode: mapping.productCodeColumnIndex != null ? row[mapping.productCodeColumnIndex] ?? null : null,
        };
    });
}
