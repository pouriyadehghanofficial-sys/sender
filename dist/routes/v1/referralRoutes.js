"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const conversationRepository_1 = require("../../db/conversationRepository");
const asyncHandler_1 = require("../../utils/asyncHandler");
const router = (0, express_1.Router)();
/**
 * GET /api/v1/referrals — بخش ۹ سند.
 * در این پلتفرم، "ارجاع" و "منتظر پاسخ" روی یک مکانیزم زیرین (needsHuman) کار می‌کنند؛
 * این endpoint همان داده را با status استاندارد سند ("referred") برمی‌گرداند تا
 * فرانت‌اند بتواند یک نوار ناوبری جدا برایش بسازد.
 */
router.get("/", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const conversations = await (0, conversationRepository_1.listWaitingForResponseForUser)(req.auth.userId);
    const data = conversations.map((c) => ({
        conversationId: c.id,
        contact: c.contact,
        product: c.product,
        status: "referred", // مقادیر ممکن دیگر طبق سند: normal | needs_review | referred | resolved
        reason: c.escalationReason,
        escalatedAt: c.escalatedAt,
        latestMessages: c.messages,
    }));
    res.json({ data });
}));
exports.default = router;
