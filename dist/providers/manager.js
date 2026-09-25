"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askAICore = askAICore;
const factory_1 = require("./factory");
const errors_1 = require("./errors");
/**
 * هسته‌ی اصلی فیل‌اوور: providerها را به ترتیب اولویت امتحان می‌کند
 * و در صورت خطا (rate limit / auth / سایر) به بعدی می‌رود.
 * این تابع به دیتابیس وابسته نیست تا به‌راحتی قابل تست باشد.
 */
async function askAICore(configs, messages, systemPrompt, hooks = {}) {
    if (configs.length === 0) {
        throw new Error("هیچ ارائه‌دهنده هوش مصنوعی فعالی در دسترس نیست.");
    }
    let lastError = null;
    for (const config of configs) {
        const adapter = (0, factory_1.createAdapter)(config);
        try {
            const text = await adapter.chat(messages, systemPrompt);
            return { text, providerId: config.id, providerName: adapter.name };
        }
        catch (err) {
            lastError = err;
            if (err instanceof errors_1.ProviderCallError) {
                if (err.kind === "rate_limit") {
                    await hooks.onRateLimited?.(config.id);
                    continue;
                }
                if (err.kind === "auth") {
                    await hooks.onAuthFailed?.(config.id);
                    continue;
                }
                await hooks.onOtherError?.(config.id, err);
                continue;
            }
            // خطای پیش‌بینی‌نشده (نباید معمولاً اینجا برسد چون adapter ها همه چیز را classify می‌کنند)
            await hooks.onOtherError?.(config.id, err);
            continue;
        }
    }
    const lastMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`همه ارائه‌دهنده‌های هوش مصنوعی ناموفق بودند. آخرین خطا: ${lastMessage}`);
}
