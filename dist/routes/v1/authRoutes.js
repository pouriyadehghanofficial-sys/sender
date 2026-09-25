"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../../utils/auth");
const userRepository_1 = require("../../db/userRepository");
const activityLogRepository_1 = require("../../db/activityLogRepository");
const asyncHandler_1 = require("../../utils/asyncHandler");
const loginService_1 = require("../../services/loginService");
const router = (0, express_1.Router)();
// جلوی brute-force روی پسورد را می‌گیرد: حداکثر ۱۰ تلاش در ۱۵ دقیقه برای هر IP
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "تعداد تلاش‌های ورود بیش از حد مجاز بود. چند دقیقه دیگر امتحان کنید." },
});
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
router.post("/register", authLimiter, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: "ایمیل معتبر الزامی است." });
    }
    if (!password || String(password).length < 8) {
        return res.status(400).json({ error: "پسورد باید حداقل ۸ کاراکتر باشد." });
    }
    const existing = await (0, userRepository_1.findUserByEmail)(email);
    if (existing) {
        return res.status(409).json({ error: "کاربری با این ایمیل قبلاً ثبت‌نام کرده است." });
    }
    // اولین کاربری که در کل پلتفرم ثبت‌نام می‌کند، خودکار مالک (owner) می‌شود —
    // این باید همان کسی باشید که اول‌بار این پروژه را دیپلوی می‌کند.
    const isFirstUser = (await (0, userRepository_1.countUsers)()) === 0;
    const passwordHash = await (0, auth_1.hashPassword)(String(password));
    const user = await (0, userRepository_1.createUser)(email, passwordHash, isFirstUser);
    await (0, activityLogRepository_1.logActivity)({ userId: user.id, action: "user_registered", resourceType: "user", resourceId: user.id });
    const token = (0, auth_1.signJwt)({ userId: user.id, email: user.email, isOwner: user.isOwner });
    res.status(201).json({ token, user: { id: user.id, email: user.email, isOwner: user.isOwner } });
}));
router.post("/login", authLimiter, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        return res.status(400).json({ error: "ایمیل و پسورد الزامی هستند." });
    }
    let user;
    try {
        user = await (0, userRepository_1.findUserByEmail)(email);
    }
    catch (err) {
        console.error("[auth/login] خطا در خواندن کاربر از دیتابیس:", err);
        return res.status(500).json({ error: "خطای داخلی سرور در بررسی حساب کاربری." });
    }
    const result = await (0, loginService_1.performLogin)(user, String(password));
    res.status(result.status).json(result.body);
}));
exports.default = router;
