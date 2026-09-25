import "./localStoragePolyfill";
import http from "http";

async function startMockApiServer(): Promise<{ url: string; close: () => void; calls: { method: string; path: string; authHeader?: string }[] }> {
  const calls: { method: string; path: string; authHeader?: string }[] = [];

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = req.url || "";
      calls.push({ method: req.method || "", path: url, authHeader: req.headers["authorization"] as string | undefined });

      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(body === undefined ? "" : JSON.stringify(body));
      };

      let json: any = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        /* multipart بدنه‌ی JSON نیست، مهم نیست */
      }

      if (req.method === "POST" && url === "/auth/login") {
        if (json.email === "shop@example.com" && json.password === "correct-pass") {
          return send(200, { token: "fake.jwt.token", user: { id: "u1", email: "shop@example.com", isOwner: false, isActive: true, createdAt: "2026-01-01T00:00:00Z" } });
        }
        return send(401, { error: "ایمیل یا پسورد اشتباه است." });
      }

      if (req.method === "POST" && url === "/auth/register") {
        return send(201, { token: "fake.jwt.token", user: { id: "u1", email: json.email, isOwner: true, isActive: true, createdAt: "2026-01-01T00:00:00Z" } });
      }

      // بعد از این نقطه، همه‌ی endpoint ها احراز هویت می‌خواهند
      if (url.startsWith("/products") || url.startsWith("/campaigns") || url.startsWith("/dashboard") || url.startsWith("/contacts") || url.startsWith("/orders") || url.startsWith("/api-keys") || url.startsWith("/admin")) {
        if (!req.headers["authorization"]) {
          return send(401, { error: "توکن احراز هویت ارسال نشده." });
        }
      }

      if (req.method === "GET" && url === "/products") {
        return send(200, { data: [{ id: "p1", name: "محصول تستی", shortCode: "TEST-01", descriptionText: "...", isActive: true, userId: "u1", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }] });
      }
      if (req.method === "POST" && url === "/products") {
        return send(201, { product: { id: "p2", name: json.name, shortCode: "AUTO-01", descriptionText: json.descriptionText, isActive: true, userId: "u1", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" } });
      }

      if (req.method === "POST" && url === "/contacts/import") {
        return send(201, { totalRows: 10, imported: 8, duplicates: 1, invalid: 1, failed: 0, totalContactsNow: 8 });
      }

      if (req.method === "POST" && url === "/campaigns") {
        return send(201, { campaign: { id: "c1", name: json.name ?? null, status: "draft", productId: json.productId, progress: { total: 0, processed: 0, successful: 0, failed: 0, pending: 0, percentage: 0 }, running: false, createdAt: "2026-01-01T00:00:00Z" } });
      }
      if (req.method === "POST" && url === "/campaigns/c1/start") {
        return send(202, { message: "شروع شد.", campaignId: "c1" });
      }
      if (req.method === "GET" && url === "/campaigns/c1") {
        return send(200, { campaign: { id: "c1", name: "تست", status: "running", productId: "p1", progress: { total: 10, processed: 4, successful: 3, failed: 1, pending: 6, percentage: 40 }, running: true, createdAt: "2026-01-01T00:00:00Z" } });
      }
      if (req.method === "GET" && url === "/campaigns/not-found-id") {
        return send(404, { error: "کمپین یافت نشد." });
      }

      if (req.method === "GET" && url === "/dashboard/summary") {
        return send(200, {
          campaigns: { active: 1, total: 3, recent: [] },
          messages: { sent: 40, failed: 2, pending: 5, noBale: 1 },
          conversations: { active: 6, waitingForResponse: 2 },
          referrals: 2,
          orders: { completed: 9 },
          products: { active: 3 },
          recentActivity: [],
        });
      }

      if (req.method === "GET" && url === "/orders") {
        return send(200, { data: [], summary: { completed: 0, active: 0, cancelled: 0 } });
      }

      if (req.method === "GET" && url === "/api-keys") {
        return send(200, { data: [{ id: "k1", name: "تست", keyPrefix: "abai_live_1234...", isActive: true, createdAt: "2026-01-01T00:00:00Z", lastUsedAt: null }] });
      }
      if (req.method === "POST" && url === "/api-keys") {
        return send(201, { id: "k2", name: json.name, keyPrefix: "abai_live_9999...", token: "abai_live_9999fulltoken", warning: "..." });
      }
      if (req.method === "DELETE" && url === "/api-keys/k1") {
        return send(204, undefined);
      }

      send(404, { error: "مسیر نامشخص در mock server" });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => {
      // server.close() به‌تنهایی سوکت‌های keep-alive باز (از fetch) را نمی‌بندد و
      // پردازه‌ی Node را معلق نگه می‌دارد؛ closeAllConnections این را هم می‌بندد.
      (server as any).closeAllConnections?.();
      server.close();
    },
    calls,
  };
}

async function main() {
  console.log("=== تست یکپارچه‌سازی: لایه سرویس API فرانت‌اند (بر پایه openapi.json) ===\n");

  const mock = await startMockApiServer();
  const apiClientModule = await import("../src/lib/apiClient");
  const authModule = await import("../src/lib/auth");
  apiClientModule.__setApiBaseForTests(mock.url);

  const checks: { name: string; pass: boolean }[] = [];

  // --- ورود موفق ---
  const loginRes = await apiClientModule.authApi.login("shop@example.com", "correct-pass");
  console.log("ورود موفق:", loginRes);
  checks.push({ name: "ورود موفق -> token و user برگشت", pass: loginRes.token === "fake.jwt.token" && loginRes.user.email === "shop@example.com" });

  // --- ورود ناموفق -> باید ApiError با status 401 پرتاب کند ---
  let loginFailedCorrectly = false;
  try {
    await apiClientModule.authApi.login("shop@example.com", "wrong-pass");
  } catch (err) {
    loginFailedCorrectly = err instanceof apiClientModule.ApiError && err.status === 401 && err.message === "ایمیل یا پسورد اشتباه است.";
  }
  checks.push({ name: "ورود اشتباه -> ApiError با status=401 و پیام سرور", pass: loginFailedCorrectly });

  // --- ذخیره توکن و درخواست محافظت‌شده با هدر درست ---
  authModule.setToken(loginRes.token);
  const productsRes = await apiClientModule.productsApi.list();
  checks.push({ name: "لیست محصولات با موفقیت گرفته شد", pass: productsRes.data.length === 1 && productsRes.data[0].name === "محصول تستی" });

  const lastCall = mock.calls[mock.calls.length - 1];
  checks.push({ name: "هدر Authorization: Bearer <token> درست ارسال شد", pass: lastCall.authHeader === `Bearer ${loginRes.token}` });

  // --- بدون توکن -> 401 و onUnauthorized صدا زده شود ---
  authModule.clearToken();
  let unauthorizedTriggered = false;
  apiClientModule.setUnauthorizedHandler(() => {
    unauthorizedTriggered = true;
  });
  let got401 = false;
  try {
    await apiClientModule.productsApi.list();
  } catch (err) {
    got401 = err instanceof apiClientModule.ApiError && err.status === 401;
  }
  checks.push({ name: "بدون توکن -> 401", pass: got401 });
  checks.push({ name: "onUnauthorized هندلر صدا زده شد", pass: unauthorizedTriggered });
  checks.push({ name: "توکن بعد از 401 پاک شد", pass: authModule.getToken() === null });

  // --- ساخت محصول ---
  authModule.setToken(loginRes.token);
  const createProductRes = await apiClientModule.productsApi.create({ name: "محصول جدید", descriptionText: "توضیحات" });
  checks.push({ name: "ساخت محصول موفق", pass: createProductRes.product.name === "محصول جدید" });

  // --- import اکسل (multipart FormData) ---
  const fakeFile = new File(["fake excel content"], "contacts.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const importRes = await apiClientModule.contactsApi.import(fakeFile);
  console.log("\nنتیجه import:", importRes);
  checks.push({ name: "import اکسل با FormData درست کار کرد", pass: importRes.imported === 8 && importRes.duplicates === 1 });

  // --- کمپین: ساخت -> شروع -> گرفتن پیشرفت ---
  const campaignRes = await apiClientModule.campaignsApi.create({ productId: "p1", name: "کمپین تستی" });
  checks.push({ name: "ساخت کمپین موفق (وضعیت draft)", pass: campaignRes.campaign.status === "draft" });

  const startRes = await apiClientModule.campaignsApi.start("c1");
  checks.push({ name: "شروع کمپین موفق", pass: startRes.campaignId === "c1" });

  const progressRes = await apiClientModule.campaignsApi.get("c1");
  console.log("پیشرفت کمپین:", progressRes.campaign.progress);
  checks.push({ name: "دریافت پیشرفت واقعی کمپین (total/processed/percentage)", pass: progressRes.campaign.progress?.percentage === 40 && progressRes.campaign.progress?.total === 10 });

  // --- 404 روی کمپین ناموجود ---
  let got404 = false;
  try {
    await apiClientModule.campaignsApi.get("not-found-id");
  } catch (err) {
    got404 = err instanceof apiClientModule.ApiError && err.status === 404;
  }
  checks.push({ name: "کمپین ناموجود -> 404", pass: got404 });

  // --- داشبورد ---
  const summary = await apiClientModule.dashboardApi.summary();
  checks.push({ name: "خلاصه داشبورد درست گرفته شد", pass: summary.conversations?.waitingForResponse === 2 && summary.orders?.completed === 9 });

  // --- کلیدهای API: ساخت + حذف ---
  const newKey = await apiClientModule.apiKeysApi.create("کلید تست");
  checks.push({ name: "ساخت کلید API -> توکن کامل یک‌بار برگشت", pass: newKey.token === "abai_live_9999fulltoken" });

  await apiClientModule.apiKeysApi.revoke("k1"); // نباید خطا بدهد (204 بدون بدنه)
  checks.push({ name: "حذف/باطل‌کردن کلید API (204 بدون بدنه) کرش نکرد", pass: true });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }

  mock.close();
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌های یکپارچه‌سازی API پاس شدند.");
  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error("خطای غیرمنتظره در تست:", err);
  process.exitCode = 1;
});
