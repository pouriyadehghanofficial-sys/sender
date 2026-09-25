import { prisma } from "./client";
import { ConversationState } from "./enums";

export async function createConversation(
  contactId: string,
  productId?: string | null,
  promptVariantId?: string | null
) {
  return prisma.conversation.create({
    data: {
      contactId,
      productId: productId ?? null,
      promptVariantId: promptVariantId ?? null,
      state: ConversationState.ACTIVE,
    },
  });
}

export async function getActiveConversationForContact(contactId: string) {
  return prisma.conversation.findFirst({
    where: { contactId, state: ConversationState.ACTIVE },
    orderBy: { createdAt: "desc" },
  });
}

/** پیدا کردن مکالمه‌ی فعال یا ساخت یک مکالمه‌ی جدید برای مخاطب — استفاده در فاز ۶ */
export async function findOrCreateActiveConversation(contactId: string, productId?: string | null) {
  const existing = await getActiveConversationForContact(contactId);
  if (existing) return existing;
  return createConversation(contactId, productId);
}

export async function getConversationById(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      contact: true,
      product: true,
      promptVariant: true,
    },
  });
}

export async function updateConversationState(id: string, state: ConversationState) {
  return prisma.conversation.update({ where: { id }, data: { state } });
}

export async function markConversationEscalated(id: string, reason: string) {
  return prisma.conversation.update({
    where: { id },
    data: { needsHuman: true, escalatedAt: new Date(), escalationReason: reason },
  });
}

export async function clearConversationEscalation(id: string) {
  return prisma.conversation.update({
    where: { id },
    data: { needsHuman: false, escalationReason: null },
  });
}

export async function listEscalatedConversations() {
  return prisma.conversation.findMany({
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
export async function getConversationOwnedByUser(id: string, userId: string) {
  return prisma.conversation.findFirst({
    where: { id, contact: { userId } },
    include: { messages: { orderBy: { createdAt: "asc" } }, contact: true, product: true },
  });
}

export async function listActiveConversationsWithLastMessage() {
  return prisma.conversation.findMany({
    where: { state: ConversationState.ACTIVE },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** فقط مکالمات فعالِ مخاطبینی که متعلق به همین کاربرند (چندمستأجری) */
export async function listActiveConversationsForUser(userId: string) {
  return prisma.conversation.findMany({
    where: { state: ConversationState.ACTIVE, contact: { userId } },
    include: {
      contact: true,
      product: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** مکالماتی که منتظر پاسخ همین کاربرند (ارجاع‌شده به انسان) — بخش ۷/۹ سند */
export async function listWaitingForResponseForUser(userId: string) {
  return prisma.conversation.findMany({
    where: { needsHuman: true, contact: { userId } },
    include: {
      contact: true,
      product: true,
      messages: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: { escalatedAt: "desc" },
  });
}

export async function countActiveConversationsForUser(userId: string) {
  return prisma.conversation.count({ where: { state: ConversationState.ACTIVE, contact: { userId } } });
}

export async function countWaitingForResponseForUser(userId: string) {
  return prisma.conversation.count({ where: { needsHuman: true, contact: { userId } } });
}

/**
 * مکالمات فعالی که آخرین پیامشان از طرف کاربر است، یعنی کاربر نوشته ولی هنوز پاسخی نگرفته
 * (مثلاً چون در گزینه ۱ AI خاموش بود، یا سرور ری‌استارت شد و تایمر پاسخ از بین رفت).
 * مکالمات ارجاع‌شده به انسان (needsHuman) عمداً حذف می‌شوند.
 * نتیجه بر اساس قدیمی‌ترین پیام بی‌پاسخ مرتب است تا اول نوبتِ کسانی برسد که بیشتر منتظر مانده‌اند.
 */
export async function listUnansweredChats(opts?: { maxAgeMs?: number }) {
  const rows = await prisma.conversation.findMany({
    where: {
      state: ConversationState.ACTIVE,
      needsHuman: false,
      contact: { baleChatId: { not: null } },
    },
    select: {
      id: true,
      contact: { select: { baleChatId: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { sender: true, createdAt: true } },
    },
  });

  const now = Date.now();
  const seen = new Set<string>();
  const result: { conversationId: string; chatId: string; lastUserAt: Date }[] = [];
  for (const r of rows as any[]) {
    const last = r.messages[0];
    const chatId: string | null = r.contact?.baleChatId ?? null;
    if (!last || last.sender !== "user" || !chatId || seen.has(chatId)) continue;
    if (opts?.maxAgeMs && now - new Date(last.createdAt).getTime() > opts.maxAgeMs) continue;
    seen.add(chatId);
    result.push({ conversationId: r.id, chatId, lastUserAt: new Date(last.createdAt) });
  }
  result.sort((a, b) => a.lastUserAt.getTime() - b.lastUserAt.getTime());
  return result;
}

/** شمار گفتگوهای ارجاع‌شده به انسان (AI در این‌ها جواب نمی‌دهد) به تفکیک دلیل */
export async function countEscalatedConversations() {
  const rows = await prisma.conversation.groupBy({
    by: ["escalationReason"],
    where: { needsHuman: true },
    _count: { _all: true },
  });
  const byReason: Record<string, number> = {};
  let total = 0;
  for (const r of rows as { escalationReason: string | null; _count: { _all: number } }[]) {
    byReason[r.escalationReason ?? "نامشخص"] = r._count._all;
    total += r._count._all;
  }
  return { total, byReason };
}

/**
 * مکالماتی که به سفارش ختم نشده‌اند (نه completed با order، و مدتی است پیامی رد و بدل
 * نشده) — ماده‌ی خام گزارش «چرا مشتری نخرید». `sinceHours` یعنی حداقل چند ساعت از
 * آخرین پیام گذشته باشد (که معلوم شود واقعاً رهاشده، نه یک مکالمه‌ی در حال جریان).
 */
export async function listConversationsWithoutOrder(opts?: { sinceHours?: number; limit?: number }) {
  const sinceHours = opts?.sinceHours ?? 2;
  const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  return prisma.conversation.findMany({
    where: {
      updatedAt: { lt: cutoff },
      orders: { none: {} },
      messages: { some: {} },
    },
    include: {
      contact: true,
      product: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: opts?.limit ?? 100,
  });
}

/** برگرداندن همه‌ی گفتگوهای ارجاع‌شده به AI (مثلاً بعد از تست یا وقتی سقف پیام خیلی کم بوده) */
export async function clearAllEscalations() {
  const res = await prisma.conversation.updateMany({
    where: { needsHuman: true },
    data: { needsHuman: false, escalationReason: null },
  });
  return res.count;
}
