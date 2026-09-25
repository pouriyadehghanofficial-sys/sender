"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContact = createContact;
exports.createContactsBulk = createContactsBulk;
exports.listContactsByProduct = listContactsByProduct;
exports.findContactByPhone = findContactByPhone;
exports.findContactByBaleChatId = findContactByBaleChatId;
exports.setContactBaleChatId = setContactBaleChatId;
exports.createAdHocContactFromChat = createAdHocContactFromChat;
exports.updateContactStatus = updateContactStatus;
exports.getContactById = getContactById;
exports.getContactOwnedByUser = getContactOwnedByUser;
exports.getCampaignReport = getCampaignReport;
exports.countContactsForUser = countContactsForUser;
exports.getContactStatusCountsForUser = getContactStatusCountsForUser;
exports.countMessagesSentSince = countMessagesSentSince;
const client_1 = require("./client");
const enums_1 = require("./enums");
async function createContact(input) {
    return client_1.prisma.contact.create({
        data: {
            name: input.name,
            phone: input.phone,
            productId: input.productId ?? null,
            userId: input.userId ?? null,
            status: enums_1.ContactStatus.PENDING,
        },
    });
}
async function createContactsBulk(inputs) {
    return client_1.prisma.contact.createMany({
        data: inputs.map((i) => ({
            name: i.name,
            phone: i.phone,
            productId: i.productId ?? null,
            userId: i.userId ?? null,
            status: enums_1.ContactStatus.PENDING,
        })),
    });
}
/**
 * userId=undefined/null یعنی حالت قدیمی تک‌مستأجر (مخاطبینی که مالک ندارند).
 * برای پلتفرم چندمستأجری همیشه userId واقعی کاربر پاس داده شود تا هیچ کاربری
 * مخاطبین کاربر دیگر را نبیند (IDOR).
 */
async function listContactsByProduct(productId, userId, status) {
    return client_1.prisma.contact.findMany({
        where: { productId, userId: userId ?? null, ...(status ? { status } : {}) },
        orderBy: { createdAt: "asc" },
    });
}
async function findContactByPhone(phone) {
    return client_1.prisma.contact.findFirst({ where: { phone } });
}
async function findContactByBaleChatId(baleChatId) {
    return client_1.prisma.contact.findFirst({ where: { baleChatId } });
}
async function setContactBaleChatId(id, baleChatId) {
    return client_1.prisma.contact.update({ where: { id }, data: { baleChatId } });
}
/** ساخت مخاطب ad-hoc وقتی پیام ورودی webhook به هیچ مخاطب شناخته‌شده‌ای مرتبط نبود */
async function createAdHocContactFromChat(baleChatId, name) {
    return client_1.prisma.contact.create({
        data: {
            name,
            phone: `bale-chat:${baleChatId}`, // مخاطب از طریق کمپین اکسل نیامده؛ شماره واقعی نداریم
            baleChatId,
            status: enums_1.ContactStatus.SENT, // چون در حال گفتگوست، عملاً به او پیام رسیده
        },
    });
}
async function updateContactStatus(id, status, extra) {
    return client_1.prisma.contact.update({
        where: { id },
        data: {
            status,
            sentAt: extra?.sentAt,
            errorMessage: extra?.errorMessage,
        },
    });
}
async function getContactById(id) {
    return client_1.prisma.contact.findUnique({ where: { id } });
}
async function getContactOwnedByUser(id, userId) {
    return client_1.prisma.contact.findFirst({ where: { id, userId } });
}
async function getCampaignReport(productId, userId) {
    const contacts = await client_1.prisma.contact.findMany({ where: { productId, userId: userId ?? null } });
    const counts = { pending: 0, sent: 0, failed: 0, no_bale: 0 };
    for (const c of contacts) {
        if (c.status in counts)
            counts[c.status]++;
    }
    return { counts, contacts };
}
async function countContactsForUser(userId) {
    return client_1.prisma.contact.count({ where: { userId } });
}
/** شمارش مخاطبین به تفکیک وضعیت — برای خلاصه‌ی داشبورد (بخش ۱۰/۱۱/۱۷ سند) */
async function getContactStatusCountsForUser(userId) {
    const rows = await client_1.prisma.contact.groupBy({
        by: ["status"],
        where: { userId },
        _count: { status: true },
    });
    const counts = { pending: 0, sent: 0, failed: 0, no_bale: 0 };
    for (const r of rows) {
        if (r.status in counts)
            counts[r.status] = r._count.status;
    }
    return counts;
}
/** پیام‌های امروز/این هفته/این ماه (برای آمار بخش ۱۱ سند) — بر اساس sentAt مخاطبین */
async function countMessagesSentSince(userId, since) {
    return client_1.prisma.contact.count({ where: { userId, sentAt: { gte: since } } });
}
