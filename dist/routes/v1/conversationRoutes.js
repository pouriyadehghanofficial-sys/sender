"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const conversationRepository_1 = require("../../db/conversationRepository");
const messageRepository_1 = require("../../db/messageRepository");
const conversationRepository_2 = require("../../db/conversationRepository");
const baleBotClient_1 = require("../../providers/baleBotClient");
const settingsRepository_1 = require("../../db/settingsRepository");
const activityLogRepository_1 = require("../../db/activityLogRepository");
const enums_1 = require("../../db/enums");
const asyncHandler_1 = require("../../utils/asyncHandler");
const router = (0, express_1.Router)();
/** مکالمات فعال — بخش ۷ سند */
router.get("/active", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const conversations = await (0, conversationRepository_1.listActiveConversationsForUser)(req.auth.userId);
    res.json({ data: conversations });
}));
/** مکالمات منتظر پاسخ کاربر (ارجاع‌شده) — بخش ۷ سند، بخش جداگانه‌ی "clearly visible" */
router.get("/waiting", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const conversations = await (0, conversationRepository_1.listWaitingForResponseForUser)(req.auth.userId);
    const withWaitTime = conversations.map((c) => ({
        ...c,
        waitingMinutes: c.escalatedAt ? Math.round((Date.now() - new Date(c.escalatedAt).getTime()) / 60000) : null,
    }));
    res.json({ data: withWaitTime });
}));
router.get("/:id", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const conversation = await (0, conversationRepository_1.getConversationOwnedByUser)(req.params.id, req.auth.userId);
    if (!conversation)
        return res.status(404).json({ error: "مکالمه یافت نشد." });
    res.json({ conversation });
}));
/** پاسخ دستی کاربر به یک مکالمه‌ی منتظر پاسخ */
router.post("/:id/reply", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "فیلد text الزامی است." });
    }
    const conversation = await (0, conversationRepository_1.getConversationOwnedByUser)(req.params.id, req.auth.userId);
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
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "conversation_replied",
        resourceType: "conversation",
        resourceId: conversation.id,
    });
    res.json({ ok: true });
}));
/** پایان ارجاع — مکالمه به AI برمی‌گردد */
router.post("/:id/resolve", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const conversation = await (0, conversationRepository_1.getConversationOwnedByUser)(req.params.id, req.auth.userId);
    if (!conversation)
        return res.status(404).json({ error: "مکالمه یافت نشد." });
    const updated = await (0, conversationRepository_2.clearConversationEscalation)(conversation.id);
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "referral_resolved",
        resourceType: "conversation",
        resourceId: conversation.id,
    });
    res.json({ conversation: updated });
}));
exports.default = router;
