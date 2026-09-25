import { hashPassword, verifyJwt } from "../src/utils/auth";
import { performLogin, LoginableUser } from "../src/services/loginService";

async function buildTestUser(overrides: Partial<LoginableUser> = {}): Promise<LoginableUser> {
  return {
    id: "user-123",
    email: "shop@example.com",
    passwordHash: await hashPassword("CorrectPassword123"),
    isActive: true,
    isOwner: false,
    ...overrides,
  };
}

async function main() {
  console.log("=== تست: جریان ورود (/auth/login) - شامل رفع باگ ۵۰۰ ===\n");
  const checks: { name: string; pass: boolean }[] = [];

  // --- ✅ سناریوی اصلی درخواست‌شده: ورود موفق ---
  process.env.JWT_SECRET = "test-jwt-secret-for-login-flow";
  const user = await buildTestUser();
  const successResult = await performLogin(user, "CorrectPassword123");
  console.log("نتیجه‌ی ورود موفق:", successResult);

  checks.push({ name: "ورود موفق -> status 200 (نه 500)", pass: successResult.status === 200 });
  checks.push({ name: "پاسخ شامل token است", pass: typeof successResult.body.token === "string" });

  const decoded = successResult.body.token ? verifyJwt(successResult.body.token as string) : null;
  checks.push({ name: "توکن برگشتی معتبر است و userId درست دارد", pass: decoded?.userId === "user-123" });
  checks.push({ name: "پاسخ شامل اطلاعات کاربر (بدون passwordHash) است", pass: (successResult.body.user as any)?.email === "shop@example.com" && !("passwordHash" in (successResult.body.user as any)) });

  // --- پسورد اشتباه -> باید 401 باشد، نه 500 ---
  const wrongPasswordResult = await performLogin(user, "WrongPassword");
  checks.push({ name: "پسورد اشتباه -> 401 (نه 500)", pass: wrongPasswordResult.status === 401 });

  // --- کاربر یافت نشد (null) -> باید 401 باشد ---
  const noUserResult = await performLogin(null, "AnyPassword123");
  checks.push({ name: "کاربر یافت نشد -> 401", pass: noUserResult.status === 401 });
  checks.push({
    name: "پیام خطا برای «کاربر نبود» و «پسورد غلط» یکسان است (جلوگیری از user enumeration)",
    pass: noUserResult.body.error === wrongPasswordResult.body.error,
  });

  // --- کاربر غیرفعال با پسورد درست -> 403 ---
  const inactiveUser = await buildTestUser({ isActive: false });
  const inactiveResult = await performLogin(inactiveUser, "CorrectPassword123");
  checks.push({ name: "حساب غیرفعال -> 403", pass: inactiveResult.status === 403 });

  // --- ❗️ تست دقیق باگ گزارش‌شده: JWT_SECRET تنظیم نشده ---
  delete process.env.JWT_SECRET;
  const misconfiguredResult = await performLogin(user, "CorrectPassword123");
  console.log("\nنتیجه با JWT_SECRET حذف‌شده (بازتولید باگ گزارش‌شده):", misconfiguredResult);

  checks.push({
    name: "بدون JWT_SECRET -> پسورد درست تایید می‌شود (قبل از رسیدن به مرحله JWT)",
    pass: misconfiguredResult.status !== 401,
  });
  checks.push({
    name: "بدون JWT_SECRET -> پیام خطا صریح و قابل‌فهم است (نه 'خطای داخلی سرور' مبهم)",
    pass: misconfiguredResult.status === 500 && String(misconfiguredResult.body.error).includes("JWT_SECRET"),
  });

  // برگرداندن JWT_SECRET برای اینکه بقیه‌ی تست‌های پروژه (اگر بعدش اجرا شوند) تحت تاثیر قرار نگیرند
  process.env.JWT_SECRET = "test-jwt-secret-for-login-flow";

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌ها پاس شدند — باگ ۵۰۰ رفع شد و ورود موفق کار می‌کند.");
}

main();
