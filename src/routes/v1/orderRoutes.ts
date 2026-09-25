import { Router } from "express";
import { listOrdersForUser, getOrderOwnedByUser } from "../../db/orderRepository";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const orders = await listOrdersForUser(req.auth!.userId);
    // فعلاً همه‌ی سفارش‌های ثبت‌شده وضعیت "completed" دارند (طبق منطق تشخیص [ORDER_CONFIRMED]).
    // فیلدهای active/cancelled برای معماری آینده در پاسخ آماده گذاشته شده‌اند.
    res.json({
      data: orders,
      summary: { completed: orders.length, active: 0, cancelled: 0 },
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await getOrderOwnedByUser(req.params.id, req.auth!.userId);
    if (!order) return res.status(404).json({ error: "سفارش یافت نشد." });
    res.json({ order });
  })
);

export default router;
