import { Router } from "express";
import {
  createCampaign,
  getCampaignOwnedByUser,
  listCampaignsForUser,
  updateCampaignStatus,
  CampaignStatus,
} from "../../db/campaignRepository";
import { getProductAccessibleByUser } from "../../db/productRepository";
import { listContactsByProduct } from "../../db/contactRepository";
import { ContactStatus } from "../../db/enums";
import { runTenantCampaign, isTenantCampaignRunning } from "../../services/campaignService";
import { logActivity } from "../../db/activityLogRepository";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

function campaignProgressView(c: any) {
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
    running: isTenantCampaignRunning(c.id),
    createdAt: c.createdAt,
    startedAt: c.startedAt,
    pausedAt: c.pausedAt,
    completedAt: c.completedAt,
    cancelledAt: c.cancelledAt,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const campaigns = await listCampaignsForUser(req.auth!.userId);
    res.json({ data: campaigns.map(campaignProgressView) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { productId, name } = req.body ?? {};
    if (!productId) return res.status(400).json({ error: "فیلد productId الزامی است." });

    const product = await getProductAccessibleByUser(productId, req.auth!.userId);
    if (!product) return res.status(400).json({ error: "productId نامعتبر است یا متعلق به شما نیست." });

    const campaign = await createCampaign(req.auth!.userId, productId, name);

    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "campaign_created",
      resourceType: "campaign",
      resourceId: campaign.id,
      metadata: { productId },
    });

    res.status(201).json({ campaign: campaignProgressView({ ...campaign, product }) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const campaign = await getCampaignOwnedByUser(req.params.id, req.auth!.userId);
    if (!campaign) return res.status(404).json({ error: "کمپین یافت نشد." });
    res.json({ campaign: campaignProgressView(campaign) });
  })
);

router.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    const campaign = await getCampaignOwnedByUser(req.params.id, req.auth!.userId);
    if (!campaign) return res.status(404).json({ error: "کمپین یافت نشد." });
    if (campaign.status === CampaignStatus.RUNNING || isTenantCampaignRunning(campaign.id)) {
      return res.status(409).json({ error: "این کمپین از قبل در حال اجراست." });
    }
    if (campaign.status === CampaignStatus.COMPLETED || campaign.status === CampaignStatus.CANCELLED) {
      return res.status(409).json({ error: `کمپین در وضعیت «${campaign.status}» است و قابل شروع دوباره نیست.` });
    }

    await updateCampaignStatus(campaign.id, CampaignStatus.RUNNING);
    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "campaign_started",
      resourceType: "campaign",
      resourceId: campaign.id,
    });

    // اجرای واقعی در پس‌زمینه — پاسخ فوری به کلاینت
    runTenantCampaign(campaign.id, req.auth!.userId, campaign.productId, req.auth!.apiKeyId).catch((err) => {
      console.error(`[campaign ${campaign.id}] خطا:`, err);
    });

    res.status(202).json({ message: "کمپین شروع شد.", campaignId: campaign.id });
  })
);

router.post(
  "/:id/pause",
  asyncHandler(async (req, res) => {
    const campaign = await getCampaignOwnedByUser(req.params.id, req.auth!.userId);
    if (!campaign) return res.status(404).json({ error: "کمپین یافت نشد." });
    if (campaign.status !== CampaignStatus.RUNNING) {
      return res.status(409).json({ error: "فقط کمپین در حال اجرا قابل توقف موقت است." });
    }

    // فقط status را در دیتابیس عوض می‌کنیم؛ حلقه‌ی runTenantCampaign خودش قبل از
    // پیام بعدی این وضعیت را می‌خواند و متوقف می‌شود (بدون نیاز به سیگنال دیگر).
    await updateCampaignStatus(campaign.id, CampaignStatus.PAUSED);
    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "campaign_paused",
      resourceType: "campaign",
      resourceId: campaign.id,
    });

    res.json({ message: "کمپین متوقف شد؛ هر وقت خواستید با /resume ادامه دهید." });
  })
);

router.post(
  "/:id/resume",
  asyncHandler(async (req, res) => {
    const campaign = await getCampaignOwnedByUser(req.params.id, req.auth!.userId);
    if (!campaign) return res.status(404).json({ error: "کمپین یافت نشد." });
    if (campaign.status !== CampaignStatus.PAUSED) {
      return res.status(409).json({ error: "فقط کمپین متوقف‌شده قابل ادامه است." });
    }

    await updateCampaignStatus(campaign.id, CampaignStatus.RUNNING);
    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "campaign_resumed",
      resourceType: "campaign",
      resourceId: campaign.id,
    });

    runTenantCampaign(campaign.id, req.auth!.userId, campaign.productId, req.auth!.apiKeyId).catch((err) => {
      console.error(`[campaign ${campaign.id}] خطا:`, err);
    });

    res.status(202).json({ message: "کمپین از همان‌جا که مانده بود ادامه پیدا کرد." });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const campaign = await getCampaignOwnedByUser(req.params.id, req.auth!.userId);
    if (!campaign) return res.status(404).json({ error: "کمپین یافت نشد." });
    if (campaign.status === CampaignStatus.COMPLETED || campaign.status === CampaignStatus.CANCELLED) {
      return res.status(409).json({ error: "این کمپین از قبل تمام یا لغو شده است." });
    }

    await updateCampaignStatus(campaign.id, CampaignStatus.CANCELLED);
    await logActivity({
      userId: req.auth!.userId,
      apiKeyId: req.auth!.apiKeyId,
      action: "campaign_cancelled",
      resourceType: "campaign",
      resourceId: campaign.id,
    });

    res.json({ message: "کمپین لغو شد." });
  })
);

export default router;
