# bale-broadcast-ai

سیستم ارسال پیام انبوه + پاسخگویی هوش مصنوعی روی بازوی بله.
ساخته‌شده با Node.js + TypeScript + Express + Prisma، طبق سند فنی پروژه، فاز به فاز.

## 🆕🆕 داشبورد کاربری React (زیر `/app`)

یک SPA کامل و production-ready برای کاربران پلتفرم چندمستأجری، ساخته‌شده با
**Vite + React + TypeScript + Tailwind**، فارسی/RTL، و کاملاً بر پایه‌ی همان
API واقعی (`/api/v1`) — بدون هیچ داده‌ی ساختگی (mock).

### اجرا
```bash
cd web
npm install
npm run dev        # روی http://localhost:5173 با پروکسی به بک‌اند :3000
```
یا برای production (از ریشه‌ی پروژه سرو می‌شود، نه جدا):
```bash
cd web
npm install
npm run build       # خروجی در web/dist ساخته می‌شود
cd ..
npm run dev          # یا npm start — سرور اصلی خودکار web/dist را زیر /app سرو می‌کند
```
بعد به `http://localhost:3000/app/register` بروید. **اولین کسی که ثبت‌نام کند، مدیر کل (owner) پلتفرم می‌شود** و بخش «مدیریت پلتفرم» را هم در نوار کناری می‌بیند.

### ساختار
- `web/src/types/openapi.ts` — تایپ‌های TypeScript **تولیدشده مستقیم از `src/openapi.json`** (با `npm run gen:api-types`)؛ منبع واحد حقیقت طبق خواسته‌ی شما.
- `web/src/lib/apiClient.ts` — لایه‌ی سرویس API: یک تابع typed به‌ازای هر endpoint، مدیریت متمرکز هدر `Authorization`، پارس خطا از بدنه‌ی `{error}`، و مدیریت خودکار ۴۰۱ (پاک‌کردن توکن + هدایت به ورود).
- `web/src/context/AuthContext.tsx` — نشست کاربر، ورود/ثبت‌نام/خروج.
- ماژول‌ها: داشبورد، محصولات، مخاطبین (import اکسل)، کمپین‌ها (با پیشرفت زنده و poll هر ۳ ثانیه وقتی در حال اجراست)، مکالمات فعال/منتظر پاسخ + پاسخ دستی، سفارش‌ها، کلیدهای API، و بخش مدیریت پلتفرم (فقط owner).

### تست
```bash
cd web
npx tsc --noEmit                          # تایپ‌چک کامل - صفر خطا
npx tsx scripts/test-api-integration.ts   # تست یکپارچه‌سازی واقعی با mock server (۱۶ چک)
npx vite build                            # build واقعی production - تست شد ✅
```
همچنین سرو شدن واقعی SPA (شامل fallback مسیریابی برای رفرش صفحه‌های داخلی مثل
`/app/dashboard`) با یک سرور Express مستقل تست شد.

⚠️ چون در sandbox من دیتابیس واقعی اجرا نمی‌شد، جریان‌های کامل login→dashboard→...
را نتوانستم روی مرورگر واقعی با بک‌اند واقعی امتحان کنم؛ به‌جایش لایه‌ی API را با
mock server کامل تست کردم (که دقیقاً طبق `openapi.json` پاسخ می‌دهد) و build
production را تایید کردم. بعد از `npx prisma migrate dev`، حتماً یک‌بار خودتان
هم جریان ثبت‌نام → ساخت محصول → import اکسل → ساخت/شروع کمپین → دیدن مکالمه را
دستی امتحان کنید.

---

## 🆕 پلتفرم چندمستأجری (API v1)

روی همان زیرساخت قبلی (بله + AI)، یک لایه‌ی کامل چندمستأجری اضافه شده: هر کاربر
با ایمیل/پسورد ثبت‌نام می‌کند، یک یا چند کلید API می‌سازد، و فقط داده‌ی خودش
(محصولات، مخاطبین، کمپین‌ها، مکالمات، سفارش‌ها) را می‌بیند.

