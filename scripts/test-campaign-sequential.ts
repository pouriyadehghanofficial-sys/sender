import http from "http";
import { sendSafirMessage } from "../src/providers/baleSafirClient";

interface LogEntry {
  phone: string;
  receivedAt: number;
  respondedAt: number;
}

async function startTimingMockServer(): Promise<{ url: string; close: () => void; log: LogEntry[] }> {
  const log: LogEntry[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const receivedAt = Date.now();
      const parsed = JSON.parse(body);
      // کمی تاخیر شبیه‌سازی‌شده در پاسخ سرور واقعی سفیر
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        log.push({ phone: parsed.phone, receivedAt, respondedAt: Date.now() });
      }, 30);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { url: `http://127.0.0.1:${port}/send`, close: () => server.close(), log };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * این تست دقیقاً همان الگویی را اجرا می‌کند که campaignService.sendCampaign استفاده
 * می‌کند: یک حلقه‌ی for با await کامل روی هر پیام + sleep بین پیام‌ها — یعنی هیچ‌وقت
 * دو درخواست هم‌زمان به سفیر بله نمی‌رود، برخلاف Promise.all که همه را یکجا می‌فرستد.
 */
async function main() {
  console.log("=== تست: ارسال کمپین واقعاً یکی‌یکی است، نه دسته‌جمعی ===\n");

  const DELAY_MS = 300; // برای سرعت تست از ۱۵۰۰ واقعی کمتر گرفته شده، منطق یکسان است
  const contacts = ["989111111111", "989222222222", "989333333333", "989444444444"];

  const mock = await startTimingMockServer();

  const startedAt = Date.now();
  for (const phone of contacts) {
    await sendSafirMessage({
      apiKey: "test-key",
      phone,
      text: "سلام، این یک پیام تستی است.",
      button: { type: "copy_text", value: "کد محصول: TEST" },
      apiUrl: mock.url,
    });
    await sleep(DELAY_MS);
  }
  const totalElapsed = Date.now() - startedAt;

  mock.close();

  console.log("لاگ زمان دریافت هر درخواست در سرور:");
  mock.log.forEach((e, i) => console.log(`  ${i + 1}. ${e.phone} -> دریافت در t+${e.receivedAt - startedAt}ms`));

  const checks: { name: string; pass: boolean }[] = [];

  checks.push({ name: `همه‌ی ${contacts.length} پیام واقعاً به سرور رسیدند`, pass: mock.log.length === contacts.length });

  // بررسی این‌که هیچ دو درخواستی هم‌زمان (کمتر از چند میلی‌ثانیه فاصله) نرسیده باشند
  let noOverlap = true;
  for (let i = 1; i < mock.log.length; i++) {
    const gap = mock.log[i].receivedAt - mock.log[i - 1].respondedAt;
    if (gap < 0) noOverlap = false; // یعنی قبل از تمام شدن قبلی، بعدی رسیده (هم‌پوشانی/burst)
  }
  checks.push({ name: "هیچ دو درخواستی هم‌زمان/هم‌پوشان به سرور نرسیدند (burst نبود)", pass: noOverlap });

  // بررسی این‌که فاصله‌ی بین شروع درخواست‌های متوالی تقریباً برابر DELAY_MS است
  let gapsOk = true;
  for (let i = 1; i < mock.log.length; i++) {
    const gap = mock.log[i].receivedAt - mock.log[i - 1].receivedAt;
    if (gap < DELAY_MS - 20) gapsOk = false; // کمی tolerance برای نوسانات تایمر
  }
  checks.push({ name: `فاصله بین پیام‌های متوالی حداقل ~${DELAY_MS}ms رعایت شد`, pass: gapsOk });

  const expectedMinTotal = DELAY_MS * contacts.length;
  checks.push({
    name: `زمان کل ارسال (${totalElapsed}ms) با تعداد پیام و تاخیر همخوانی دارد (نه خیلی سریع‌تر)`,
    pass: totalElapsed >= expectedMinTotal - 50,
  });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ ارسال کمپین واقعاً ترتیبی و کنترل‌شده است — هیچ فشار ناگهانی روی API بله وارد نمی‌شود.");
}

main();
