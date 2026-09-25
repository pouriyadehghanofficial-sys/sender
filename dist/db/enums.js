"use strict";
// چون SQLite از enum واقعی پشتیبانی نمی‌کند، مقادیر مجاز اینجا به‌صورت
// ثابت (const) تعریف و در لایه سرویس اعتبارسنجی می‌شوند.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatus = exports.MessageSender = exports.ConversationState = exports.ContactStatus = exports.ProviderType = void 0;
exports.ProviderType = {
    ANTHROPIC: "anthropic",
    OPENAI_COMPATIBLE: "openai_compatible",
};
exports.ContactStatus = {
    PENDING: "pending",
    SENT: "sent",
    FAILED: "failed",
    NO_BALE: "no_bale",
    PASSIVE: "passive",
};
exports.ConversationState = {
    ACTIVE: "active",
    COMPLETED: "completed",
    ABANDONED: "abandoned",
};
exports.MessageSender = {
    USER: "user",
    AI: "ai",
    /** پاسخ دستی اپراتور انسانی از پنل مدیریت (بعد از ارجاع مکالمه) */
    HUMAN: "human",
};
exports.OrderStatus = {
    COMPLETED: "completed",
};
