import { AIProviderAdapter, ProviderConfig } from "./types";
import { AnthropicAdapter } from "./anthropicAdapter";
import { OpenAICompatibleAdapter } from "./openAICompatibleAdapter";

export function createAdapter(config: ProviderConfig): AIProviderAdapter {
  switch (config.providerType) {
    case "anthropic":
      return new AnthropicAdapter(config);
    case "openai_compatible":
      return new OpenAICompatibleAdapter(config);
    default:
      throw new Error(`نوع ارائه‌دهنده ناشناخته: ${config.providerType}`);
  }
}
