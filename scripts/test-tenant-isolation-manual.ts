/**
 * این تست به یک سرور واقعی در حال اجرا نیاز دارد (چون در sandbox ساخت این پروژه
 * دیتابیس واقعی قابل migrate نبود). بعد از `npm run dev`، در یک ترمینال دیگر بزنید:
 *
 *   npx tsx scripts/test-tenant-isolation-manual.ts
 *
 * این اسکریپت با ۲ کاربر واقعی جدا ثبت‌نام می‌کند، برای هرکدام یک محصول می‌سازد،
 * و تایید می‌کند که کاربر B نه در لیست، نه با حدس زدن id، به محصول کاربر A دسترسی ندارد.
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function api(path: string, options: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function randomEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

async function main() {
  console.log(`=== تست دستی ایزولاسیون چندمستأجری (روی ${BASE_URL}) ===\n`);
  const checks: { name: string; pass: boolean }[] = [];

  // --- ثبت‌نام دو کاربر کاملاً جدا ---
  const emailA = randomEmail("tenant-a");
  const emailB = randomEmail("tenant-b");
  const password = "SuperSecret123!";

  const regA = await api("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ email: emailA, password }) });
  const regB = await api("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ email: emailB, password }) });

  console.log("ثبت‌نام کاربر A:", regA.status);
  console.log("ثبت‌نام کاربر B:", regB.status);
  checks.push({ name: "هر دو کاربر با موفقیت ثبت‌نام شدند", pass: regA.status === 201 && regB.status === 201 });

  const tokenA = regA.body?.token;
  const tokenB = regB.body?.token;

  // --- کاربر A یک محصول می‌سازد ---
  const createProductA = await api(
    "/api/v1/products",
    { method: "POST", body: JSON.stringify({ name: "محصول محرمانه A", descriptionText: "فقط کاربر A باید این را ببیند" }) },
    tokenA
  );
  console.log("\nساخت محصول توسط A:", createProductA.status, createProductA.body?.product?.id);
  checks.push({ name: "محصول کاربر A ساخته شد", pass: createProductA.status === 201 });
  const productIdA = createProductA.body?.product?.id;

  // --- کاربر B لیست محصولاتش را می‌گیرد؛ نباید محصول A را ببیند ---
  const listB = await api("/api/v1/products", {}, tokenB);
  const bCanSeeAsProduct = (listB.body?.data ?? []).some((p: any) => p.id === productIdA);
  checks.push({ name: "کاربر B در لیست خودش محصول A را نمی‌بیند", pass: !bCanSeeAsProduct });

  // --- کاربر B با حدس زدن id مستقیم محصول A را می‌خواهد (تست IDOR) ---
  const directAccessB = await api(`/api/v1/products/${productIdA}`, {}, tokenB);
  console.log("تلاش B برای دسترسی مستقیم به محصول A:", directAccessB.status);
  checks.push({ name: "دسترسی مستقیم IDOR کاربر B رد شد (۴۰۴)", pass: directAccessB.status === 404 });

  // --- بدون توکن اصلاً نباید کار کند ---
  const noAuth = await api("/api/v1/products");
  checks.push({ name: "بدون توکن -> ۴۰۱", pass: noAuth.status === 401 });

  // --- کلید API بسازیم و با آن هم تست کنیم (نه فقط JWT) ---
  const createKeyA = await api("/api/v1/api-keys", { method: "POST", body: JSON.stringify({ name: "تست" }) }, tokenA);
  const apiKeyTokenA = createKeyA.body?.token;
  console.log("\nکلید API کاربر A ساخته شد:", createKeyA.status, !!apiKeyTokenA);
  checks.push({ name: "کلید API ساخته شد و توکن کامل برگشت", pass: createKeyA.status === 201 && !!apiKeyTokenA });

  const listWithApiKey = await api("/api/v1/products", {}, apiKeyTokenA);
  const apiKeySeesOwnProduct = (listWithApiKey.body?.data ?? []).some((p: any) => p.id === productIdA);
  checks.push({ name: "همان کاربر با کلید API هم محصول خودش را می‌بیند", pass: apiKeySeesOwnProduct });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  console.log("\n" + (allPass ? "✅ ایزولاسیون چندمستأجری تایید شد." : "❌ برخی چک‌ها ناموفق بودند — قبل از استفاده واقعی بررسی کنید."));
  if (!allPass) process.exitCode = 1;
}

main().catch((err) => {
  console.error("خطا در اجرای تست (سرور روشن است؟ npm run dev زدید؟):", err.message);
  process.exitCode = 1;
});
