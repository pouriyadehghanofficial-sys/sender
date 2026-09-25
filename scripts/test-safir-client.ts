import http from "http";
import { sendSafirMessage } from "../src/providers/baleSafirClient";

interface ReceivedRequest {
  headers: http.IncomingHttpHeaders;
  body: any;
}

async function startMockSafirServer(): Promise<{
  url: string;
  close: () => void;
  lastRequest: () => ReceivedRequest | null;
}> {
  let last: ReceivedRequest | null = null;

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : {};
      last = { headers: req.headers, body };

      if (body.phone === "989111111111") {
        // شبیه‌سازی ارسال موفق
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ ok: true }));
      }
      if (body.phone === "989222222222") {
        // شبیه‌سازی «کاربر بله ندارد»
        res.writeHead(404, { "content-type": "application/json" });
        return res.end(JSON.stringify({ message: "user not_found on bale" }));
      }
      // شبیه‌سازی خطای عمومی سرور
      res.writeHead(500, { "content-type": "application/json" });
      return res.end(JSON.stringify({ message: "internal error" }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { url: `http://127.0.0.1:${port}/send`, close: () => server.close(), lastRequest: () => last };
}

async function main() {
  console.log("=== تست فاز ۵: کلاینت سفیر بله (sent / no_bale / failed) ===\n");
  const mock = await startMockSafirServer();
  const checks: { name: string; pass: boolean }[] = [];

  const sentResult = await sendSafirMessage({
    apiKey: "test-key",
    phone: "989111111111",
    text: "سلام، این پیام تستی است.",
    button: { type: "copy_text", value: "کد: TEST-01" },
    apiUrl: mock.url,
  });
  console.log("نتیجه شماره سالم:", sentResult);
  checks.push({ name: "شماره سالم -> status: sent", pass: sentResult.kind === "sent" });

  const req1 = mock.lastRequest();
  checks.push({ name: "هدر Api-Access-Key ارسال شد", pass: req1?.headers["api-access-key"] === "test-key" });
  checks.push({ name: "بدنه شامل copy_text بود", pass: req1?.body.copy_text === "کد: TEST-01" });

  const noBaleResult = await sendSafirMessage({
    apiKey: "test-key",
    phone: "989222222222",
    text: "سلام",
    button: { type: "url", value: "https://example.com" },
    apiUrl: mock.url,
  });
  console.log("نتیجه شماره بدون بله:", noBaleResult);
  checks.push({ name: "شماره بدون بله -> status: no_bale", pass: noBaleResult.kind === "no_bale" });

  const failedResult = await sendSafirMessage({
    apiKey: "test-key",
    phone: "989999999999",
    text: "سلام",
    button: { type: "web_app", value: "https://example.com/app" },
    apiUrl: mock.url,
  });
  console.log("نتیجه خطای عمومی:", failedResult);
  checks.push({ name: "خطای سرور -> status: failed", pass: failedResult.kind === "failed" });

  mock.close();

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }

  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌های فاز ۵ پاس شدند.");
}

main();
