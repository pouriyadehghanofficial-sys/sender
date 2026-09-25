import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductByShortCode,
} from "../db/productRepository";
import {
  createPromptVariant,
  listPromptVariants,
  setPromptVariantActive,
  deletePromptVariant,
} from "../db/promptVariantRepository";
import { buildSystemPrompt } from "../services/productService";
import { askAI } from "../services/aiService";
import { parseAiResponseTags } from "../utils/orderTag";
import { checkEscalationTrigger, DEFAULT_ESCALATION_THRESHOLD, DEFAULT_ESCALATION_KEYWORDS } from "../utils/escalation";
import { getSetting, SettingKeys } from "../db/settingsRepository";
import { ChatMessage } from "../providers/types";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// آپلود فایل در حافظه (نه دیسک) — فایل‌های توضیحات معمولاً کوچک (متنی) هستند
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

/**
 * POST /admin/products
 * multipart/form-data یا JSON:
 *   - name (الزامی)
 *   - shortCode (اختیاری — اگر ندهید، از روی name ساخته می‌شود)
 *   - descriptionText (اختیاری اگر فایل بدهید)
 *   - file (اختیاری، فایل متنی .txt/.md — جایگزین descriptionText می‌شود)
 */
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { name, descriptionText, shortCode, photoUrl } = req.body ?? {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "فیلد name الزامی است." });
    }

    let finalDescription = typeof descriptionText === "string" ? descriptionText : "";
    if (req.file) {
      finalDescription = req.file.buffer.toString("utf-8");
    }

    if (!finalDescription.trim()) {
      return res
        .status(400)
        .json({ error: "باید یا descriptionText بفرستید یا یک فایل متنی آپلود کنید." });
    }

    let code = typeof shortCode === "string" && shortCode.trim() ? shortCode.trim() : slugify(name);
    // اطمینان از یکتا بودن short_code
    const existing = await getProductByShortCode(code);
    if (existing) {
      code = `${code}-${uuidv4().slice(0, 6)}`;
    }

    const product = await createProduct({
      name,
      shortCode: code,
      descriptionText: finalDescription,
      photoUrl: typeof photoUrl === "string" && photoUrl.trim() ? photoUrl.trim() : null,
    });

    res.status(201).json({ product });
  } catch (err) {
    console.error("خطا در ایجاد محصول:", err);
    res.status(500).json({ error: "خطای داخلی سرور در ذخیره محصول." });
  }
});

router.get("/", asyncHandler(async (_req, res) => {
  const products = await listProducts();
  res.json({ products });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const product = await getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: "محصول یافت نشد." });
  res.json({ product });
}));

/** پیش‌نمایش system prompt ساخته‌شده برای یک محصول — مفید برای دیباگ پنل مدیریت */
router.get("/:id/system-prompt", asyncHandler(async (req, res) => {
  const product = await getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: "محصول یافت نشد." });
  const systemPrompt = buildSystemPrompt(product);
  res.json({ systemPrompt });
}));

