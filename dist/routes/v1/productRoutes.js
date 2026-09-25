"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productRepository_1 = require("../../db/productRepository");
const activityLogRepository_1 = require("../../db/activityLogRepository");
const asyncHandler_1 = require("../../utils/asyncHandler");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
function slugify(input) {
    return (input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
        .replace(/^-+|-+$/g, "") || "product");
}
router.get("/", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const products = await (0, productRepository_1.listProductsForUser)(req.auth.userId);
    res.json({ data: products });
}));
router.post("/", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, shortCode, descriptionText } = req.body ?? {};
    if (!name || !descriptionText) {
        return res.status(400).json({ error: "فیلدهای name و descriptionText الزامی هستند." });
    }
    let code = typeof shortCode === "string" && shortCode.trim() ? shortCode.trim() : slugify(name);
    const existing = await (0, productRepository_1.getProductByShortCode)(code);
    if (existing)
        code = `${code}-${(0, uuid_1.v4)().slice(0, 6)}`;
    const product = await (0, productRepository_1.createProduct)({ name, shortCode: code, descriptionText, userId: req.auth.userId });
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "product_created",
        resourceType: "product",
        resourceId: product.id,
        metadata: { name },
    });
    res.status(201).json({ product });
}));
router.get("/:id", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const product = await (0, productRepository_1.getProductAccessibleByUser)(req.params.id, req.auth.userId);
    if (!product)
        return res.status(404).json({ error: "محصول یافت نشد." });
    res.json({ product });
}));
router.patch("/:id", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // فقط اگر واقعاً مالک باشد (محصولات سراسری از این API قابل ویرایش نیستند)
    const owned = await (0, productRepository_1.getProductOwnedByUser)(req.params.id, req.auth.userId);
    if (!owned)
        return res.status(404).json({ error: "محصول یافت نشد یا متعلق به شما نیست." });
    const { name, descriptionText, isActive } = req.body ?? {};
    if (typeof isActive === "boolean") {
        await (0, productRepository_1.setProductActive)(req.params.id, isActive);
    }
    if (name || descriptionText) {
        await (0, productRepository_1.updateProduct)(req.params.id, {
            ...(name ? { name } : {}),
            ...(descriptionText ? { descriptionText } : {}),
        });
    }
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "product_updated",
        resourceType: "product",
        resourceId: req.params.id,
        metadata: req.body,
    });
    const updated = await (0, productRepository_1.getProductOwnedByUser)(req.params.id, req.auth.userId);
    res.json({ product: updated });
}));
exports.default = router;
