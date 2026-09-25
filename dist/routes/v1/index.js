"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authRoutes_1 = __importDefault(require("./authRoutes"));
const apiKeyRoutes_1 = __importDefault(require("./apiKeyRoutes"));
const productRoutes_1 = __importDefault(require("./productRoutes"));
const contactsRoutes_1 = __importDefault(require("./contactsRoutes"));
const campaignRoutes_1 = __importDefault(require("./campaignRoutes"));
const conversationRoutes_1 = __importDefault(require("./conversationRoutes"));
const orderRoutes_1 = __importDefault(require("./orderRoutes"));
const referralRoutes_1 = __importDefault(require("./referralRoutes"));
const dashboardRoutes_1 = __importDefault(require("./dashboardRoutes"));
const adminRoutes_1 = __importDefault(require("./adminRoutes"));
const authMiddleware_1 = require("./authMiddleware");
const router = (0, express_1.Router)();
// محدودیت نرخ عمومی روی کل API v1 — جلوی سوءاستفاده از یک کلید/IP را می‌گیرد
// (بخش ۱۸ سند: "rate limiting where practical")
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    limit: 120, // هر IP/کلید حداکثر ۱۲۰ درخواست در دقیقه
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "تعداد درخواست‌ها بیش از حد مجاز بود. کمی صبر کنید." },
});
router.use(apiLimiter);
// ثبت‌نام/ورود نیازی به توکن ندارند
router.use("/auth", authRoutes_1.default);
// همه‌ی بقیه‌ی API نیاز به احراز هویت دارند (JWT یا کلید API — بخش ۲ سند)
router.use("/api-keys", authMiddleware_1.requireAuth, apiKeyRoutes_1.default);
router.use("/products", authMiddleware_1.requireAuth, productRoutes_1.default);
router.use("/contacts", authMiddleware_1.requireAuth, contactsRoutes_1.default);
router.use("/campaigns", authMiddleware_1.requireAuth, campaignRoutes_1.default);
router.use("/conversations", authMiddleware_1.requireAuth, conversationRoutes_1.default);
router.use("/orders", authMiddleware_1.requireAuth, orderRoutes_1.default);
router.use("/referrals", authMiddleware_1.requireAuth, referralRoutes_1.default);
router.use("/dashboard", authMiddleware_1.requireAuth, dashboardRoutes_1.default);
router.use("/admin", authMiddleware_1.requireAuth, adminRoutes_1.default); // خودِ adminRoutes هم requireOwner دارد
exports.default = router;
