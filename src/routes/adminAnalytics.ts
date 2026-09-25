import { Router } from "express";
import { getInsightsReport } from "../services/insightsService";
import { generateChurnReport } from "../services/churnReportService";
import { getPromptVariantConversionReport } from "../db/promptVariantRepository";
import { runFollowUpScan } from "../services/followUpService";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/**
 * GET /admin/analytics/insights
 * دلایل رایج ارجاع به انسان + پرتکرارترین موضوعاتی که AI جوابشان را نمی‌دانست.
 */
router.get("/insights", asyncHandler(async (_req, res) => {
  res.json(await getInsightsReport());
}));

/**
 * GET /admin/analytics/churn?hours=2
 * گزارش «چرا مشتری نخرید» — خلاصه‌سازی AI از مکالمات رهاشده/بدون سفارش.
 * چون هزینه‌ی یک فراخوانی AI دارد، درخواستی است (نه خودکار روی هر پیام).
 */
router.get("/churn", asyncHandler(async (req, res) => {
  const hours = req.query.hours ? Number(req.query.hours) : undefined;
  res.json(await generateChurnReport({ sinceHours: hours }));
}));

/**
 * GET /admin/analytics/products/:productId/ab-test
 * گزارش نرخ تبدیل هر نسخه‌ی A/B این محصول (به‌همراه پرامپت پیش‌فرض به‌عنوان مرجع).
 */
router.get("/products/:productId/ab-test", asyncHandler(async (req, res) => {
  res.json({ variants: await getPromptVariantConversionReport(req.params.productId) });
}));

/**
 * POST /admin/analytics/follow-up/run-now
 * اجرای دستی «پیگیری مشتریان مردد» بدون منتظر ماندن برای اسکن خودکار بعدی (برای تست).
 */
router.post("/follow-up/run-now", asyncHandler(async (_req, res) => {
  res.json(await runFollowUpScan());
}));

export default router;
