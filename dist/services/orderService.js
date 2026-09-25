"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeOrder = completeOrder;
const orderRepository_1 = require("../db/orderRepository");
const conversationRepository_1 = require("../db/conversationRepository");
const webhookService_1 = require("./webhookService");
const notificationService_1 = require("./notificationService");
const adminNotificationDispatcher_1 = require("./adminNotificationDispatcher");
const enums_1 = require("../db/enums");
function summarizeConversation(messages, maxMessages = 6) {
    const recent = messages.slice(-maxMessages);
    return recent
        .map((m) => `${m.sender === enums_1.MessageSender.USER ? "کاربر" : "دستیار"}: ${m.text}`)
        .join("\n");
}
/**
 * وقتی تگ [ORDER_CONFIRMED] در پاسخ AI تشخیص داده شد (فاز ۶)، این تابع صدا زده می‌شود:
 * رکورد order می‌سازد، وضعیت مکالمه را completed می‌کند و به مالک کسب‌وکار اطلاع می‌دهد.
 */
async function completeOrder(conversationId) {
    await (0, orderRepository_1.createOrder)(conversationId);
    await (0, conversationRepository_1.updateConversationState)(conversationId, enums_1.ConversationState.COMPLETED);
    const conversation = await (0, webhookService_1.getConversationWithDetails)(conversationId);
    if (!conversation) {
        console.error(`[completeOrder] مکالمه ${conversationId} بعد از ثبت سفارش پیدا نشد.`);
        return;
    }
    const text = (0, notificationService_1.buildOrderNotificationText)({
        customerName: conversation.contact.name,
        customerPhone: conversation.contact.phone,
        productName: conversation.product?.name ?? "نامشخص",
        conversationSummary: summarizeConversation(conversation.messages),
    });
    await (0, adminNotificationDispatcher_1.sendAdminNotification)(text);
}
