import { Router } from "express";
import { getContactStatusCountsForUser, countMessagesSentSince } from "../../db/contactRepository";
import { countCampaignsForUser, listCampaignsForUser, CampaignStatus } from "../../db/campaignRepository";
import { countActiveConversationsForUser, countWaitingForResponseForUser } from "../../db/conversationRepository";
import { countOrdersForUser } from "../../db/orderRepository";
import { countActiveProductsForUser } from "../../db/productRepository";
import { listActivityForUser } from "../../db/activityLogRepository";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * GET /api/v1/dashboard/summary — بخش ۱۷ سند: همه‌ی اطلاعات مهم داشبورد در یک
 * درخواست، تا فرانت‌اند (Google AI Studio) مجبور نباشد چند تا request جدا بزند.
 */
router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;

    const [messageCounts, activeCampaigns, allCampaigns, activeConversations, waitingForResponse, completedOrders, activeProducts, recentActivity] =
      await Promise.all([
        getContactStatusCountsForUser(userId),
        countCampaignsForUser(userId, CampaignStatus.RUNNING),
        listCampaignsForUser(userId),
        countActiveConversationsForUser(userId),
        countWaitingForResponseForUser(userId),
        countOrdersForUser(userId),
        countActiveProductsForUser(userId),
        listActivityForUser(userId, 15),
      ]);

    res.json({
      campaigns: {
        active: activeCampaigns,
        total: allCampaigns.length,
        recent: allCampaigns.slice(0, 5),
      },
      messages: {
        sent: messageCounts.sent,
        failed: messageCounts.failed,
        pending: messageCounts.pending,
        noBale: messageCounts.no_bale,
      },
      conversations: {
        active: activeConversations,
        waitingForResponse,
      },
      referrals: waitingForResponse, // در این پلتفرم ارجاع == منتظر پاسخ (بخش ۹ سند)
      orders: { completed: completedOrders },
      products: { active: activeProducts },
      recentActivity,
    });
  })
);

/** GET /api/v1/dashboard/statistics — بخش ۱۱ سند، با فیلتر بازه‌ی زمانی */
router.get(
  "/statistics",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;

    const [messagesToday, messagesThisWeek, messagesThisMonth, statusCounts, activeCampaigns, activeConversations, waitingForResponse, completedOrders] =
      await Promise.all([
        countMessagesSentSince(userId, startOfToday()),
        countMessagesSentSince(userId, daysAgo(7)),
        countMessagesSentSince(userId, daysAgo(30)),
        getContactStatusCountsForUser(userId),
        countCampaignsForUser(userId, CampaignStatus.RUNNING),
        countActiveConversationsForUser(userId),
        countWaitingForResponseForUser(userId),
        countOrdersForUser(userId),
      ]);

    const totalAttempts = statusCounts.sent + statusCounts.failed + statusCounts.no_bale;
    const successRate = totalAttempts > 0 ? Math.round((statusCounts.sent / totalAttempts) * 100) : 0;
    const failureRate = totalAttempts > 0 ? 100 - successRate : 0;

    res.json({
      messagesToday,
      messagesThisWeek,
      messagesThisMonth,
      successRate,
      failureRate,
      activeCampaigns,
      activeConversations,
      waitingForResponse,
      referrals: waitingForResponse,
      completedOrders,
    });
  })
);

export default router;