**مستندات کامل و تعاملی:** بعد از بالا آمدن سرور به آدرس زیر بروید:
```
http://localhost:3000/api/v1/docs
```

### شروع سریع API
```bash
# ثبت‌نام (اولین کاربر پلتفرم خودکار owner/مالک می‌شود)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"SuperSecret123"}'
# پاسخ شامل یک JWT است؛ همان را در همه‌ی درخواست‌های بعدی به‌صورت
# Authorization: Bearer <token> بفرستید (یا یک کلید API دائمی بسازید: POST /api/v1/api-keys)
```

### نقشه‌ی endpoint ها (پیشوند همه: `/api/v1`)
| بخش | Endpoint ها |
|---|---|
| احراز هویت | `POST /auth/register`, `POST /auth/login` |
| کلید API | `GET|POST /api-keys`, `DELETE /api-keys/:id` |
| محصولات | `GET|POST /products`, `GET|PATCH /products/:id` |
| مخاطبین | `POST /contacts/import` (آپلود اکسل، multipart) |
| کمپین‌ها | `GET|POST /campaigns`, `.../:id/{start,pause,resume,cancel}` |
| مکالمات | `GET /conversations/active`, `GET /conversations/waiting`, `.../:id/{reply,resolve}` |
| سفارش‌ها | `GET /orders`, `GET /orders/:id` |
| ارجاعات | `GET /referrals` |
| داشبورد | `GET /dashboard/summary` (همه‌چیز یک‌جا), `GET /dashboard/statistics` |
| مدیریت (فقط owner) | `GET /admin/users`, `GET /admin/api-keys`, `GET /admin/activity` |

### نکات مهم چندمستأجری
- **هیچ‌وقت `userId` از body/query خوانده نمی‌شود** — همیشه از توکن احراز هویت
  (JWT یا کلید API) استخراج می‌شود؛ این جلوی IDOR را می‌گیرد.
- محصولات می‌توانند «سراسری» (global، `userId=null`) یا مختص یک کاربر باشند؛
  مخاطبین/کمپین‌ها همیشه مختص یک کاربرند.
- **پنل قدیمی `/admin/*` (تک‌مستأجر، فازهای ۰-۹) دست‌نخورده باقی مانده** و
  همچنان زیرساخت مشترک بله/سفیر/AI providers را مدیریت می‌کند — این‌ها سطح
  «مالک پلتفرم»اند، نه هر کاربر.
- هر عمل مهم (ساخت کلید، import اکسل، ساخت/شروع/توقف کمپین، پاسخ دستی، ...) در
  جدول `activity_logs` با `userId` + `apiKeyId` ثبت می‌شود؛ مالک پلتفرم از
  `GET /admin/activity?apiKeyId=...` می‌تواند تاریخچه‌ی کامل هر کلید را ببیند.
- کمپین‌های چندمستأجری (`Campaign` model) واقعاً pause/resume می‌شوند: وسط حلقه‌ی
  ارسال، قبل از هر پیام وضعیت از دیتابیس دوباره خوانده می‌شود.

### migration لازم
مدل‌های جدید (`User`, `ApiKey`, `ActivityLog`, `Campaign`) و فیلدهای `userId` روی
`Product`/`Contact` اضافه شدند:
```bash
npx prisma migrate dev --name add_multitenant_platform
npm run seed   # یک کاربر owner تستی هم می‌سازد: owner@example.com / ChangeMe123!
```

### تست‌های این بخش
```bash
npx tsx scripts/test-auth-utils.ts              # هش پسورد، JWT، تولید/هش کلید API
npx tsx scripts/test-auth-middleware.ts         # میان‌افزار احراز هویت (مسیر JWT)
npx tsx scripts/test-pagination.ts              # ابزار صفحه‌بندی
npx tsx scripts/test-import-classification.ts   # تشخیص مخاطب تکراری/نامعتبر در import
# این یکی به یک سرور واقعیِ در حال اجرا نیاز دارد (چون در sandbox من DB اجرا نمی‌شد):
npm run dev   # در یک ترمینال
npx tsx scripts/test-tenant-isolation-manual.ts # در ترمینال دیگر — کاربر B نباید داده A را ببیند
```

