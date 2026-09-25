import { Router } from "express";
import { sendCampaign, isCampaignRunning, CampaignMode } from "../services/campaignService";
import { getCampaignReport, getCampaignCounts } from "../db/contactRepository";
import { getProductById } from "../db/productRepository";
import { getSetting, SettingKeys } from "../db/settingsRepository";
import { getAutoReplyMode, isSweepRunning, getLastSweep, sweepUnansweredChats } from "../services/replyService";
import { countEscalatedConversations, clearAllEscalations, listUnansweredChats } from "../db/conversationRepository";
import { getBaleMe, getBaleWebhookInfo } from "../providers/baleBotClient";
import { runtimeStats } from "../utils/runtimeStats";
import { toCsv } from "../utils/csv";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

interface ContactCsvRow {
  name: string;
  phone: string;
  status: string;
  sentAt: Date | null;
  errorMessage: string | null;
}

/**
 * POST /admin/campaigns/:productId/send
 * کمپین را به‌صورت غیرمسدودکننده (background) شروع می‌کند و بلافاصله ۲۰۲ برمی‌گرداند.
 * چون فقط مخاطبین status='pending' فرستاده می‌شوند، همین endpoint نقش «ادامه کمپین» را
 * هم بازی می‌کند: اگر قبلاً به هر دلیلی (قطعی سرور، خطای شبکه، خرابی API) متوقف شده
 * بود، دوباره صدا زدنش دقیقاً از همان مخاطبین ارسال‌نشده ادامه می‌دهد.
 */
router.post("/:productId/send", asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { initialMessageText, initialMessagePhoto, isPassiveMode } = req.body || {};

  // mode: "send" (گزینه ۱) | "listen" (گزینه ۲) | "listen_catchup" (گزینه ۳)
  // سازگاری با نسخه‌ی قبل: isPassiveMode=true یعنی "listen"
  const rawMode = req.body?.mode;
  const mode: CampaignMode =
    rawMode === "send" || rawMode === "listen" || rawMode === "listen_catchup"
      ? rawMode
      : isPassiveMode
        ? "listen"
        : "send";

  const product = await getProductById(productId);
  if (!product) {
    return res.status(404).json({ error: "محصول یافت نشد." });
  }

  if (isCampaignRunning(productId)) {
    return res.status(409).json({ error: "یک کمپین برای این محصول همین الان در حال اجراست." });
  }

  // خطاهای پیکربندی را همین‌جا به کاربر نشان بده، نه فقط در لاگ سرور
  if (mode === "send") {
    if (!(await getSetting(SettingKeys.BALE_SAFIR_KEY))) {
      return res.status(400).json({ error: "کلید سفیر بله (bale_safir_key) در تنظیمات وارد نشده است." });
    }
    const token = await getSetting(SettingKeys.BALE_BOT_TOKEN);
    if (!token || isNaN(parseInt(token.split(":")[0], 10))) {
      return res.status(400).json({ error: "توکن ربات بازو (bale_bot_token) وارد نشده یا نامعتبر است." });
    }
  } else if (!(await getSetting(SettingKeys.BALE_BOT_TOKEN))) {
    return res.status(400).json({ error: "برای پاسخ‌گویی به کاربران، توکن ربات بازو (bale_bot_token) باید تنظیم شده باشد." });
  }

  // اجرای async بدون await کامل — پاسخ فوری به کاربر، ادامه در پس‌زمینه
  sendCampaign(
    productId,
    (progress) => {
      console.log(
        `[campaign ${productId}] پیشرفت: ${progress.sent + progress.failed + progress.noBale}/${progress.total} ` +
          `(sent=${progress.sent}, failed=${progress.failed}, no_bale=${progress.noBale})`
      );
    },
    { initialMessageText, initialMessagePhoto, mode }
  ).catch((err) => {
    console.error(`[campaign ${productId}] خطا در اجرای کمپین:`, err);
  });

  const messages: Record<CampaignMode, string> = {
    send: "ارسال پیام اولیه در پس‌زمینه شروع شد. پاسخ خودکار AI برای پیام‌های ورودی خاموش است.",
    listen: "حالت گوش‌به‌زنگ فعال شد: پیامی ارسال نمی‌شود و AI به پیام‌های جدید کاربران با این محصول جواب می‌دهد.",
    listen_catchup:
      "حالت گوش‌به‌زنگ فعال شد و بررسی پیام‌های بی‌پاسخ در پس‌زمینه شروع شد؛ به کسانی که نوشته‌اند و جواب نگرفته‌اند نفر به نفر پاسخ داده می‌شود.",
  };
  res.status(202).json({
    message: messages[mode],
    mode,
    reportUrl: `/admin/campaigns/${productId}/report`,
  });
}));

/** وضعیت لحظه‌ای: آیا کمپین همین الان در حال ارسال است؟ (برای دکمه «ادامه ارسال» در پنل) */
router.get("/:productId/status", asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const counts = await getCampaignCounts(productId);
  res.json({
    running: isCampaignRunning(productId),
    counts,
    autoReplyMode: await getAutoReplyMode(),
    sweeping: isSweepRunning(),
    lastSweep: getLastSweep(),
    escalated: (await countEscalatedConversations()).total,
    stats: runtimeStats,
  });
}));

/**
 * GET /admin/campaigns/:productId/report            -> JSON
 * GET /admin/campaigns/:productId/report?format=csv  -> دانلود CSV
 */
