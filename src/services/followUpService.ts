import { listStaleUndecidedContacts, markFollowUpSent } from "../db/contactRepository";
import { addMessage } from "../db/messageRepository";
import { sendBaleMessage } from "../providers/baleBotClient";
import { askAI } from "./aiService";
import { getSetting, SettingKeys } from "../db/settingsRepository";
import { getAutoReplyMode } from "./replyService";
import { MessageSender } from "../db/enums";
import { recordError } from "../utils/runtimeStats";

/** بعد از چند ساعت بی‌پاسخی مشتری «مردد» حساب می‌شود */
const STALE_HOURS = Number(process.env.FOLLOW_UP_STALE_HOURS) || 24;
/** حداقل فاصله بین دو پیگیری پشت‌سرهم برای همان مشتری (جلوگیری از مزاحمت) */
const COOLDOWN_HOURS = Number(process.env.FOLLOW_UP_COOLDOWN_HOURS) || 72;
/** هر چند وقت یک‌بار اسکن انجام شود */
const SCAN_INTERVAL_MS = Number(process.env.FOLLOW_UP_SCAN_INTERVAL_MS) || 30 * 60 * 1000;
const DELAY_BETWEEN_SENDS_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FOLLOW_UP_DRAFT_PROMPT = `تو همان دستیار فروش این مکالمه هستی. مشتری مدتی است جواب نداده و تصمیم نگرفته.
یک پیام «پیگیری» خیلی کوتاه (۱ تا ۲ جمله)، دوستانه و بدون فشار بنویس تا دوباره مکالمه را باز کند؛
مثلاً یادآوری محترمانه یا پرسیدن اینکه آیا سوالی مانده. از عبارت‌های رسمی/تکراری/ربات‌گونه استفاده نکن.
فقط متن پیام را بنویس، بدون مقدمه یا گیومه.`;

async function draftFollowUpMessage(recentMessages: { sender: string; text: string }[]): Promise<string> {
  const context = recentMessages
    .slice()
    .reverse()
    .map((m) => `${m.sender === MessageSender.USER ? "مشتری" : "دستیار"}: ${m.text}`)
    .join("\n");
  try {
    const text = await askAI([{ role: "user", content: context }], FOLLOW_UP_DRAFT_PROMPT);
    return text.trim();
  } catch {
    return "سلام! هنوز درباره خریدتون تصمیم نگرفتین؟ اگه سوالی مونده در خدمتم 🙂";
  }
}

/** یک دور اسکن: مشتریان مردد را پیدا و پیگیری می‌کند. برای تست/اجرای دستی هم قابل‌فراخوانی است. */
export async function runFollowUpScan(): Promise<{ scanned: number; sent: number }> {
  if ((await getAutoReplyMode()) !== "ai") return { scanned: 0, sent: 0 }; // فقط وقتی AI فعال است (گزینه ۲/۳)

  const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
  if (!botToken) return { scanned: 0, sent: 0 };

  const contacts = await listStaleUndecidedContacts(STALE_HOURS, COOLDOWN_HOURS);
  let sent = 0;

  for (const contact of contacts as any[]) {
    try {
      const conversation = contact.conversations?.[0];
      if (!conversation || !contact.baleChatId) continue;

      const text = await draftFollowUpMessage(conversation.messages ?? []);
      const res = await sendBaleMessage({ botToken }, contact.baleChatId, text);
      if (res && res.ok === false) throw new Error(JSON.stringify(res));

      await addMessage(conversation.id, MessageSender.AI, text);
      await markFollowUpSent(contact.id);
      sent++;
    } catch (err) {
      recordError("followUp", err);
      console.error(`[follow-up] خطا برای contactId=${contact.id}:`, (err as Error)?.message);
    }
    await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  if (contacts.length > 0) console.log(`[follow-up] ${contacts.length} مشتری مردد بررسی شد؛ ${sent} پیام پیگیری ارسال شد.`);
  return { scanned: contacts.length, sent };
}

let started = false;

/** اجرای دوره‌ای در پس‌زمینه؛ یک‌بار در index.ts صدا زده می‌شود */
export function startFollowUpScheduler() {
  if (started) return;
  started = true;
  console.log(`[follow-up] پیگیری خودکار مشتریان مردد فعال شد (هر ${Math.round(SCAN_INTERVAL_MS / 60000)} دقیقه، بعد از ${STALE_HOURS} ساعت بی‌پاسخی).`);
  const tick = () => {
    runFollowUpScan().catch((err) => console.error("[follow-up] خطا در اسکن:", err));
  };
  setTimeout(tick, 60_000); // اولین اجرا کمی بعد از بالا آمدن سرور
  setInterval(tick, SCAN_INTERVAL_MS);
}
