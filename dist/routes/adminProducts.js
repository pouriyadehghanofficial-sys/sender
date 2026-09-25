"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const productRepository_1 = require("../db/productRepository");
const productService_1 = require("../services/productService");
const aiService_1 = require("../services/aiService");
const orderTag_1 = require("../utils/orderTag");
const escalation_1 = require("../utils/escalation");
const settingsRepository_1 = require("../db/settingsRepository");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
// آپلود فایل در حافظه (نه دیسک) — فایل‌های توضیحات معمولاً کوچک (متنی) هستند
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
function slugify(input) {
    return (input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
        .replace(/^-+|-+$/g, "") || "product");
}
/**
 * POST /admin/products
 * multipart/form-data یا JSON:
 *   - name (الزامی)
 *   - shortCode (اختیاری — اگر ندهید، از روی name ساخته می‌شود)
 *   - descriptionText (اختیاری اگر فایل بدهید)
 *   - file (اختیاری، فایل متنی .txt/.md — جایگزین descriptionText می‌شود)
 */
router.post("/", upload.single("file"), async (req, res) => {
    try {
        const { name, descriptionText, shortCode } = req.body ?? {};
        if (!name || typeof name !== "string") {
            return res.status(400).json({ error: "فیلد name الزامی است." });
        }
        let finalDescription = typeof descriptionText === "string" ? descriptionText : "";
        if (req.file) {
            finalDescription = req.file.buffer.toString("utf-8");
        }
        if (!finalDescription.trim()) {
            return res
                .status(400)
                .json({ error: "باید یا descriptionText بفرستید یا یک فایل متنی آپلود کنید." });
        }
        let code = typeof shortCode === "string" && shortCode.trim() ? shortCode.trim() : slugify(name);
        // اطمینان از یکتا بودن short_code
        const existing = await (0, productRepository_1.getProductByShortCode)(code);
        if (existing) {
            code = `${code}-${(0, uuid_1.v4)().slice(0, 6)}`;
        }
        const product = await (0, productRepository_1.createProduct)({
            name,
            shortCode: code,
            descriptionText: finalDescription,
        });
        res.status(201).json({ product });
    }
    catch (err) {
        console.error("خطا در ایجاد محصول:", err);
        res.status(500).json({ error: "خطای داخلی سرور در ذخیره محصول." });
    }
});
router.get("/", (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const products = await (0, productRepository_1.listProducts)();
    res.json({ products });
}));
router.get("/:id", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const product = await (0, productRepository_1.getProductById)(req.params.id);
    if (!product)
        return res.status(404).json({ error: "محصول یافت نشد." });
    res.json({ product });
}));
/** پیش‌نمایش system prompt ساخته‌شده برای یک محصول — مفید برای دیباگ پنل مدیریت */
router.get("/:id/system-prompt", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const product = await (0, productRepository_1.getProductById)(req.params.id);
    if (!product)
        return res.status(404).json({ error: "محصول یافت نشد." });
    const systemPrompt = (0, productService_1.buildSystemPrompt)(product);
    res.json({ systemPrompt });
}));
router.put("/:id", upload.single("file"), async (req, res) => {
    try {
        const { name, descriptionText, shortCode } = req.body ?? {};
        const data = {};
        if (typeof name === "string" && name.trim())
            data.name = name;
        if (typeof shortCode === "string" && shortCode.trim())
            data.shortCode = shortCode;
        if (req.file) {
            data.descriptionText = req.file.buffer.toString("utf-8");
        }
        else if (typeof descriptionText === "string" && descriptionText.trim()) {
            data.descriptionText = descriptionText;
        }
        const product = await (0, productRepository_1.updateProduct)(req.params.id, data);
        res.json({ product });
    }
    catch (err) {
        console.error("خطا در به‌روزرسانی محصول:", err);
        res.status(500).json({ error: "خطای داخلی سرور در به‌روزرسانی محصول." });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        await (0, productRepository_1.deleteProduct)(req.params.id);
        res.status(204).send();
    }
    catch (err) {
        console.error("خطا در حذف محصول:", err);
        res.status(500).json({ error: "خطای داخلی سرور در حذف محصول." });
    }
});
/**
 * POST /admin/products/:id/test-chat
 * برای تست کردن دانش AI روی یک محصول، بدون اینکه چیزی در دیتابیس واقعی
 * (contacts/conversations/messages) ذخیره شود — یک چت‌بات آزمایشی صرف.
 * body: { messages: [{ role: 'user'|'assistant', content: string }] }
 * آخرین آیتم آرایه باید پیام تازه‌ی کاربر باشد؛ کل آرایه به‌عنوان تاریخچه به AI داده می‌شود.
 * همان منطق ارجاع به انسان (فاز جدید C) هم اینجا شبیه‌سازی می‌شود تا بتوانید قبل از
 * اتصال واقعی بله، مطمئن شوید تنظیمات ارجاع درست کار می‌کنند.
 */
router.post("/:id/test-chat", async (req, res) => {
    try {
        const product = await (0, productRepository_1.getProductById)(req.params.id);
        if (!product)
            return res.status(404).json({ error: "محصول یافت نشد." });
        const messages = req.body?.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: "فیلد messages (آرایه) الزامی است." });
        }
        const chatMessages = messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content ?? ""),
        }));
        const lastUserMessage = [...chatMessages].reverse().find((m) => m.role === "user")?.content ?? "";
        const userMessageCount = chatMessages.filter((m) => m.role === "user").length;
        const thresholdRaw = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.ESCALATION_MESSAGE_THRESHOLD);
        const keywordsRaw = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.ESCALATION_KEYWORDS);
        const customInstructions = (await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.ESCALATION_CUSTOM_INSTRUCTIONS)) ?? "";
        const threshold = thresholdRaw ? Number(thresholdRaw) || escalation_1.DEFAULT_ESCALATION_THRESHOLD : escalation_1.DEFAULT_ESCALATION_THRESHOLD;
        const keywords = keywordsRaw ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean) : escalation_1.DEFAULT_ESCALATION_KEYWORDS;
        // ۱) محرک قانون‌محور (کلمه کلیدی / سقف تعداد پیام) — دقیقاً مثل فاز واقعی وبهوک
        const ruleEscalation = (0, escalation_1.checkEscalationTrigger)(lastUserMessage, userMessageCount, { threshold, keywords });
        if (ruleEscalation.shouldEscalate) {
            return res.json({
                reply: "پیام شما دریافت شد و به همکاران ما ارجاع داده شد؛ به‌زودی شخصاً پاسخ می‌دهند. 🙏",
                orderConfirmed: false,
                needsHuman: true,
                escalationReason: ruleEscalation.reason,
            });
        }
        // ۲) اگر قانون‌محور فعال نشد، از AI بپرس و ببین خودش تگ [NEEDS_HUMAN] را برمی‌گرداند یا نه
        const systemPrompt = (0, productService_1.buildSystemPrompt)(product, customInstructions);
        const aiRawResponse = await (0, aiService_1.askAI)(chatMessages, systemPrompt);
        const { displayText, orderConfirmed, needsHuman } = (0, orderTag_1.parseAiResponseTags)(aiRawResponse);
        res.json({
            reply: displayText,
            orderConfirmed,
            needsHuman,
            escalationReason: needsHuman ? "ai_requested" : null,
        });
    }
    catch (err) {
        console.error("خطا در تست چت‌بات محصول:", err);
        res.status(500).json({ error: err.message || "خطای داخلی سرور در تست چت." });
    }
});
exports.default = router;
