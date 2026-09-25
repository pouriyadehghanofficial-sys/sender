import {
  getActiveProvidersSortedByPriority,
  getDecryptedApiKey,
  setCooldown,
  markProviderInactive,
} from "../db/aiProviderRepository";
import { askAICore } from "../providers/manager";
import { ChatMessage, ProviderConfig } from "../providers/types";
import { parseModelList } from "../utils/modelList";

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

interface AiProviderRow {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string | null;
  model: string;
}

/**
 * تابع اصلی askAI طبق سند فاز ۲:
 * providerهای فعال را بر اساس اولویت از دیتابیس می‌خواند، کلید هرکدام را رمزگشایی
 * می‌کند، هر ردیف را (در صورت چند مدل) گسترش می‌دهد، و با فیل‌اوور خودکار
 * (askAICore) پاسخ می‌گیرد.
 */
export async function askAI(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const rows = await getActiveProvidersSortedByPriority();

  const configsPerRow: ProviderConfig[][] = await Promise.all(
    rows.map(async (row: AiProviderRow) => {
      const apiKey = await getDecryptedApiKey(row.id);
      const models = parseModelList(row.model);
      return models.map((model) => ({
        // id یکسان برای همه‌ی مدل‌های یک کلید عمداً حفظ شده: اگر کلید auth-fail شود
        // یا rate-limit بخورد، منطقی است همه‌ی مدل‌های همان کلید هم موقتاً کنار بروند.
        id: row.id,
        name: models.length > 1 ? `${row.name} (${model})` : row.name,
        providerType: row.providerType as ProviderConfig["providerType"],
        baseUrl: row.baseUrl,
        apiKey,
        model,
      }));
    })
  );
  const configs: ProviderConfig[] = configsPerRow.flat();

  const result = await askAICore(configs, messages, systemPrompt, {
    onRateLimited: async (providerId) => { await setCooldown(providerId, minutesFromNow(5)); },
    onAuthFailed: async (providerId) => { await markProviderInactive(providerId); },
    onOtherError: (providerId, err) => {
      console.error(`[askAI] خطای غیرمنتظره در provider ${providerId}:`, err);
    },
  });

  return result.text;
}
