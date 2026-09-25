import express from "express";
import http from "http";
import { requireAdminToken } from "../src/routes/adminAuthMiddleware";
import { asyncHandler } from "../src/utils/asyncHandler";

function get(port: number, path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http.get({ port, path, headers }, (res) => {
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
    }).on("error", reject);
  });
}

async function testWithoutToken() {
  console.log("--- تست ۱: بدون ADMIN_PANEL_TOKEN (باید همه چیز باز باشد + هشدار) ---");
  delete process.env.ADMIN_PANEL_TOKEN;

  const app = express();
  app.use("/admin", requireAdminToken);
  app.get("/admin/secret", (_req, res) => res.json({ secret: "data" }));

  const server = app.listen(0);
  const port = (server.address() as any).port;

  const res = await get(port, "/admin/secret");
  server.close();

  const pass = res.status === 200 && res.body.secret === "data";
  console.log((pass ? "✅" : "❌") + " بدون تنظیم توکن، دسترسی باز است (طبق طراحی، برای dev)");
  return pass;
}

async function testWithToken() {
  console.log("\n--- تست ۲: با ADMIN_PANEL_TOKEN تنظیم‌شده ---");
  process.env.ADMIN_PANEL_TOKEN = "super-secret-token-123";

  const app = express();
  app.use("/admin", requireAdminToken);
  app.get("/admin/secret", (_req, res) => res.json({ secret: "data" }));

  const server = app.listen(0);
  const port = (server.address() as any).port;

  const withoutHeader = await get(port, "/admin/secret");
  const withWrongHeader = await get(port, "/admin/secret", { "x-admin-token": "wrong-token" });
  const withCorrectHeader = await get(port, "/admin/secret", { "x-admin-token": "super-secret-token-123" });

  server.close();
  delete process.env.ADMIN_PANEL_TOKEN;

  console.log("بدون هدر:", withoutHeader.status, withoutHeader.body);
  console.log("هدر اشتباه:", withWrongHeader.status, withWrongHeader.body);
  console.log("هدر درست:", withCorrectHeader.status, withCorrectHeader.body);

  const checks = [
    withoutHeader.status === 401,
    withWrongHeader.status === 401,
    withCorrectHeader.status === 200 && withCorrectHeader.body.secret === "data",
  ];
  const pass = checks.every(Boolean);
  console.log((checks[0] ? "✅" : "❌") + " بدون هدر -> ۴۰۱");
  console.log((checks[1] ? "✅" : "❌") + " هدر اشتباه -> ۴۰۱");
  console.log((checks[2] ? "✅" : "❌") + " هدر درست -> ۲۰۰ و داده واقعی برگشت");
  return pass;
}

async function testAsyncHandlerDoesNotCrash() {
  console.log("\n--- تست ۳: asyncHandler نباید بگذارد خطای async سرور را کرش کند ---");
  const app = express();
  app.get(
    "/boom",
    asyncHandler(async () => {
      throw new Error("خطای عمدی برای تست");
    })
  );
  // میان‌افزار خطا دقیقاً مثل index.ts
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "خطای داخلی سرور." });
  });

  const server = app.listen(0);
  const port = (server.address() as any).port;

  let crashed = false;
  const originalHandler = process.listeners("uncaughtException");
  process.removeAllListeners("uncaughtException");
  process.once("uncaughtException", () => {
    crashed = true;
  });

  const res = await get(port, "/boom");
  await new Promise((r) => setTimeout(r, 50)); // فرصت برای اینکه اگر قرار بود کرش کند، اتفاق بیفتد

  server.close();
  // برگرداندن listener های اصلی محیط تست
  originalHandler.forEach((h) => process.on("uncaughtException", h as any));

  console.log("پاسخ /boom:", res.status, res.body);
  const pass = res.status === 500 && !crashed;
  console.log((res.status === 500 ? "✅" : "❌") + " درخواست با ۵۰۰ جواب داده شد (نه کرش کامل)");
  console.log((!crashed ? "✅" : "❌") + " uncaughtException رخ نداد (سرور زنده ماند)");
  return pass;
}

async function main() {
  console.log("=== تست: میان‌افزار احراز هویت پنل + asyncHandler ===\n");
  const r1 = await testWithoutToken();
  const r2 = await testWithToken();
  const r3 = await testAsyncHandlerDoesNotCrash();

  const allPass = r1 && r2 && r3;
  console.log("\n" + (allPass ? "✅ همه‌ی تست‌ها پاس شدند." : "❌ برخی تست‌ها ناموفق بودند."));
  if (!allPass) process.exitCode = 1;
}

main();