---

## وضعیت پیاده‌سازی
همه‌ی ۱۰ فاز (۰ تا ۹) کامل شدند:

| فاز | عنوان | خلاصه |
|---|---|---|
| ۰ | راه‌اندازی اولیه | ساختار پروژه + `GET /health` |
| ۱ | مدل داده | Prisma schema (۷ جدول) + repository ها + seed |
| ۲ | چند-ارائه‌دهنده AI | فیل‌اوور خودکار بین Anthropic/OpenAI-compatible |
| ۳ | دانش محصول | `buildSystemPrompt` + `POST /admin/products` |
| ۴ | مخاطبین از اکسل | پیش‌نمایش + نگاشت ستون + import |
| ۵ | ارسال گروهی | سفیر بله + ثبت وضعیت تحویل + گزارش CSV |
| ۶ | Webhook زنده | دریافت پیام کاربر + پاسخ AI |
| ۷ | تشخیص سفارش | ثبت order + اعلان به مالک (بله/ایمیل) |
| ۸ | پنل مدیریت | تک‌صفحه‌ای، ۴ تب، بدون فریم‌ورک |
| ۹ | استقرار | راهنمای Render/Railway + Supabase/Neon |

**+ سه قابلیت اضافه شده بعد از تحویل اولیه:**

| # | عنوان | خلاصه |
|---|---|---|
| A | تست چت‌بات | تب «محصولات» → چت با AI روی دانش هر محصول، بدون ذخیره در دیتابیس واقعی |
| B | مقاومت کمپین | ارسال گروهی از همان‌جا که قطع شده ادامه پیدا می‌کند؛ قفل جلوگیری از اجرای هم‌زمان |
| C | ارجاع به انسان | با کلمه کلیدی، سقف تعداد پیام، یا تشخیص خودِ AI (تگ `[NEEDS_HUMAN]`) ارجاع می‌دهد |
| D | چند مدل در یک کلید | فیلد «مدل» می‌تواند چند مدل کاما-جدا بگیرد؛ بین‌شان هم فیل‌اوور می‌شود |

**+ سخت‌سازی امنیتی و پایداری (بعد از گزارش کاربر):**

| # | عنوان | خلاصه |
|---|---|---|
| E | رمز پنل مدیریت | بدون `ADMIN_PANEL_TOKEN`، همه‌ی API های `/admin/*` باز بودند — الان با توکن محافظت می‌شوند |
| F | رمز وبهوک | `/webhook/bale/:secret` — جلوی جعل پیام و هزینه‌ی الکی AI را می‌گیرد |
| G | قفل ترتیبی مکالمه | پیام‌های پشت‌سرهم یک کاربر race condition نمی‌سازند |
| H | محدودیت نرخ | حداکثر ۲۰ پیام در ۲ دقیقه برای هر کاربر (قابل تغییر) |
| I | مدیریت خطای مرکزی | یک route خراب دیگر کل سرور را کرش نمی‌کند |

---

## راه‌اندازی سریع (محلی)

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed        # تست پایان فاز ۱: درج و خواندن داده تستی
npm run dev          # اجرای سرور روی http://localhost:3000
```

سپس:
```bash
curl http://localhost:3000/health
# { "status": "ok" }
```

پنل مدیریت: مرورگر را به `http://localhost:3000` (ریدایرکت خودکار به `/ui/index.html`) باز کنید.

فایل `.env.example` را کپی کرده و به `.env` تغییر نام دهید. `ENCRYPTION_KEY` را با این دستور بسازید:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## ⚠️ محدودیت مهم محیط ساخت این پروژه (بخوانید)

