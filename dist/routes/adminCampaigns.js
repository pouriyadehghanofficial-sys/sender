"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaignService_1 = require("../services/campaignService");
const contactRepository_1 = require("../db/contactRepository");
const csv_1 = require("../utils/csv");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
/**
 * POST /admin/campaigns/:productId/send
 * کمپین را به‌صورت غیرمسدودکننده (background) شروع می‌کند و بلافاصله ۲۰۲ برمی‌گرداند.
 * چون فقط مخاطبین status='pending' فرستاده می‌شوند، همین endpoint نقش «ادامه کمپین» را
 * هم بازی می‌کند: اگر قبلاً به هر دلیلی (قطعی سرور، خطای شبکه، خرابی API) متوقف شده
 * بود، دوباره صدا زدنش دقیقاً از همان مخاطبین ارسال‌نشده ادامه می‌دهد.
 */
router.post("/:productId/send", async (req, res) => {
    const { productId } = req.params;
    const { initialMessageText, initialMessagePhoto, isPassiveMode } = req.body || {};
    if ((0, campaignService_1.isCampaignRunning)(productId)) {
        return res.status(409).json({ error: "یک کمپین برای این محصول همین الان در حال اجراست." });
    }
    // اجرای async بدون await کامل — پاسخ فوری به کاربر، ادامه در پس‌زمینه
    (0, campaignService_1.sendCampaign)(productId, (progress) => {
        console.log(`[campaign ${productId}] پیشرفت: ${progress.sent + progress.failed + progress.noBale}/${progress.total} ` +
            `(sent=${progress.sent}, failed=${progress.failed}, no_bale=${progress.noBale})`);
    }, { initialMessageText, initialMessagePhoto, isPassiveMode }).catch((err) => {
        console.error(`[campaign ${productId}] خطا در اجرای کمپین:`, err);
    });
    res.status(202).json({
        message: "ارسال کمپین در پس‌زمینه شروع شد. برای مشاهده پیشرفت، گزارش را poll کنید.",
        reportUrl: `/admin/campaigns/${productId}/report`,
    });
});
/** وضعیت لحظه‌ای: آیا کمپین همین الان در حال ارسال است؟ (برای دکمه «ادامه ارسال» در پنل) */
router.get("/:productId/status", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { productId } = req.params;
    const { counts } = await (0, contactRepository_1.getCampaignReport)(productId);
    res.json({ running: (0, campaignService_1.isCampaignRunning)(productId), counts });
}));
/**
 * GET /admin/campaigns/:productId/report            -> JSON
 * GET /admin/campaigns/:productId/report?format=csv  -> دانلود CSV
 */
router.get("/:productId/report", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { productId } = req.params;
    const { counts, contacts } = await (0, contactRepository_1.getCampaignReport)(productId);
    if (req.query.format === "csv") {
        const csv = (0, csv_1.toCsv)(["نام", "شماره", "وضعیت", "زمان ارسال", "پیام خطا"], contacts.map((c) => [c.name, c.phone, c.status, c.sentAt ?? "", c.errorMessage ?? ""]));
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="campaign-${productId}.csv"`);
        return res.send(csv);
    }
    res.json({ counts, contacts });
}));
exports.default = router;
