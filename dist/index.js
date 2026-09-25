"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const health_1 = __importDefault(require("./routes/health"));
const adminProducts_1 = __importDefault(require("./routes/adminProducts"));
const adminContacts_1 = __importDefault(require("./routes/adminContacts"));
const adminCampaigns_1 = __importDefault(require("./routes/adminCampaigns"));
const webhookBale_1 = __importDefault(require("./routes/webhookBale"));
const adminBale_1 = __importDefault(require("./routes/adminBale"));
const adminOrders_1 = __importDefault(require("./routes/adminOrders"));
const adminAiProviders_1 = __importDefault(require("./routes/adminAiProviders"));
const adminConversations_1 = __importDefault(require("./routes/adminConversations"));
const adminAuthMiddleware_1 = require("./routes/adminAuthMiddleware");
const v1_1 = __importDefault(require("./routes/v1"));
const openapi_json_1 = __importDefault(require("./openapi.json"));
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
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: "5mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// فایل‌های استاتیک پنل مدیریت (تک‌مستأجر قدیمی) — عمداً بدون توکن، چون فقط HTML/JS/CSS
// است و هیچ داده‌ی حساسی ندارد؛ خودِ درخواست‌های API از داخل آن با توکن محافظت می‌شوند.
app.use("/ui", express_1.default.static(path_1.default.join(__dirname, "..", "src", "ui")));
// ---------------------------------------------------------------------------
// داشبورد React پلتفرم چندمستأجری (build شده از web/) — فقط سرو کردن فایل استاتیک،
// هیچ منطق API/دیتابیسی اینجا نیست. خودِ اپ React با JWT/کلید API به همان
// /api/v1 موجود وصل می‌شود؛ هیچ endpoint یا رفتار بک‌اندی تغییر نکرده است.
// ---------------------------------------------------------------------------
const webDistPath = path_1.default.join(__dirname, "..", "web", "dist");
app.use("/app", express_1.default.static(webDistPath));
app.get("/app/*", (_req, res) => {
    res.sendFile(path_1.default.join(webDistPath, "index.html"), (err) => {
        if (err) {
            res.status(500).send("داشبورد build نشده است. در پوشه web دستور «npm run build» را بزنید.");
        }
    });
});
app.use("/health", health_1.default);
// ---------------------------------------------------------------------------
// API v1 — پلتفرم چندمستأجری (بخش‌های ۱ تا ۱۹ سند). احراز هویت خودش داخل
// src/routes/v1/index.ts و authMiddleware.ts انجام می‌شود (JWT یا کلید API).
// ---------------------------------------------------------------------------
app.use("/api/v1", v1_1.default);
app.use("/api/v1/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_json_1.default));
// ---------------------------------------------------------------------------
// پنل مدیریت قدیمی تک‌مستأجر (فازهای ۰ تا ۹ اولیه) — دست‌نخورده باقی مانده،
// همچنان با ADMIN_PANEL_TOKEN محافظت می‌شود. این همان زیرساخت مشترک بله/AI است
// که همه‌ی کاربران پلتفرم چندمستأجری از آن استفاده می‌کنند.
// ---------------------------------------------------------------------------
app.use("/admin", adminAuthMiddleware_1.requireAdminToken);
app.use("/admin/products", adminProducts_1.default);
app.use("/admin/contacts", adminContacts_1.default);
app.use("/admin/campaigns", adminCampaigns_1.default);
app.use("/admin/bale", adminBale_1.default);
app.use("/admin/orders", adminOrders_1.default);
app.use("/admin/ai-providers", adminAiProviders_1.default);
app.use("/admin/conversations", adminConversations_1.default);
// وبهوک بازو با رمز مسیر (WEBHOOK_SECRET) محافظت می‌شود، نه توکن پنل — چون بازو نمی‌تواند
// هدر دلخواه بفرستد؛ جزئیات در routes/webhookBale.ts
app.use("/webhook/bale", webhookBale_1.default);
app.get("/", (_req, res) => {
    res.redirect("/ui/index.html");
});
// میان‌افزار مرکزی خطا: هر route ای که با asyncHandler یا next(err) خطا را پاس بدهد،
// اینجا می‌افتد و فقط همان یک درخواست ۵۰۰ می‌گیرد؛ بقیه‌ی سرور دست‌نخورده می‌ماند.
app.use((err, _req, res, next) => {
    console.error("[خطای مدیریت‌نشده در route]", err);
    if (res.headersSent)
        return next(err);
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
});
exports.default = app;