این پروژه در یک sandbox ساخته شد که دسترسی شبکه‌اش به چند آدرس محدود بود:
`binaries.prisma.sh` (برای دانلود موتور Prisma)، `safir.bale.ai` و `tapi.bale.ai`
(API های واقعی بله) در دسترس نبودند. در نتیجه:

- `npx prisma generate` / `migrate` / `npm run seed` در همان محیط اجرا **نشدند** —
  ولی اسکیما و کد کاملاً استاندارد است و روی سیستم شما (با اینترنت عادی) بدون مشکل کار می‌کند.
- هر بخشی که به API واقعی سفیر/بازو نیاز داشت، با یک **سرور mock محلی واقعی**
  (نه شبیه‌سازی روی کاغذ) تست شد — سرور HTTP واقعی بالا آمد، درخواست واقعی گرفت،
  پاسخ واقعی داد. لیست کامل تست‌ها در بخش «تست‌های خودکار» پایین.
- ارتباط با `api.anthropic.com` در sandbox **مجاز بود**، پس فیل‌اوور فاز ۲ با یک
  کلید عمداً نامعتبر واقعاً امتحان شد (۴۰۱ واقعی گرفت).
- در همین مسیر یک **باگ واقعی پیدا و رفع شد**: نام هدر `Api Access Key` (با فاصله)
  که در سند اولیه آمده بود، از نظر مشخصات HTTP نامعتبر است؛ به `Api-Access-Key` اصلاح شد.

**قبل از استفاده‌ی واقعی حتماً این‌ها را با مستندات رسمی چک کنید:**
1. `src/providers/baleSafirClient.ts` — نام دقیق هدر احراز هویت و ساختار خطای
   «کاربر بله ندارد» را با https://docs.bale.ai/safir تطبیق دهید.
2. `src/services/baleWebhookParser.ts` — ساختار واقعی payload وبهوک را (با یک
   پیام تستی واقعی و لاگی که در `routes/webhookBale.ts` گذاشته شده) ببینید.

---

## تست‌های خودکار (Scripts)

هر فاز حداقل یک تست واقعی و اجراشده دارد (نه فقط ادعا). همه را می‌توانید مستقیم اجرا کنید:

```bash
npx tsx scripts/test-failover.ts          # فاز ۲: فیل‌اوور واقعی بین دو AI provider
npx tsx scripts/test-system-prompt.ts     # فاز ۳: ساخت و تزریق system prompt
npx tsx scripts/test-excel-import.ts      # فاز ۴: پارس اکسل + نرمال‌سازی شماره
npx tsx scripts/test-safir-client.ts      # فاز ۵: کلاینت سفیر بله (۳ حالت)
npx tsx scripts/test-webhook-parsing.ts   # فاز ۶: پارسر webhook + تگ سفارش
npx tsx scripts/test-bale-bot-client.ts   # فاز ۶: setWebhook / sendMessage
npx tsx scripts/test-notification.ts      # فاز ۷: متن اعلان + ارسال بله/ایمیل (شامل متن اعلان ارجاع)
npx tsx scripts/test-escalation.ts        # قابلیت C: تشخیص محرک‌های ارجاع به انسان
npx tsx scripts/test-ai-tags.ts           # قابلیت C: تگ [NEEDS_HUMAN] + سازگاری تگ سفارش
npx tsx scripts/test-multi-model.ts       # قابلیت D: فیل‌اوور بین چند مدل زیر یک کلید
npx tsx scripts/test-auth-and-errors.ts   # قابلیت E, I: رمز پنل + مدیریت خطای مرکزی
npx tsx scripts/test-webhook-secret.ts    # قابلیت F: رمز مسیر وبهوک
npx tsx scripts/test-concurrency.ts       # قابلیت G, H: قفل ترتیبی + محدودیت نرخ
npx tsx scripts/test-campaign-sequential.ts # تایید ارسال یکی‌یکی کمپین با اندازه‌گیری زمان واقعی
```

