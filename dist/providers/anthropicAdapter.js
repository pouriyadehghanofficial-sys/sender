"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const errors_1 = require("./errors");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 20_000;
class AnthropicAdapter {
    name;
    apiKey;
    model;
    constructor(config) {
        this.name = config.name;
        this.apiKey = config.apiKey;
        this.model = config.model;
    }
    async chat(messages, systemPrompt) {
        try {
            const response = await axios_1.default.post(ANTHROPIC_API_URL, {
                model: this.model,
                max_tokens: 1024,
                system: systemPrompt,
                messages,
            }, {
                headers: {
                    "x-api-key": this.apiKey,
                    "anthropic-version": ANTHROPIC_VERSION,
                    "content-type": "application/json",
                },
                timeout: REQUEST_TIMEOUT_MS,
            });
            const contentBlocks = response.data?.content;
            const text = (contentBlocks ?? [])
                .filter((b) => b.type === "text" && b.text)
                .map((b) => b.text)
                .join("\n")
                .trim();
            if (!text) {
                throw new errors_1.ProviderCallError(`پاسخ خالی از ارائه‌دهنده «${this.name}» دریافت شد`, "other", this.name);
            }
            return text;
        }
        catch (err) {
            if (err instanceof errors_1.ProviderCallError)
                throw err;
            throw (0, errors_1.classifyAxiosError)(err, this.name);
        }
    }
}
exports.AnthropicAdapter = AnthropicAdapter;
