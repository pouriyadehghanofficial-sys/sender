import { Request, Response, NextFunction } from "express";
import { verifyJwt, looksLikeApiKey, hashApiKeyToken } from "../../utils/auth";

export interface AuthContext {
  userId: string;
  isOwner: boolean;
  /** فقط وقتی احراز هویت از طریق کلید API انجام شده باشد پر می‌شود (برای activity log) */
  apiKeyId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * احراز هویت یکپارچه‌ی API v1 (بخش ۲ سند): همان هدر Authorization: Bearer <token>
 * هم برای نشست ورود داشبورد (JWT) و هم برای توکن‌های API بلندمدت کار می‌کند.
 * تشخیص نوع توکن از روی پیشوندش (abai_live_...) انجام می‌شود.
 * هیچ‌وقت userId از body/query گرفته نمی‌شود — همیشه از همین context.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return res.status(401).json({ error: "توکن احراز هویت ارسال نشده (Authorization: Bearer <token>)." });
  }

  try {
    if (looksLikeApiKey(token)) {
      // import تنبل: تا وقتی مسیر JWT کافی است، این ماژول‌ها (که به دیتابیس وصل‌اند)
      // اصلاً بارگذاری نمی‌شوند. این باعث می‌شود این میان‌افزار مستقل از وضعیت
      // دیتابیس هم قابل تست باشد.
      const { findActiveApiKeyByHash, touchApiKeyLastUsed } = await import("../../db/apiKeyRepository");
      const { findUserById } = await import("../../db/userRepository");

      const keyHash = hashApiKeyToken(token);
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

    const payload = verifyJwt(token);
    if (!payload) {
      return res.status(401).json({ error: "توکن نامعتبر یا منقضی است." });
    }
    req.auth = { userId: payload.userId, isOwner: payload.isOwner, apiKeyId: null };
    return next();
  } catch (err) {
    console.error("[requireAuth] خطای غیرمنتظره:", err);
    return res.status(401).json({ error: "خطا در احراز هویت." });
  }
}

/** فقط برای route های مخصوص مالک پلتفرم (بخش ۱۲ سند) — باید بعد از requireAuth بیاید */
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isOwner) {
    return res.status(403).json({ error: "این بخش فقط برای مالک پلتفرم در دسترس است." });
  }
  next();
}
