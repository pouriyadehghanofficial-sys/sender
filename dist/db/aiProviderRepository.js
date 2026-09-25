"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAiProvider = createAiProvider;
exports.listAiProviders = listAiProviders;
exports.getActiveProvidersSortedByPriority = getActiveProvidersSortedByPriority;
exports.getDecryptedApiKey = getDecryptedApiKey;
exports.setCooldown = setCooldown;
exports.markProviderInactive = markProviderInactive;
exports.deleteAiProvider = deleteAiProvider;
const client_1 = require("./client");
const crypto_1 = require("../utils/crypto");
async function createAiProvider(input) {
    return client_1.prisma.aiProvider.create({
        data: {
            name: input.name,
            providerType: input.providerType,
            baseUrl: input.baseUrl ?? null,
            apiKeyEncrypted: (0, crypto_1.encryptSecret)(input.apiKey),
            model: input.model,
            priority: input.priority ?? 100,
        },
    });
}
async function listAiProviders() {
    return client_1.prisma.aiProvider.findMany({ orderBy: { priority: "asc" } });
}
/** فقط ارائه‌دهندگان فعال و خارج از cooldown، مرتب بر اساس اولویت — برای فاز ۲ */
async function getActiveProvidersSortedByPriority() {
    const now = new Date();
    return client_1.prisma.aiProvider.findMany({
        where: {
            isActive: true,
            OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
        },
        orderBy: { priority: "asc" },
    });
}
async function getDecryptedApiKey(providerId) {
    const provider = await client_1.prisma.aiProvider.findUniqueOrThrow({ where: { id: providerId } });
    return (0, crypto_1.decryptSecret)(provider.apiKeyEncrypted);
}
async function setCooldown(providerId, until) {
    return client_1.prisma.aiProvider.update({ where: { id: providerId }, data: { cooldownUntil: until } });
}
async function markProviderInactive(providerId) {
    return client_1.prisma.aiProvider.update({ where: { id: providerId }, data: { isActive: false } });
}
async function deleteAiProvider(providerId) {
    return client_1.prisma.aiProvider.delete({ where: { id: providerId } });
}
