import axios from "axios";

const DEFAULT_TAPI_BASE = "https://tapi.bale.ai";
const REQUEST_TIMEOUT_MS = 15_000;

export interface BaleBotConfig {
  botToken: string;
  /** فقط برای تست: override آدرس پایه API */
  apiBase?: string;
}

export async function setBaleWebhook(config: BaleBotConfig, webhookUrl: string) {
  const base = config.apiBase ?? DEFAULT_TAPI_BASE;
  const url = `${base}/bot${config.botToken}/setWebhook`;
  const response = await axios.post(url, { url: webhookUrl }, { timeout: REQUEST_TIMEOUT_MS });
  return response.data;
}

export async function sendBaleMessage(config: BaleBotConfig, chatId: string, text: string) {
  const base = config.apiBase ?? DEFAULT_TAPI_BASE;
  const url = `${base}/bot${config.botToken}/sendMessage`;
  const response = await axios.post(
    url,
    { chat_id: chatId, text },
    { timeout: REQUEST_TIMEOUT_MS }
  );
  return response.data;
}

/** بررسی اعتبار توکن (برای عیب‌یابی) */
export async function getBaleMe(config: BaleBotConfig) {
  const base = config.apiBase ?? DEFAULT_TAPI_BASE;
  const response = await axios.get(`${base}/bot${config.botToken}/getMe`, { timeout: REQUEST_TIMEOUT_MS });
  return response.data;
}

/** آدرس وبهوک ثبت‌شده در بله (برای عیب‌یابی؛ اگر بله این متد را نداشته باشد خطا می‌دهد و نادیده گرفته می‌شود) */
export async function getBaleWebhookInfo(config: BaleBotConfig) {
  const base = config.apiBase ?? DEFAULT_TAPI_BASE;
  const response = await axios.get(`${base}/bot${config.botToken}/getWebhookInfo`, { timeout: REQUEST_TIMEOUT_MS });
  return response.data;
}
