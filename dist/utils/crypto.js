"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
const crypto_1 = __importDefault(require("crypto"));
// کلید رمزنگاری از .env خوانده می‌شود (باید ۳۲ بایت base64 باشد)
function getKey() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
        throw new Error("ENCRYPTION_KEY در فایل .env تنظیم نشده است. برای ساخت یک کلید تصادفی اجرا کنید:\n" +
            "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"");
    }
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
        throw new Error("ENCRYPTION_KEY باید دقیقاً ۳۲ بایت (به‌صورت base64) باشد.");
    }
    return key;
}
/** رمزنگاری یک رشته متنی (مثل کلید API) قبل از ذخیره در دیتابیس */
function encryptSecret(plainText) {
    const key = getKey();
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // فرمت ذخیره‌سازی: iv:authTag:ciphertext (همه base64)
    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}
/** رمزگشایی رشته‌ی ذخیره‌شده در دیتابیس برای استفاده در فراخوانی API */
function decryptSecret(stored) {
    const key = getKey();
    const [ivB64, authTagB64, dataB64] = stored.split(":");
    if (!ivB64 || !authTagB64 || !dataB64) {
        throw new Error("فرمت مقدار رمزنگاری‌شده نامعتبر است.");
    }
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = crypto_1.default.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
}
