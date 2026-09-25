"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const contactImportService_1 = require("../../services/contactImportService");
const contactRepository_1 = require("../../db/contactRepository");
const productRepository_1 = require("../../db/productRepository");
const activityLogRepository_1 = require("../../db/activityLogRepository");
const asyncHandler_1 = require("../../utils/asyncHandler");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
/**
 * POST /api/v1/contacts/import
 * multipart/form-data:
 *   - file: فایل اکسل (.xlsx/.xls)
 *   - nameColumn, phoneColumn: نام دقیق ستون‌ها (یا اندیس عددی) — پیش‌فرض حدس زده می‌شود
 *   - productId: اختیاری
 * برخلاف نسخه‌ی دو-مرحله‌ای پنل قدیمی (upload+import جدا)، این endpoint برای
 * مصرف برنامه‌نویسی (بخش ۴ سند) یک‌مرحله‌ای است: ستون‌ها را خودکار حدس می‌زند
 * (اولین ستونی که شبیه شماره تلفن است = phone، بعدی‌ترین متن = name).
 */
router.post("/import", upload.single("file"), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "فایل اکسل (فیلد file) ارسال نشده است." });
    }
    let productId = null;
    if (req.body?.productId) {
        const product = await (0, productRepository_1.getProductAccessibleByUser)(req.body.productId, req.auth.userId);
        if (!product)
            return res.status(400).json({ error: "productId نامعتبر است یا متعلق به شما نیست." });
        productId = product.id;
    }
    else if (req.body?.productCode) {
        const product = await (0, productRepository_1.getProductByShortCode)(req.body.productCode);
        if (product && (product.userId === req.auth.userId || product.userId === null)) {
            productId = product.id;
        }
    }
    let allRows;
    let columns;
    try {
        const parsed = (0, contactImportService_1.parseExcelForPreview)(req.file.buffer);
        allRows = parsed.allRows;
        columns = parsed.preview.columns;
    }
    catch (err) {
        return res.status(400).json({ error: err.message || "فایل اکسل قابل خواندن نبود." });
    }
    // حدس خودکار ستون نام/شماره از روی سرنویس‌های رایج فارسی/انگلیسی
    const phoneHeaderGuess = ["phone", "mobile", "شماره", "موبایل", "تلفن"];
    const nameHeaderGuess = ["name", "نام", "مشتری", "customer"];
    function guessColumnIndex(candidates) {
        const idx = columns.findIndex((c) => candidates.some((k) => c.toLowerCase().includes(k)));
        return idx >= 0 ? idx : -1;
    }
    let phoneColumnIndex = Number(req.body?.phoneColumnIndex);
    if (!Number.isInteger(phoneColumnIndex))
        phoneColumnIndex = guessColumnIndex(phoneHeaderGuess);
    let nameColumnIndex = Number(req.body?.nameColumnIndex);
    if (!Number.isInteger(nameColumnIndex))
        nameColumnIndex = guessColumnIndex(nameHeaderGuess);
    if (phoneColumnIndex < 0 || nameColumnIndex < 0) {
        return res.status(400).json({
            error: "نتوانستیم ستون نام/شماره را خودکار تشخیص دهیم. nameColumnIndex و phoneColumnIndex را صریح بفرستید.",
            columns,
        });
    }
    const mapped = (0, contactImportService_1.applyColumnMapping)(allRows, { nameColumnIndex, phoneColumnIndex });
    const classified = (0, contactImportService_1.classifyMappedRows)(mapped);
    const validInputs = classified.validInputs.map((v) => ({
        name: v.name,
        phone: v.phone,
        productId,
        userId: req.auth.userId,
    }));
    if (validInputs.length > 0) {
        await (0, contactRepository_1.createContactsBulk)(validInputs);
    }
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "contacts_imported",
        resourceType: "contact_import",
        metadata: { totalRows: allRows.length, imported: classified.imported, duplicates: classified.duplicates, invalid: classified.invalid, productId },
    });
    res.status(201).json({
        totalRows: allRows.length,
        imported: classified.imported,
        duplicates: classified.duplicates,
        invalid: classified.invalid,
        failed: 0,
        totalContactsNow: await (0, contactRepository_1.countContactsForUser)(req.auth.userId),
    });
}));
exports.default = router;
