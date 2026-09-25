import { Router } from "express";
import { sendCampaign, isCampaignRunning, CampaignMode } from "../services/campaignService";
import { getCampaignReport, getCampaignCounts } from "../db/contactRepository";
import { getProductById } from "../db/productRepository";
import { getSetting, SettingKeys } from "../db/settingsRepository";
import { getAutoReplyMode, isSweepRunning, getLastSweep } from "../services/replyService";
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

export default router;
