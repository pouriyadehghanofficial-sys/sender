"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.listOrders = listOrders;
exports.listOrdersForUser = listOrdersForUser;
exports.getOrderOwnedByUser = getOrderOwnedByUser;
exports.countOrdersForUser = countOrdersForUser;
const client_1 = require("./client");
const enums_1 = require("./enums");
async function createOrder(conversationId) {
    return client_1.prisma.order.create({
        data: { conversationId, status: enums_1.OrderStatus.COMPLETED },
    });
}
async function listOrders() {
    return client_1.prisma.order.findMany({
        include: { conversation: { include: { contact: true, product: true } } },
        orderBy: { createdAt: "desc" },
    });
}
/** فقط سفارش‌های مخاطبینی که متعلق به همین کاربرند (چندمستأجری) */
async function listOrdersForUser(userId) {
    return client_1.prisma.order.findMany({
        where: { conversation: { contact: { userId } } },
        include: { conversation: { include: { contact: true, product: true } } },
        orderBy: { createdAt: "desc" },
    });
}
async function getOrderOwnedByUser(id, userId) {
    return client_1.prisma.order.findFirst({
        where: { id, conversation: { contact: { userId } } },
        include: { conversation: { include: { contact: true, product: true } } },
    });
}
async function countOrdersForUser(userId) {
    return client_1.prisma.order.count({ where: { conversation: { contact: { userId } } } });
}
