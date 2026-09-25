"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminToken = requireAdminToken;
/**
 * بدون این میان‌افزار، هر کسی که آدرس سرور شما را داشته باشد می‌توانست کلید API
 * هوش مصنوعی شما را ببیند/عوض کند، مخاطبین را ببیند، کمپین بزند، یا جای شما به
 * مشتری‌ها دستی پاسخ بدهد. همه‌ی روت‌های زیر /admin با یک توکن ساده محافظت می‌شوند.
 *
 * توکن از هدر x-admin-token یا کوئری ?token= خوانده می‌شود و با ADMIN_PANEL_TOKEN
 * در .env مقایسه می‌شود. اگر ADMIN_PANEL_TOKEN تنظیم نشده باشد، به‌جای قفل کامل
 * (که برای توسعه‌ی محلی آزاردهنده است) فقط یک هشدار در لاگ سرور چاپ می‌شود —
 * ولی قبل از هر دیپلوی عمومی حتماً باید این متغیر را تنظیم کنید.
 */
function requireAdminToken(req, res, next) {
    const expected = process.env.ADMIN_PANEL_TOKEN;
    if (!expected) {
        console.warn("[امنیت] ADMIN_PANEL_TOKEN تنظیم نشده — پنل مدیریت و API ها کاملاً بدون رمز و در دسترس همه هستند! " +
            "قبل از دیپلوی روی اینترنت عمومی حتماً این متغیر را در .env تنظیم کنید.");
        return next();
    }
    const provided = req.header("x-admin-token") || req.query.token;
    if (provided !== expected) {
        return res.status(401).json({ error: "دسترسی غیرمجاز. توکن پنل مدیریت را وارد کنید." });
    }
    next();
}
