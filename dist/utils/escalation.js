"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ESCALATION_KEYWORDS = exports.DEFAULT_ESCALATION_THRESHOLD = void 0;
exports.checkEscalationTrigger = checkEscalationTrigger;
exports.DEFAULT_ESCALATION_THRESHOLD = 10;
exports.DEFAULT_ESCALATION_KEYWORDS = [
    "اپراتور",
    "پشتیبان",
    "کارشناس",
    "صحبت با انسان",
    "با آدم صحبت کنم",
    "انسانی",
];
/**
 * تشخیص می‌دهد آیا مکالمه باید به اپراتور انسانی ارجاع شود یا نه.
 * دو محرک دارد:
 *  ۱) کاربر عبارتی شبیه «اپراتور» / «پشتیبان» و ... گفته باشد
 *  ۲) تعداد پیام‌های کاربر در این مکالمه به یک آستانه رسیده باشد
 * تابع خالص است (بدون وابستگی به دیتابیس یا شبکه) تا به‌راحتی تست شود.
 */
function checkEscalationTrigger(latestUserMessage, userMessageCountInConversation, options) {
    const keywords = options?.keywords ?? exports.DEFAULT_ESCALATION_KEYWORDS;
    const threshold = options?.threshold ?? exports.DEFAULT_ESCALATION_THRESHOLD;
    const normalized = latestUserMessage.toLowerCase();
    const matched = keywords.find((k) => k.trim() && normalized.includes(k.trim().toLowerCase()));
    if (matched) {
        return { shouldEscalate: true, reason: "keyword", matchedKeyword: matched };
    }
    if (userMessageCountInConversation >= threshold) {
        return { shouldEscalate: true, reason: "message_limit" };
    }
    return { shouldEscalate: false, reason: null };
}
