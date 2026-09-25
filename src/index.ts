import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import swaggerUi from "swagger-ui-express";
import healthRouter from "./routes/health";
import adminProductsRouter from "./routes/adminProducts";
import adminContactsRouter from "./routes/adminContacts";
import adminCampaignsRouter from "./routes/adminCampaigns";
import webhookBaleRouter from "./routes/webhookBale";
import adminBaleRouter from "./routes/adminBale";
import adminOrdersRouter from "./routes/adminOrders";
import adminAiProvidersRouter from "./routes/adminAiProviders";
import adminConversationsRouter from "./routes/adminConversations";
import adminAnalyticsRouter from "./routes/adminAnalytics";
import { requireAdminToken } from "./routes/adminAuthMiddleware";
import apiV1Router from "./routes/v1";
import openapiSpec from "./openapi.json";
import { getAutoReplyMode, sweepUnansweredChats, replyToChat } from "./services/replyService";
import { startBaleUpdatesPoller, shouldUsePolling } from "./services/baleUpdatesPoller";
import { startFollowUpScheduler } from "./services/followUpService";
import { startReplyQueueWorker } from "./queue/replyQueue";
import { startCampaignQueueWorker } from "./queue/campaignQueue";
import { sendIntroToContactJob } from "./services/campaignService";
import { isQueueEnabled } from "./queue/queueConnection";

// شبکه‌ی امنیتی سطح پردازه: اگر جایی یک promise بدون catch reject شود، به‌جای
// کرش کل سرور (و قطعی همه‌ی کاربران فعلی)، فقط لاگ می‌کنیم و زنده می‌مانیم.
// این جایگزین رفع ریشه‌ای باگ نیست (که با asyncHandler روی تک‌تک route ها انجام شده)
// بلکه آخرین خط دفاعی است برای هر چیزی که از قلم افتاده باشد.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] یک خطای پیش‌بینی‌نشده رخ داد (سرور همچنان روشن می‌ماند):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] یک خطای پیش‌بینی‌نشده رخ داد (سرور همچنان روشن می‌ماند):", err);
});

const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// فایل‌های استاتیک پنل مدیریت (تک‌مستأجر قدیمی) — عمداً بدون توکن، چون فقط HTML/JS/CSS
// است و هیچ داده‌ی حساسی ندارد؛ خودِ درخواست‌های API از داخل آن با توکن محافظت می‌شوند.
app.use("/ui", express.static(path.join(__dirname, "..", "src", "ui")));

// ---------------------------------------------------------------------------
// داشبورد React پلتفرم چندمستأجری (build شده از web/) — فقط سرو کردن فایل استاتیک،
// هیچ منطق API/دیتابیسی اینجا نیست. خودِ اپ React با JWT/کلید API به همان
// /api/v1 موجود وصل می‌شود؛ هیچ endpoint یا رفتار بک‌اندی تغییر نکرده است.
// ---------------------------------------------------------------------------
const webDistPath = path.join(__dirname, "..", "web", "dist");
app.use("/app", express.static(webDistPath));
app.get("/app/*", (_req, res) => {
  res.sendFile(path.join(webDistPath, "index.html"), (err) => {
    if (err) {
      res.status(500).send("داشبورد build نشده است. در پوشه web دستور «npm run build» را بزنید.");
    }
  });
});

app.use("/health", healthRouter);

// ---------------------------------------------------------------------------
// API v1 — پلتفرم چندمستأجری (بخش‌های ۱ تا ۱۹ سند). احراز هویت خودش داخل
// src/routes/v1/index.ts و authMiddleware.ts انجام می‌شود (JWT یا کلید API).
// ---------------------------------------------------------------------------
app.use("/api/v1", apiV1Router);
app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// ---------------------------------------------------------------------------
// پنل مدیریت قدیمی تک‌مستأجر (فازهای ۰ تا ۹ اولیه) — دست‌نخورده باقی مانده،
// همچنان با ADMIN_PANEL_TOKEN محافظت می‌شود. این همان زیرساخت مشترک بله/AI است
// که همه‌ی کاربران پلتفرم چندمستأجری از آن استفاده می‌کنند.
// ---------------------------------------------------------------------------
app.use("/admin", requireAdminToken);
app.use("/admin/products", adminProductsRouter);
app.use("/admin/contacts", adminContactsRouter);
app.use("/admin/campaigns", adminCampaignsRouter);
app.use("/admin/bale", adminBaleRouter);
app.use("/admin/orders", adminOrdersRouter);
app.use("/admin/ai-providers", adminAiProvidersRouter);
app.use("/admin/conversations", adminConversationsRouter);
app.use("/admin/analytics", adminAnalyticsRouter);

// وبهوک بازو با رمز مسیر (WEBHOOK_SECRET) محافظت می‌شود، نه توکن پنل — چون بازو نمی‌تواند
// هدر دلخواه بفرستد؛ جزئیات در routes/webhookBale.ts
app.use("/webhook/bale", webhookBaleRouter);

app.get("/", (_req, res) => {
  res.redirect("/ui/index.html");
});

// میان‌افزار مرکزی خطا: هر route ای که با asyncHandler یا next(err) خطا را پاس بدهد،
// اینجا می‌افتد و فقط همان یک درخواست ۵۰۰ می‌گیرد؛ بقیه‌ی سرور دست‌نخورده می‌ماند.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  console.error("[خطای مدیریت‌نشده در route]", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "خطای داخلی سرور." });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`سرور روی پورت ${PORT} بالا آمد. تست سلامت: http://localhost:${PORT}/health`);
  console.log(`مستندات API v1: http://localhost:${PORT}/api/v1/docs`);
  if (!process.env.ADMIN_PANEL_TOKEN) {
    console.warn("[امنیت] ADMIN_PANEL_TOKEN تنظیم نشده — پنل قدیمی و API های /admin بدون رمز در دسترس‌اند.");
  }
  if (!process.env.JWT_SECRET) {
    console.warn("[امنیت] JWT_SECRET تنظیم نشده — /api/v1/auth کار نخواهد کرد تا این را تنظیم کنید.");
  }

  // اجرای محلی (بدون آدرس عمومی): پیام‌های بله را با getUpdates می‌گیریم
  if (shouldUsePolling()) startBaleUpdatesPoller();

  // پیگیری خودکار مشتریان مردد / یادآوری سبد رهاشده
  startFollowUpScheduler();

  // صف واقعی Redis/BullMQ (کاملاً اختیاری؛ فقط اگر REDIS_URL تنظیم شده باشد چیزی راه می‌افتد)
  if (isQueueEnabled) {
    console.log("[queue] REDIS_URL تنظیم شده؛ صف واقعی برای پاسخ‌دهی و ارسال کمپین فعال می‌شود.");
    startReplyQueueWorker(async (chatId) => {
      await replyToChat(chatId);
    });
    startCampaignQueueWorker(sendIntroToContactJob);
  }

  // بازیابی بعد از ری‌استارت: تایمرهای debounce در حافظه‌اند و با ری‌استارت از بین می‌روند.
  // اگر پاسخ‌گویی خودکار روشن است، به پیام‌های ۲۴ ساعت اخیر که جواب نگرفته‌اند جواب می‌دهیم.
  setTimeout(() => {
    getAutoReplyMode()
      .then((mode) => (mode === "ai" ? sweepUnansweredChats({ maxAgeMs: 24 * 60 * 60 * 1000 }) : null))
      .catch((err) => console.error("[startup] خطا در بازیابی پیام‌های بی‌پاسخ:", err));
  }, 15_000);
});

export default app;
