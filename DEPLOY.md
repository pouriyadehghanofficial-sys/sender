# راهنمای استقرار (Deploy) رایگان

این راهنما پروژه را با سرویس‌های رایگان مستقر می‌کند:
- **بک‌اند:** Render.com (یا Railway.app) — پلن رایگان
- **دیتابیس:** Supabase یا Neon (Postgres رایگان)

---

## مرحله ۱ — ساخت دیتابیس Postgres رایگان

### گزینه الف) Supabase
1. در https://supabase.com یک پروژه جدید بسازید.
2. از بخش Project Settings → Database، مقدار **Connection string** را با فرمت
   `postgresql://...` کپی کنید (حالت "Connection pooling" برای production توصیه می‌شود).

### گزینه ب) Neon
1. در https://neon.tech یک پروژه جدید بسازید.
2. از داشبورد پروژه، مستقیماً connection string را کپی کنید.

این مقدار همان `DATABASE_URL` نهایی شماست.

---

## مرحله ۲ — تغییر Prisma از SQLite به Postgres

پروژه به‌صورت پیش‌فرض برای توسعه‌ی محلی روی SQLite تنظیم شده. **قبل از اولین دیپلوی**،
این یک خط را در `prisma/schema.prisma` تغییر دهید:

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

هیچ تغییر دیگری در اسکیما لازم نیست (همه‌ی فیلدها از نظر نوع با Postgres سازگارند).
بعد از این تغییر، یک migration تازه برای Postgres بسازید:

```bash
npx prisma migrate dev --name init_postgres
```

> اگر می‌خواهید هم روی SQLite محلی و هم Postgres پروداکشن کار کنید، ساده‌ترین راه
> نگه‌داشتن دو فایل `schema.prisma` (یکی برای dev با sqlite، یکی برای prod با
> postgresql) و انتخاب با `--schema` است؛ برای این پروژه با توجه به مقیاس کوچک،
> سوییچ دستی همان یک خط کافیست.

---

## مرحله ۳ — دیپلوی روی Render.com (روش پیشنهادی — با Blueprint آماده)

1. ریپازیتوری را روی GitHub push کنید.
2. در Render.com → New → **Blueprint** → ریپازیتوری را انتخاب کنید (فایل
   `render.yaml` که در ریشه‌ی پروژه است به‌صورت خودکار شناسایی می‌شود).
3. در فرم متغیرهای محیطی که Render نشان می‌دهد، مقداردهی کنید:
   - `DATABASE_URL` → همان connection string مرحله ۱
   - `WEBHOOK_BASE_URL` → بعد از اولین دیپلوی، آدرس Render (مثل
     `https://bale-broadcast-ai.onrender.com`) را اینجا بگذارید و redeploy کنید
   - `ENCRYPTION_KEY` → با این دستور بسازید و اینجا بگذارید:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```
4. Deploy را بزنید. `buildCommand` در `render.yaml` به‌طور خودکار
   `npm install`، `prisma migrate deploy` (اعمال migration روی دیتابیس واقعی) و
   `npm run build` را اجرا می‌کند.

### روش دستی (بدون Blueprint)
اگر ترجیح می‌دهید دستی تنظیم کنید:
- Build Command: `npm install && npx prisma migrate deploy && npm run build && cd web && npm install && npm run build && cd ..`
- Start Command: `npm start`
- Environment: Node

داشبورد React بعد از این build زیر `https://YOUR_DOMAIN/app` در دسترس است.

---

## مرحله ۳ (جایگزین) — دیپلوی روی Railway.app
1. پروژه جدید → Deploy from GitHub repo.
2. متغیرهای محیطی بالا را در تب Variables وارد کنید.
3. در تب Settings → Deploy، Build Command و Start Command را مثل بالا تنظیم کنید
   (Railway معمولاً `npm install` و `npm start` را خودش تشخیص می‌دهد؛ فقط Build
   Command را برای اجرای migration دستی اضافه کنید).

---

## مرحله ۴ — تنظیم وبهوک بازو روی آدرس نهایی

بعد از اینکه سرویس بالا آمد و `WEBHOOK_BASE_URL` درست تنظیم شد، یکی از این دو کار را انجام دهید:
- از پنل مدیریت (`/ui/index.html` → تب تنظیمات API → دکمه «تنظیم وبهوک بازو روی این سرور»)
- یا مستقیم با curl:
  ```bash
  curl -X POST https://YOUR_DOMAIN/admin/bale/setup-webhook
  ```

---

## چک‌لیست نهایی قبل از استفاده واقعی
- [ ] `DATABASE_URL` روی Postgres واقعی تنظیم شده (نه SQLite محلی)
- [ ] `ENCRYPTION_KEY` یک مقدار تصادفی واقعی است (نه مقدار نمونه)
- [ ] **`ADMIN_PANEL_TOKEN` تنظیم شده** — بدون این، هرکسی آدرس سرور را داشته باشد
      به پنل و کلید AI شما دسترسی کامل دارد
- [ ] **`WEBHOOK_SECRET` تنظیم شده** و آدرس وبهوک بعد از تنظیمش دوباره روی سرور
      بازو ثبت شده (دکمه «تنظیم وبهوک» در پنل)
- [ ] **`JWT_SECRET` تنظیم شده** — برای ورود کاربران پلتفرم چندمستأجری (`/api/v1/auth`)
- [ ] `WEBHOOK_BASE_URL` دقیقاً همان دامنه‌ی عمومی سرویس دیپلوی‌شده است (با https)
- [ ] حداقل یک ارائه‌دهنده AI فعال از پنل اضافه شده
- [ ] `bale_bot_token` و `bale_safir_key` از پنل تنظیمات وارد شده‌اند
- [ ] وبهوک با موفقیت روی سرور بازو تنظیم شده (مرحله ۴)
- [ ] فرمت واقعی خطاهای سفیر بله (`no_bale` در برابر `failed`) و ساختار واقعی
      payload وبهوک بازو، با یک تست واقعی بررسی و در صورت نیاز در کد اصلاح شده‌اند
      (نکات مربوطه در `README.md` فازهای ۵ و ۶ مستند شده)
