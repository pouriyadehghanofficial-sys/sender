import { Router } from "express";
import { generateApiKey } from "../../utils/auth";
import {
  createApiKeyRecord,
  listApiKeysForUser,
  revokeApiKey,
  getApiKeyOwnedByUser,
} from "../../db/apiKeyRepository";
import { logActivity } from "../../db/activityLogRepository";
import { asyncHandler } from "../../utils/asyncHandler";
import { toSafeApiKey } from "../../utils/sanitize";

const router = Router();

/** لیست کلیدهای خودِ کاربر — هیچ‌وقت keyHash در پاسخ نیست (whitelist صریح) */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const keys = await listApiKeysForUser(req.auth!.userId);
    res.json({ data: keys.map(toSafeApiKey) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "فیلد name الزامی است (مثلاً «سرور تولید» یا «تست»)." });
    }

    const generated = generateApiKey();
    const row = await createApiKeyRecord(req.auth!.userId, name.trim(), generated.keyPrefix, generated.keyHash);

    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
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
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    // اول بررسی می‌کنیم کلید واقعاً متعلق به همین کاربر است (IDOR)، بعد باطلش می‌کنیم
    const owned = await getApiKeyOwnedByUser(req.params.id, req.auth!.userId);
    if (!owned) return res.status(404).json({ error: "کلید یافت نشد." });

    await revokeApiKey(req.params.id, req.auth!.userId);
    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "api_key_revoked",
      resourceType: "api_key",
      resourceId: req.params.id,
    });

    res.status(204).send();
  })
);

export default router;
