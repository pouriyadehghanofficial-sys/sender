import { prisma } from "./client";
import { OrderStatus } from "./enums";

export async function createOrder(conversationId: string) {
  return prisma.order.create({
    data: { conversationId, status: OrderStatus.COMPLETED },
  });
}

export async function listOrders() {
  return prisma.order.findMany({
    include: { conversation: { include: { contact: true, product: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** فقط سفارش‌های مخاطبینی که متعلق به همین کاربرند (چندمستأجری) */
export async function listOrdersForUser(userId: string) {
  return prisma.order.findMany({
    where: { conversation: { contact: { userId } } },
    include: { conversation: { include: { contact: true, product: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrderOwnedByUser(id: string, userId: string) {
  return prisma.order.findFirst({
    where: { id, conversation: { contact: { userId } } },
    include: { conversation: { include: { contact: true, product: true } } },
  });
}

export async function countOrdersForUser(userId: string) {
  return prisma.order.count({ where: { conversation: { contact: { userId } } } });
}
