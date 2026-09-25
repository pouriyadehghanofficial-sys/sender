import { prisma } from "./client";
import { encryptSecret, decryptSecret } from "../utils/crypto";
import { ProviderType } from "./enums";

export interface CreateAiProviderInput {
  name: string;
  providerType: ProviderType;
  baseUrl?: string | null;
  apiKey: string; // متن خام؛ قبل از ذخیره رمزنگاری می‌شود
  model: string;
  priority?: number;
}

export async function createAiProvider(input: CreateAiProviderInput) {
  return prisma.aiProvider.create({
    data: {
      name: input.name,
      providerType: input.providerType,
      baseUrl: input.baseUrl ?? null,
      apiKeyEncrypted: encryptSecret(input.apiKey),
      model: input.model,
      priority: input.priority ?? 100,
    },
  });
}

export async function listAiProviders() {
  return prisma.aiProvider.findMany({ orderBy: { priority: "asc" } });
}

/** فقط ارائه‌دهندگان فعال و خارج از cooldown، مرتب بر اساس اولویت — برای فاز ۲ */
export async function getActiveProvidersSortedByPriority() {
  const now = new Date();
  return prisma.aiProvider.findMany({
    where: {
      isActive: true,
      OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
    },
    orderBy: { priority: "asc" },
  });
}

export async function getDecryptedApiKey(providerId: string): Promise<string> {
  const provider = await prisma.aiProvider.findUniqueOrThrow({ where: { id: providerId } });
  return decryptSecret(provider.apiKeyEncrypted);
}

export async function setCooldown(providerId: string, until: Date) {
  return prisma.aiProvider.update({ where: { id: providerId }, data: { cooldownUntil: until } });
}

export async function markProviderInactive(providerId: string) {
  return prisma.aiProvider.update({ where: { id: providerId }, data: { isActive: false } });
}

export async function deleteAiProvider(providerId: string) {
  return prisma.aiProvider.delete({ where: { id: providerId } });
}
