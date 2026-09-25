"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderRepository_1 = require("../db/orderRepository");
const conversationRepository_1 = require("../db/conversationRepository");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
router.get("/", (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const orders = await (0, orderRepository_1.listOrders)();
    res.json({ orders });
}));
router.get("/conversations/active", (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const conversations = await (0, conversationRepository_1.listActiveConversationsWithLastMessage)();
    res.json({ conversations });
}));
exports.default = router;
