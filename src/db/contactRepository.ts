import { prisma } from "./client";
import { ContactStatus } from "./enums";

export interface CreateContactInput {
  name: string;
  phone: string;
  productId?: string | null;
  /** null/undefined = بدون مالک (سیستم قدیمی تک‌مستأجر) — برای API چندمستأجری همیشه پر کنید */
  userId?: string | null;
}

export async function createContact(input: CreateContactInput) {
  return prisma.contact.create({
    data: {
      name: input.name,
      phone: input.phone,
      productId: input.productId ?? null,
      userId: input.userId ?? null,
      status: ContactStatus.PENDING,
    },
  });
}

/**
 * درج دسته‌ای مخاطبین. برای ده‌ها هزار ردیف، درج در بسته‌های ۵۰۰تایی انجام می‌شود تا
 * از سقف تعداد پارامتر SQLite یا تایم‌اوت یک کوئری خیلی بزرگ عبور نکنیم.
 */
export async function createContactsBulk(inputs: CreateContactInput[]) {
  const CHUNK = 500;
  let count = 0;
  for (let i = 0; i < inputs.length; i += CHUNK) {
    const slice = inputs.slice(i, i + CHUNK);
    const res = await prisma.contact.createMany({
      data: slice.map((c) => ({
        name: c.name,
        phone: c.phone,
        productId: c.productId ?? null,
        userId: c.userId ?? null,
        status: ContactStatus.PENDING,
      })),
    });
    count += res.count;
  }
  return { count };
}

/** شماره‌هایی که از قبل در دیتابیس هستند (برای جلوگیری از مخاطب تکراری هنگام import). کلید: «productId|phone» */
export async function listExistingContactKeys(userId?: string | null): Promise<Set<string>> {
  const rows = await prisma.contact.findMany({
    where: { userId: userId ?? null },
    select: { phone: true, productId: true },
  });
  return new Set(rows.map((r: { phone: string; productId: string | null }) => `${r.productId ?? ""}|${r.phone}`));
}

/** گزینه ۲ و ۳ کمپین: همه‌ی مخاطبین pending این محصول را یک‌جا passive می‌کند (بدون حلقه‌ی ۱۰هزارتایی) */
export async function markPendingContactsPassive(productId: string, userId?: string | null) {
  const res = await prisma.contact.updateMany({
    where: { productId, userId: userId ?? null, status: ContactStatus.PENDING },
    data: { status: ContactStatus.PASSIVE, errorMessage: null },
  });
  return res.count;
}

/**
 * userId=undefined/null یعنی حالت قدیمی تک‌مستأجر (مخاطبینی که مالک ندارند).
 * برای پلتفرم چندمستأجری همیشه userId واقعی کاربر پاس داده شود تا هیچ کاربری
 * مخاطبین کاربر دیگر را نبیند (IDOR).
 */
export async function listContactsByProduct(productId: string, userId?: string | null, status?: ContactStatus) {
  return prisma.contact.findMany({
    where: { productId, userId: userId ?? null, ...(status ? { status } : {}) },
    orderBy: { createdAt: "asc" },
  });
}

export async function findContactByPhone(phone: string) {
  return prisma.contact.findFirst({ where: { phone } });
}

export async function findContactByBaleChatId(baleChatId: string) {
  return prisma.contact.findFirst({ where: { baleChatId } });
}

export async function setContactBaleChatId(id: string, baleChatId: string) {
  return prisma.contact.update({ where: { id }, data: { baleChatId } });
}

/** ساخت مخاطب ad-hoc وقتی پیام ورودی webhook به هیچ مخاطب شناخته‌شده‌ای مرتبط نبود */
export async function createAdHocContactFromChat(baleChatId: string, name: string, productId?: string | null) {
  return prisma.contact.create({
    data: {
      name,
      productId: productId ?? null,
      phone: `bale-chat:${baleChatId}`, // مخاطب از طریق کمپین اکسل نیامده؛ شماره واقعی نداریم
      baleChatId,
      status: ContactStatus.SENT, // چون در حال گفتگوست، عملاً به او پیام رسیده
    },
  });
}

export async function updateContactStatus(
  id: string,
  status: ContactStatus,
  extra?: { sentAt?: Date; errorMessage?: string | null }
) {
  return prisma.contact.update({
    where: { id },
    data: {
      status,
      sentAt: extra?.sentAt,
      errorMessage: extra?.errorMessage,
    },
  });
}

/** خواندن حافظه‌ی ذخیره‌شده‌ی این مخاطب (خلاصه‌ی مکالمات قبلی) */
export async function getContactMemory(contactId: string): Promise<string | null> {
  const row = await prisma.contact.findUnique({ where: { id: contactId }, select: { memoryNotes: true } });
  return row?.memoryNotes ?? null;
}

