"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performLogin = performLogin;
const auth_1 = require("../utils/auth");
/**
 * منطق اصلی ورود، جدا از نحوه‌ی واکشی کاربر از دیتابیس (که در routes/v1/authRoutes.ts
 * انجام می‌شود). این فایل عمداً هیچ import ای از db/* ندارد تا بدون نیاز به
 * دیتابیس واقعی قابل تست باشد (scripts/test-login-flow.ts).
 *
 * علت دقیق باگ گزارش‌شده (۵۰۰ به‌جای JWT/۴۰۱):
 * signJwt() از getJwtSecret() در utils/auth.ts استفاده می‌کند که اگر JWT_SECRET
 * در .env تنظیم نشده باشد یک Error پرتاب می‌کند. قبلاً این throw داخل route
 * گرفته نمی‌شد، به میان‌افزار خطای عمومی می‌رسید و همیشه یک ۵۰۰ ژنریک
 * ("خطای داخلی سرور.") برمی‌گشت — هم برای کاربر نامفهوم بود، هم برای
 * توسعه‌دهنده غیرقابل‌تشخیص از خطاهای دیگر. حالا صریح گرفته می‌شود.
 */
async function performLogin(user, password) {
    let passwordValid = false;
    if (user) {
        try {
            passwordValid = await (0, auth_1.verifyPassword)(password, user.passwordHash);
        }
        catch (err) {
            // مثلاً اگر passwordHash در دیتابیس خراب/ناقص باشد، bcrypt.compare می‌تواند reject کند.
            console.error("[auth/login] خطا در بررسی پسورد:", err);
            return { status: 500, body: { error: "خطای داخلی سرور در بررسی پسورد." } };
        }
    }
    // پیام خطا عمداً برای «کاربر نبود» و «پسورد غلط بود» یکسان است تا کسی نتواند
    // با آزمون‌وخطا فهمید کدام ایمیل‌ها در سیستم ثبت‌نام کرده‌اند.
    if (!user || !passwordValid) {
        return { status: 401, body: { error: "ایمیل یا پسورد اشتباه است." } };
    }
    if (!user.isActive) {
        return { status: 403, body: { error: "این حساب غیرفعال شده است." } };
    }
    try {
        const token = (0, auth_1.signJwt)({ userId: user.id, email: user.email, isOwner: user.isOwner });
        return {
            status: 200,
            body: { token, user: { id: user.id, email: user.email, isOwner: user.isOwner } },
        };
    }
    catch (err) {
        // همان علت اصلی باگ گزارش‌شده: معمولاً یعنی JWT_SECRET در .env تنظیم نشده.
        console.error("[auth/login] خطا در ساخت JWT:", err);
        return {
            status: 500,
            body: {
                error: "خطای پیکربندی سرور: JWT_SECRET تنظیم نشده است.",
                developerMessage: err?.message,
            },
        };
    }
}
