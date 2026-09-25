import { prisma } from "./client";

export interface CreatePromptVariantInput {
  productId: string;
  name: string;
  descriptionText: string;
  weight?: number;
}

export async function createPromptVariant(input: CreatePromptVariantInput) {
  return prisma.promptVariant.create({
    data: {
      productId: input.productId,
      name: input.name,
      descriptionText: input.descriptionText,
      weight: input.weight ?? 1,
    },
  });
}

export async function listPromptVariants(productId: string) {
  return prisma.promptVariant.findMany({ where: { productId }, orderBy: { createdAt: "asc" } });
}

export async function listActivePromptVariants(productId: string) {
  return prisma.promptVariant.findMany({ where: { productId, isActive: true } });
}

export async function setPromptVariantActive(id: string, isActive: boolean) {
  return prisma.promptVariant.update({ where: { id }, data: { isActive } });
}

export async function deletePromptVariant(id: string) {
  return prisma.promptVariant.delete({ where: { id } });
}

/**
 * گزارش A/B: به‌ازای هر نسخه، چند مکالمه به آن اختصاص داده شده و چند تای آن‌ها
 * سفارش نهایی داشته‌اند (نرخ تبدیل). حالت «بدون نسخه» (پرامپت پیش‌فرض محصول) هم
 * به‌عنوان یک ردیف مرجع کنار نسخه‌ها گزارش می‌شود تا مقایسه معنادار باشد.
 */
export async function getPromptVariantConversionReport(productId: string) {
  const variants = await listPromptVariants(productId);

  const rows = await Promise.all(
    variants.map(async (v: { id: string; name: string; isActive: boolean; weight: number }) => {
      const conversations = await prisma.conversation.count({ where: { promptVariantId: v.id } });
      const orders = await prisma.order.count({ where: { conversation: { promptVariantId: v.id } } });
      return {
        variantId: v.id,
        name: v.name,
        isActive: v.isActive,
        weight: v.weight,
        conversations,
        orders,
        conversionRate: conversations > 0 ? Number(((orders / conversations) * 100).toFixed(1)) : 0,
      };
    })
  );

  const baselineConversations = await prisma.conversation.count({ where: { productId, promptVariantId: null } });
  const baselineOrders = await prisma.order.count({
    where: { conversation: { productId, promptVariantId: null } },
  });
  rows.unshift({
    variantId: null as any,
    name: "پرامپت پیش‌فرض محصول (بدون نسخه)",
    isActive: true,
    weight: 0,
    conversations: baselineConversations,
    orders: baselineOrders,
    conversionRate: baselineConversations > 0 ? Number(((baselineOrders / baselineConversations) * 100).toFixed(1)) : 0,
  });

  return rows;
}
