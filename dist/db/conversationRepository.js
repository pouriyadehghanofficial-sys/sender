"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConversation = createConversation;
exports.getActiveConversationForContact = getActiveConversationForContact;
exports.findOrCreateActiveConversation = findOrCreateActiveConversation;
exports.getConversationById = getConversationById;
exports.updateConversationState = updateConversationState;
exports.markConversationEscalated = markConversationEscalated;
exports.clearConversationEscalation = clearConversationEscalation;
exports.listEscalatedConversations = listEscalatedConversations;
exports.getConversationOwnedByUser = getConversationOwnedByUser;
exports.listActiveConversationsWithLastMessage = listActiveConversationsWithLastMessage;
exports.listActiveConversationsForUser = listActiveConversationsForUser;
exports.listWaitingForResponseForUser = listWaitingForResponseForUser;
exports.countActiveConversationsForUser = countActiveConversationsForUser;
exports.countWaitingForResponseForUser = countWaitingForResponseForUser;
const client_1 = require("./client");
const enums_1 = require("./enums");
async function createConversation(contactId, productId) {
    return client_1.prisma.conversation.create({
        data: { contactId, productId: productId ?? null, state: enums_1.ConversationState.ACTIVE },
    });
}
async function getActiveConversationForContact(contactId) {
    return client_1.prisma.conversation.findFirst({
        where: { contactId, state: enums_1.ConversationState.ACTIVE },
        orderBy: { createdAt: "desc" },
    });
}
/** پیدا کردن مکالمه‌ی فعال یا ساخت یک مکالمه‌ی جدید برای مخاطب — استفاده در فاز ۶ */
async function findOrCreateActiveConversation(contactId, productId) {
    const existing = await getActiveConversationForContact(contactId);
    if (existing)
        return existing;
    return createConversation(contactId, productId);
}
async function getConversationById(id) {
    return client_1.prisma.conversation.findUnique({
        where: { id },
        include: { messages: { orderBy: { createdAt: "asc" } }, contact: true, product: true },
    });
}
async function updateConversationState(id, state) {
    return client_1.prisma.conversation.update({ where: { id }, data: { state } });
}
async function markConversationEscalated(id, reason) {
    return client_1.prisma.conversation.update({
        where: { id },
        data: { needsHuman: true, escalatedAt: new Date(), escalationReason: reason },
    });
}
async function clearConversationEscalation(id) {
    return client_1.prisma.conversation.update({
        where: { id },
        data: { needsHuman: false, escalationReason: null },
    });
}
async function listEscalatedConversations() {
    return client_1.prisma.conversation.findMany({
        where: { needsHuman: true },
        include: {
            contact: true,
            product: true,
            messages: { orderBy: { createdAt: "desc" }, take: 3 },
        },
        orderBy: { escalatedAt: "desc" },
    });
}
/** برای دید مدیریتی مالک پلتفرم: فقط سفارش‌های همان کاربر (از طریق مخاطب) */
async function getConversationOwnedByUser(id, userId) {
    return client_1.prisma.conversation.findFirst({
        where: { id, contact: { userId } },
        include: { messages: { orderBy: { createdAt: "asc" } }, contact: true, product: true },
    });
}
async function listActiveConversationsWithLastMessage() {
    return client_1.prisma.conversation.findMany({
        where: { state: enums_1.ConversationState.ACTIVE },
        include: {
            contact: true,
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
    });
}
/** فقط مکالمات فعالِ مخاطبینی که متعلق به همین کاربرند (چندمستأجری) */
async function listActiveConversationsForUser(userId) {
    return client_1.prisma.conversation.findMany({
        where: { state: enums_1.ConversationState.ACTIVE, contact: { userId } },
        include: {
            contact: true,
            product: true,
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
    });
}
/** مکالماتی که منتظر پاسخ همین کاربرند (ارجاع‌شده به انسان) — بخش ۷/۹ سند */
async function listWaitingForResponseForUser(userId) {
    return client_1.prisma.conversation.findMany({
        where: { needsHuman: true, contact: { userId } },
        include: {
            contact: true,
            product: true,
            messages: { orderBy: { createdAt: "desc" }, take: 3 },
        },
        orderBy: { escalatedAt: "desc" },
    });
}
async function countActiveConversationsForUser(userId) {
    return client_1.prisma.conversation.count({ where: { state: enums_1.ConversationState.ACTIVE, contact: { userId } } });
}
async function countWaitingForResponseForUser(userId) {
    return client_1.prisma.conversation.count({ where: { needsHuman: true, contact: { userId } } });
}
