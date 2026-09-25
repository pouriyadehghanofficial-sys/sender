"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdapter = createAdapter;
const anthropicAdapter_1 = require("./anthropicAdapter");
const openAICompatibleAdapter_1 = require("./openAICompatibleAdapter");
function createAdapter(config) {
    switch (config.providerType) {
        case "anthropic":
            return new anthropicAdapter_1.AnthropicAdapter(config);
        case "openai_compatible":
            return new openAICompatibleAdapter_1.OpenAICompatibleAdapter(config);
        default:
            throw new Error(`نوع ارائه‌دهنده ناشناخته: ${config.providerType}`);
    }
}
