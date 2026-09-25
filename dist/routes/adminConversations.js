"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const conversationRepository_1 = require("../db/conversationRepository");
const messageRepository_1 = require("../db/messageRepository");
const baleBotClient_1 = require("../providers/baleBotClient");
const settingsRepository_1 = require("../db/settingsRepository");
const enums_1 = require("../db/enums");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
/** لیست مکالماتی که منتظر پاسخ اپراتور انسانی هستند */
router.get("/escalated", (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const conversations = await (0, conversationRepository_1.listEscalatedConversations)();
    res.json({ conversations });
}));
/** تاریخچه کامل یک مکالمه (برای اینکه اپراتور قبل از پاسخ، کل زمینه را ببیند) */
router.get("/:id/messages", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const conversation = await (0, conversationRepository_1.getConversationById)(req.params.id);
    if (!conversation)
        return res.status(404).json({ error: "مکالمه یافت نشد." });
    res.json({ conversation });
}));
/**
 * پاسخ دستی اپراتور — مستقیماً به کاربر در بازو ارسال می‌شود و در تاریخچه با
 * sender='human' ذخیره می‌شود (تا اگر بعداً مکالمه به AI برگردد، زمینه کامل بماند).
 */
router.post("/:id/reply", async (req, res) => {
    try {
        const { text } = req.body ?? {};
        if (!text || typeof text !== "string" || !text.trim()) {
            return res.status(400).json({ error: "فیلد text الزامی است." });
        }
        const conversation = await (0, conversationRepository_1.getConversationById)(req.params.id);
        if (!conversation)
            return res.status(404).json({ error: "مکالمه یافت نشد." });
        if (!conversation.contact?.baleChatId) {
            return res.status(400).json({ error: "این مخاطب chat_id بازو ندارد؛ امکان ارسال پیام نیست." });
        }
        const botToken = await (0, settingsRepository_1.getSetting)(settingsRepository_1.SettingKeys.BALE_BOT_TOKEN);
        if (!botToken)
            return res.status(400).json({ error: "bale_bot_token تنظیم نشده است." });
        await (0, baleBotClient_1.sendBaleMessage)({ botToken }, conversation.contact.baleChatId, text);
        await (0, messageRepository_1.addMessage)(conversation.id, enums_1.MessageSender.HUMAN, text);
        res.json({ ok: true });
    }
    catch (err) {
        console.error("خطا در ارسال پاسخ دستی اپراتور:", err);
        res.status(500).json({ error: "خطای داخلی سرور در ارسال پاسخ." });
    }
});
/** پایان دادن به ارجاع — از این به بعد AI دوباره خودکار پاسخ می‌دهد */
router.post("/:id/resolve", async (req, res) => {
    try {
        const conversation = await (0, conversationRepository_1.clearConversationEscalation)(req.params.id);
        res.json({ conversation });
    }
    catch (err) {
        console.error("خطا در پایان دادن به ارجاع:", err);
        res.status(500).json({ error: "خطای داخلی سرور." });
    }
});
exports.default = router;
