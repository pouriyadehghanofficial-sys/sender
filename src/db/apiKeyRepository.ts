import { prisma } from "./client";

export async function createApiKeyRecord(userId: string, name: string, keyPrefix: string, keyHash: string) {
  return prisma.apiKey.create({ data: { userId, name, keyPrefix, keyHash } });
}

export async function listApiKeysForUser(userId: string) {
  return prisma.apiKey.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/** برای احراز هویت درخواست‌های API — با هش (نه توکن خام) جستجو می‌کند */
export async function findActiveApiKeyByHash(keyHash: string) {
  const now = new Date();
  return prisma.apiKey.findFirst({
    where: {
      keyHash,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
}

export async function touchApiKeyLastUsed(id: string) {
  return prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
}

export async function revokeApiKey(id: string, userId: string) {
  // شرط userId هم در where تا یک کاربر نتواند کلید کاربر دیگر را با حدس زدن id باطل کند (IDOR)
  return prisma.apiKey.updateMany({
    where: { id, userId },
    data: { isActive: false, revokedAt: new Date() },
  });
}

export async function getApiKeyOwnedByUser(id: string, userId: string) {
  return prisma.apiKey.findFirst({ where: { id, userId } });
}

/** برای دید مدیریتی مالک پلتفرم — همه‌ی کلیدها با اطلاعات کاربرشان */
export async function listAllApiKeysWithUser() {
  return prisma.apiKey.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
}