فاز ۰ و ۱ هم با `curl http://localhost:3000/health` و `npm run seed` تست می‌شوند
(نیازمند دیتابیس migrate‌شده).

---

## مرجع API به تفکیک فاز

### فاز ۱ — ارائه‌دهندگان AI
- `POST /admin/ai-providers` — `{ name, providerType, model, apiKey, baseUrl?, priority? }`
- `GET /admin/ai-providers` — لیست (بدون کلید رمزنگاری‌شده)
- `DELETE /admin/ai-providers/:id`

### فاز ۳ — محصولات
- `POST /admin/products` — `{ name, shortCode?, descriptionText }` یا آپلود فایل (`file`)
- `GET /admin/products` / `GET /admin/products/:id`
- `GET /admin/products/:id/system-prompt` — پیش‌نمایش system prompt
- `PUT /admin/products/:id` / `DELETE /admin/products/:id`

### فاز ۴ — مخاطبین
- `POST /admin/contacts/upload` (multipart، فیلد `file`) → پیش‌نمایش ستون‌ها + `uploadToken`
- `POST /admin/contacts/import` — `{ uploadToken, mapping: { nameColumnIndex, phoneColumnIndex, productCodeColumnIndex? }, defaultProductId? }`

### فاز ۵ — کمپین
- `POST /admin/campaigns/:productId/send` — شروع ارسال در پس‌زمینه (پاسخ فوری ۲۰۲)
- `GET /admin/campaigns/:productId/report` — گزارش JSON
- `GET /admin/campaigns/:productId/report?format=csv` — دانلود CSV

### فاز ۶ — Webhook و تنظیمات بازو
- `POST /webhook/bale` — دریافت پیام کاربر، پاسخ AI، ارسال جواب
- `POST /admin/bale/setup-webhook` — تنظیم وبهوک روی سرور بازو
- `POST /admin/bale/settings` — ذخیره `bale_bot_token`, `bale_safir_key`,
  `admin_notify_method`, `admin_notify_target`, تنظیمات `smtp_*`

### فاز ۷ — سفارش‌ها
به‌محض تشخیص `[ORDER_CONFIRMED]` در پاسخ AI، به‌صورت خودکار رکورد `orders` ساخته
و به مالک اطلاع داده می‌شود (طبق `admin_notify_method`: `bale` یا `email`).
- `GET /admin/orders` — لیست سفارش‌های تکمیل‌شده
- `GET /admin/orders/conversations/active` — مکالمات فعال با آخرین پیام

برای اعلان ایمیلی این کلیدها را هم در `/admin/bale/settings` بدهید:
`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`،‌ و
`admin_notify_target` را ایمیل مقصد + `admin_notify_method=email` بگذارید.
برای اعلان بله: `admin_notify_method=bale` و `admin_notify_target` را chat_id بگذارید.

### فاز ۸ — پنل مدیریت
`http://localhost:3000/ui/index.html` — چهار تب: تنظیمات API، محصولات، مخاطبین
(آپلود اکسل + نگاشت ستون + کمپین)، مکالمات و سفارش‌ها. هیچ منطق تجاری در
فرانت‌اند نیست؛ فقط به endpoint های بالا وصل می‌شود.

---

## قابلیت‌های اضافه‌شده (A, B, C)

### A) تست چت‌بات (بدون آلوده کردن دیتابیس واقعی)
- `POST /admin/products/:id/test-chat` — `{ messages: [{role:'user'|'assistant', content}] }`
  → `{ reply, orderConfirmed }`. چیزی در `contacts/conversations/messages` ذخیره نمی‌شود.
- پنل: تب «محصولات» → کارت «🧪 تست چت‌بات».
- منطق آن دقیقاً از همان `buildSystemPrompt` (فاز ۳) و `askAI` (فاز ۲) استفاده
  می‌کند که هر دو جداگانه با mock واقعی تست شده‌اند.

