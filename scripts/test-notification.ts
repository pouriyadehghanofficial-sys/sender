import http from "http";
import {
  buildOrderNotificationText,
  buildMailOptions,
  sendBaleNotification,
  buildEscalationNotificationText,
} from "../src/services/notificationService";

async function startMockBaleApiServer(): Promise<{ apiBase: string; close: () => void; calls: any[] }> {
  const calls: any[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      calls.push({ url: req.url, body: raw ? JSON.parse(raw) : {} });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { apiBase: `http://127.0.0.1:${port}`, close: () => server.close(), calls };
}

async function main() {
  console.log("=== تست فاز ۷: اعلان تکمیل سفارش ===\n");
  const checks: { name: string; pass: boolean }[] = [];

  // --- متن اعلان ---
  const text = buildOrderNotificationText({
    customerName: "علی رضایی",
    customerPhone: "989123456789",
    productName: "کرم مرطوب‌کننده تستی",
    conversationSummary: "کاربر: سلام\nدستیار: سلام، چطور می‌تونم کمکتون کنم؟",
  });
  console.log("--- متن اعلان ساخته‌شده ---\n" + text + "\n");
  checks.push({ name: "نام مشتری در متن هست", pass: text.includes("علی رضایی") });
  checks.push({ name: "شماره مشتری در متن هست", pass: text.includes("989123456789") });
  checks.push({ name: "نام محصول در متن هست", pass: text.includes("کرم مرطوب‌کننده تستی") });
  checks.push({ name: "خلاصه مکالمه در متن هست", pass: text.includes("سلام، چطور می‌تونم کمکتون کنم؟") });

  // --- mail options ---
  const mailOptions = buildMailOptions(
    { host: "smtp.example.com", port: 587, user: "u", pass: "p", from: "shop@example.com", to: "owner@example.com" },
    text
  );
  console.log("mail options:", mailOptions);
  checks.push({ name: "from درست است", pass: mailOptions.from === "shop@example.com" });
  checks.push({ name: "to درست است", pass: mailOptions.to === "owner@example.com" });
  checks.push({ name: "subject حاوی «سفارش» است", pass: mailOptions.subject.includes("سفارش") });
  checks.push({ name: "متن ایمیل همان متن اعلان است", pass: mailOptions.text === text });

  // --- ارسال واقعی اعلان بله به mock server ---
  const mock = await startMockBaleApiServer();
  await sendBaleNotification({ botToken: "TOKEN", apiBase: mock.apiBase }, "999999", text);
  mock.close();

  checks.push({ name: "درخواست sendMessage به مسیر درست رفت", pass: mock.calls[0]?.url === "/botTOKEN/sendMessage" });
  checks.push({ name: "chat_id درست ارسال شد", pass: mock.calls[0]?.body.chat_id === "999999" });
  checks.push({ name: "متن پیام همان متن اعلان بود", pass: mock.calls[0]?.body.text === text });

  // --- متن اعلان ارجاع به انسان ---
  const escalationText = buildEscalationNotificationText({
    customerName: "سارا احمدی",
    customerPhone: "989351234567",
    productName: "کرم مرطوب‌کننده تستی",
    reason: "keyword",
    conversationSummary: "کاربر: میشه با اپراتور صحبت کنم؟",
  });
  console.log("\n--- متن اعلان ارجاع ---\n" + escalationText);
  checks.push({ name: "متن ارجاع شامل نام مشتری است", pass: escalationText.includes("سارا احمدی") });
  checks.push({ name: "متن ارجاع دلیل را توضیح می‌دهد", pass: escalationText.includes("اپراتور") });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌های فاز ۷ پاس شدند.");
}

main();
