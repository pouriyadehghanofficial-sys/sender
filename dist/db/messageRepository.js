"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMessage = addMessage;
exports.listMessagesForConversation = listMessagesForConversation;
exports.messageExistsByExternalId = messageExistsByExternalId;
const client_1 = require("./client");
async function addMessage(conversationId, sender, text, externalMessageId) {
    return client_1.prisma.message.create({
        data: { conversationId, sender, text, externalMessageId: externalMessageId ?? null },
    });
}
async function listMessagesForConversation(conversationId) {
    return client_1.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
    });
}
/** برای idempotency در وبهوک: آیا این پیام قبلاً پردازش شده؟ */
async function messageExistsByExternalId(externalMessageId) {
    const found = await client_1.prisma.message.findUnique({ where: { externalMessageId } });
    return !!found;
}
