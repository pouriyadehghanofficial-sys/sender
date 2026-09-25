import { Router } from "express";
import {
  listEscalatedConversations,
  getConversationById,
  clearConversationEscalation,
} from "../db/conversationRepository";
import { addMessage } from "../db/messageRepository";
import { sendBaleMessage } from "../providers/baleBotClient";
import { getSetting, SettingKeys } from "../db/settingsRepository";
import { MessageSender } from "../db/enums";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/** لیست مکالماتی که منتظر پاسخ اپراتور انسانی هستند */
router.get("/escalated", asyncHandler(async (_req, res) => {
  const conversations = await listEscalatedConversations();
  res.json({ conversations });
}));

/** تاریخچه کامل یک مکالمه (برای اینکه اپراتور قبل از پاسخ، کل زمینه را ببیند) */
router.get("/:id/messages", asyncHandler(async (req, res) => {
  const conversation = await getConversationById(req.params.id);
  if (!conversation) return res.status(404).json({ error: "مکالمه یافت نشد." });
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

    const conversation = await getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ error: "مکالمه یافت نشد." });
    if (!conversation.contact?.baleChatId) {
      return res.status(400).json({ error: "این مخاطب chat_id بازو ندارد؛ امکان ارسال پیام نیست." });
    }

    const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
    if (!botToken) return res.status(400).json({ error: "bale_bot_token تنظیم نشده است." });

    await sendBaleMessage({ botToken }, conversation.contact.baleChatId, text);
    await addMessage(conversation.id, MessageSender.HUMAN, text);

    res.json({ ok: true });
  } catch (err) {
    console.error("خطا در ارسال پاسخ دستی اپراتور:", err);
    res.status(500).json({ error: "خطای داخلی سرور در ارسال پاسخ." });
  }
});

/** پایان دادن به ارجاع — از این به بعد AI دوباره خودکار پاسخ می‌دهد */
router.post("/:id/resolve", async (req, res) => {
  try {
    const conversation = await clearConversationEscalation(req.params.id);
    res.json({ conversation });
  } catch (err) {
    console.error("خطا در پایان دادن به ارجاع:", err);
    res.status(500).json({ error: "خطای داخلی سرور." });
  }
});

export default router;
