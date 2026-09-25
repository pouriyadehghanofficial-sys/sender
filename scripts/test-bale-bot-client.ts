import http from "http";
import { setBaleWebhook, sendBaleMessage } from "../src/providers/baleBotClient";

async function startMockBaleApiServer(): Promise<{ apiBase: string; close: () => void; calls: any[] }> {
  const calls: any[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      calls.push({ url: req.url, method: req.method, body: raw ? JSON.parse(raw) : {} });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, result: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { apiBase: `http://127.0.0.1:${port}`, close: () => server.close(), calls };
}

async function main() {
  console.log("=== تست فاز ۶ (بخش ۲): کلاینت ربات بازو ===\n");
  const mock = await startMockBaleApiServer();
  const checks: { name: string; pass: boolean }[] = [];

  const webhookResult = await setBaleWebhook(
    { botToken: "TEST_TOKEN_123", apiBase: mock.apiBase },
    "https://example.com/webhook/bale"
  );
  console.log("نتیجه setWebhook:", webhookResult);

  const sendResult = await sendBaleMessage(
    { botToken: "TEST_TOKEN_123", apiBase: mock.apiBase },
    "55555",
    "سلام از طرف ربات"
  );
  console.log("نتیجه sendMessage:", sendResult);

  mock.close();

  checks.push({ name: "درخواست setWebhook به مسیر صحیح رفت", pass: mock.calls[0]?.url === "/botTEST_TOKEN_123/setWebhook" });
  checks.push({ name: "بدنه setWebhook شامل url بود", pass: mock.calls[0]?.body.url === "https://example.com/webhook/bale" });
  checks.push({ name: "درخواست sendMessage به مسیر صحیح رفت", pass: mock.calls[1]?.url === "/botTEST_TOKEN_123/sendMessage" });
  checks.push({ name: "بدنه sendMessage شامل chat_id و text بود", pass: mock.calls[1]?.body.chat_id === "55555" && mock.calls[1]?.body.text === "سلام از طرف ربات" });
  checks.push({ name: "هر دو پاسخ ok دریافت شد", pass: webhookResult.ok === true && sendResult.ok === true });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌های بخش ۲ پاس شدند.");
}

main();
