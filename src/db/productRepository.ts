import { prisma } from "./client";

export interface CreateProductInput {
  name: string;
  shortCode: string;
  descriptionText: string;
  /** آدرس عکس محصول (اختیاری) — در اولین پاسخ AI برای مشتری فرستاده می‌شود */
  photoUrl?: string | null;
  /** null/undefined = محصول سراسری (global)، در غیر این صورت متعلق به همان کاربر */
  userId?: string | null;
}

export async function createProduct(input: CreateProductInput) {
  return prisma.product.create({
    data: {
      name: input.name,
      shortCode: input.shortCode,
      descriptionText: input.descriptionText,
      photoUrl: input.photoUrl ?? null,
      userId: input.userId ?? null,
    },
  });
}

export async function listProducts() {
  return prisma.product.findMany({ orderBy: { createdAt: "desc" } });
}

/** فقط محصولات همان کاربر + محصولات سراسری (userId=null) — طبق بخش ۵ سند چندمستأجری */
export async function listProductsForUser(userId: string) {
  return prisma.product.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

/** فقط اگر محصول متعلق به همین کاربر یا سراسری باشد برمی‌گرداند — جلوگیری از IDOR */
export async function getProductAccessibleByUser(id: string, userId: string) {
  return prisma.product.findFirst({ where: { id, OR: [{ userId }, { userId: null }] } });
}

/** فقط اگر واقعاً مالک همین کاربر باشد (نه سراسری) — برای edit/deactivate */
export async function getProductOwnedByUser(id: string, userId: string) {
  return prisma.product.findFirst({ where: { id, userId } });
}

export async function getProductByShortCode(shortCode: string) {
  return prisma.product.findUnique({ where: { shortCode } });
}

export async function updateProduct(id: string, data: Partial<CreateProductInput>) {
  return prisma.product.update({ where: { id }, data });
}

export async function setProductActive(id: string, isActive: boolean) {
  return prisma.product.update({ where: { id }, data: { isActive } });
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({ where: { id } });
}

export async function countActiveProductsForUser(userId: string) {
  return prisma.product.count({ where: { userId, isActive: true } });
}

/**
 * برای حالت passive: وقتی کاربر جدیدی پیام می‌دهد و هیچ مخاطب شناخته‌شده‌ای نداریم،
 * اولین محصول فعال را به‌عنوان پیش‌فرض برمی‌گرداند تا prompt محصول استفاده شود
 * (به جای FALLBACK_SYSTEM_PROMPT عمومی).
 */
export async function getDefaultProductForWebhook() {
  return prisma.product.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}
