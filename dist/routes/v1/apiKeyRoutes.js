"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../utils/auth");
const apiKeyRepository_1 = require("../../db/apiKeyRepository");
const activityLogRepository_1 = require("../../db/activityLogRepository");
const asyncHandler_1 = require("../../utils/asyncHandler");
const sanitize_1 = require("../../utils/sanitize");
const router = (0, express_1.Router)();
/** لیست کلیدهای خودِ کاربر — هیچ‌وقت keyHash در پاسخ نیست (whitelist صریح) */
router.get("/", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const keys = await (0, apiKeyRepository_1.listApiKeysForUser)(req.auth.userId);
    res.json({ data: keys.map(sanitize_1.toSafeApiKey) });
}));
router.post("/", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "فیلد name الزامی است (مثلاً «سرور تولید» یا «تست»)." });
    }
    const generated = (0, auth_1.generateApiKey)();
    const row = await (0, apiKeyRepository_1.createApiKeyRecord)(req.auth.userId, name.trim(), generated.keyPrefix, generated.keyHash);
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "api_key_created",
        resourceType: "api_key",
        resourceId: row.id,
        metadata: { name: name.trim() },
    });
    // توکن کامل فقط همین یک‌بار (لحظه‌ی ساخت) برگردانده می‌شود — بعد از این دیگر
    // هیچ‌جا (حتی در دیتابیس) ذخیره نشده و قابل بازیابی نیست.
    res.status(201).json({
        id: row.id,
        name: row.name,
        keyPrefix: row.keyPrefix,
        token: generated.plainToken,
        warning: "این توکن را همین الان جایی امن ذخیره کنید؛ دیگر نمایش داده نمی‌شود.",
    });
}));
router.delete("/:id", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // اول بررسی می‌کنیم کلید واقعاً متعلق به همین کاربر است (IDOR)، بعد باطلش می‌کنیم
    const owned = await (0, apiKeyRepository_1.getApiKeyOwnedByUser)(req.params.id, req.auth.userId);
    if (!owned)
        return res.status(404).json({ error: "کلید یافت نشد." });
    await (0, apiKeyRepository_1.revokeApiKey)(req.params.id, req.auth.userId);
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "api_key_revoked",
        resourceType: "api_key",
        resourceId: req.params.id,
    });
    res.status(204).send();
}));
exports.default = router;
