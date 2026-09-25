import { prisma } from "./client";

export const CampaignStatus = {
  DRAFT: "draft",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export async function createCampaign(userId: string, productId: string, name?: string) {
  return prisma.campaign.create({ data: { userId, productId, name: name ?? null } });
}

export async function getCampaignOwnedByUser(id: string, userId: string) {
  return prisma.campaign.findFirst({ where: { id, userId }, include: { product: true } });
}

export async function listCampaignsForUser(userId: string) {
  return prisma.campaign.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateCampaignStatus(id: string, status: CampaignStatus, extra?: Record<string, unknown>) {
  const timestampField =
    status === CampaignStatus.RUNNING
      ? { startedAt: new Date() }
      : status === CampaignStatus.PAUSED
      ? { pausedAt: new Date() }
      : status === CampaignStatus.COMPLETED
      ? { completedAt: new Date() }
      : status === CampaignStatus.CANCELLED
      ? { cancelledAt: new Date() }
      : {};

  return prisma.campaign.update({
    where: { id },
    data: { status, ...timestampField, ...(extra ?? {}) },
  });
}

export async function updateCampaignProgress(
  id: string,
  progress: { totalContacts?: number; processed?: number; successful?: number; failed?: number }
) {
  return prisma.campaign.update({ where: { id }, data: progress });
}

/** برای بررسی سریع "الان باید متوقف بشه یا نه" وسط حلقه‌ی ارسال، بدون نگه‌داشتن state در حافظه */
export async function getCampaignStatus(id: string): Promise<CampaignStatus | null> {
  const row = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
  return (row?.status as CampaignStatus) ?? null;
}

export async function countCampaignsForUser(userId: string, status?: CampaignStatus) {
  return prisma.campaign.count({ where: { userId, ...(status ? { status } : {}) } });
}
