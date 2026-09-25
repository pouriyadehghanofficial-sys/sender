import { Router } from "express";
import { parseIncomingBaleWebhook } from "../services/baleWebhookParser";
import { saveIncomingBaleMessage } from "../services/webhookService";
import { scheduleReply, getAutoReplyMode } from "../services/replyService";
import { runExclusive } from "../utils/chatMutex";
import { isRateLimited } from "../utils/rateLimiter";

const router = Router();

// حداکثر ۲۰ پیام در هر ۲ دقیقه برای هر chatId — جلوی هرزنامه/باگ حلقه‌ی بی‌نهایت/هزینه
// سرسام‌آور فراخوانی AI را می‌گیرد. اگر کسب‌وکارتان واقعاً به نرخ بالاتر نیاز دارد،
// همین دو عدد را تغییر دهید.
const RATE_LIMIT_MAX_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;

/**
 * مسیر شامل :secret است: اگر WEBHOOK_SECRET در .env تنظیم شده باشد، فقط درخواست‌هایی
 * که همان رمز را در مسیر دارند پردازش می‌شوند — تا هر کسی که آدرس سرور را حدس بزند
 * نتواند پیام جعلی بفرستد و هزینه‌ی AI شما را بالا ببرد یا سفارش قلابی بسازد.
 *
 * جریان: پیام همیشه ذخیره می‌شود. اگر پاسخ‌گویی خودکار روشن باشد (گزینه ۲ و ۳ کمپین)،
 * پاسخ با debounce زمان‌بندی می‌شود (پیام‌های تکه‌تکه‌ی کاربر یکی می‌شوند)؛ اگر خاموش باشد
 * (گزینه ۱) فقط ذخیره می‌شود و بعداً با گزینه ۳ می‌شود به آن‌ها جواب داد.
 */
router.post("/:secret?", async (req, res) => {
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret && req.params.secret !== expectedSecret) {
    console.warn("[webhook/bale] درخواست با رمز نامعتبر یا بدون رمز رد شد.");
    return res.status(404).json({ ok: false });
  }

  try {
    const incoming = parseIncomingBaleWebhook(req.body);
    if (!incoming) {
      console.warn("[webhook/bale] payload قابل تجزیه نبود، نادیده گرفته شد:", JSON.stringify(req.body)?.slice(0, 500));
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (isRateLimited(incoming.chatId, RATE_LIMIT_MAX_MESSAGES, RATE_LIMIT_WINDOW_MS)) {
      console.warn(`[webhook/bale] chatId=${incoming.chatId} به سقف نرخ پیام رسید؛ این پیام نادیده گرفته شد.`);
      return res.status(200).json({ ok: true, rateLimited: true });
    }

    // ۱. ذخیره‌ی پیام (پشت‌سرهم برای هر کاربر؛ قفل جدا از قفل پاسخ‌دهی است تا وبهوک منتظر پاسخ طولانی AI نماند)
    const saved = await runExclusive(`save:${incoming.chatId}`, () => saveIncomingBaleMessage(incoming));
    if (saved.skippedAsDuplicate) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    // ۲. پاسخ خودکار فقط وقتی روشن است (گزینه ۲ و ۳)
    if ((await getAutoReplyMode()) === "ai") {
      scheduleReply(incoming.chatId);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[webhook/bale] خطا در پردازش پیام ورودی:", err);
    res.status(200).json({ ok: false });
  }
});

export default router;
