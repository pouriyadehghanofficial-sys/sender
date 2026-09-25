import { Router } from "express";
import { listOrders } from "../db/orderRepository";
import { listActiveConversationsWithLastMessage } from "../db/conversationRepository";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const orders = await listOrders();
  res.json({ orders });
}));

router.get("/conversations/active", asyncHandler(async (_req, res) => {
  const conversations = await listActiveConversationsWithLastMessage();
  res.json({ conversations });
}));

export default router;
