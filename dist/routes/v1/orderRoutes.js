"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderRepository_1 = require("../../db/orderRepository");
const asyncHandler_1 = require("../../utils/asyncHandler");
const router = (0, express_1.Router)();
router.get("/", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orders = await (0, orderRepository_1.listOrdersForUser)(req.auth.userId);
    // فعلاً همه‌ی سفارش‌های ثبت‌شده وضعیت "completed" دارند (طبق منطق تشخیص [ORDER_CONFIRMED]).
    // فیلدهای active/cancelled برای معماری آینده در پاسخ آماده گذاشته شده‌اند.
    res.json({
        data: orders,
        summary: { completed: orders.length, active: 0, cancelled: 0 },
    });
}));
router.get("/:id", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await (0, orderRepository_1.getOrderOwnedByUser)(req.params.id, req.auth.userId);
    if (!order)
        return res.status(404).json({ error: "سفارش یافت نشد." });
    res.json({ order });
}));
exports.default = router;
