import { toSafeUser, toSafeApiKey } from "../src/utils/sanitize";

function main() {
  console.log("=== تست: پاک‌سازی whitelist داده حساس (کاربر و کلید API) ===\n");
  const checks: { name: string; pass: boolean }[] = [];

  const dangerousUser = {
    id: "u1",
    email: "a@b.com",
    passwordHash: "$2a$10$SUPER_SECRET_BCRYPT_HASH",
    isOwner: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    // فرض کنیم فردا یک فیلد حساس جدید هم به مدل اضافه شود:
    twoFactorSecret: "SECRET123",
  };

  const safeUser = toSafeUser(dangerousUser);
  console.log("خروجی toSafeUser:", safeUser);

  checks.push({ name: "passwordHash در خروجی نیست", pass: !JSON.stringify(safeUser).includes("SUPER_SECRET") });
  checks.push({ name: "فیلد جدید ناشناخته (twoFactorSecret) هم نشت نمی‌کند (چون whitelist است)", pass: !("twoFactorSecret" in (safeUser as object)) });
  checks.push({ name: "فیلدهای مجاز (id, email, isOwner, isActive, createdAt) درست برگشتند", pass: safeUser?.id === "u1" && safeUser?.email === "a@b.com" && safeUser?.isOwner === true && safeUser?.isActive === true && safeUser?.createdAt === "2026-01-01T00:00:00.000Z" });
  checks.push({ name: "updatedAt در whitelist نیست، پس برنمی‌گردد", pass: !("updatedAt" in (safeUser as object)) });

  const nullUser = toSafeUser(null);
  checks.push({ name: "ورودی null -> خروجی null (کرش نمی‌کند)", pass: nullUser === null });

  const dangerousApiKey = {
    id: "k1",
    name: "کلید تست",
    keyPrefix: "abai_live_1234...",
    keyHash: "SUPER_SECRET_SHA256_HASH_THAT_COULD_BE_BRUTE_FORCED",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
  };

  const safeKey = toSafeApiKey(dangerousApiKey);
  console.log("\nخروجی toSafeApiKey:", safeKey);

  checks.push({ name: "keyHash در خروجی نیست", pass: !JSON.stringify(safeKey).includes("SUPER_SECRET_SHA256") });
  checks.push({ name: "فیلدهای مجاز کلید API درست برگشتند", pass: safeKey?.id === "k1" && safeKey?.keyPrefix === "abai_live_1234..." });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌ها پاس شدند — هیچ فیلد حساسی نشت نمی‌کند.");
}

main();
