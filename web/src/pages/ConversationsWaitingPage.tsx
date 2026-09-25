import { Link } from "react-router-dom";
import { conversationsApi } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, EmptyState, toPersianDigits } from "../components/Primitives";

const REASON_LABELS: Record<string, string> = {
  keyword: "درخواست صحبت با اپراتور",
  message_limit: "تعداد پیام زیاد شد",
  ai_failure: "خرابی موقت هوش مصنوعی",
  ai_requested: "خودِ هوش مصنوعی تشخیص داد",
};

export function ConversationsWaitingPage() {
  const { data, loading, error, reload } = useApiResource(() => conversationsApi.waiting());

  if (loading) return <LoadingSpinner label="در حال بارگذاری..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const conversations = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">منتظر پاسخ من</h1>
        <p className="text-sm text-inkmuted">این مکالمات دیگر توسط هوش مصنوعی پاسخ داده نمی‌شوند و منتظر شما هستند.</p>
      </div>

      {conversations.length === 0 ? (
        <EmptyState title="فعلاً هیچ مکالمه‌ای منتظر شما نیست 🎉" description="وقتی مشتری‌ای به کمک انسانی نیاز داشته باشد، اینجا نمایش داده می‌شود." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {conversations.map((c) => (
            <Link key={c.id} to={`/conversations/${c.id}`} className="rounded-xl border-r-4 border-amber border-line bg-white p-5 shadow-card hover:bg-paper2">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-medium text-ink">{c.contact?.name ?? "مخاطب ناشناس"}</p>
                {typeof c.waitingMinutes === "number" && (
                  <span className="shrink-0 rounded-full bg-amber-light px-2.5 py-0.5 text-xs font-medium text-amber">
                    {toPersianDigits(c.waitingMinutes)} دقیقه پیش
                  </span>
                )}
              </div>
              <p className="mb-2 text-xs text-inkmuted">{c.contact?.phone}</p>
              <p className="text-sm text-inkmuted">دلیل: {REASON_LABELS[c.escalationReason ?? ""] ?? "نامشخص"}</p>
              {c.product && <p className="mt-1 text-xs text-inkmuted">محصول: {c.product.name}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
