import http from "http";
import { askAICore } from "../src/providers/manager";
import { ProviderConfig, ChatMessage } from "../src/providers/types";

async function startMockServerThatFailsOneModel(): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      if (parsed.model === "model-a-overloaded") {
        // شبیه‌سازی rate limit روی مدل اول
        res.writeHead(429, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: { type: "rate_limit_exceeded", message: "too many requests" } }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: `پاسخ از مدل ${parsed.model}` } }],
        })
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

async function main() {
  console.log("=== تست: فیل‌اوور بین چند مدل زیر یک کلید API (همان id) ===\n");
  const mock = await startMockServerThatFailsOneModel();

  // دقیقاً شبیه‌سازی همان کاری که aiService.ts با یک ردیف provider با model="model-a-overloaded,model-b-ok" می‌کند
  const sharedProviderId = "provider-with-two-models";
  const configs: ProviderConfig[] = [
    {
      id: sharedProviderId,
      name: "OpenRouter (model-a-overloaded)",
      providerType: "openai_compatible",
      baseUrl: mock.url,
      apiKey: "shared-key",
      model: "model-a-overloaded",
    },
    {
      id: sharedProviderId,
      name: "OpenRouter (model-b-ok)",
      providerType: "openai_compatible",
      baseUrl: mock.url,
      apiKey: "shared-key",
      model: "model-b-ok",
    },
  ];

  const messages: ChatMessage[] = [{ role: "user", content: "سلام" }];
  const rateLimitedIds: string[] = [];

  const result = await askAICore(configs, messages, "system", {
    onRateLimited: (id) => rateLimitedIds.push(id),
  });

  mock.close();

  console.log("نتیجه:", result);
  const checks: { name: string; pass: boolean }[] = [
    { name: "مدل دوم (model-b-ok) جواب داد", pass: result.text === "پاسخ از مدل model-b-ok" },
    { name: "provider مربوطه همان id مشترک بود", pass: result.providerId === sharedProviderId },
    { name: "cooldown برای مدل اول ثبت شد", pass: rateLimitedIds.includes(sharedProviderId) },
  ];

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌ها پاس شدند.");
}

main();
