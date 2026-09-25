import { Router } from "express";
import multer from "multer";
import { parseExcelForPreview, applyColumnMapping, classifyMappedRows } from "../../services/contactImportService";
import { createContactsBulk, countContactsForUser } from "../../db/contactRepository";
import { getProductAccessibleByUser, getProductByShortCode } from "../../db/productRepository";
import { logActivity } from "../../db/activityLogRepository";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
router.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "فایل اکسل (فیلد file) ارسال نشده است." });
    }

    let productId: string | null = null;
    if (req.body?.productId) {
      const product = await getProductAccessibleByUser(req.body.productId, req.auth!.userId);
      if (!product) return res.status(400).json({ error: "productId نامعتبر است یا متعلق به شما نیست." });
      productId = product.id;
    } else if (req.body?.productCode) {
      const product = await getProductByShortCode(req.body.productCode);
      if (product && (product.userId === req.auth!.userId || product.userId === null)) {
        productId = product.id;
      }
    }

    let allRows: string[][];
    let columns: string[];
    try {
      const parsed = parseExcelForPreview(req.file.buffer);
      allRows = parsed.allRows;
      columns = parsed.preview.columns;
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message || "فایل اکسل قابل خواندن نبود." });
    }

    // حدس خودکار ستون نام/شماره از روی سرنویس‌های رایج فارسی/انگلیسی
    const phoneHeaderGuess = ["phone", "mobile", "شماره", "موبایل", "تلفن"];
    const nameHeaderGuess = ["name", "نام", "مشتری", "customer"];

    function guessColumnIndex(candidates: string[]): number {
      const idx = columns.findIndex((c) => candidates.some((k) => c.toLowerCase().includes(k)));
      return idx >= 0 ? idx : -1;
    }

    let phoneColumnIndex = Number(req.body?.phoneColumnIndex);
    if (!Number.isInteger(phoneColumnIndex)) phoneColumnIndex = guessColumnIndex(phoneHeaderGuess);
    let nameColumnIndex = Number(req.body?.nameColumnIndex);
    if (!Number.isInteger(nameColumnIndex)) nameColumnIndex = guessColumnIndex(nameHeaderGuess);

    if (phoneColumnIndex < 0 || nameColumnIndex < 0) {
      return res.status(400).json({
        error: "نتوانستیم ستون نام/شماره را خودکار تشخیص دهیم. nameColumnIndex و phoneColumnIndex را صریح بفرستید.",
        columns,
      });
    }

    const mapped = applyColumnMapping(allRows, { nameColumnIndex, phoneColumnIndex });
    const classified = classifyMappedRows(mapped);

    const validInputs = classified.validInputs.map((v) => ({
      name: v.name,
      phone: v.phone,
      productId,
      userId: req.auth!.userId,
    }));

    if (validInputs.length > 0) {
      await createContactsBulk(validInputs);
    }

    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
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
      totalContactsNow: await countContactsForUser(req.auth!.userId),
    });
  })
);

export default router;
