process.env.JWT_SECRET = "test-jwt-secret-for-unit-test";

import { hashPassword, verifyPassword, signJwt, verifyJwt, generateApiKey, hashApiKeyToken, looksLikeApiKey } from "../src/utils/auth";

async function main() {
  console.log("=== تست: ابزارهای احراز هویت ===\n");
  const checks: { name: string; pass: boolean }[] = [];

  // --- پسورد ---
  const hash = await hashPassword("MySecurePass123");
  checks.push({ name: "هش پسورد متفاوت از متن اصلی است", pass: hash !== "MySecurePass123" });
  checks.push({ name: "verifyPassword با پسورد درست true می‌دهد", pass: await verifyPassword("MySecurePass123", hash) });
  checks.push({ name: "verifyPassword با پسورد غلط false می‌دهد", pass: !(await verifyPassword("WrongPass", hash)) });

  // --- JWT ---
  const token = signJwt({ userId: "u1", email: "a@b.com", isOwner: false });
  const decoded = verifyJwt(token);
  console.log("JWT decode شده:", decoded);
  checks.push({ name: "JWT معتبر decode می‌شود و userId درست برمی‌گردد", pass: decoded?.userId === "u1" });
  checks.push({ name: "JWT دستکاری‌شده رد می‌شود", pass: verifyJwt(token + "tampered") === null });
  checks.push({ name: "JWT کاملاً بی‌ربط رد می‌شود", pass: verifyJwt("not.a.jwt") === null });

  // --- API Key ---
  const key1 = generateApiKey();
  const key2 = generateApiKey();
  console.log("\nنمونه کلید API ساخته‌شده:", { plainToken: key1.plainToken.slice(0, 20) + "...", keyPrefix: key1.keyPrefix });
  checks.push({ name: "پیشوند abai_live_ دارد", pass: key1.plainToken.startsWith("abai_live_") });
  checks.push({ name: "دو کلید متفاوت تولید می‌شوند", pass: key1.plainToken !== key2.plainToken });
  checks.push({ name: "هش دو کلید متفاوت است", pass: key1.keyHash !== key2.keyHash });
  checks.push({ name: "هش کردن دوباره‌ی همان توکن، همان هش را می‌دهد (قابل جستجو در DB)", pass: hashApiKeyToken(key1.plainToken) === key1.keyHash });
  checks.push({ name: "looksLikeApiKey کلید واقعی را تشخیص می‌دهد", pass: looksLikeApiKey(key1.plainToken) });
  checks.push({ name: "looksLikeApiKey یک JWT را کلید API تشخیص نمی‌دهد", pass: !looksLikeApiKey(token) });
  checks.push({ name: "keyPrefix کامل نیست (کل توکن افشا نمی‌شود)", pass: key1.keyPrefix.length < key1.plainToken.length });

  console.log("\n--- نتیجه چک‌ها ---");
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? "✅" : "❌") + " " + c.name);
    if (!c.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
  else console.log("\n✅ همه‌ی تست‌ها پاس شدند.");
}

main();
