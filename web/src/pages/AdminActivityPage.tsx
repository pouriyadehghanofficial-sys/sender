import { useState } from "react";
import { adminApi } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, EmptyState, formatDateTime, toPersianDigits } from "../components/Primitives";
import { Button } from "../components/Form";

export function AdminActivityPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApiResource(() => adminApi.activity({ page, pageSize: 20 }), [page]);

  if (loading) return <LoadingSpinner label="در حال بارگذاری لاگ فعالیت..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">لاگ فعالیت</h1>
        <p className="text-sm text-inkmuted">تاریخچه‌ی کامل عملیات مهم در کل پلتفرم</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="هنوز فعالیتی ثبت نشده" />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-paper2 text-right text-xs text-inkmuted">
                <tr>
                  <th className="px-4 py-3 font-medium">کاربر</th>
                  <th className="px-4 py-3 font-medium">عملیات</th>
                  <th className="px-4 py-3 font-medium">نوع منبع</th>
                  <th className="px-4 py-3 font-medium">زمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-ink">{r.user?.email ?? "—"}</td>
                    <td className="px-4 py-3 text-inkmuted">{r.action}</td>
                    <td className="px-4 py-3 text-inkmuted">{r.resourceType}</td>
                    <td className="px-4 py-3 text-inkmuted">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-inkmuted">
              صفحه {toPersianDigits(data?.page ?? 1)} از {toPersianDigits(data?.totalPages ?? 1)} (مجموع {toPersianDigits(data?.total ?? 0)})
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                قبلی
              </Button>
              <Button variant="secondary" disabled={(data?.totalPages ?? 1) <= page} onClick={() => setPage((p) => p + 1)}>
                بعدی
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
