import { useParams, Link } from "react-router-dom";
import { ordersApi } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, StatusBadge, formatDateTime } from "../components/Primitives";

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApiResource(() => ordersApi.get(id!), [id]);

  if (loading) return <LoadingSpinner label="در حال بارگذاری سفارش..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  const order = data?.order;
  if (!order) return null;

  return (
    <div className="max-w-lg space-y-4">
      <Link to="/orders" className="text-sm text-inkmuted hover:text-ink">
        ← بازگشت به سفارش‌ها
      </Link>

      <div className="rounded-xl border border-line bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-ink">جزئیات سفارش</h1>
          <StatusBadge status={order.status ?? "completed"} />
        </div>
        <dl className="space-y-3 text-sm">
          <Row label="مشتری" value={order.conversation?.contact?.name} />
          <Row label="شماره" value={order.conversation?.contact?.phone} />
          <Row label="محصول" value={order.conversation?.product?.name} />
          <Row label="تاریخ ثبت" value={formatDateTime(order.createdAt)} />
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-2 last:border-0 last:pb-0">
      <dt className="text-inkmuted">{label}</dt>
      <dd className="font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}
