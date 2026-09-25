import "dotenv/config";
import { prisma } from "../src/db/client";
import { createAiProvider } from "../src/db/aiProviderRepository";
import { createProduct } from "../src/db/productRepository";
import { ProviderType } from "../src/db/enums";
import { hashPassword } from "../src/utils/auth";
import { createUser, findUserByEmail } from "../src/db/userRepository";

async function main() {
  console.log("در حال درج داده‌های تستی (seed)...");

  const provider = await createAiProvider({
    name: "Claude تستی",
    providerType: ProviderType.ANTHROPIC,
    apiKey: "sk-ant-test-key-1234",
    model: "claude-sonnet-4-6",
    priority: 1,
  });
  console.log("✔ ارائه‌دهنده هوش مصنوعی درج شد:", provider.id, provider.name);

  const product = await createProduct({
    name: "کرم مرطوب‌کننده تستی",
    shortCode: "TEST-CREAM-01",
    descriptionText:
      "کرم مرطوب‌کننده تستی برای پوست خشک، حجم ۵۰ میلی‌لیتر، قیمت ۲۵۰,۰۰۰ تومان، ارسال رایگان.",
  });
  console.log("✔ محصول درج شد:", product.id, product.name);

  // کاربر مالک پلتفرم (isOwner=true) — اگر از قبل کسی ثبت‌نام کرده باشد، اولین
  // ثبت‌نام‌کننده‌ی واقعی از /api/v1/auth/register خودش owner می‌شود؛ این فقط
  // یک حساب تستی برای محیط توسعه است.
  const ownerEmail = "owner@example.com";
  let owner = await findUserByEmail(ownerEmail);
  if (!owner) {
    owner = await createUser(ownerEmail, await hashPassword("ChangeMe123!"), true);
    console.log(`✔ کاربر مالک تستی ساخته شد: ${ownerEmail} / رمز: ChangeMe123! (حتماً بعداً عوض کنید)`);
  } else {
    console.log("… کاربر مالک تستی از قبل وجود داشت، دوباره ساخته نشد.");
  }

  // خواندن مستقیم برای اثبات درج صحیح
  const readBackProvider = await prisma.aiProvider.findUnique({ where: { id: provider.id } });
  const readBackProduct = await prisma.product.findUnique({ where: { id: product.id } });

  console.log("\n--- نتیجه خواندن مستقیم از دیتابیس ---");
  console.log(JSON.stringify({ readBackProvider, readBackProduct, owner: { id: owner.id, email: owner.email, isOwner: owner.isOwner } }, null, 2));
}

main()
  .catch((e) => {
    console.error("خطا در seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
