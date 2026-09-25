import express from "express";
import http from "http";

/**
 * این تست فقط لایه‌ی اعتبارسنجی رمز مسیر را بررسی می‌کند (بدون فراخوانی واقعی
 * processIncomingBaleMessage که به دیتابیس نیاز دارد)، با شبیه‌سازی همان منطق
 * دقیقی که در routes/webhookBale.ts هست.
 */
function post(port: number, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, path, method: "POST", headers: { "content-type": "application/json" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let body: any = null;
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end(JSON.stringify({}));
  });
}

async function main() {
  console.log("=== تست: رمز مسیر وبهوک بازو ===\n");
  process.env.WEBHOOK_SECRET = "my-webhook-secret";

  const app = express();
  app.use(express.json());
  app.post("/webhook/bale/:secret?", (req, res) => {
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (expectedSecret && req.params.secret !== expectedSecret) {
      return res.status(404).json({ ok: false });
    }
    res.status(200).json({ ok: true });
  });

  const server = app.listen(0);
  const port = (server.address() as any).port;

  const withoutSecret = await post(port, "/webhook/bale");
  const withWrongSecret = await post(port, "/webhook/bale/wrong-guess");
  const withCorrectSecret = await post(port, "/webhook/bale/my-webhook-secret");

  server.close();
  delete process.env.WEBHOOK_SECRET;

  console.log("بدون رمز:", withoutSecret.status, withoutSecret.body);
  console.log("رمز اشتباه:", withWrongSecret.status, withWrongSecret.body);
  console.log("رمز درست:", withCorrectSecret.status, withCorrectSecret.body);

  const checks = [
    withoutSecret.status === 404,
    withWrongSecret.status === 404,
    withCorrectSecret.status === 200 && withCorrectSecret.body.ok === true,
  ];

  console.log((checks[0] ? "✅" : "❌") + " بدون رمز در مسیر -> ۴۰۴ (رد شد)");
  console.log((checks[1] ? "✅" : "❌") + " رمز اشتباه در مسیر -> ۴۰۴ (رد شد)");
  console.log((checks[2] ? "✅" : "❌") + " رمز درست در مسیر -> ۲۰۰ (پردازش شد)");

  const allPass = checks.every(Boolean);
  console.log("\n" + (allPass ? "✅ همه‌ی تست‌ها پاس شدند." : "❌ برخی تست‌ها ناموفق بودند."));
  if (!allPass) process.exitCode = 1;
}

main();
