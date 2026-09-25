import { processAiForChat } from "./webhookService";
import { completeOrder } from "./orderService";
import { sendBaleMessage } from "../providers/baleBotClient";
import { getSetting, SettingKeys } from "../db/settingsRepository";
import { listUnansweredChats, countEscalatedConversations } from "../db/conversationRepository";
import { runtimeStats, recordError, recordSkip } from "../utils/runtimeStats";
import { deleteMessage } from "../db/messageRepository";
import { runExclusive } from "../utils/chatMutex";
import { Semaphore } from "../utils/semaphore";

/**
 * لایه‌ی مرکزی «پاسخ به کاربر»؛ هر دو مسیر (وبهوک با debounce، و بررسی پیام‌های بی‌پاسخ
 * در گزینه ۳) از همین‌جا رد می‌شوند تا قوانین یکسان باشند:
 *  - برای هر کاربر فقط یک پردازش در هر لحظه (runExclusive) → نفر به نفر و بدون پاسخ دوبل
 *  - حداکثر N فراخوانی هم‌زمان AI برای کل سرور (Semaphore) → با ده‌ها کاربر هم‌زمان سرویس AI کرش/rate-limit نمی‌شود
 *  - پیام‌های تکه‌تکه‌ی کاربر با debounce جمع می‌شوند و یک پاسخ جامع می‌گیرند
 */

const DEBOUNCE_MS = Number(process.env.REPLY_DEBOUNCE_MS) || 8000;
/** حتی اگر کاربر مدام پیام بدهد، حداکثر این‌قدر بعد از اولین پیام جواب می‌دهیم */
const MAX_WAIT_MS = Number(process.env.REPLY_MAX_WAIT_MS) || 30000;
const AI_MAX_CONCURRENCY = Number(process.env.AI_MAX_CONCURRENCY) || 5;
const SEND_RETRIES = 3;
const BALE_MAX_TEXT = 4000; // سقف بله ۴۰۹۶ کاراکتر است
const SWEEP_DELAY_BETWEEN_CHATS_MS = 400;

const aiLimiter = new Semaphore(AI_MAX_CONCURRENCY);
const timers = new Map<string, { timer: NodeJS.Timeout; firstAt: number }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type AutoReplyMode = "ai" | "off";

export async function getAutoReplyMode(): Promise<AutoReplyMode> {
  const v = await getSetting(SettingKeys.AUTO_REPLY_MODE);
  return v === "off" ? "off" : "ai";
}

function splitText(text: string): string[] {
  if (text.length <= BALE_MAX_TEXT) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > BALE_MAX_TEXT) {
    let cut = rest.lastIndexOf("\n", BALE_MAX_TEXT);
    if (cut < BALE_MAX_TEXT / 2) cut = BALE_MAX_TEXT;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function sendWithRetry(botToken: string, chatId: string, text: string): Promise<boolean> {
  for (const chunk of splitText(text)) {
    let ok = false;
    for (let attempt = 1; attempt <= SEND_RETRIES && !ok; attempt++) {
      try {
        const res = await sendBaleMessage({ botToken }, chatId, chunk);
        if (res && res.ok === false) throw new Error(JSON.stringify(res));
        ok = true;
      } catch (err) {
        console.error(`[reply] ارسال به chatId=${chatId} ناموفق (تلاش ${attempt}/${SEND_RETRIES}):`, (err as Error)?.message);
        if (attempt < SEND_RETRIES) await sleep(1000 * attempt * attempt);
      }
    }
    if (!ok) return false;
  }
  return true;
}

/**
 * یک پاسخ کامل برای یک chatId: AI → ارسال به کاربر. خروجی: true یعنی پاسخی ارسال شد.
 * اگر ارسال به بله ناموفق بود، پاسخ AI از دیتابیس پاک می‌شود تا این گفتگو «بی‌پاسخ» بماند
 * و در بررسی بعدی (گزینه ۳ یا شروع سرور) دوباره امتحان شود.
 */
export async function replyToChat(chatId: string): Promise<boolean> {
  try {
    return await runExclusive(`reply:${chatId}`, async () => {
      const result = await aiLimiter.run(() => processAiForChat(chatId));
      if (!result) {
        recordSkip(chatId, "مخاطبی با این chatId پیدا نشد");
        return false;
      }
      if (!result.sendReply) {
        recordSkip(chatId, result.skipReason ?? "sendReply=false");
        // خرابی موقت AI: ۲۰ ثانیه بعد دوباره تلاش کن (بدون ارجاع به انسان)
        if (result.skipReason === "ai_retry") setTimeout(() => scheduleReply(chatId), 20_000);
        return false;
      }

      const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
      if (!botToken) {
        recordError("reply", new Error("bale_bot_token تنظیم نشده است"));
        console.error("[reply] bale_bot_token تنظیم نشده است.");
        if (result.aiMessageId) await deleteMessage(result.aiMessageId).catch(() => undefined);
        return false;
      }

      const sent = await sendWithRetry(botToken, result.chatId, result.displayText);
      if (!sent) {
        recordError("sendMessage", new Error(`ارسال پاسخ به chatId=${chatId} پس از چند تلاش ناموفق بود (توکن یا chat_id را بررسی کنید)`));
        if (result.aiMessageId) await deleteMessage(result.aiMessageId).catch(() => undefined);
        return false;
      }

      runtimeStats.repliesSent++;
      runtimeStats.lastReplyAt = new Date();
      if (result.orderConfirmed) {
        completeOrder(result.conversationId).catch((err) => console.error("[reply] خطا در ثبت سفارش:", err));
      }
      return true;
    });
  } catch (err) {
    recordError("replyToChat", err);
    console.error(`[reply] خطا در پاسخ به chatId=${chatId}:`, err);
    return false;
  }
}

/**
 * وبهوک بعد از ذخیره‌ی هر پیام این را صدا می‌زند. با هر پیام جدید تایمر از نو شروع می‌شود؛
 * پس «سلام» ← «قیمت» ← «چنده؟» که پشت‌سرهم بیایند یک پاسخ جامع می‌گیرند.
 */
export function scheduleReply(chatId: string) {
  const existing = timers.get(chatId);
  const firstAt = existing?.firstAt ?? Date.now();
  if (existing) clearTimeout(existing.timer);

  const waited = Date.now() - firstAt;
  const delay = Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - waited));

  const timer = setTimeout(() => {
    timers.delete(chatId);
    // بین صبر کردن و پاسخ دادن ممکن است حالت به «خاموش» عوض شده باشد
    getAutoReplyMode()
      .then((mode) => (mode === "ai" ? replyToChat(chatId) : false))
      .catch((err) => console.error("[reply] خطا پس از debounce:", err));
  }, delay);
  timers.set(chatId, { timer, firstAt });
}

