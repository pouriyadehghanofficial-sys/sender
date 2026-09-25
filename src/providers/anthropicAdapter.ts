import axios from "axios";
import { AIProviderAdapter, ChatMessage, ProviderConfig } from "./types";
import { classifyAxiosError, ProviderCallError } from "./errors";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 20_000;

export class AnthropicAdapter implements AIProviderAdapter {
  name: string;
  private apiKey: string;
  private model: string;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  async chat(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    try {
      const response = await axios.post(
        ANTHROPIC_API_URL,
        {
          model: this.model,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        },
        {
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
          },
          timeout: REQUEST_TIMEOUT_MS,
        }
      );

      const contentBlocks = response.data?.content as Array<{ type: string; text?: string }> | undefined;
      const text = (contentBlocks ?? [])
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text)
        .join("\n")
        .trim();

      if (!text) {
        throw new ProviderCallError(`پاسخ خالی از ارائه‌دهنده «${this.name}» دریافت شد`, "other", this.name);
      }
      return text;
    } catch (err) {
      if (err instanceof ProviderCallError) throw err;
      throw classifyAxiosError(err, this.name);
    }
  }
}
