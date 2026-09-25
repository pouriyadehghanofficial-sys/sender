import { Router } from "express";
import multer from "multer";
import { parseExcelForPreview, applyColumnMapping } from "../services/contactImportService";
import { storeUploadPreview, getUploadPreview, deleteUploadPreview } from "../services/uploadCache";
import { createContactsBulk, listExistingContactKeys } from "../db/contactRepository";
import { getProductById, getProductByShortCode } from "../db/productRepository";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
    const { preview, allRows } = parseExcelForPreview(req.file.buffer);
    const uploadToken = storeUploadPreview(preview.columns, allRows);

    res.json({
      uploadToken,
      columns: preview.columns,
      sampleRows: preview.sampleRows,
      totalDataRows: preview.totalDataRows,
      message: "فایل با موفقیت خوانده شد. حالا ستون‌ها را نگاشت کرده و /admin/contacts/import را صدا بزنید.",
    });
  } catch (err) {
    console.error("خطا در پردازش فایل اکسل:", err);
    res.status(400).json({ error: (err as Error).message || "خطا در خواندن فایل اکسل." });
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

    const cached = getUploadPreview(uploadToken);
    if (!cached) {
      return res.status(410).json({ error: "این uploadToken منقضی شده یا نامعتبر است. دوباره آپلود کنید." });
    }

    if (defaultProductId) {
      const product = await getProductById(defaultProductId);
      if (!product) return res.status(400).json({ error: "defaultProductId نامعتبر است." });
    }

    const mappedRows = applyColumnMapping(cached.allRows, {
      nameColumnIndex: mapping.nameColumnIndex,
      phoneColumnIndex: mapping.phoneColumnIndex,
      productCodeColumnIndex: mapping.productCodeColumnIndex ?? null,
    });

    // کش کوچک برای جلوگیری از کوئری تکراری short_code های یکسان
    const productCodeCache = new Map<string, string | null>();
    async function resolveProductId(code: string | null | undefined): Promise<string | null> {
      if (!code) return defaultProductId ?? null;
      if (productCodeCache.has(code)) return productCodeCache.get(code)!;
      const product = await getProductByShortCode(code);
      const resolved = product?.id ?? defaultProductId ?? null;
      productCodeCache.set(code, resolved);
      return resolved;
    }

    const validInputs: { name: string; phone: string; productId: string | null }[] = [];
    const invalidRows: { row: number; reason: string }[] = [];

    // جلوگیری از مخاطب تکراری: هم تکرار داخل همین فایل، هم شماره‌هایی که قبلاً برای همان محصول ثبت شده‌اند
    const existingKeys = await listExistingContactKeys(null);
    let duplicateCount = 0;

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
      const key = `${productId ?? ""}|${r.normalizedPhone}`;
      if (existingKeys.has(key)) {
        duplicateCount++;
        invalidRows.push({ row: i + 2, reason: "شماره تکراری (قبلاً ثبت شده یا در همین فایل تکرار شده)" });
        continue;
      }
      existingKeys.add(key);
      validInputs.push({ name: r.name, phone: r.normalizedPhone, productId });
    }

    if (validInputs.length > 0) {
      await createContactsBulk(validInputs);
    }

    deleteUploadPreview(uploadToken);

    res.status(201).json({
      insertedCount: validInputs.length,
      skippedCount: invalidRows.length,
      duplicateCount,
      // فقط ۲۰۰ مورد اول برای نمایش؛ با فایل‌های ۱۰ هزارتایی پاسخ حجیم نشود
      skippedRows: invalidRows.slice(0, 200),
    });
  } catch (err) {
    console.error("خطا در import مخاطبین:", err);
    res.status(500).json({ error: "خطای داخلی سرور در ثبت مخاطبین." });
  }
});

export default router;
