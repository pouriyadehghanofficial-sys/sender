import { adminApi } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, EmptyState, formatDateTime } from "../components/Primitives";

export function AdminApiKeysPage() {
  const { data, loading, error, reload } = useApiResource(() => adminApi.apiKeys());

  if (loading) return <LoadingSpinner label="در حال بارگذاری..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const keys = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">کلیدهای API همه کاربران</h1>
        <p className="text-sm text-inkmuted">هر کلید متعلق به کدام کاربر است و چه فعالیتی داشته</p>
      </div>

      {keys.length === 0 ? (
        <EmptyState title="هنوز هیچ کلیدی ساخته نشده" />
      ) : (
        <div className="space-y-4">
          {keys.map((k) => (
            <div key={k.id} className="rounded-xl border border-line bg-white p-5 shadow-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{k.name}</p>
                  <p className="font-mono text-xs text-inkmuted">{k.keyPrefix}</p>
                </div>
                <div className="text-left text-xs text-inkmuted">
                  <p>کاربر: {k.user?.email}</p>
                  <p>آخرین استفاده: {formatDateTime(k.lastUsedAt)}</p>
                </div>
              </div>
              {k.activitySummary && Object.keys(k.activitySummary).length > 0 ? (
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  {Object.entries(k.activitySummary).map(([action, count]) => (
                    <span key={action} className="rounded-full bg-paper2 px-2.5 py-1 text-xs text-inkmuted">
                      {action}: {count}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="border-t border-line pt-3 text-xs text-inkmuted">هنوز فعالیتی با این کلید ثبت نشده.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
