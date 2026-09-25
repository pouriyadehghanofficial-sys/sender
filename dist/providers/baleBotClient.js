"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBaleWebhook = setBaleWebhook;
exports.sendBaleMessage = sendBaleMessage;
const axios_1 = __importDefault(require("axios"));
const DEFAULT_TAPI_BASE = "https://tapi.bale.ai";
const REQUEST_TIMEOUT_MS = 15_000;
async function setBaleWebhook(config, webhookUrl) {
    const base = config.apiBase ?? DEFAULT_TAPI_BASE;
    const url = `${base}/bot${config.botToken}/setWebhook`;
    const response = await axios_1.default.post(url, { url: webhookUrl }, { timeout: REQUEST_TIMEOUT_MS });
    return response.data;
}
async function sendBaleMessage(config, chatId, text) {
    const base = config.apiBase ?? DEFAULT_TAPI_BASE;
    const url = `${base}/bot${config.botToken}/sendMessage`;
    const response = await axios_1.default.post(url, { chat_id: chatId, text }, { timeout: REQUEST_TIMEOUT_MS });
    return response.data;
}
