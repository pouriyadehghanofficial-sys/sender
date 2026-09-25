import { prisma } from "./client";

export interface LogActivityInput {
  userId?: string | null;
  apiKeyId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logActivity(input: LogActivityInput) {
  return prisma.activityLog.create({
    data: {
      userId: input.userId ?? null,
      apiKeyId: input.apiKeyId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function listActivityForUser(userId: string, limit = 50) {
  return prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** برای دید مدیریتی مالک پلتفرم: کل لاگ، یا فیلترشده روی یک apiKeyId/userId خاص */
export async function listActivityForOwner(filter: { userId?: string; apiKeyId?: string }, limit = 200) {
  return prisma.activityLog.findMany({
    where: {
      userId: filter.userId ?? undefined,
      apiKeyId: filter.apiKeyId ?? undefined,
    },
    include: { user: true, apiKey: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** خلاصه‌ی تعداد هر action برای یک apiKeyId — برای پاسخ به «این کلید چه کارهایی کرد؟» */
export async function summarizeActivityByApiKey(apiKeyId: string) {
  const rows = await prisma.activityLog.findMany({ where: { apiKeyId } });
  const summary: Record<string, number> = {};
  for (const row of rows as { action: string }[]) {
    summary[row.action] = (summary[row.action] ?? 0) + 1;
  }
  return summary;
}
