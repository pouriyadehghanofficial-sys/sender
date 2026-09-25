import { Router } from "express";
import { listWaitingForResponseForUser } from "../../db/conversationRepository";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

/**
 * GET /api/v1/referrals — بخش ۹ سند.
 * در این پلتفرم، "ارجاع" و "منتظر پاسخ" روی یک مکانیزم زیرین (needsHuman) کار می‌کنند؛
 * این endpoint همان داده را با status استاندارد سند ("referred") برمی‌گرداند تا
 * فرانت‌اند بتواند یک نوار ناوبری جدا برایش بسازد.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const conversations = await listWaitingForResponseForUser(req.auth!.userId);
    const data = (conversations as any[]).map((c) => ({
      conversationId: c.id,
      contact: c.contact,
      product: c.product,
      status: "referred", // مقادیر ممکن دیگر طبق سند: normal | needs_review | referred | resolved
      reason: c.escalationReason,
      escalatedAt: c.escalatedAt,
      latestMessages: c.messages,
    }));
    res.json({ data });
  })
);

export default router;
