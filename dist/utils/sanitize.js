"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSafeUser = toSafeUser;
exports.toSafeApiKey = toSafeApiKey;
/**
 * فقط فیلدهای صریحاً مجاز کاربر را برمی‌گرداند — passwordHash (و هر فیلد دیگری
 * که اضافه شود) هرگز اینجا کپی نمی‌شود چون whitelist است نه blacklist.
 * هیچ‌وقت به‌جایش از الگوی `const { passwordHash, ...rest } = user` استفاده نکنید؛
 * آن الگو یعنی هر فیلد جدیدی که بعداً به مدل User اضافه شود خودکار افشا می‌شود.
 */
function toSafeUser(user) {
    if (!user || typeof user !== "object")
        return null;
    const u = user;
    return {
        id: u.id,
        email: u.email,
        isOwner: Boolean(u.isOwner),
        isActive: Boolean(u.isActive),
        createdAt: u.createdAt,
    };
}
/** همان اصل whitelist برای ApiKey — keyHash هرگز اینجا کپی نمی‌شود */
function toSafeApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== "object")
        return null;
    const k = apiKey;
    return {
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        isActive: Boolean(k.isActive),
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
    };
}
