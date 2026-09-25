import { dashboardApi } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { StatCard } from "../components/StatCard";
import { ErrorBanner, LoadingSpinner, formatDateTime, toPersianDigits } from "../components/Primitives";
import { Link } from "react-router-dom";

const ACTION_LABELS: Record<string, string> = {
  product_created: "محصول جدید ساخته شد",
  product_updated: "محصول ویرایش شد",
  campaign_created: "کمپین ساخته شد",
  campaign_started: "کمپین شروع شد",
  campaign_paused: "کمپین متوقف شد",
  campaign_resumed: "کمپین ادامه پیدا کرد",
  campaign_cancelled: "کمپین لغو شد",
  campaign_completed: "کمپین تمام شد",
  contacts_imported: "مخاطبین import شدند",
  api_key_created: "کلید API ساخته شد",
  api_key_revoked: "کلید API باطل شد",
  conversation_replied: "پاسخ دستی ارسال شد",
  referral_resolved: "ارجاع حل شد",
};

export function DashboardPage() {
  const { data, loading, error, reload } = useApiResource(() => dashboardApi.summary());

  if (loading) return <LoadingSpinner label="در حال بارگذاری داشبورد..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-ink">خلاصه وضعیت</h1>
        <p className="text-sm text-inkmuted">نمای کلی کسب‌وکارتان روی بله</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="محصولات فعال" value={toPersianDigits(data.products?.active ?? 0)} />
        <StatCard label="کمپین‌های فعال" value={toPersianDigits(data.campaigns?.active ?? 0)} hint={`از مجموع ${toPersianDigits(data.campaigns?.total ?? 0)} کمپین`} />
        <StatCard label="پیام ارسال‌شده" value={toPersianDigits(data.messages?.sent ?? 0)} hint={`${toPersianDigits(data.messages?.failed ?? 0)} ناموفق`} />
        <StatCard label="مکالمات فعال" value={toPersianDigits(data.conversations?.active ?? 0)} />
        <StatCard
          label="منتظر پاسخ من"
          value={toPersianDigits(data.conversations?.waitingForResponse ?? 0)}
          urgent={(data.conversations?.waitingForResponse ?? 0) > 0}
          hint={(data.conversations?.waitingForResponse ?? 0) > 0 ? "نیاز به پیگیری دارد" : undefined}
        />
        <StatCard label="سفارش تکمیل‌شده" value={toPersianDigits(data.orders?.completed ?? 0)} />
      </div>

      {(data.conversations?.waitingForResponse ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-xl border-r-4 border-amber bg-amber-light px-5 py-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">{toPersianDigits(data.conversations?.waitingForResponse ?? 0)} مکالمه</span> منتظر پاسخ شماست.
          </p>
          <Link to="/conversations/waiting" className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            مشاهده و پاسخ
          </Link>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-semibold text-ink">فعالیت اخیر</h2>
        {data.recentActivity && data.recentActivity.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <ul className="divide-y divide-line">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-ink">{ACTION_LABELS[item.action ?? ""] ?? item.action}</span>
                  <span className="text-xs text-inkmuted">{formatDateTime(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-inkmuted">هنوز فعالیتی ثبت نشده.</p>
        )}
      </div>
    </div>
  );
}
