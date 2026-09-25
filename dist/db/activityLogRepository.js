"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
exports.listActivityForUser = listActivityForUser;
exports.listActivityForOwner = listActivityForOwner;
exports.summarizeActivityByApiKey = summarizeActivityByApiKey;
const client_1 = require("./client");
async function logActivity(input) {
    return client_1.prisma.activityLog.create({
        data: {
            userId: input.userId ?? null,
            apiKeyId: input.apiKeyId ?? null,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId ?? null,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        },
    });
}
async function listActivityForUser(userId, limit = 50) {
    return client_1.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}
/** برای دید مدیریتی مالک پلتفرم: کل لاگ، یا فیلترشده روی یک apiKeyId/userId خاص */
async function listActivityForOwner(filter, limit = 200) {
    return client_1.prisma.activityLog.findMany({
        where: {
            userId: filter.userId ?? undefined,
            apiKeyId: filter.apiKeyId ?? undefined,
        },
        include: { user: true, apiKey: true },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}
/** خلاصه‌ی تعداد هر action برای یک apiKeyId — برای پاسخ به «این کلید چه کارهایی کرد؟» */
async function summarizeActivityByApiKey(apiKeyId) {
    const rows = await client_1.prisma.activityLog.findMany({ where: { apiKeyId } });
    const summary = {};
    for (const row of rows) {
        summary[row.action] = (summary[row.action] ?? 0) + 1;
    }
    return summary;
}
