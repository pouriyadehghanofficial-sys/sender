import { prisma } from "./client";

export async function recordUnansweredTopic(conversationId: string, topic: string) {
  const trimmed = topic.trim().slice(0, 300);
  if (!trimmed) return null;
  return prisma.unansweredTopic.create({ data: { conversationId, topic: trimmed } });
}

/** پرتکرارترین موضوعاتی که AI جوابشان را نمی‌دانست — برای بهبود محصول/توضیحات */
export async function getTopUnansweredTopics(limit = 50) {
  return prisma.unansweredTopic.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { conversation: { include: { product: true, contact: true } } },
  });
}

export async function countUnansweredTopics() {
  return prisma.unansweredTopic.count();
}
