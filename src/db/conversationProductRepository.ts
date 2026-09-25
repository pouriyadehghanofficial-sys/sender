import { prisma } from "./client";

/** محصولات اضافه‌ای که در همین مکالمه (غیر از محصول اصلی) قبلاً مطرح شده‌اند */
export async function listExtraProductsForConversation(conversationId: string) {
  const rows = await prisma.conversationProduct.findMany({
    where: { conversationId },
    include: { product: true },
    orderBy: { addedAt: "asc" },
  });
  return rows.map((r: { product: unknown }) => r.product) as any[];
}

/** اتصال یک محصول دیگر به مکالمه؛ اگر قبلاً متصل بوده کاری نمی‌کند (idempotent) */
export async function attachProductToConversation(conversationId: string, productId: string) {
  return prisma.conversationProduct.upsert({
    where: { conversationId_productId: { conversationId, productId } },
    update: {},
    create: { conversationId, productId },
  });
}
