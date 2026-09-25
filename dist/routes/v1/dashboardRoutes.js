"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contactRepository_1 = require("../../db/contactRepository");
const campaignRepository_1 = require("../../db/campaignRepository");
const conversationRepository_1 = require("../../db/conversationRepository");
const orderRepository_1 = require("../../db/orderRepository");
const productRepository_1 = require("../../db/productRepository");
const activityLogRepository_1 = require("../../db/activityLogRepository");
const asyncHandler_1 = require("../../utils/asyncHandler");
const router = (0, express_1.Router)();
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
function daysAgo(n) {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
/**
 * GET /api/v1/dashboard/summary — بخش ۱۷ سند: همه‌ی اطلاعات مهم داشبورد در یک
 * درخواست، تا فرانت‌اند (Google AI Studio) مجبور نباشد چند تا request جدا بزند.
 */
router.get("/summary", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const [messageCounts, activeCampaigns, allCampaigns, activeConversations, waitingForResponse, completedOrders, activeProducts, recentActivity] = await Promise.all([
        (0, contactRepository_1.getContactStatusCountsForUser)(userId),
        (0, campaignRepository_1.countCampaignsForUser)(userId, campaignRepository_1.CampaignStatus.RUNNING),
        (0, campaignRepository_1.listCampaignsForUser)(userId),
        (0, conversationRepository_1.countActiveConversationsForUser)(userId),
        (0, conversationRepository_1.countWaitingForResponseForUser)(userId),
        (0, orderRepository_1.countOrdersForUser)(userId),
        (0, productRepository_1.countActiveProductsForUser)(userId),
        (0, activityLogRepository_1.listActivityForUser)(userId, 15),
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
}));
/** GET /api/v1/dashboard/statistics — بخش ۱۱ سند، با فیلتر بازه‌ی زمانی */
router.get("/statistics", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const [messagesToday, messagesThisWeek, messagesThisMonth, statusCounts, activeCampaigns, activeConversations, waitingForResponse, completedOrders] = await Promise.all([
        (0, contactRepository_1.countMessagesSentSince)(userId, startOfToday()),
        (0, contactRepository_1.countMessagesSentSince)(userId, daysAgo(7)),
        (0, contactRepository_1.countMessagesSentSince)(userId, daysAgo(30)),
        (0, contactRepository_1.getContactStatusCountsForUser)(userId),
        (0, campaignRepository_1.countCampaignsForUser)(userId, campaignRepository_1.CampaignStatus.RUNNING),
        (0, conversationRepository_1.countActiveConversationsForUser)(userId),
        (0, conversationRepository_1.countWaitingForResponseForUser)(userId),
        (0, orderRepository_1.countOrdersForUser)(userId),
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
}));
exports.default = router;
