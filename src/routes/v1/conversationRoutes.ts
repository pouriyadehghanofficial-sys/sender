import { Router } from "express";
import {
  listActiveConversationsForUser,
  listWaitingForResponseForUser,
  getConversationOwnedByUser,
} from "../../db/conversationRepository";
import { addMessage } from "../../db/messageRepository";
import { clearConversationEscalation } from "../../db/conversationRepository";
import { sendBaleMessage } from "../../providers/baleBotClient";
import { getSetting, SettingKeys } from "../../db/settingsRepository";
import { logActivity } from "../../db/activityLogRepository";
import { MessageSender } from "../../db/enums";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

/** مکالمات فعال — بخش ۷ سند */
router.get(
  "/active",
  asyncHandler(async (req, res) => {
    const conversations = await listActiveConversationsForUser(req.auth!.userId);
    res.json({ data: conversations });
  })
);

/** مکالمات منتظر پاسخ کاربر (ارجاع‌شده) — بخش ۷ سند، بخش جداگانه‌ی "clearly visible" */
router.get(
  "/waiting",
  asyncHandler(async (req, res) => {
    const conversations = await listWaitingForResponseForUser(req.auth!.userId);
    const withWaitTime = (conversations as any[]).map((c) => ({
      ...c,
      waitingMinutes: c.escalatedAt ? Math.round((Date.now() - new Date(c.escalatedAt).getTime()) / 60000) : null,
    }));
    res.json({ data: withWaitTime });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const conversation = await getConversationOwnedByUser(req.params.id, req.auth!.userId);
    if (!conversation) return res.status(404).json({ error: "مکالمه یافت نشد." });
    res.json({ conversation });
  })
);

/** پاسخ دستی کاربر به یک مکالمه‌ی منتظر پاسخ */
router.post(
  "/:id/reply",
  asyncHandler(async (req, res) => {
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "فیلد text الزامی است." });
    }

    const conversation = await getConversationOwnedByUser(req.params.id, req.auth!.userId);
    if (!conversation) return res.status(404).json({ error: "مکالمه یافت نشد." });
    if (!conversation.contact?.baleChatId) {
      return res.status(400).json({ error: "این مخاطب chat_id بازو ندارد؛ امکان ارسال پیام نیست." });
    }

    const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
    if (!botToken) return res.status(400).json({ error: "bale_bot_token تنظیم نشده است." });

    await sendBaleMessage({ botToken }, conversation.contact.baleChatId, text);
    await addMessage(conversation.id, MessageSender.HUMAN, text);

    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "conversation_replied",
      resourceType: "conversation",
      resourceId: conversation.id,
    });

    res.json({ ok: true });
  })
);

/** پایان ارجاع — مکالمه به AI برمی‌گردد */
router.post(
  "/:id/resolve",
  asyncHandler(async (req, res) => {
    const conversation = await getConversationOwnedByUser(req.params.id, req.auth!.userId);
    if (!conversation) return res.status(404).json({ error: "مکالمه یافت نشد." });

    const updated = await clearConversationEscalation(conversation.id);
    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "referral_resolved",
      resourceType: "conversation",
      resourceId: conversation.id,
    });

    res.json({ conversation: updated });
  })
);

export default router;
