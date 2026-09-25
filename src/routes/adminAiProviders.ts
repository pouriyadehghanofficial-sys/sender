import { Router } from "express";
import { createAiProvider, listAiProviders, deleteAiProvider } from "../db/aiProviderRepository";
import { ProviderType } from "../db/enums";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { name, providerType, baseUrl, apiKey, model, priority } = req.body ?? {};

    if (!name || !providerType || !apiKey || !model) {
      return res.status(400).json({ error: "فیلدهای name, providerType, apiKey, model الزامی هستند." });
    }
    if (![ProviderType.ANTHROPIC, ProviderType.OPENAI_COMPATIBLE].includes(providerType)) {
      return res.status(400).json({ error: "providerType باید anthropic یا openai_compatible باشد." });
    }

    const provider = await createAiProvider({
      name,
      providerType,
      baseUrl: baseUrl || null,
      apiKey,
      model,
      priority: typeof priority === "number" ? priority : Number(priority) || 100,
    });

    // کلید رمزنگاری‌شده هرگز در پاسخ HTTP برنمی‌گردد
    const { apiKeyEncrypted, ...safe } = provider;
    res.status(201).json({ provider: safe });
  } catch (err) {
    console.error("خطا در ایجاد ارائه‌دهنده AI:", err);
    res.status(500).json({ error: "خطای داخلی سرور." });
  }
});

router.get("/", asyncHandler(async (_req, res) => {
  const providers = await listAiProviders();
  // apiKeyEncrypted هیچ‌وقت نباید به کلاینت برگردد
  const safe = providers.map(({ apiKeyEncrypted, ...rest }: any) => rest);
  res.json({ providers: safe });
}));

router.delete("/:id", async (req, res) => {
  try {
    await deleteAiProvider(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error("خطا در حذف ارائه‌دهنده AI:", err);
    res.status(500).json({ error: "خطای داخلی سرور." });
  }
});

export default router;
