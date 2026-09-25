import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { campaignsApi, productsApi, ApiError, SchemaProduct } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, EmptyState, StatusBadge, toPersianDigits } from "../components/Primitives";
import { Button, Field, Modal, TextInput } from "../components/Form";

export function CampaignsPage() {
  const { data, loading, error, reload } = useApiResource(() => campaignsApi.list());
  const [creating, setCreating] = useState(false);

  if (loading) return <LoadingSpinner label="در حال بارگذاری کمپین‌ها..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const campaigns = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">کمپین‌ها</h1>
          <p className="text-sm text-inkmuted">ارسال گروهی پیام معرفی محصول به مخاطبین</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ کمپین جدید</Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState title="هنوز کمپینی نساخته‌اید" description="یک محصول انتخاب کنید و کمپین بسازید." action={<Button onClick={() => setCreating(true)}>ساخت اولین کمپین</Button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-paper2 text-right text-xs text-inkmuted">
              <tr>
                <th className="px-4 py-3 font-medium">نام</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">پیشرفت</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-ink">{c.name || c.product?.name || "بدون نام"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status ?? "draft"} />
                  </td>
                  <td className="px-4 py-3 text-inkmuted">
                    {c.progress ? `${toPersianDigits(c.progress.processed ?? 0)} / ${toPersianDigits(c.progress.total ?? 0)} (${toPersianDigits(c.progress.percentage ?? 0)}٪)` : "—"}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Link to={`/campaigns/${c.id}`} className="text-sm font-medium text-pine hover:underline">
                      مشاهده
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateCampaignModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: productsData, loading: loadingProducts } = useApiResource(() => productsApi.list());
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products: SchemaProduct[] = (productsData?.data ?? []).filter((p) => p.isActive);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productId) {
      setError("یک محصول انتخاب کنید.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await campaignsApi.create({ productId, name: name || undefined });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در ساخت کمپین.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="کمپین جدید" onClose={onClose}>
      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} />
        </div>
      )}
      <form onSubmit={onSubmit}>
        <Field label="محصول">
          {loadingProducts ? (
            <p className="text-sm text-inkmuted">در حال بارگذاری محصولات...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-brick">هیچ محصول فعالی ندارید. اول یک محصول بسازید.</p>
          ) : (
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-pine">
              <option value="">انتخاب کنید...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="نام کمپین (اختیاری)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً کمپین بهاره" />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={saving || products.length === 0}>
            {saving ? "در حال ساخت..." : "ساخت کمپین"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
