import { listConversationsWithoutOrder } from "../db/conversationRepository";
import { askAI } from "./aiService";
import { MessageSender } from "../db/enums";

const MAX_CONVERSATIONS_PER_REPORT = 40;
const MAX_MESSAGES_PER_CONVERSATION = 20;

const CHURN_SYSTEM_PROMPT = `تو یک تحلیل‌گر فروش هستی. چند مکالمه‌ی واقعی بین یک دستیار فروش و مشتریانی که
در نهایت خرید نکرده‌اند به تو داده می‌شود. کارت این است که دلایل رایج و تکرارشونده‌ی
نخریدن را استخراج کنی (مثلاً: قیمت بالا به نظرشان رسیده، مردد در مقایسه با رقبا بوده‌اند،
سوالی بی‌جواب مانده، دیر جواب گرفته‌اند، محصول دقیقاً نیازشان را برطرف نمی‌کرده، و ...).
خروجی را دقیقاً به این شکل فارسی و خلاصه بده (بدون مقدمه‌ی اضافه):

۱) [دلیل] — [چند مکالمه تقریباً همین الگو را داشتند] — [یک نمونه‌ی خیلی کوتاه]
۲) ...

حداکثر ۶ دلیل رایج، مرتب از پرتکرارترین به کم‌تکرارترین. اگر داده‌ی کافی نبود صادقانه بگو.`;

function summarizeConversationForPrompt(c: { messages: { sender: string; text: string }[] }): string {
  return c.messages
    .slice(-MAX_MESSAGES_PER_CONVERSATION)
    .map((m) => `${m.sender === MessageSender.USER ? "مشتری" : "دستیار"}: ${m.text}`)
    .join("\n");
}

/**
 * گزارش «چرا مشتری نخرید»: مکالمات رهاشده/بدون سفارش را جمع می‌کند و با یک فراخوانی AI
 * خلاصه‌ی الگوهای رایج نخریدن را استخراج می‌کند. چون هزینه‌ی چند مکالمه‌ی طولانی در یک
 * پرامپت زیاد است، این گزارش درخواستی است (نه خودکار روی هر پیام).
 */
export async function generateChurnReport(opts?: { sinceHours?: number }) {
  const conversations = await listConversationsWithoutOrder({
    sinceHours: opts?.sinceHours ?? 2,
    limit: MAX_CONVERSATIONS_PER_REPORT,
  });

  if (conversations.length === 0) {
    return { conversationsAnalyzed: 0, summary: "مکالمه‌ی رهاشده‌ی قابل‌بررسی‌ای پیدا نشد." };
  }

  const prompt = (conversations as any[])
    .map((c, i) => `--- مکالمه ${i + 1} (محصول: ${c.product?.name ?? "نامشخص"}) ---\n${summarizeConversationForPrompt(c)}`)
    .join("\n\n");

  const summary = await askAI([{ role: "user", content: prompt }], CHURN_SYSTEM_PROMPT);

  return { conversationsAnalyzed: conversations.length, summary: summary.trim() };
}
