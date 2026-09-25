"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askAI = askAI;
const aiProviderRepository_1 = require("../db/aiProviderRepository");
const manager_1 = require("../providers/manager");
const modelList_1 = require("../utils/modelList");
function minutesFromNow(minutes) {
    return new Date(Date.now() + minutes * 60_000);
}
/**
 * تابع اصلی askAI طبق سند فاز ۲:
 * providerهای فعال را بر اساس اولویت از دیتابیس می‌خواند، کلید هرکدام را رمزگشایی
 * می‌کند، هر ردیف را (در صورت چند مدل) گسترش می‌دهد، و با فیل‌اوور خودکار
 * (askAICore) پاسخ می‌گیرد.
 */
async function askAI(messages, systemPrompt) {
    const rows = await (0, aiProviderRepository_1.getActiveProvidersSortedByPriority)();
    const configsPerRow = await Promise.all(rows.map(async (row) => {
        const apiKey = await (0, aiProviderRepository_1.getDecryptedApiKey)(row.id);
        const models = (0, modelList_1.parseModelList)(row.model);
        return models.map((model) => ({
            // id یکسان برای همه‌ی مدل‌های یک کلید عمداً حفظ شده: اگر کلید auth-fail شود
            // یا rate-limit بخورد، منطقی است همه‌ی مدل‌های همان کلید هم موقتاً کنار بروند.
            id: row.id,
            name: models.length > 1 ? `${row.name} (${model})` : row.name,
            providerType: row.providerType,
            baseUrl: row.baseUrl,
            apiKey,
            model,
        }));
    }));
    const configs = configsPerRow.flat();
    const result = await (0, manager_1.askAICore)(configs, messages, systemPrompt, {
        onRateLimited: async (providerId) => { await (0, aiProviderRepository_1.setCooldown)(providerId, minutesFromNow(5)); },
        onAuthFailed: async (providerId) => { await (0, aiProviderRepository_1.markProviderInactive)(providerId); },
        onOtherError: (providerId, err) => {
            console.error(`[askAI] خطای غیرمنتظره در provider ${providerId}:`, err);
        },
    });
    return result.text;
}
