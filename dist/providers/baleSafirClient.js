"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSafirMessage = sendSafirMessage;
const axios_1 = __importDefault(require("axios"));
const DEFAULT_SAFIR_SEND_MESSAGE_URL = "https://safir.bale.ai/api/v3/send_message";
const REQUEST_TIMEOUT_MS = 15_000;
/**
 * ارسال یک پیام از طریق سفیر بله.
 */
async function sendSafirMessage(input) {
    const url = input.apiUrl ?? DEFAULT_SAFIR_SEND_MESSAGE_URL;
    const messagePayload = {
        text: input.text,
    };
    if (input.photoUrl) {
        messagePayload.photo = input.photoUrl;
        // معمولا در بات‌های بله اگر عکس باشد، متن در caption قرار می‌گیرد
        messagePayload.caption = input.text;
    }
    // اضافه کردن کیبورد شیشه‌ای در صورت وجود دکمه
    if (input.button) {
        const inlineBtn = { text: input.button.label || "لینک" };
        if (input.button.type === "url")
            inlineBtn.url = input.button.value;
        else if (input.button.type === "web_app")
            inlineBtn.web_app = input.button.value;
        else if (input.button.type === "copy_text")
            inlineBtn.copy_text = input.button.value;
        messagePayload.reply_markup = {
            inline_keyboard: [[inlineBtn]],
        };
    }
    const body = {
        bot_id: input.botId,
        phone_number: input.phone,
        message_data: {
            message: messagePayload
        }
    };
    try {
        const response = await axios_1.default.post(url, body, {
            headers: {
                "Api-Access-Key": input.apiKey,
                "Content-Type": "application/json",
            },
            timeout: REQUEST_TIMEOUT_MS,
            validateStatus: () => true,
        });
        if (response.status >= 200 && response.status < 300) {
            const data = response.data;
            const chatId = data?.chat_id ?? data?.result?.chat_id ?? data?.user_id ?? data?.id;
            return { kind: "sent", chatId: chatId != null ? String(chatId) : undefined };
        }
        return classifyErrorResponse(response.status, response.data);
    }
    catch (err) {
        const axErr = err;
        if (axErr?.isAxiosError) {
            return { kind: "failed", message: `خطای شبکه: ${axErr.message}` };
        }
        return { kind: "failed", message: err?.message ?? String(err) };
    }
}
function classifyErrorResponse(status, data) {
    const rawMessage = (typeof data === "string" ? data : data?.message || data?.error || JSON.stringify(data ?? {})) ||
        `کد وضعیت ${status}`;
    // تشخیص «کاربر بله ندارد» بر اساس کلیدواژه‌های محتمل در پاسخ خطا.
    const noBaleIndicators = ["not_found", "no_bale", "not registered", "کاربر یافت نشد", "ثبت‌نام نکرده"];
    const looksLikeNoBale = noBaleIndicators.some((k) => String(rawMessage).toLowerCase().includes(k.toLowerCase()));
    if (status === 404 || looksLikeNoBale) {
        return { kind: "no_bale", message: String(rawMessage) };
    }
    return { kind: "failed", message: `[${status}] ${rawMessage}` };
}