// ---------------------------------------------------------------------------
// بررسی پیام‌های بی‌پاسخ (گزینه ۳ و بازیابی بعد از ری‌استارت)
// ---------------------------------------------------------------------------
let sweepRunning = false;
let lastSweep: { startedAt: Date; total: number; replied: number; escalated: number; done: boolean } | null = null;

export function isSweepRunning() {
  return sweepRunning;
}
export function getLastSweep() {
  return lastSweep;
}

/**
 * همه‌ی گفتگوهایی که آخرین پیامشان از کاربر است (بعد از آخرین پاسخ ما چیزی نوشته‌اند و جواب نگرفته‌اند)
 * را پیدا می‌کند و نفر به نفر جواب می‌دهد. `maxAgeMs` برای بازیابی بعد از ری‌استارت است تا پیام‌های
 * خیلی قدیمی ناگهان جواب داده نشوند؛ در گزینه ۳ بدون محدودیت اجرا می‌شود.
 */
export async function sweepUnansweredChats(opts?: { maxAgeMs?: number }) {
  if (sweepRunning) return lastSweep;
  sweepRunning = true;
  try {
    const pending = (await listUnansweredChats(opts)).filter((p) => !timers.has(p.chatId));
    const escalated = (await countEscalatedConversations()).total;
    lastSweep = { startedAt: new Date(), total: pending.length, replied: 0, escalated, done: false };
    console.log(`[sweep] ${pending.length} گفتگوی بی‌پاسخ پیدا شد؛ ${escalated} گفتگوی ارجاع‌شده به انسان نادیده گرفته شد.`);

    for (const p of pending) {
      // اگر وسط کار حالت به «خاموش» عوض شد (کمپین گزینه ۱ شروع شد)، ادامه نده
      if ((await getAutoReplyMode()) !== "ai") {
        console.log("[sweep] حالت پاسخ‌گویی خاموش شد؛ بررسی متوقف شد.");
        break;
      }
      const replied = await replyToChat(p.chatId);
      if (replied && lastSweep) lastSweep.replied++;
      await sleep(SWEEP_DELAY_BETWEEN_CHATS_MS);
    }
    if (lastSweep) lastSweep.done = true;
    console.log(`[sweep] تمام شد؛ ${lastSweep?.replied ?? 0} پاسخ ارسال شد.`);
    return lastSweep;
  } catch (err) {
    console.error("[sweep] خطا:", err);
    return lastSweep;
  } finally {
    sweepRunning = false;
  }
}
