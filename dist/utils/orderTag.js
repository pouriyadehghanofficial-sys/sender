"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectAndStripOrderConfirmed = detectAndStripOrderConfirmed;
exports.parseAiResponseTags = parseAiResponseTags;
const ORDER_TAG = "[ORDER_CONFIRMED]";
const NEEDS_HUMAN_TAG = "[NEEDS_HUMAN]";
/** تگ [ORDER_CONFIRMED] را از متن پاسخ AI تشخیص می‌دهد و آن را از متن نمایشی حذف می‌کند */
function detectAndStripOrderConfirmed(aiResponseText) {
    const orderConfirmed = aiResponseText.includes(ORDER_TAG);
    const displayText = aiResponseText.split(ORDER_TAG).join("").trim();
    return { displayText, orderConfirmed };
}
/**
 * هر دو تگ مخفی ممکن در پاسخ AI را همزمان تشخیص می‌دهد و از متن نمایشی حذف می‌کند:
 *  - [ORDER_CONFIRMED] → سفارش قطعی شد (فاز ۷)
 *  - [NEEDS_HUMAN]      → AI خودش تشخیص داد باید به انسان ارجاع دهد (مثلاً وقتی جواب را نمی‌داند)
 */
function parseAiResponseTags(aiResponseText) {
    const orderConfirmed = aiResponseText.includes(ORDER_TAG);
    const needsHuman = aiResponseText.includes(NEEDS_HUMAN_TAG);
    const displayText = aiResponseText.split(ORDER_TAG).join("").split(NEEDS_HUMAN_TAG).join("").trim();
    return { displayText, orderConfirmed, needsHuman };
}