/** به‌روزرسانی حافظه‌ی مخاطب؛ در پس‌زمینه بعد از هر پاسخ AI صدا زده می‌شود */
export async function updateContactMemory(contactId: string, memoryNotes: string) {
  return prisma.contact.update({ where: { id: contactId }, data: { memoryNotes } });
}

/** هر بار مشتری پیام می‌دهد صدا زده می‌شود؛ مبنای «پیگیری خودکار مشتریان مردد» است */
export async function touchContactLastInteraction(contactId: string) {
  return prisma.contact.update({ where: { id: contactId }, data: { lastInteractionAt: new Date() } });
}

export async function markFollowUpSent(contactId: string) {
  return prisma.contact.update({ where: { id: contactId }, data: { followUpSentAt: new Date() } });
}

/**
 * مخاطبینی که مکالمه‌ی فعال (بدون سفارش) دارند، حداقل `staleHours` ساعت از آخرین
 * پیامشان گذشته، و یا اصلاً پیگیری نشده‌اند یا آخرین پیگیری خیلی قبل بوده — ماده‌ی
 * خام «پیگیری خودکار مشتریان مردد / یادآوری سبد رهاشده».
 */
export async function listStaleUndecidedContacts(staleHours: number, cooldownHours: number) {
  const staleCutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000);
  const cooldownCutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  return prisma.contact.findMany({
    where: {
      baleChatId: { not: null },
      lastInteractionAt: { not: null, lt: staleCutoff },
      OR: [{ followUpSentAt: null }, { followUpSentAt: { lt: cooldownCutoff } }],
      conversations: {
        some: { state: "active", orders: { none: {} } },
      },
    },
    include: {
      product: true,
      conversations: {
        where: { state: "active" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { messages: { orderBy: { createdAt: "desc" }, take: 6 } },
      },
    },
    take: 200,
  });
}

export async function getContactById(id: string) {
  return prisma.contact.findUnique({ where: { id } });
}

export async function getContactOwnedByUser(id: string, userId: string) {
  return prisma.contact.findFirst({ where: { id, userId } });
}

/** مخاطبین ad-hoc (کسانی که خودشان به بات پیام داده‌اند) جزو لیست کمپین حساب نمی‌شوند */
function campaignContactsWhere(productId: string, userId?: string | null) {
  return { productId, userId: userId ?? null, NOT: { phone: { startsWith: "bale-chat:" } } };
}

/** شمارش وضعیت‌ها با groupBy — سبک؛ برای پولینگ پنل حتی با ۱۰ هزار مخاطب */
export async function getCampaignCounts(productId: string, userId?: string | null) {
  const rows = await prisma.contact.groupBy({
    by: ["status"],
    where: campaignContactsWhere(productId, userId),
    _count: { status: true },
  });
  const counts = { pending: 0, sent: 0, failed: 0, no_bale: 0, passive: 0 };
  for (const r of rows as { status: string; _count: { status: number } }[]) {
    if (r.status in counts) counts[r.status as keyof typeof counts] = r._count.status;
  }
  return counts;
}

/**
 * گزارش کمپین. `limit` برای نمایش در پنل است (مثلاً ۲۰۰ ردیف اول)؛ برای CSV بدون limit صدا بزنید.
 */
export async function getCampaignReport(productId: string, userId?: string | null, opts?: { limit?: number }) {
  const counts = await getCampaignCounts(productId, userId);
  const contacts = await prisma.contact.findMany({
    where: campaignContactsWhere(productId, userId),
    orderBy: { createdAt: "asc" },
    ...(opts?.limit ? { take: opts.limit } : {}),
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, contacts, total };
}

export async function countContactsForUser(userId: string) {
  return prisma.contact.count({ where: { userId } });
}

/** شمارش مخاطبین به تفکیک وضعیت — برای خلاصه‌ی داشبورد (بخش ۱۰/۱۱/۱۷ سند) */
export async function getContactStatusCountsForUser(userId: string) {
  const rows = await prisma.contact.groupBy({
    by: ["status"],
    where: { userId },
    _count: { status: true },
  });
  const counts = { pending: 0, sent: 0, failed: 0, no_bale: 0 };
  for (const r of rows as { status: string; _count: { status: number } }[]) {
    if (r.status in counts) counts[r.status as keyof typeof counts] = r._count.status;
  }
  return counts;
}

/** پیام‌های امروز/این هفته/این ماه (برای آمار بخش ۱۱ سند) — بر اساس sentAt مخاطبین */
export async function countMessagesSentSince(userId: string, since: Date) {
  return prisma.contact.count({ where: { userId, sentAt: { gte: since } } });
}
