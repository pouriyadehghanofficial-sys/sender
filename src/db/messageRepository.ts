import { prisma } from "./client";
import { MessageSender } from "./enums";

export async function addMessage(
  conversationId: string,
  sender: MessageSender,
  text: string,
  externalMessageId?: string | null
) {
  return prisma.message.create({
    data: { conversationId, sender, text, externalMessageId: externalMessageId ?? null },
  });
}

export async function listMessagesForConversation(conversationId: string) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
}

/** حذف یک پیام — برای وقتی که پاسخ AI ذخیره شده ولی ارسال آن به کاربر ناموفق بوده (تا بعداً دوباره تلاش شود) */
export async function deleteMessage(id: string) {
  return prisma.message.deleteMany({ where: { id } });
}

/** برای idempotency در وبهوک: آیا این پیام قبلاً پردازش شده؟ */
export async function messageExistsByExternalId(externalMessageId: string) {
  const found = await prisma.message.findUnique({ where: { externalMessageId } });
  return !!found;
}
