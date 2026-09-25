"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignStatus = void 0;
exports.createCampaign = createCampaign;
exports.getCampaignOwnedByUser = getCampaignOwnedByUser;
exports.listCampaignsForUser = listCampaignsForUser;
exports.updateCampaignStatus = updateCampaignStatus;
exports.updateCampaignProgress = updateCampaignProgress;
exports.getCampaignStatus = getCampaignStatus;
exports.countCampaignsForUser = countCampaignsForUser;
const client_1 = require("./client");
exports.CampaignStatus = {
    DRAFT: "draft",
    RUNNING: "running",
    PAUSED: "paused",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
};
async function createCampaign(userId, productId, name) {
    return client_1.prisma.campaign.create({ data: { userId, productId, name: name ?? null } });
}
async function getCampaignOwnedByUser(id, userId) {
    return client_1.prisma.campaign.findFirst({ where: { id, userId }, include: { product: true } });
}
async function listCampaignsForUser(userId) {
    return client_1.prisma.campaign.findMany({
        where: { userId },
        include: { product: true },
        orderBy: { createdAt: "desc" },
    });
}
async function updateCampaignStatus(id, status, extra) {
    const timestampField = status === exports.CampaignStatus.RUNNING
        ? { startedAt: new Date() }
        : status === exports.CampaignStatus.PAUSED
            ? { pausedAt: new Date() }
            : status === exports.CampaignStatus.COMPLETED
                ? { completedAt: new Date() }
                : status === exports.CampaignStatus.CANCELLED
                    ? { cancelledAt: new Date() }
                    : {};
    return client_1.prisma.campaign.update({
        where: { id },
        data: { status, ...timestampField, ...(extra ?? {}) },
    });
}
async function updateCampaignProgress(id, progress) {
    return client_1.prisma.campaign.update({ where: { id }, data: progress });
}
/** برای بررسی سریع "الان باید متوقف بشه یا نه" وسط حلقه‌ی ارسال، بدون نگه‌داشتن state در حافظه */
async function getCampaignStatus(id) {
    const row = await client_1.prisma.campaign.findUnique({ where: { id }, select: { status: true } });
    return row?.status ?? null;
}
async function countCampaignsForUser(userId, status) {
    return client_1.prisma.campaign.count({ where: { userId, ...(status ? { status } : {}) } });
}
