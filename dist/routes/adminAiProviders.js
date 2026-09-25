"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiProviderRepository_1 = require("../db/aiProviderRepository");
const enums_1 = require("../db/enums");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    try {
        const { name, providerType, baseUrl, apiKey, model, priority } = req.body ?? {};
        if (!name || !providerType || !apiKey || !model) {
            return res.status(400).json({ error: "فیلدهای name, providerType, apiKey, model الزامی هستند." });
        }
        if (![enums_1.ProviderType.ANTHROPIC, enums_1.ProviderType.OPENAI_COMPATIBLE].includes(providerType)) {
            return res.status(400).json({ error: "providerType باید anthropic یا openai_compatible باشد." });
        }
        const provider = await (0, aiProviderRepository_1.createAiProvider)({
            name,
            providerType,
            baseUrl: baseUrl || null,
            apiKey,
            model,
            priority: typeof priority === "number" ? priority : Number(priority) || 100,
        });
        // کلید رمزنگاری‌شده هرگز در پاسخ HTTP برنمی‌گردد
        const { apiKeyEncrypted, ...safe } = provider;
        res.status(201).json({ provider: safe });
    }
    catch (err) {
        console.error("خطا در ایجاد ارائه‌دهنده AI:", err);
        res.status(500).json({ error: "خطای داخلی سرور." });
    }
});
router.get("/", (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const providers = await (0, aiProviderRepository_1.listAiProviders)();
    // apiKeyEncrypted هیچ‌وقت نباید به کلاینت برگردد
    const safe = providers.map(({ apiKeyEncrypted, ...rest }) => rest);
    res.json({ providers: safe });
}));
router.delete("/:id", async (req, res) => {
    try {
        await (0, aiProviderRepository_1.deleteAiProvider)(req.params.id);
        res.status(204).send();
    }
    catch (err) {
        console.error("خطا در حذف ارائه‌دهنده AI:", err);
        res.status(500).json({ error: "خطای داخلی سرور." });
    }
});
exports.default = router;
