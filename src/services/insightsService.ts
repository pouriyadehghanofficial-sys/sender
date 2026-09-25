import { countEscalatedConversations } from "../db/conversationRepository";
import { getTopUnansweredTopics, countUnansweredTopics } from "../db/unansweredTopicRepository";

/**
 * گزارش «چرا AI کم می‌آورد»: دلایل رایج ارجاع به انسان + پرتکرارترین موضوعاتی که
 * AI صادقانه گفته جوابشان را نمی‌داند. این دو با هم می‌گویند دقیقاً کجای توضیحات
 * محصول یا شرایط ارجاع باید کامل‌تر شود.
 */
export async function getInsightsReport() {
  const escalation = await countEscalatedConversations();
  const unansweredTotal = await countUnansweredTopics();
  const recentTopics = await getTopUnansweredTopics(100);

  // گروه‌بندی ساده‌ی متن‌محور: موضوعات کاملاً یکسان (بعد از نرمال‌سازی خیلی ساده) را می‌شمارد
  const normalized = new Map<string, { topic: string; count: number; lastSeenAt: Date }>();
  for (const row of recentTopics as any[]) {
    const key = row.topic.trim().toLowerCase();
    const existing = normalized.get(key);
    if (existing) {
      existing.count++;
      if (row.createdAt > existing.lastSeenAt) existing.lastSeenAt = row.createdAt;
    } else {
      normalized.set(key, { topic: row.topic, count: 1, lastSeenAt: row.createdAt });
    }
  }
  const topUnansweredTopics = [...normalized.values()].sort((a, b) => b.count - a.count).slice(0, 20);

  return {
    escalation, // { total, byReason }
    unansweredTopics: { total: unansweredTotal, top: topUnansweredTopics },
  };
}
