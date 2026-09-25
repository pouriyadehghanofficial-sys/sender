"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiKeyRecord = createApiKeyRecord;
exports.listApiKeysForUser = listApiKeysForUser;
exports.findActiveApiKeyByHash = findActiveApiKeyByHash;
exports.touchApiKeyLastUsed = touchApiKeyLastUsed;
exports.revokeApiKey = revokeApiKey;
exports.getApiKeyOwnedByUser = getApiKeyOwnedByUser;
exports.listAllApiKeysWithUser = listAllApiKeysWithUser;
const client_1 = require("./client");
async function createApiKeyRecord(userId, name, keyPrefix, keyHash) {
    return client_1.prisma.apiKey.create({ data: { userId, name, keyPrefix, keyHash } });
}
async function listApiKeysForUser(userId) {
    return client_1.prisma.apiKey.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}
/** برای احراز هویت درخواست‌های API — با هش (نه توکن خام) جستجو می‌کند */
async function findActiveApiKeyByHash(keyHash) {
    const now = new Date();
    return client_1.prisma.apiKey.findFirst({
        where: {
            keyHash,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
    });
}
async function touchApiKeyLastUsed(id) {
    return client_1.prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
}
async function revokeApiKey(id, userId) {
    // شرط userId هم در where تا یک کاربر نتواند کلید کاربر دیگر را با حدس زدن id باطل کند (IDOR)
    return client_1.prisma.apiKey.updateMany({
        where: { id, userId },
        data: { isActive: false, revokedAt: new Date() },
    });
}
async function getApiKeyOwnedByUser(id, userId) {
    return client_1.prisma.apiKey.findFirst({ where: { id, userId } });
}
/** برای دید مدیریتی مالک پلتفرم — همه‌ی کلیدها با اطلاعات کاربرشان */
async function listAllApiKeysWithUser() {
    return client_1.prisma.apiKey.findMany({
        include: { user: true },
        orderBy: { createdAt: "desc" },
    });
}
