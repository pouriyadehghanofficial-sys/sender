"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userRepository_1 = require("../../db/userRepository");
const apiKeyRepository_1 = require("../../db/apiKeyRepository");
const activityLogRepository_1 = require("../../db/activityLogRepository");
const authMiddleware_1 = require("./authMiddleware");
const asyncHandler_1 = require("../../utils/asyncHandler");
const pagination_1 = require("../../utils/pagination");
const sanitize_1 = require("../../utils/sanitize");
const router = (0, express_1.Router)();
// همه‌ی روت‌های این فایل فقط برای مالک پلتفرم‌اند
router.use(authMiddleware_1.requireOwner);
router.get("/users", (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const users = await (0, userRepository_1.listUsers)();
    // whitelist صریح (نه الگوی `const {passwordHash, ...rest} = user`) — این‌طوری
    // هر فیلد حساس جدیدی که بعداً به مدل User اضافه شود خودکار افشا نمی‌شود.
    const safe = users.map(sanitize_1.toSafeUser);
    res.json({ data: safe });
}));
/**
 * GET /api/v1/admin/api-keys — بخش ۱۲ سند: «کلید X متعلق به کدام کاربر است؟
 * چه محصولاتی اضافه کرده؟ چند مخاطب import کرده؟ چند پیام فرستاده؟»
 * برای هر کلید، یک خلاصه‌ی تعداد هر action (از ActivityLog) هم برمی‌گردد.
 */
router.get("/api-keys", (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const keys = await (0, apiKeyRepository_1.listAllApiKeysWithUser)();
    const withSummary = await Promise.all(keys.map(async (k) => ({
        ...(0, sanitize_1.toSafeApiKey)(k), // id, name, keyPrefix, isActive, createdAt, lastUsedAt — هرگز keyHash
        user: (0, sanitize_1.toSafeUser)(k.user), // هرگز passwordHash
        activitySummary: await (0, activityLogRepository_1.summarizeActivityByApiKey)(k.id),
    })));
    res.json({ data: withSummary });
}));
/** لاگ کامل فعالیت، با امکان فیلتر روی یک کاربر یا یک کلید خاص + صفحه‌بندی */
router.get("/activity", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pagination = (0, pagination_1.parsePagination)(req.query);
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const apiKeyId = typeof req.query.apiKeyId === "string" ? req.query.apiKeyId : undefined;
    const rows = await (0, activityLogRepository_1.listActivityForOwner)({ userId, apiKeyId }, pagination.skip + pagination.take);
    const pageSlice = rows.slice(pagination.skip, pagination.skip + pagination.take);
    // ⚠️ نکته امنیتی مهم: listActivityForOwner با include:{user:true, apiKey:true}
    // کوئری می‌زند، یعنی رکوردهای خام Prisma (شامل user.passwordHash و
    // apiKey.keyHash) را برمی‌گرداند. قبلاً این رکوردهای خام مستقیم در پاسخ
    // JSON می‌رفتند — اینجا صریحاً whitelist می‌شوند.
    const safeRows = pageSlice.map((row) => ({
        id: row.id,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        metadata: row.metadata,
        createdAt: row.createdAt,
        user: (0, sanitize_1.toSafeUser)(row.user),
        apiKey: (0, sanitize_1.toSafeApiKey)(row.apiKey),
    }));
    res.json((0, pagination_1.buildPaginatedResult)(safeRows, rows.length, pagination));
}));
exports.default = router;
