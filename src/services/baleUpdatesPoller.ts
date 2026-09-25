import { getSetting, SettingKeys } from "../db/settingsRepository";
import { deleteBaleWebhook, getBaleUpdates } from "../providers/baleBotClient";
import { parseIncomingBaleWebhook } from "./baleWebhookParser";
import { saveIncomingBaleMessage } from "./webhookService";
import { scheduleReply, getAutoReplyMode } from "./replyService";
import { runExclusive } from "../utils/chatMutex";
import { isRateLimited } from "../utils/rateLimiter";
import { runtimeStats, recordError } from "../utils/runtimeStats";

/**
 * دریافت پیام‌های ورودی بله به روش polling (getUpdates).
 *
 * چرا لازم است؟ وبهوک فقط وقتی کار می‌کند که سرورِ بله بتواند به آدرس شما وصل شود.
 * روی localhost این ممکن نیست، پس هیچ پیامی نمی‌رسید و sweep همیشه «۰ گفتگوی بی‌پاسخ» می‌گفت.
 *
 * فعال‌سازی:
 *  - BALE_POLLING=true   → همیشه روشن
 *  - BALE_POLLING=false  → همیشه خاموش
 *  - تعیین‌نشده          → اگر WEBHOOK_BASE_URL تنظیم نشده باشد (اجرای محلی) روشن می‌شود
 */
export function shouldUsePolling(): boolean {
  const flag = (process.env.BALE_POLLING ?? "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !process.env.WEBHOOK_BASE_URL;
}

const LONG_POLL_SECONDS = 20;
const IDLE_SLEEP_MS = 1000;
const ERROR_SLEEP_MS = 5000;
const RATE_LIMIT_MAX_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let started = false;

async function handleUpdate(update: unknown) {
  const incoming = parseIncomingBaleWebhook(update);
  if (!incoming) {
    runtimeStats.webhookUnparsable++;
    console.warn("[poller] آپدیت قابل تجزیه نبود:", JSON.stringify(update)?.slice(0, 300));
    return;
  }
  if (isRateLimited(incoming.chatId, RATE_LIMIT_MAX_MESSAGES, RATE_LIMIT_WINDOW_MS)) {
    console.warn(`[poller] chatId=${incoming.chatId} به سقف نرخ پیام رسید؛ نادیده گرفته شد.`);
    return;
  }
  const saved = await runExclusive(`save:${incoming.chatId}`, () => saveIncomingBaleMessage(incoming));
  if (saved.skippedAsDuplicate) return;

  runtimeStats.messagesSaved++;
  console.log(`[poller] پیام جدید از chatId=${incoming.chatId} ذخیره شد.`);

  if ((await getAutoReplyMode()) === "ai") {
    scheduleReply(incoming.chatId);
  }
}

export function startBaleUpdatesPoller() {
  if (started) return;
  started = true;
  console.log("[poller] دریافت پیام از بله به روش getUpdates فعال شد (بدون نیاز به وبهوک).");

  void (async () => {
    let offset: number | undefined;
    let webhookCleared = false;
    let lastToken = "";

    while (true) {
      try {
        const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
        if (!botToken) {
          await sleep(ERROR_SLEEP_MS);
          continue;
        }
        if (botToken !== lastToken) {
          lastToken = botToken;
          webhookCleared = false;
          offset = undefined;
        }

        // وبهوک فعال جلوی getUpdates را می‌گیرد؛ یک‌بار پاکش می‌کنیم
        if (!webhookCleared) {
          try {
            const r = await deleteBaleWebhook({ botToken });
            console.log("[poller] deleteWebhook:", JSON.stringify(r));
          } catch (err) {
            console.warn("[poller] deleteWebhook ناموفق (نادیده گرفته شد):", (err as Error)?.message);
          }
          webhookCleared = true;
        }

        const res = await getBaleUpdates({ botToken }, { offset, limit: 50, timeout: LONG_POLL_SECONDS });
        if (res?.ok === false) {
          throw new Error(`getUpdates خطا داد: ${JSON.stringify(res)}`);
        }

        const updates: any[] = Array.isArray(res?.result) ? res.result : [];
        if (updates.length === 0) {
          await sleep(IDLE_SLEEP_MS);
          continue;
        }

        runtimeStats.webhookReceived += updates.length;
        runtimeStats.lastWebhookAt = new Date();

        for (const u of updates) {
          try {
            await handleUpdate(u);
          } catch (err) {
            recordError("poller", err);
            console.error("[poller] خطا در پردازش یک آپدیت:", err);
          }
          if (typeof u?.update_id === "number") offset = u.update_id + 1;
        }
      } catch (err) {
        recordError("poller", err);
        console.error("[poller] خطا در getUpdates:", (err as any)?.response?.data ?? (err as Error)?.message);
        await sleep(ERROR_SLEEP_MS);
      }
    }
  })();
}
