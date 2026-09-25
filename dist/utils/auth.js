"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signJwt = signJwt;
exports.verifyJwt = verifyJwt;
exports.generateApiKey = generateApiKey;
exports.hashApiKeyToken = hashApiKeyToken;
exports.looksLikeApiKey = looksLikeApiKey;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const JWT_EXPIRES_IN = "7d";
const API_KEY_PREFIX = "abai_live_"; // ahoora-bale-ai live key
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET در .env تنظیم نشده است. برای ساخت یک مقدار تصادفی اجرا کنید:\n" +
            "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    }
    return secret;
}
// ---------------------------------------------------------------------------
// پسورد کاربران (bcryptjs — خالص جاوااسکریپت، بدون نیاز به کامپایل native،
// تا روی ویندوز هم بدون مشکل نصب شود)
// ---------------------------------------------------------------------------
async function hashPassword(plainPassword) {
    return bcryptjs_1.default.hash(plainPassword, 10);
}
async function verifyPassword(plainPassword, hash) {
    return bcryptjs_1.default.compare(plainPassword, hash);
}
function signJwt(payload) {
    return jsonwebtoken_1.default.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}
function verifyJwt(token) {
    try {
        return jsonwebtoken_1.default.verify(token, getJwtSecret());
    }
    catch {
        return null;
    }
}
function generateApiKey() {
    const randomPart = crypto_1.default.randomBytes(24).toString("hex");
    const plainToken = `${API_KEY_PREFIX}${randomPart}`;
    const keyPrefix = plainToken.slice(0, API_KEY_PREFIX.length + 8) + "...";
    const keyHash = hashApiKeyToken(plainToken);
    return { plainToken, keyPrefix, keyHash };
}
function hashApiKeyToken(plainToken) {
    return crypto_1.default.createHash("sha256").update(plainToken).digest("hex");
}
function looksLikeApiKey(token) {
    return token.startsWith(API_KEY_PREFIX);
}
