import { Router } from "express";
import {
  createProduct,
  listProductsForUser,
  getProductAccessibleByUser,
  getProductOwnedByUser,
  updateProduct,
  setProductActive,
  getProductByShortCode,
} from "../../db/productRepository";
import { logActivity } from "../../db/activityLogRepository";
import { asyncHandler } from "../../utils/asyncHandler";
import { v4 as uuidv4 } from "uuid";

const router = Router();

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const products = await listProductsForUser(req.auth!.userId);
    res.json({ data: products });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, shortCode, descriptionText } = req.body ?? {};
    if (!name || !descriptionText) {
      return res.status(400).json({ error: "فیلدهای name و descriptionText الزامی هستند." });
    }

    let code = typeof shortCode === "string" && shortCode.trim() ? shortCode.trim() : slugify(name);
    const existing = await getProductByShortCode(code);
    if (existing) code = `${code}-${uuidv4().slice(0, 6)}`;

    const product = await createProduct({ name, shortCode: code, descriptionText, userId: req.auth!.userId });

    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "product_created",
      resourceType: "product",
      resourceId: product.id,
      metadata: { name },
    });

    res.status(201).json({ product });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await getProductAccessibleByUser(req.params.id, req.auth!.userId);
    if (!product) return res.status(404).json({ error: "محصول یافت نشد." });
    res.json({ product });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    // فقط اگر واقعاً مالک باشد (محصولات سراسری از این API قابل ویرایش نیستند)
    const owned = await getProductOwnedByUser(req.params.id, req.auth!.userId);
    if (!owned) return res.status(404).json({ error: "محصول یافت نشد یا متعلق به شما نیست." });

    const { name, descriptionText, isActive } = req.body ?? {};
    if (typeof isActive === "boolean") {
      await setProductActive(req.params.id, isActive);
    }
    if (name || descriptionText) {
      await updateProduct(req.params.id, {
        ...(name ? { name } : {}),
        ...(descriptionText ? { descriptionText } : {}),
      });
    }

    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "product_updated",
      resourceType: "product",
      resourceId: req.params.id,
      metadata: req.body,
    });

    const updated = await getProductOwnedByUser(req.params.id, req.auth!.userId);
    res.json({ product: updated });
  })
);

export default router;
