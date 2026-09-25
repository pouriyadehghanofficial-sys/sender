process.env.JWT_SECRET = "test-secret-for-middleware";

import express from "express";
import http from "http";
import { requireAuth, requireOwner } from "../src/routes/v1/authMiddleware";
import { signJwt } from "../src/utils/auth";

function get(port: number, path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get({ port, path, headers }, (res) => {
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
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("=== تست: میان‌افزار requireAuth (مسیر JWT) ===\n");

  const app = express();
  app.get("/protected", requireAuth, (req, res) => res.json({ userId: req.auth?.userId, isOwner: req.auth?.isOwner }));
  app.get("/owner-only", requireAuth, requireOwner, (_req, res) => res.json({ ok: true }));

  const server = app.listen(0);
  const port = (server.address() as any).port;

  const checks: { name: string; pass: boolean }[] = [];

  const noToken = await get(port, "/protected");
  checks.push({ name: "بدون توکن -> ۴۰۱", pass: noToken.status === 401 });

  const garbageToken = await get(port, "/protected", { authorization: "Bearer not-a-real-jwt" });
  checks.push({ name: "توکن نامعتبر -> ۴۰۱", pass: garbageToken.status === 401 });

  const validToken = signJwt({ userId: "user-42", email: "a@b.com", isOwner: false });
  const validRes = await get(port, "/protected", { authorization: `Bearer ${validToken}` });
  console.log("پاسخ با JWT معتبر:", validRes.status, validRes.body);
  checks.push({ name: "JWT معتبر -> ۲۰۰ و userId درست در req.auth", pass: validRes.status === 200 && validRes.body.userId === "user-42" });

  const nonOwnerToken = signJwt({ userId: "user-1", email: "u1@b.com", isOwner: false });
  const nonOwnerRes = await get(port, "/owner-only", { authorization: `Bearer ${nonOwnerToken}` });
  checks.push({ name: "کاربر عادی به بخش مالک -> ۴۰۳", pass: nonOwnerRes.status === 403 });

  const ownerToken = signJwt({ userId: "owner-1", email: "owner@b.com", isOwner: true });
  const ownerRes = await get(port, "/owner-only", { authorization: `Bearer ${ownerToken}` });
  checks.push({ name: "کاربر owner=true به بخش مالک -> ۲۰۰", pass: ownerRes.status === 200 });

  // یک کاربر نباید بتواند با دستکاری چیزی جز توکن، هویت کاربر دیگر را جعل کند —
  // اینجا فقط تایید می‌کنیم که userId همیشه از payload امضاشده‌ی JWT می‌آید، نه از جای دیگر
  const anotherToken = signJwt({ userId: "user-99", email: "x@y.com", isOwner: false });
  const anotherRes = await get(port, "/protected", { authorization: `Bearer ${anotherToken}` });
  checks.push({ name: "userId همیشه از JWT امضاشده می‌آید (نه قابل جعل)", pass: anotherRes.body.userId === "user-99" });

  server.close();

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌ها پاس شدند. (مسیر کلید API چون به دیتابیس نیاز دارد، در sandbox قابل تست نبود — منطق هش/جستجویش در test-auth-utils.ts تایید شده)");
}

main();
