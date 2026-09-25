import { Router } from "express";
import rateLimit from "express-rate-limit";
import { hashPassword, signJwt } from "../../utils/auth";
import { createUser, findUserByEmail, countUsers } from "../../db/userRepository";
import { logActivity } from "../../db/activityLogRepository";
import { asyncHandler } from "../../utils/asyncHandler";
import { performLogin, LoginableUser } from "../../services/loginService";

const router = Router();

// جلوی brute-force روی پسورد را می‌گیرد: حداکثر ۱۰ تلاش در ۱۵ دقیقه برای هر IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تعداد تلاش‌های ورود بیش از حد مجاز بود. چند دقیقه دیگر امتحان کنید." },
});

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "ایمیل معتبر الزامی است." });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: "پسورد باید حداقل ۸ کاراکتر باشد." });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "کاربری با این ایمیل قبلاً ثبت‌نام کرده است." });
    }

    // اولین کاربری که در کل پلتفرم ثبت‌نام می‌کند، خودکار مالک (owner) می‌شود —
    // این باید همان کسی باشید که اول‌بار این پروژه را دیپلوی می‌کند.
    const isFirstUser = (await countUsers()) === 0;
    const passwordHash = await hashPassword(String(password));
    const user = await createUser(email, passwordHash, isFirstUser);

    await logActivity({ userId: user.id, action: "user_registered", resourceType: "user", resourceId: user.id });

    const token = signJwt({ userId: user.id, email: user.email, isOwner: user.isOwner });
    res.status(201).json({ token, user: { id: user.id, email: user.email, isOwner: user.isOwner } });
  })
);

router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "ایمیل و پسورد الزامی هستند." });
    }

    let user: LoginableUser | null;
    try {
      user = await findUserByEmail(email);
    } catch (err) {
      console.error("[auth/login] خطا در خواندن کاربر از دیتابیس:", err);
      return res.status(500).json({ error: "خطای داخلی سرور در بررسی حساب کاربری." });
    }

    const result = await performLogin(user, String(password));
    res.status(result.status).json(result.body);
  })
);

export default router;
