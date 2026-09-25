import { ChatMessage, ProviderConfig } from "./types";
import { createAdapter } from "./factory";
import { ProviderCallError } from "./errors";

export interface FailoverHooks {
  /** وقتی provider با خطای rate-limit مواجه شد (باید cooldown ثبت شود) */
  onRateLimited?: (providerId: string) => Promise<void> | void;
  /** وقتی provider با خطای auth مواجه شد (باید غیرفعال دائمی شود) */
  onAuthFailed?: (providerId: string) => Promise<void> | void;
  /** خطای غیرمنتظره (timeout و ...) — فقط لاگ می‌شود، provider دست‌نخورده می‌ماند */
  onOtherError?: (providerId: string, err: unknown) => Promise<void> | void;
}

export interface AskAIResult {
  text: string;
  providerId: string;
  providerName: string;
}

/**
 * هسته‌ی اصلی فیل‌اوور: providerها را به ترتیب اولویت امتحان می‌کند
 * و در صورت خطا (rate limit / auth / سایر) به بعدی می‌رود.
 * این تابع به دیتابیس وابسته نیست تا به‌راحتی قابل تست باشد.
 */
export async function askAICore(
  configs: ProviderConfig[],
  messages: ChatMessage[],
  systemPrompt: string,
  hooks: FailoverHooks = {}
): Promise<AskAIResult> {
  if (configs.length === 0) {
    throw new Error("هیچ ارائه‌دهنده هوش مصنوعی فعالی در دسترس نیست.");
  }

  let lastError: unknown = null;

  for (const config of configs) {
    const adapter = createAdapter(config);
    try {
      const text = await adapter.chat(messages, systemPrompt);
      return { text, providerId: config.id, providerName: adapter.name };
    } catch (err) {
      lastError = err;

      if (err instanceof ProviderCallError) {
        if (err.kind === "rate_limit") {
          await hooks.onRateLimited?.(config.id);
          continue;
        }
        if (err.kind === "auth") {
          await hooks.onAuthFailed?.(config.id);
          continue;
        }
        await hooks.onOtherError?.(config.id, err);
        continue;
      }

      // خطای پیش‌بینی‌نشده (نباید معمولاً اینجا برسد چون adapter ها همه چیز را classify می‌کنند)
      await hooks.onOtherError?.(config.id, err);
      continue;
    }
  }

  const lastMessage = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`همه ارائه‌دهنده‌های هوش مصنوعی ناموفق بودند. آخرین خطا: ${lastMessage}`);
}
