// چون SQLite از enum واقعی پشتیبانی نمی‌کند، مقادیر مجاز اینجا به‌صورت
// ثابت (const) تعریف و در لایه سرویس اعتبارسنجی می‌شوند.

export const ProviderType = {
  ANTHROPIC: "anthropic",
  OPENAI_COMPATIBLE: "openai_compatible",
} as const;
export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

export const ContactStatus = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  NO_BALE: "no_bale",
  PASSIVE: "passive",
} as const;
export type ContactStatus = (typeof ContactStatus)[keyof typeof ContactStatus];

export const ConversationState = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
} as const;
export type ConversationState = (typeof ConversationState)[keyof typeof ConversationState];

export const MessageSender = {
  USER: "user",
  AI: "ai",
  /** پاسخ دستی اپراتور انسانی از پنل مدیریت (بعد از ارجاع مکالمه) */
  HUMAN: "human",
} as const;
export type MessageSender = (typeof MessageSender)[keyof typeof MessageSender];

export const OrderStatus = {
  COMPLETED: "completed",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
