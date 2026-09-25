const ORDER_TAG = "[ORDER_CONFIRMED]";
const NEEDS_HUMAN_TAG = "[NEEDS_HUMAN]";
const UNKNOWN_TOPIC_RE = /\[UNKNOWN_TOPIC:\s*([^\]]+)\]/g;

export interface OrderTagResult {
  displayText: string;
  orderConfirmed: boolean;
}

/** تگ [ORDER_CONFIRMED] را از متن پاسخ AI تشخیص می‌دهد و آن را از متن نمایشی حذف می‌کند */
export function detectAndStripOrderConfirmed(aiResponseText: string): OrderTagResult {
  const orderConfirmed = aiResponseText.includes(ORDER_TAG);
  const displayText = aiResponseText.split(ORDER_TAG).join("").trim();
  return { displayText, orderConfirmed };
}

export interface AiResponseTags {
  displayText: string;
  orderConfirmed: boolean;
  /** true یعنی خودِ AI تشخیص داد که باید مکالمه به یک انسان ارجاع شود */
  needsHuman: boolean;
  /** موضوعاتی که AI صادقانه گفته جوابشان را نمی‌داند (برای گزارش‌گیری/بهبود محصول) */
  unknownTopics: string[];
}

/**
 * هر تگ مخفی ممکن در پاسخ AI را همزمان تشخیص می‌دهد و از متن نمایشی حذف می‌کند:
 *  - [ORDER_CONFIRMED]         → سفارش قطعی شد (فاز ۷)
 *  - [NEEDS_HUMAN]              → AI خودش تشخیص داد باید به انسان ارجاع دهد
 *  - [UNKNOWN_TOPIC: موضوع]     → AI صادقانه گفته این را نمی‌داند (می‌تواند چند بار تکرار شود)
 */
export function parseAiResponseTags(aiResponseText: string): AiResponseTags {
  const orderConfirmed = aiResponseText.includes(ORDER_TAG);
  const needsHuman = aiResponseText.includes(NEEDS_HUMAN_TAG);

  const unknownTopics: string[] = [];
  for (const m of aiResponseText.matchAll(UNKNOWN_TOPIC_RE)) {
    if (m[1]?.trim()) unknownTopics.push(m[1].trim());
  }

  const displayText = aiResponseText
    .split(ORDER_TAG).join("")
    .split(NEEDS_HUMAN_TAG).join("")
    .replace(UNKNOWN_TOPIC_RE, "")
    .trim();

  return { displayText, orderConfirmed, needsHuman, unknownTopics };
}
