import axios from "axios";
import { AIProviderAdapter, ChatMessage, ProviderConfig } from "./types";
import { classifyAxiosError, ProviderCallError } from "./errors";

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export class OpenAICompatibleAdapter implements AIProviderAdapter {
  name: string;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, "");
  }

  async chat(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json",
          },
          timeout: REQUEST_TIMEOUT_MS,
        }
      );

      const text = response.data?.choices?.[0]?.message?.content?.trim();
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
