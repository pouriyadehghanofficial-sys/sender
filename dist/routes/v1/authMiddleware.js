"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireOwner = requireOwner;
const auth_1 = require("../../utils/auth");
/**
 * احراز هویت یکپارچه‌ی API v1 (بخش ۲ سند): همان هدر Authorization: Bearer <token>
 * هم برای نشست ورود داشبورد (JWT) و هم برای توکن‌های API بلندمدت کار می‌کند.
 * تشخیص نوع توکن از روی پیشوندش (abai_live_...) انجام می‌شود.
 * هیچ‌وقت userId از body/query گرفته نمی‌شود — همیشه از همین context.
 */
async function requireAuth(req, res, next) {
    const header = req.header("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
        return res.status(401).json({ error: "توکن احراز هویت ارسال نشده (Authorization: Bearer <token>)." });
    }
    try {
        if ((0, auth_1.looksLikeApiKey)(token)) {
            // import تنبل: تا وقتی مسیر JWT کافی است، این ماژول‌ها (که به دیتابیس وصل‌اند)
            // اصلاً بارگذاری نمی‌شوند. این باعث می‌شود این میان‌افزار مستقل از وضعیت
            // دیتابیس هم قابل تست باشد.
            const { findActiveApiKeyByHash, touchApiKeyLastUsed } = await Promise.resolve().then(() => __importStar(require("../../db/apiKeyRepository")));
            const { findUserById } = await Promise.resolve().then(() => __importStar(require("../../db/userRepository")));
            const keyHash = (0, auth_1.hashApiKeyToken)(token);
            const apiKeyRow = await findActiveApiKeyByHash(keyHash);
            if (!apiKeyRow) {
                return res.status(401).json({ error: "کلید API نامعتبر، باطل‌شده یا منقضی است." });
            }
            const user = await findUserById(apiKeyRow.userId);
            if (!user || !user.isActive) {
                return res.status(401).json({ error: "حساب کاربری مرتبط با این کلید غیرفعال است." });
            }
            touchApiKeyLastUsed(apiKeyRow.id).catch(() => undefined); // fire-and-forget
            req.auth = { userId: user.id, isOwner: user.isOwner, apiKeyId: apiKeyRow.id };
            return next();
        }
        const payload = (0, auth_1.verifyJwt)(token);
        if (!payload) {
            return res.status(401).json({ error: "توکن نامعتبر یا منقضی است." });
        }
        req.auth = { userId: payload.userId, isOwner: payload.isOwner, apiKeyId: null };
        return next();
    }
    catch (err) {
        console.error("[requireAuth] خطای غیرمنتظره:", err);
        return res.status(401).json({ error: "خطا در احراز هویت." });
    }
}
/** فقط برای route های مخصوص مالک پلتفرم (بخش ۱۲ سند) — باید بعد از requireAuth بیاید */
function requireOwner(req, res, next) {
    if (!req.auth?.isOwner) {
        return res.status(403).json({ error: "این بخش فقط برای مالک پلتفرم در دسترس است." });
    }
    next();
}
