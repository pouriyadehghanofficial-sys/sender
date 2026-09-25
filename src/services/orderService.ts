import { createOrder } from "../db/orderRepository";
import { updateConversationState } from "../db/conversationRepository";
import { getConversationWithDetails } from "./webhookService";
import { buildOrderNotificationText } from "./notificationService";
import { sendAdminNotification } from "./adminNotificationDispatcher";
import { ConversationState, MessageSender } from "../db/enums";

interface ConversationMessageLike {
  sender: string;
  text: string;
}

function summarizeConversation(messages: ConversationMessageLike[], maxMessages = 6): string {
  const recent = messages.slice(-maxMessages);
  return recent
    .map((m) => `${m.sender === MessageSender.USER ? "کاربر" : "دستیار"}: ${m.text}`)
    .join("\n");
}

/**
 * وقتی تگ [ORDER_CONFIRMED] در پاسخ AI تشخیص داده شد (فاز ۶)، این تابع صدا زده می‌شود:
 * رکورد order می‌سازد، وضعیت مکالمه را completed می‌کند و به مالک کسب‌وکار اطلاع می‌دهد.
 */
export async function completeOrder(conversationId: string): Promise<void> {
  await createOrder(conversationId);
  await updateConversationState(conversationId, ConversationState.COMPLETED);

  const conversation = await getConversationWithDetails(conversationId);
  if (!conversation) {
    console.error(`[completeOrder] مکالمه ${conversationId} بعد از ثبت سفارش پیدا نشد.`);
    return;
  }

  const text = buildOrderNotificationText({
    customerName: conversation.contact.name,
    customerPhone: conversation.contact.phone,
    productName: conversation.product?.name ?? "نامشخص",
    conversationSummary: summarizeConversation(conversation.messages),
  });

  await sendAdminNotification(text);
}
