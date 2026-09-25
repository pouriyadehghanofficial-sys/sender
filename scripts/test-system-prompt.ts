import http from "http";
import { buildSystemPrompt } from "../src/services/productService";
import { askAICore } from "../src/providers/manager";
import { ProviderConfig, ChatMessage } from "../src/providers/types";

async function startEchoServer(): Promise<{ url: string; close: () => void; getLastSystemMessage: () => string | null }> {
  let lastSystemMessage: string | null = null;
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/chat/completions") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const parsed = JSON.parse(body);
        const systemMsg = parsed.messages?.find((m: any) => m.role === "system");
        lastSystemMessage = systemMsg?.content ?? null;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: "دریافت شد و بر اساس system prompt پاسخ دادم." } }],
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
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => server.close(),
    getLastSystemMessage: () => lastSystemMessage,
  };
}

async function main() {
  console.log("=== تست فاز ۳: ساخت system prompt و تزریق به askAICore ===\n");

  const testProduct = {
    name: "کرم مرطوب‌کننده تستی",
    descriptionText: "کرم مرطوب‌کننده تستی، حجم ۵۰ میلی‌لیتر، قیمت ۲۵۰,۰۰۰ تومان.",
  };

  const systemPrompt = buildSystemPrompt(testProduct);
  console.log("--- system prompt ساخته‌شده ---\n");
  console.log(systemPrompt);
  console.log("\n--------------------------------\n");

  const checks = [
    systemPrompt.includes(testProduct.name),
    systemPrompt.includes(testProduct.descriptionText),
    systemPrompt.includes("[ORDER_CONFIRMED]"),
  ];
  const basicOk = checks.every(Boolean);
  console.log(basicOk ? "✅ ساختار system prompt صحیح است." : "❌ ساختار system prompt ناقص است.");

  const echo = await startEchoServer();
  const provider: ProviderConfig = {
    id: "p1",
    name: "Echo Mock",
    providerType: "openai_compatible",
    baseUrl: echo.url,
    apiKey: "n/a",
    model: "mock",
  };
  const messages: ChatMessage[] = [{ role: "user", content: "قیمتش چنده؟" }];

  const result = await askAICore([provider], messages, systemPrompt);
  echo.close();

  const injected = echo.getLastSystemMessage();
  const injectionOk = injected === systemPrompt;

  console.log("\nپاسخ AI:", result.text);
  console.log(injectionOk ? "✅ system prompt دقیقاً همان‌طور که ساخته شد به askAICore تزریق شد." : "❌ عدم تطابق system prompt.");

  if (!basicOk || !injectionOk) process.exitCode = 1;
}

main();
