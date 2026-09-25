"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const contactImportService_1 = require("../services/contactImportService");
const uploadCache_1 = require("../services/uploadCache");
const contactRepository_1 = require("../db/contactRepository");
const productRepository_1 = require("../db/productRepository");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
/**
 * مرحله ۱: POST /admin/contacts/upload
 * فایل اکسل را می‌گیرد، هدر ستون‌ها و چند ردیف نمونه را برمی‌گرداند تا کاربر
 * ستون نام/شماره/کد محصول را دستی نگاشت کند. ردیف‌ها فعلاً در هیچ جدولی درج نمی‌شوند.
 */
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "فایل اکسل (فیلد file) ارسال نشده است." });
        }
        const { preview, allRows } = (0, contactImportService_1.parseExcelForPreview)(req.file.buffer);
        const uploadToken = (0, uploadCache_1.storeUploadPreview)(preview.columns, allRows);
        res.json({
            uploadToken,
            columns: preview.columns,
            sampleRows: preview.sampleRows,
            totalDataRows: preview.totalDataRows,
            message: "فایل با موفقیت خوانده شد. حالا ستون‌ها را نگاشت کرده و /admin/contacts/import را صدا بزنید.",
        });
    }
    catch (err) {
        console.error("خطا در پردازش فایل اکسل:", err);
        res.status(400).json({ error: err.message || "خطا در خواندن فایل اکسل." });
    }
});
/**
 * مرحله ۲: POST /admin/contacts/import
 * body: {
 *   uploadToken: string,
 *   defaultProductId?: string,        // محصول پیش‌فرض برای همه ردیف‌ها
 *   mapping: {
 *     nameColumnIndex: number,
 *     phoneColumnIndex: number,
 *     productCodeColumnIndex?: number // اختیاری: ستونی که کد محصول هر ردیف را دارد
 *   }
 * }
 */
router.post("/import", async (req, res) => {
    try {
        const { uploadToken, defaultProductId, mapping } = req.body ?? {};
        if (!uploadToken || typeof uploadToken !== "string") {
            return res.status(400).json({ error: "uploadToken الزامی است." });
        }
        if (!mapping || typeof mapping.nameColumnIndex !== "number" || typeof mapping.phoneColumnIndex !== "number") {
            return res
                .status(400)
                .json({ error: "mapping.nameColumnIndex و mapping.phoneColumnIndex باید عدد باشند." });
        }
        const cached = (0, uploadCache_1.getUploadPreview)(uploadToken);
        if (!cached) {
            return res.status(410).json({ error: "این uploadToken منقضی شده یا نامعتبر است. دوباره آپلود کنید." });
        }
        if (defaultProductId) {
            const product = await (0, productRepository_1.getProductById)(defaultProductId);
            if (!product)
                return res.status(400).json({ error: "defaultProductId نامعتبر است." });
        }
        const mappedRows = (0, contactImportService_1.applyColumnMapping)(cached.allRows, {
            nameColumnIndex: mapping.nameColumnIndex,
            phoneColumnIndex: mapping.phoneColumnIndex,
            productCodeColumnIndex: mapping.productCodeColumnIndex ?? null,
        });
        // کش کوچک برای جلوگیری از کوئری تکراری short_code های یکسان
        const productCodeCache = new Map();
        async function resolveProductId(code) {
            if (!code)
                return defaultProductId ?? null;
            if (productCodeCache.has(code))
                return productCodeCache.get(code);
            const product = await (0, productRepository_1.getProductByShortCode)(code);
            const resolved = product?.id ?? defaultProductId ?? null;
            productCodeCache.set(code, resolved);
            return resolved;
        }
        const validInputs = [];
        const invalidRows = [];
        for (let i = 0; i < mappedRows.length; i++) {
            const r = mappedRows[i];
            if (!r.name) {
                invalidRows.push({ row: i + 2, reason: "نام خالی است" }); // +2 چون ردیف ۱ هدر است
                continue;
            }
            if (!r.normalizedPhone) {
                invalidRows.push({ row: i + 2, reason: `شماره «${r.rawPhone}» قابل نرمال‌سازی نیست` });
                continue;
            }
            const productId = await resolveProductId(r.productCode);
            validInputs.push({ name: r.name, phone: r.normalizedPhone, productId });
        }
        if (validInputs.length > 0) {
            await (0, contactRepository_1.createContactsBulk)(validInputs);
        }
        (0, uploadCache_1.deleteUploadPreview)(uploadToken);
        res.status(201).json({
            insertedCount: validInputs.length,
            skippedCount: invalidRows.length,
            skippedRows: invalidRows,
        });
    }
    catch (err) {
        console.error("خطا در import مخاطبین:", err);
        res.status(500).json({ error: "خطای داخلی سرور در ثبت مخاطبین." });
    }
});
exports.default = router;
