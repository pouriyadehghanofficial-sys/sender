"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaignRepository_1 = require("../../db/campaignRepository");
const productRepository_1 = require("../../db/productRepository");
const campaignService_1 = require("../../services/campaignService");
const activityLogRepository_1 = require("../../db/activityLogRepository");
const asyncHandler_1 = require("../../utils/asyncHandler");
const router = (0, express_1.Router)();
function campaignProgressView(c) {
    const percentage = c.totalContacts > 0 ? Math.round((c.processed / c.totalContacts) * 100) : 0;
    return {
        id: c.id,
        name: c.name,
        status: c.status,
        productId: c.productId,
        product: c.product ? { id: c.product.id, name: c.product.name } : undefined,
        progress: {
            total: c.totalContacts,
            processed: c.processed,
            successful: c.successful,
            failed: c.failed,
            pending: Math.max(0, c.totalContacts - c.processed),
            percentage,
        },
        running: (0, campaignService_1.isTenantCampaignRunning)(c.id),
        createdAt: c.createdAt,
        startedAt: c.startedAt,
        pausedAt: c.pausedAt,
        completedAt: c.completedAt,
        cancelledAt: c.cancelledAt,
    };
}
router.get("/", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const campaigns = await (0, campaignRepository_1.listCampaignsForUser)(req.auth.userId);
    res.json({ data: campaigns.map(campaignProgressView) });
}));
router.post("/", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { productId, name } = req.body ?? {};
    if (!productId)
        return res.status(400).json({ error: "فیلد productId الزامی است." });
    const product = await (0, productRepository_1.getProductAccessibleByUser)(productId, req.auth.userId);
    if (!product)
        return res.status(400).json({ error: "productId نامعتبر است یا متعلق به شما نیست." });
    const campaign = await (0, campaignRepository_1.createCampaign)(req.auth.userId, productId, name);
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "campaign_created",
        resourceType: "campaign",
        resourceId: campaign.id,
        metadata: { productId },
    });
    res.status(201).json({ campaign: campaignProgressView({ ...campaign, product }) });
}));
router.get("/:id", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const campaign = await (0, campaignRepository_1.getCampaignOwnedByUser)(req.params.id, req.auth.userId);
    if (!campaign)
        return res.status(404).json({ error: "کمپین یافت نشد." });
    res.json({ campaign: campaignProgressView(campaign) });
}));
router.post("/:id/start", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const campaign = await (0, campaignRepository_1.getCampaignOwnedByUser)(req.params.id, req.auth.userId);
    if (!campaign)
        return res.status(404).json({ error: "کمپین یافت نشد." });
    if (campaign.status === campaignRepository_1.CampaignStatus.RUNNING || (0, campaignService_1.isTenantCampaignRunning)(campaign.id)) {
        return res.status(409).json({ error: "این کمپین از قبل در حال اجراست." });
    }
    if (campaign.status === campaignRepository_1.CampaignStatus.COMPLETED || campaign.status === campaignRepository_1.CampaignStatus.CANCELLED) {
        return res.status(409).json({ error: `کمپین در وضعیت «${campaign.status}» است و قابل شروع دوباره نیست.` });
    }
    await (0, campaignRepository_1.updateCampaignStatus)(campaign.id, campaignRepository_1.CampaignStatus.RUNNING);
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "campaign_started",
        resourceType: "campaign",
        resourceId: campaign.id,
    });
    // اجرای واقعی در پس‌زمینه — پاسخ فوری به کلاینت
    (0, campaignService_1.runTenantCampaign)(campaign.id, req.auth.userId, campaign.productId, req.auth.apiKeyId).catch((err) => {
        console.error(`[campaign ${campaign.id}] خطا:`, err);
    });
    res.status(202).json({ message: "کمپین شروع شد.", campaignId: campaign.id });
}));
router.post("/:id/pause", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const campaign = await (0, campaignRepository_1.getCampaignOwnedByUser)(req.params.id, req.auth.userId);
    if (!campaign)
        return res.status(404).json({ error: "کمپین یافت نشد." });
    if (campaign.status !== campaignRepository_1.CampaignStatus.RUNNING) {
        return res.status(409).json({ error: "فقط کمپین در حال اجرا قابل توقف موقت است." });
    }
    // فقط status را در دیتابیس عوض می‌کنیم؛ حلقه‌ی runTenantCampaign خودش قبل از
    // پیام بعدی این وضعیت را می‌خواند و متوقف می‌شود (بدون نیاز به سیگنال دیگر).
    await (0, campaignRepository_1.updateCampaignStatus)(campaign.id, campaignRepository_1.CampaignStatus.PAUSED);
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "campaign_paused",
        resourceType: "campaign",
        resourceId: campaign.id,
    });
    res.json({ message: "کمپین متوقف شد؛ هر وقت خواستید با /resume ادامه دهید." });
}));
router.post("/:id/resume", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const campaign = await (0, campaignRepository_1.getCampaignOwnedByUser)(req.params.id, req.auth.userId);
    if (!campaign)
        return res.status(404).json({ error: "کمپین یافت نشد." });
    if (campaign.status !== campaignRepository_1.CampaignStatus.PAUSED) {
        return res.status(409).json({ error: "فقط کمپین متوقف‌شده قابل ادامه است." });
    }
    await (0, campaignRepository_1.updateCampaignStatus)(campaign.id, campaignRepository_1.CampaignStatus.RUNNING);
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "campaign_resumed",
        resourceType: "campaign",
        resourceId: campaign.id,
    });
    (0, campaignService_1.runTenantCampaign)(campaign.id, req.auth.userId, campaign.productId, req.auth.apiKeyId).catch((err) => {
        console.error(`[campaign ${campaign.id}] خطا:`, err);
    });
    res.status(202).json({ message: "کمپین از همان‌جا که مانده بود ادامه پیدا کرد." });
}));
router.post("/:id/cancel", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const campaign = await (0, campaignRepository_1.getCampaignOwnedByUser)(req.params.id, req.auth.userId);
    if (!campaign)
        return res.status(404).json({ error: "کمپین یافت نشد." });
    if (campaign.status === campaignRepository_1.CampaignStatus.COMPLETED || campaign.status === campaignRepository_1.CampaignStatus.CANCELLED) {
        return res.status(409).json({ error: "این کمپین از قبل تمام یا لغو شده است." });
    }
    await (0, campaignRepository_1.updateCampaignStatus)(campaign.id, campaignRepository_1.CampaignStatus.CANCELLED);
    await (0, activityLogRepository_1.logActivity)({
        userId: req.auth.userId,
        apiKeyId: req.auth.apiKeyId,
        action: "campaign_cancelled",
        resourceType: "campaign",
        resourceId: campaign.id,
    });
    res.json({ message: "کمپین لغو شد." });
}));
exports.default = router;