router.put("/:id", upload.single("file"), async (req, res) => {
  try {
    const { name, descriptionText, shortCode, photoUrl } = req.body ?? {};
    const data: Record<string, string> = {};
    if (typeof name === "string" && name.trim()) data.name = name;
    if (typeof shortCode === "string" && shortCode.trim()) data.shortCode = shortCode;
    if (typeof photoUrl === "string") data.photoUrl = photoUrl.trim();
    if (req.file) {
      data.descriptionText = req.file.buffer.toString("utf-8");
    } else if (typeof descriptionText === "string" && descriptionText.trim()) {
      data.descriptionText = descriptionText;
    }

    const product = await updateProduct(req.params.id, data);
    res.json({ product });
  } catch (err) {
    console.error("خطا در به‌روزرسانی محصول:", err);
    res.status(500).json({ error: "خطای داخلی سرور در به‌روزرسانی محصول." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error("خطا در حذف محصول:", err);
    res.status(500).json({ error: "خطای داخلی سرور در حذف محصول." });
  }
});

/**
 * POST /admin/products/:id/test-chat
 * برای تست کردن دانش AI روی یک محصول، بدون اینکه چیزی در دیتابیس واقعی
 * (contacts/conversations/messages) ذخیره شود — یک چت‌بات آزمایشی صرف.
 * body: { messages: [{ role: 'user'|'assistant', content: string }] }
 * آخرین آیتم آرایه باید پیام تازه‌ی کاربر باشد؛ کل آرایه به‌عنوان تاریخچه به AI داده می‌شود.
 * همان منطق ارجاع به انسان (فاز جدید C) هم اینجا شبیه‌سازی می‌شود تا بتوانید قبل از
 * اتصال واقعی بله، مطمئن شوید تنظیمات ارجاع درست کار می‌کنند.
 */
router.post("/:id/test-chat", async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "محصول یافت نشد." });

    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "فیلد messages (آرایه) الزامی است." });
    }

    const chatMessages: ChatMessage[] = messages.map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? ""),
    }));

    const lastUserMessage = [...chatMessages].reverse().find((m) => m.role === "user")?.content ?? "";
    const userMessageCount = chatMessages.filter((m) => m.role === "user").length;

    const thresholdRaw = await getSetting(SettingKeys.ESCALATION_MESSAGE_THRESHOLD);
    const keywordsRaw = await getSetting(SettingKeys.ESCALATION_KEYWORDS);
    const customInstructions = (await getSetting(SettingKeys.ESCALATION_CUSTOM_INSTRUCTIONS)) ?? "";
    const threshold = thresholdRaw ? Number(thresholdRaw) || DEFAULT_ESCALATION_THRESHOLD : DEFAULT_ESCALATION_THRESHOLD;
    const keywords = keywordsRaw ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean) : DEFAULT_ESCALATION_KEYWORDS;

    // ۱) محرک قانون‌محور (کلمه کلیدی / سقف تعداد پیام) — دقیقاً مثل فاز واقعی وبهوک
    const ruleEscalation = checkEscalationTrigger(lastUserMessage, userMessageCount, { threshold, keywords });
    if (ruleEscalation.shouldEscalate) {
      return res.json({
        reply: "پیام شما دریافت شد و به همکاران ما ارجاع داده شد؛ به‌زودی شخصاً پاسخ می‌دهند. 🙏",
        orderConfirmed: false,
        needsHuman: true,
        escalationReason: ruleEscalation.reason,
      });
    }

    // ۲) اگر قانون‌محور فعال نشد، از AI بپرس و ببین خودش تگ [NEEDS_HUMAN] را برمی‌گرداند یا نه
    const systemPrompt = buildSystemPrompt(product, customInstructions);
    const aiRawResponse = await askAI(chatMessages, systemPrompt);
    const { displayText, orderConfirmed, needsHuman } = parseAiResponseTags(aiRawResponse);

    res.json({
      reply: displayText,
      orderConfirmed,
      needsHuman,
      escalationReason: needsHuman ? "ai_requested" : null,
    });
  } catch (err) {
    console.error("خطا در تست چت‌بات محصول:", err);
    res.status(500).json({ error: (err as Error).message || "خطای داخلی سرور در تست چت." });
  }
});

/**
 * نسخه‌های A/B این محصول — چند پرسونا/پرامپت مختلف که به‌صورت تصادفیِ وزن‌دار بین
 * مکالمات تازه تقسیم می‌شوند تا نرخ تبدیل‌شان مقایسه شود.
 * (گزارش نرخ تبدیل هر نسخه: GET /admin/analytics/products/:productId/ab-test)
 */
router.get("/:id/prompt-variants", asyncHandler(async (req, res) => {
  res.json({ variants: await listPromptVariants(req.params.id) });
}));

router.post("/:id/prompt-variants", asyncHandler(async (req, res) => {
  const { name, descriptionText, weight } = req.body ?? {};
  if (!name || !descriptionText) {
    return res.status(400).json({ error: "فیلدهای name و descriptionText الزامی‌اند." });
  }
  const variant = await createPromptVariant({
    productId: req.params.id,
    name,
    descriptionText,
    weight: weight ? Number(weight) : undefined,
  });
  res.status(201).json({ variant });
}));

router.patch("/prompt-variants/:variantId", asyncHandler(async (req, res) => {
  const { isActive } = req.body ?? {};
  const variant = await setPromptVariantActive(req.params.variantId, !!isActive);
  res.json({ variant });
}));

router.delete("/prompt-variants/:variantId", asyncHandler(async (req, res) => {
  await deletePromptVariant(req.params.variantId);
  res.status(204).send();
}));

export default router;
