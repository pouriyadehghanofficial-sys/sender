import { Link } from "react-router-dom";
import { conversationsApi } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, EmptyState, formatDateTime } from "../components/Primitives";

export function ConversationsActivePage() {
  const { data, loading, error, reload } = useApiResource(() => conversationsApi.active());

  if (loading) return <LoadingSpinner label="در حال بارگذاری مکالمات..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const conversations = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">مکالمات فعال</h1>
        <p className="text-sm text-inkmuted">مکالماتی که همین الان AI به‌طور خودکار پاسخ می‌دهد</p>
      </div>

      {conversations.length === 0 ? (
        <EmptyState title="هیچ مکالمه‌ی فعالی نیست" description="وقتی مشتری‌ها به کمپین‌های شما پاسخ بدهند، اینجا نمایش داده می‌شوند." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <ul className="divide-y divide-line">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link to={`/conversations/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-paper2">
                  <div>
                    <p className="text-sm font-medium text-ink">{c.contact?.name ?? "مخاطب ناشناس"}</p>
                    <p className="text-xs text-inkmuted">{c.contact?.phone}</p>
                  </div>
                  <div className="text-left">
                    <p className="max-w-xs truncate text-sm text-inkmuted">{c.messages?.[0]?.text ?? "—"}</p>
                    <p className="text-xs text-inkmuted">{formatDateTime(c.messages?.[0]?.createdAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
