import { AxiosError } from "axios";

export type ProviderErrorKind = "rate_limit" | "auth" | "other";

export class ProviderCallError extends Error {
  kind: ProviderErrorKind;
  providerName: string;

  constructor(message: string, kind: ProviderErrorKind, providerName: string) {
    super(message);
    this.name = "ProviderCallError";
    this.kind = kind;
    this.providerName = providerName;
  }
}

/**
 * یک خطای axios (یا هر خطای دیگر) را به ProviderCallError با kind مشخص تبدیل می‌کند.
 * قوانین:
 *  - status 429 یا error.type === 'rate_limit_exceeded' (فرمت OpenAI) → rate_limit
 *  - status 401 یا 403 → auth
 *  - timeout شبکه یا هر خطای دیگر → other (فیل‌اوور انجام می‌شود ولی provider غیرفعال نمی‌شود)
 */
export function classifyAxiosError(err: unknown, providerName: string): ProviderCallError {
  const axErr = err as AxiosError<any>;

  if (axErr && axErr.isAxiosError) {
    const status = axErr.response?.status;
    const openAiErrorType = axErr.response?.data?.error?.type;

    if (status === 429 || openAiErrorType === "rate_limit_exceeded") {
      return new ProviderCallError(
        `محدودیت نرخ درخواست (rate limit) برای ارائه‌دهنده «${providerName}»`,
        "rate_limit",
        providerName
      );
    }

    if (status === 401 || status === 403) {
      return new ProviderCallError(
        `کلید API نامعتبر یا بدون دسترسی برای ارائه‌دهنده «${providerName}»`,
        "auth",
        providerName
      );
    }

    if (axErr.code === "ECONNABORTED" || axErr.code === "ETIMEDOUT") {
      return new ProviderCallError(
        `تایم‌اوت درخواست به ارائه‌دهنده «${providerName}»`,
        "other",
        providerName
      );
    }

    const msg = axErr.response?.data?.error?.message || axErr.response?.data?.error || axErr.message;
    return new ProviderCallError(`خطای ارائه‌دهنده «${providerName}»: ${msg}`, "other", providerName);
  }

  return new ProviderCallError(
    `خطای ناشناخته در ارائه‌دهنده «${providerName}»: ${(err as Error)?.message ?? String(err)}`,
    "other",
    providerName
  );
}
