import { Link } from "react-router-dom";
import { ordersApi } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, EmptyState, StatusBadge, formatDateTime, toPersianDigits } from "../components/Primitives";
import { StatCard } from "../components/StatCard";

export function OrdersPage() {
  const { data, loading, error, reload } = useApiResource(() => ordersApi.list());

  if (loading) return <LoadingSpinner label="در حال بارگذاری سفارش‌ها..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const orders = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">سفارش‌ها</h1>
        <p className="text-sm text-inkmuted">سفارش‌هایی که هوش مصنوعی در مکالمه تایید کرده</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="تکمیل‌شده" value={toPersianDigits(data?.summary?.completed ?? 0)} />
        <StatCard label="در جریان" value={toPersianDigits(data?.summary?.active ?? 0)} />
        <StatCard label="لغوشده" value={toPersianDigits(data?.summary?.cancelled ?? 0)} />
      </div>

      {orders.length === 0 ? (
        <EmptyState title="هنوز سفارشی ثبت نشده" description="وقتی مشتری در مکالمه خریدش را تایید کند، اینجا نمایش داده می‌شود." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-paper2 text-right text-xs text-inkmuted">
              <tr>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">محصول</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">تاریخ</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 text-ink">{o.conversation?.contact?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-inkmuted">{o.conversation?.product?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status ?? "completed"} />
                  </td>
                  <td className="px-4 py-3 text-inkmuted">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3 text-left">
                    <Link to={`/orders/${o.id}`} className="text-sm font-medium text-pine hover:underline">
                      جزئیات
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
