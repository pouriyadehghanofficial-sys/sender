export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** نوع مشترک برای پیکربندی یک ارائه‌دهنده — مستقل از دیتابیس، برای تست‌پذیری آسان */
export interface ProviderConfig {
  id: string;
  name: string;
  providerType: "anthropic" | "openai_compatible";
  baseUrl?: string | null;
  apiKey: string;
  model: string;
}

export interface AIProviderAdapter {
  name: string;
  chat(messages: ChatMessage[], systemPrompt: string): Promise<string>;
}
