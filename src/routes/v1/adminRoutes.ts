import { Router } from "express";
import { listUsers } from "../../db/userRepository";
import { listAllApiKeysWithUser } from "../../db/apiKeyRepository";
import { listActivityForOwner, summarizeActivityByApiKey } from "../../db/activityLogRepository";
import { requireOwner } from "./authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { parsePagination, buildPaginatedResult } from "../../utils/pagination";
import { toSafeUser, toSafeApiKey } from "../../utils/sanitize";

const router = Router();

// همه‌ی روت‌های این فایل فقط برای مالک پلتفرم‌اند
router.use(requireOwner);

router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await listUsers();
    // whitelist صریح (نه الگوی `const {passwordHash, ...rest} = user`) — این‌طوری
    // هر فیلد حساس جدیدی که بعداً به مدل User اضافه شود خودکار افشا نمی‌شود.
    const safe = users.map(toSafeUser);
    res.json({ data: safe });
  })
);

/**
 * GET /api/v1/admin/api-keys — بخش ۱۲ سند: «کلید X متعلق به کدام کاربر است؟
 * چه محصولاتی اضافه کرده؟ چند مخاطب import کرده؟ چند پیام فرستاده؟»
 * برای هر کلید، یک خلاصه‌ی تعداد هر action (از ActivityLog) هم برمی‌گردد.
 */
router.get(
  "/api-keys",
  asyncHandler(async (_req, res) => {
    const keys = await listAllApiKeysWithUser();
    const withSummary = await Promise.all(
      (keys as any[]).map(async (k) => ({
        ...toSafeApiKey(k), // id, name, keyPrefix, isActive, createdAt, lastUsedAt — هرگز keyHash
        user: toSafeUser(k.user), // هرگز passwordHash
        activitySummary: await summarizeActivityByApiKey(k.id),
      }))
    );
    res.json({ data: withSummary });
  })
);

/** لاگ کامل فعالیت، با امکان فیلتر روی یک کاربر یا یک کلید خاص + صفحه‌بندی */
router.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const apiKeyId = typeof req.query.apiKeyId === "string" ? req.query.apiKeyId : undefined;

    const rows = await listActivityForOwner({ userId, apiKeyId }, pagination.skip + pagination.take);
    const pageSlice = rows.slice(pagination.skip, pagination.skip + pagination.take);

    // ⚠️ نکته امنیتی مهم: listActivityForOwner با include:{user:true, apiKey:true}
    // کوئری می‌زند، یعنی رکوردهای خام Prisma (شامل user.passwordHash و
    // apiKey.keyHash) را برمی‌گرداند. قبلاً این رکوردهای خام مستقیم در پاسخ
    // JSON می‌رفتند — اینجا صریحاً whitelist می‌شوند.
    const safeRows = (pageSlice as any[]).map((row) => ({
      id: row.id,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      user: toSafeUser(row.user),
      apiKey: toSafeApiKey(row.apiKey),
    }));

    res.json(buildPaginatedResult(safeRows, rows.length, pagination));
  })
);

export default router;
