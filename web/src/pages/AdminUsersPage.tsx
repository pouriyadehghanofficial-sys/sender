import { adminApi } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, EmptyState, formatDateTime } from "../components/Primitives";

export function AdminUsersPage() {
  const { data, loading, error, reload } = useApiResource(() => adminApi.users());

  if (loading) return <LoadingSpinner label="در حال بارگذاری کاربران..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const users = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">کاربران پلتفرم</h1>
        <p className="text-sm text-inkmuted">همه‌ی کاربرانی که در پلتفرم ثبت‌نام کرده‌اند</p>
      </div>

      {users.length === 0 ? (
        <EmptyState title="کاربری وجود ندارد" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-paper2 text-right text-xs text-inkmuted">
              <tr>
                <th className="px-4 py-3 font-medium">ایمیل</th>
                <th className="px-4 py-3 font-medium">نقش</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">تاریخ عضویت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-ink">{u.email}</td>
                  <td className="px-4 py-3 text-inkmuted">{u.isOwner ? "مدیر کل" : "کاربر عادی"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${u.isActive ? "bg-pine-light text-pine-dark" : "bg-paper2 text-inkmuted"}`}>
                      {u.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-inkmuted">{formatDateTime(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
