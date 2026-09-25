import http from "http";
import { askAICore } from "../src/providers/manager";
import { ProviderConfig, ChatMessage } from "../src/providers/types";

async function startMockOpenAIServer(): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/chat/completions") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "این پاسخ از provider دوم (mock سازگار با OpenAI) است.",
                },
              },
            ],
          })
        );
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

async function main() {
  console.log("=== تست فیل‌اوور بین دو ارائه‌دهنده هوش مصنوعی ===\n");

  const mock = await startMockOpenAIServer();

  const providerBroken: ProviderConfig = {
    id: "provider-1-broken",
    name: "Claude با کلید نامعتبر (عمداً خراب)",
    providerType: "anthropic",
    apiKey: "sk-ant-INVALID-KEY-FOR-TEST",
    model: "claude-sonnet-4-6",
  };

  const providerWorking: ProviderConfig = {
    id: "provider-2-working",
    name: "Mock سازگار با OpenAI",
    providerType: "openai_compatible",
    baseUrl: mock.url,
    apiKey: "does-not-matter-for-mock",
    model: "mock-model",
  };

  const messages: ChatMessage[] = [{ role: "user", content: "سلام، این محصول چقدر قیمت دارد؟" }];
  const systemPrompt = "شما دستیار فروش هستید.";

  const rateLimited: string[] = [];
  const authFailed: string[] = [];
  const otherErrors: string[] = [];

  try {
    const result = await askAICore([providerBroken, providerWorking], messages, systemPrompt, {
      onRateLimited: (id) => {
        rateLimited.push(id);
        console.log(`  ↳ hook: provider ${id} به دلیل rate-limit وارد cooldown شد`);
      },
      onAuthFailed: (id) => {
        authFailed.push(id);
        console.log(`  ↳ hook: provider ${id} به دلیل خطای auth غیرفعال شد`);
      },
      onOtherError: (id, err) => {
        otherErrors.push(id);
        console.log(`  ↳ hook: خطای دیگر در provider ${id}:`, (err as Error).message);
      },
    });

    console.log("\n--- نتیجه نهایی ---");
    console.log("پاسخ دریافتی:", result.text);
    console.log("provider استفاده‌شده:", result.providerName, `(${result.providerId})`);

    const success =
      result.providerId === "provider-2-working" && authFailed.includes("provider-1-broken");

    console.log("\n" + (success ? "✅ تست موفق: فیل‌اوور به‌درستی کار کرد." : "❌ تست ناموفق."));
    if (!success) process.exitCode = 1;
  } catch (err) {
    console.error("❌ askAICore با خطا مواجه شد:", err);
    process.exitCode = 1;
  } finally {
    mock.close();
  }
}

main();
