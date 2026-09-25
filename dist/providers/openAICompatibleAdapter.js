"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICompatibleAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const errors_1 = require("./errors");
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
class OpenAICompatibleAdapter {
    name;
    apiKey;
    model;
    baseUrl;
    constructor(config) {
        this.name = config.name;
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.baseUrl = (config.baseUrl || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, "");
    }
    async chat(messages, systemPrompt) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/chat/completions`, {
                model: this.model,
                messages: [{ role: "system", content: systemPrompt }, ...messages],
            }, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "content-type": "application/json",
                },
                timeout: REQUEST_TIMEOUT_MS,
            });
            const text = response.data?.choices?.[0]?.message?.content?.trim();
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
exports.OpenAICompatibleAdapter = OpenAICompatibleAdapter;