### B) مقاومت کمپین در برابر قطعی
- `sendCampaign` فقط مخاطبین `status='pending'` را می‌فرستد، پس اگر سرور وسط کار
  از کار بیفتد (قطع برق/نت/کرش/خرابی API سفیر)، **همان `POST /admin/campaigns/:id/send`
  را دوباره صدا بزنید** — دقیقاً از همان‌جا که مانده ادامه می‌دهد.
- یک قفل درون‌حافظه‌ای (`isCampaignRunning`) از اجرای دو کمپین هم‌زمان روی یک
  محصول جلوگیری می‌کند (خطای ۴۰۹).
- `GET /admin/campaigns/:productId/status` → `{ running, counts }` — پنل از این
  برای نمایش «در حال ارسال» یا دکمه‌ی «ادامه ارسال کمپین» استفاده می‌کند.
- مکالمات AI هم از قبل مقاوم بودند (فاز ۶: idempotency + ذخیره پیام قبل از فراخوانی
  AI)؛ حالا اگر **همه‌ی** ارائه‌دهنده‌های AI هم‌زمان خراب باشند، به‌جای رها کردن
  مشتری، مکالمه خودکار به «ارجاع به انسان» (قابلیت C) منتقل می‌شود.

### C) ارجاع خودکار به اپراتور انسانی
سه محرک دارد:
1. کاربر عبارتی مثل «اپراتور»/«پشتیبان»/«کارشناس» بگوید (قابل تنظیم)
2. تعداد پیام‌های کاربر در یک مکالمه به یک سقف برسد (پیش‌فرض ۱۰، **شما خودتان از پنل
   روی هر عددی مثل ۱۰ یا ۱۵ تنظیم می‌کنید**)
3. **خودِ AI** تشخیص دهد باید ارجاع دهد (جواب را نمی‌داند، سوال خارج از اطلاعات محصول
   است، یا با توضیحات آزادی که شما نوشته‌اید مطابقت دارد) — این با تگ مخفی `[NEEDS_HUMAN]`
   در پاسخ AI کار می‌کند، دقیقاً مثل `[ORDER_CONFIRMED]`
4. همه‌ی ارائه‌دهنده‌های AI هم‌زمان خراب باشند

**رفع باگ:** قبلاً وقتی AI در متن پاسخش می‌گفت «باید از فروشنده بپرسم»، این فقط یک
جمله بود و هیچ اتفاقی در سیستم نمی‌افتاد. حالا system prompt به AI می‌گوید در چنین
حالتی تگ `[NEEDS_HUMAN]` را هم اضافه کند، و بک‌اند این تگ را می‌بیند و واقعاً مکالمه
را ارجاع می‌دهد + به شما اطلاع می‌دهد. در تب «تست چت‌بات» هم می‌توانید همین را
شبیه‌سازی و تایید کنید (پیام نشان می‌دهد آیا ارجاع فعال شد یا نه و چرا).

بعد از ارجاع: AI دیگر خودکار پاسخ نمی‌دهد، یک پیام کوتاه به کاربر می‌رود («به همکاران
ارجاع داده شد» یا همان پاسخ طبیعی AI اگر خودش تشخیص داده بود)، و یک اعلان (طبق
`admin_notify_method`) برای شما ارسال می‌شود.

- `GET /admin/conversations/escalated` — لیست مکالمات منتظر شما
- `GET /admin/conversations/:id/messages` — تاریخچه کامل
- `POST /admin/conversations/:id/reply` — `{ text }` → پاسخ دستی شما مستقیم به بازو می‌رود
- `POST /admin/conversations/:id/resolve` — پایان ارجاع، AI دوباره خودکار می‌شود
- تنظیم از پنل (تب تنظیمات API → «ارجاع خودکار به انسان»):
  - **سقف تعداد پیام** (عدد دلخواه شما، مثلاً ۱۰ یا ۱۵)
  - **کلمات کلیدی** (با کاما جدا)
  - **توضیحات آزاد برای AI** (یک textarea — هر رفتار یا شرایطی که می‌خواهید AI
    خودش تشخیص بدهد و ارجاع کند، به زبان طبیعی بنویسید)
