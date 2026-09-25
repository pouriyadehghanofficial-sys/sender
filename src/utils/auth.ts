import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_EXPIRES_IN = "7d";
const API_KEY_PREFIX = "abai_live_"; // ahoora-bale-ai live key

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET در .env تنظیم نشده است. برای ساخت یک مقدار تصادفی اجرا کنید:\n" +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return secret;
}

// ---------------------------------------------------------------------------
// پسورد کاربران (bcryptjs — خالص جاوااسکریپت، بدون نیاز به کامپایل native،
// تا روی ویندوز هم بدون مشکل نصب شود)
// ---------------------------------------------------------------------------
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 10);
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

// ---------------------------------------------------------------------------
// JWT برای نشست ورود داشبورد (username/password login)
// ---------------------------------------------------------------------------
export interface JwtPayload {
  userId: string;
  email: string;
  isOwner: boolean;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// کلیدهای API — فقط هش (SHA-256) ذخیره می‌شود، خودِ توکن هرگز در دیتابیس نیست
// ---------------------------------------------------------------------------
export interface GeneratedApiKey {
  /** توکن کامل — فقط همین یک‌بار (لحظه‌ی ساخت) نمایش داده می‌شود */
  plainToken: string;
  /** پیشوند کوتاه قابل نمایش دائم (برای شناسایی کلید در لیست، بدون افشای کل توکن) */
  keyPrefix: string;
  /** هش SHA-256 کل توکن — همین در دیتابیس ذخیره می‌شود */
  keyHash: string;
}

export function generateApiKey(): GeneratedApiKey {
  const randomPart = crypto.randomBytes(24).toString("hex");
  const plainToken = `${API_KEY_PREFIX}${randomPart}`;
  const keyPrefix = plainToken.slice(0, API_KEY_PREFIX.length + 8) + "...";
  const keyHash = hashApiKeyToken(plainToken);
  return { plainToken, keyPrefix, keyHash };
}

export function hashApiKeyToken(plainToken: string): string {
  return crypto.createHash("sha256").update(plainToken).digest("hex");
}

export function looksLikeApiKey(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}
