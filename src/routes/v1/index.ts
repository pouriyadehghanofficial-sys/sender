import { Router } from "express";
import rateLimit from "express-rate-limit";
import authRoutes from "./authRoutes";
import apiKeyRoutes from "./apiKeyRoutes";
import productRoutes from "./productRoutes";
import contactsRoutes from "./contactsRoutes";
import campaignRoutes from "./campaignRoutes";
import conversationRoutes from "./conversationRoutes";
import orderRoutes from "./orderRoutes";
import referralRoutes from "./referralRoutes";
import dashboardRoutes from "./dashboardRoutes";
import adminRoutes from "./adminRoutes";
import { requireAuth } from "./authMiddleware";

const router = Router();

// محدودیت نرخ عمومی روی کل API v1 — جلوی سوءاستفاده از یک کلید/IP را می‌گیرد
// (بخش ۱۸ سند: "rate limiting where practical")
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120, // هر IP/کلید حداکثر ۱۲۰ درخواست در دقیقه
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تعداد درخواست‌ها بیش از حد مجاز بود. کمی صبر کنید." },
});
router.use(apiLimiter);

// ثبت‌نام/ورود نیازی به توکن ندارند
router.use("/auth", authRoutes);

// همه‌ی بقیه‌ی API نیاز به احراز هویت دارند (JWT یا کلید API — بخش ۲ سند)
router.use("/api-keys", requireAuth, apiKeyRoutes);
router.use("/products", requireAuth, productRoutes);
router.use("/contacts", requireAuth, contactsRoutes);
router.use("/campaigns", requireAuth, campaignRoutes);
router.use("/conversations", requireAuth, conversationRoutes);
router.use("/orders", requireAuth, orderRoutes);
router.use("/referrals", requireAuth, referralRoutes);
router.use("/dashboard", requireAuth, dashboardRoutes);
router.use("/admin", requireAuth, adminRoutes); // خودِ adminRoutes هم requireOwner دارد

export default router;