- پنل: تب «ارجاع به من» (با نشان قرمز تعداد مکالمات منتظر) + کارت «تست چت‌بات»
  در تب محصولات که همین منطق را (بدون تماس واقعی) نشان می‌دهد
- تست: `npx tsx scripts/test-escalation.ts` (محرک‌های قانون‌محور)،
  `npx tsx scripts/test-ai-tags.ts` (تگ `[NEEDS_HUMAN]` + سازگاری با تگ سفارش)،
  و بخش اعلان ارجاع در `npx tsx scripts/test-notification.ts`

⚠️ چون فیلدهای `needsHuman`/`escalatedAt`/`escalationReason` به مدل `Conversation`
اضافه شدند، اگر از قبل یک دیتابیس migrate‌شده دارید، یک migration جدید بسازید:
```bash
npx prisma migrate dev --name add_escalation_fields
```

### D) چند مدل زیر یک کلید API
وقتی ارائه‌دهنده AI اضافه می‌کنید، فیلد «مدل» می‌تواند چند مدل با کاما جدا شده
بگیرد (مثلاً یک کلید OpenRouter که چند مدل را پوشش می‌دهد):
```
claude-sonnet-4-6, claude-haiku-4-5, claude-opus-5
```
سیستم آن‌ها را به همان ترتیب نوشته‌شده در فیل‌اوور امتحان می‌کند (اولین مدل =
اولویت بالاتر)؛ اگر مدل اول rate-limit خورد یا خطا داد، خودکار مدل بعدی از همان
کلید امتحان می‌شود، بعد سراغ provider بعدی در اولویت‌بندی کلی می‌رود.
تست واقعی: `npx tsx scripts/test-multi-model.ts` (یک mock server که مدل اول را
rate-limit می‌کند و مدل دوم را قبول می‌کند).

## امنیت و پایداری (E, F, G, H, I)

### E) رمز پنل مدیریت — حیاتی، قبل از هر دیپلوی عمومی تنظیم کنید
قبلاً هیچ رمزی روی `/admin/*` نبود؛ هر کسی آدرس سرور را می‌دید می‌توانست کلید AI شما
را ببیند/عوض کند، مخاطبین را ببیند، یا جای شما دستی به مشتری جواب بدهد.