router.get("/:productId/report", asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const isCsv = req.query.format === "csv";
  // برای نمایش در پنل فقط ۲۰۰ ردیف اول (با ۱۰ هزار مخاطب مرورگر و شبکه سنگین نشود)؛ CSV کامل است
  const { counts, contacts, total } = await getCampaignReport(productId, null, isCsv ? undefined : { limit: 200 });

  if (isCsv) {
    const csv = toCsv(
      ["نام", "شماره", "وضعیت", "زمان ارسال", "پیام خطا"],
      contacts.map((c: ContactCsvRow) => [c.name, c.phone, c.status, c.sentAt ?? "", c.errorMessage ?? ""])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="campaign-${productId}.csv"`);
    return res.send(csv);
  }

  res.json({ counts, contacts, total, truncated: total > contacts.length });
}));

/**
 * GET /admin/campaigns/diagnostics
 * زنجیره‌ی پاسخ‌گویی را مرحله‌به‌مرحله بررسی می‌کند (توکن ← وبهوک ← پیام رسیده؟ ← ارجاع؟ ← AI) و
 * به فارسی می‌گوید کجا گیر کرده.
 */
router.get("/diagnostics", asyncHandler(async (_req, res) => {
  const hints: string[] = [];
  const botToken = await getSetting(SettingKeys.BALE_BOT_TOKEN);
  let bot: unknown = null;
  let webhookInfo: unknown = null;

  if (!botToken) {
    hints.push("❌ توکن ربات بازو (bale_bot_token) ذخیره نشده است.");
  } else {
    try {
      bot = (await getBaleMe({ botToken }))?.result ?? null;
      if (!bot) hints.push("❌ بله توکن را نپذیرفت (getMe نتیجه‌ای نداد).");
    } catch (err) {
      hints.push(`❌ توکن ربات نامعتبر است یا بله در دسترس نیست: ${(err as Error)?.message}`);
    }
    try {
      webhookInfo = (await getBaleWebhookInfo({ botToken }))?.result ?? null;
    } catch {
      webhookInfo = null; // ممکن است بله این متد را نداشته باشد؛ مشکلی نیست
    }
    const wUrl = (webhookInfo as any)?.url;
    if (webhookInfo && !wUrl) {
      hints.push("❌ هیچ آدرس وبهوکی در بله ثبت نیست؛ «تنظیم وبهوک بازو» را بزنید.");
    } else if (wUrl && process.env.WEBHOOK_BASE_URL && !String(wUrl).startsWith(process.env.WEBHOOK_BASE_URL)) {
      hints.push(`❌ آدرس وبهوک ثبت‌شده در بله (${wUrl}) با WEBHOOK_BASE_URL فعلی یکی نیست؛ (آدرس تونل عوض شده؟) دوباره «تنظیم وبهوک بازو» را بزنید.`);
    }
  }

  if (runtimeStats.webhookReceived === 0) {
    hints.push("⚠️ از زمان روشن شدن سرور هیچ درخواستی از بله نرسیده است. وبهوک ثبت نشده، آدرس تونل (cloudflared/ngrok) عوض شده یا تونل خاموش است.");
  }
  if (runtimeStats.webhookRejectedSecret > 0) {
    hints.push(`⚠️ ${runtimeStats.webhookRejectedSecret} درخواست به‌خاطر رمز وبهوک (WEBHOOK_SECRET) رد شد؛ وبهوک را دوباره ثبت کنید.`);
  }
  if (runtimeStats.webhookUnparsable > 0) {
    hints.push(`⚠️ ${runtimeStats.webhookUnparsable} درخواست قابل تجزیه نبود (ساختار payload بله متفاوت است؛ لاگ سرور را ببینید).`);
  }

  const mode = await getAutoReplyMode();
  if (mode === "off") hints.push("ℹ️ پاسخ خودکار AI خاموش است (آخرین کمپین گزینه ۱ بوده). گزینه ۲ یا ۳ را بزنید.");

  const escalated = await countEscalatedConversations();
  if (escalated.total > 0) {
    const reasons = Object.entries(escalated.byReason).map(([k, v]) => `${k}: ${v}`).join("، ");
    hints.push(`⚠️ ${escalated.total} گفتگو به انسان ارجاع شده و AI در آن‌ها جواب نمی‌دهد (${reasons}). با «رفع ارجاع همه» به AI برگردانید.`);
  }

  const awaiting = (await listUnansweredChats()).length;
  if (awaiting > 0 && mode === "ai") hints.push(`ℹ️ ${awaiting} گفتگو منتظر پاسخ است (گزینه ۳ به آن‌ها جواب می‌دهد).`);

  if (runtimeStats.lastError) {
    hints.push(`❌ آخرین خطا (${runtimeStats.lastError.where}): ${runtimeStats.lastError.message}`);
  }
  if (runtimeStats.lastSkip) {
    hints.push(`ℹ️ آخرین گفتگویی که جواب داده نشد: ${runtimeStats.lastSkip.reason}`);
  }
  if (hints.length === 0) hints.push("✅ مشکلی پیدا نشد. یک پیام از بله بفرستید و ۱۰ ثانیه بعد دوباره بررسی کنید.");

  res.json({
    autoReplyMode: mode,
    bot,
    webhookInfo,
    escalated,
    awaitingReply: awaiting,
    stats: runtimeStats,
    hints,
  });
}));

/** POST /admin/campaigns/reset-escalations — همه‌ی گفتگوهای ارجاع‌شده را به AI برمی‌گرداند؛ با {sweep:true} به پیام‌های بی‌پاسخ هم جواب می‌دهد */
router.post("/reset-escalations", asyncHandler(async (req, res) => {
  const count = await clearAllEscalations();
  const startSweep = !!req.body?.sweep && (await getAutoReplyMode()) === "ai";
  if (startSweep) {
    void sweepUnansweredChats().catch((err) => console.error("[campaign] خطا در بررسی پیام‌های بی‌پاسخ:", err));
  }
  res.json({ cleared: count, sweepStarted: startSweep });
}));

export default router;