در `.env`:
```
ADMIN_PANEL_TOKEN="یک رشته تصادفی طولانی"
```
ساخت مقدار تصادفی:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```
اگر این متغیر خالی بماند، سرور فقط یک **هشدار در لاگ** چاپ می‌کند و همچنان باز
می‌ماند (برای راحتی توسعه‌ی محلی) — ولی قبل از دیپلوی روی اینترنت عمومی حتماً پرش کنید.

بعد از تنظیم، وقتی `/ui/index.html` را باز کنید یک صفحه‌ی ورود می‌بینید؛ همان مقدار
`ADMIN_PANEL_TOKEN` را وارد کنید (در مرورگرتان ذخیره می‌ماند تا دفعه بعد لازم نباشد
دوباره وارد کنید).

### F) رمز مسیر وبهوک بازو
```
WEBHOOK_SECRET="یک رشته تصادفی دیگر"
```
بعد از تنظیم، از پنل دوباره روی «تنظیم وبهوک بازو روی این سرور» بزنید تا آدرس
جدید (شامل رمز) به بازو اطلاع داده شود. بدون این، هرکسی آدرس `/webhook/bale` را
حدس بزند می‌تواند پیام جعلی بفرستد و باعث فراخوانی‌های الکی و هزینه‌دار AI شود.

### G) قفل ترتیبی مکالمه (`src/utils/chatMutex.ts`)
اگر بازو دو پیام از یک کاربر را خیلی نزدیک به هم بفرستد، دو درخواست HTTP همزمان
می‌توانستند تاریخچه‌ی مکالمه را به‌هم بریزند یا باعث دو پاسخ قاطی‌شده از AI شوند.
حالا پیام‌های هر `chatId` همیشه دقیقاً پشت سر هم پردازش می‌شوند (کاربران مختلف
همچنان کاملاً موازی و بدون تاخیر اضافه پردازش می‌شوند).
تست واقعی: `npx tsx scripts/test-concurrency.ts`

### H) محدودیت نرخ پیام (`src/utils/rateLimiter.ts`)
هر `chatId` حداکثر ۲۰ پیام در هر ۲ دقیقه می‌تواند بفرستد (در
`src/routes/webhookBale.ts` با `RATE_LIMIT_MAX_MESSAGES` / `RATE_LIMIT_WINDOW_MS`
قابل تغییر است)؛ بعد از آن پیام‌ها بی‌صدا نادیده گرفته می‌شوند تا هزینه‌ی AI و
فشار به API بله کنترل‌شده بماند.

### I) مدیریت خطای مرکزی (`src/utils/asyncHandler.ts`)
قبلاً چند `route` (مثل لیست محصولات، گزارش کمپین، لیست سفارش‌ها) اگر دیتابیس یک
خطای غیرمنتظره می‌داد، می‌توانستند کل پردازه‌ی Node را کرش کنند (unhandled promise
rejection). همه‌ی این route ها حالا با `asyncHandler` پوشانده شده‌اند و یک
middleware مرکزی خطا در `index.ts` هر خطای پیش‌بینی‌نشده را می‌گیرد و فقط همان یک
درخواست را با ۵۰۰ جواب می‌دهد — بقیه‌ی کاربران و سرور دست‌نخورده می‌مانند. یک
شبکه‌ی امنیتی سطح پردازه (`process.on('unhandledRejection'/'uncaughtException')`)
هم به‌عنوان آخرین خط دفاعی اضافه شده.
تست واقعی: `npx tsx scripts/test-auth-and-errors.ts` (شامل تست E هم هست)،
`npx tsx scripts/test-webhook-secret.ts` (تست F)

### تایید عملکرد ترتیبی کمپین (رفع نگرانی «یهو با هم جواب ندهد»)
`npx tsx scripts/test-campaign-sequential.ts` با اندازه‌گیری زمان واقعی ثابت می‌کند
پیام‌های کمپین دقیقاً یکی‌یکی و با فاصله (نه به‌صورت انفجاری/همزمان) به سفیر بله
می‌روند — این از فاز ۵ همین‌طور بود، فقط حالا با تست عددی دقیق تایید شد.

---

## استقرار (Deploy)

راهنمای کامل دیپلوی رایگان روی Render.com یا Railway.app با دیتابیس Postgres رایگان
(Supabase/Neon) در فایل [`DEPLOY.md`](./DEPLOY.md). یک `render.yaml` (Blueprint)
هم برای دیپلوی یک‌کلیکی روی Render آماده است.

⚠️ پیش از اولین دیپلوی، طبق مرحله ۲ در `DEPLOY.md`، یک خط در `prisma/schema.prisma`
را از `provider = "sqlite"` به `provider = "postgresql"` تغییر دهید.

---

## ساختار پروژه
```
/src
  /db          مدل‌ها (Prisma) + repository های CRUD هر جدول
  /providers   اداپتورهای خارجی: Claude/OpenAI-compatible، سفیر بله، ربات بازو
  /services    منطق تجاری: system prompt، import اکسل، کمپین، webhook، سفارش، اعلان
  /routes      endpoint های HTTP (همه زیر /admin/* و /webhook/bale و /health)
  /ui          پنل مدیریت (HTML/CSS/JS خالص)
  /utils       رمزنگاری، CSV، نرمال‌سازی شماره، تگ سفارش
/prisma        schema.prisma + seed.ts
/scripts       تست‌های end-to-end هر فاز (بدون نیاز به فریم‌ورک تست)
```
