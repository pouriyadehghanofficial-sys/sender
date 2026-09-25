import { FormEvent, useState } from "react";
import { productsApi, SchemaProduct, ApiError } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, EmptyState } from "../components/Primitives";
import { Button, Field, Modal, TextArea, TextInput } from "../components/Form";

export function ProductsPage() {
  const { data, loading, error, reload } = useApiResource(() => productsApi.list());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SchemaProduct | null>(null);

  if (loading) return <LoadingSpinner label="در حال بارگذاری محصولات..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const products = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">محصولات</h1>
          <p className="text-sm text-inkmuted">توضیحاتی که هوش مصنوعی برای پاسخ به مشتری استفاده می‌کند</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ محصول جدید</Button>
      </div>

      {products.length === 0 ? (
        <EmptyState title="هنوز محصولی ثبت نکرده‌اید" description="یک محصول بسازید تا بتوانید برایش کمپین بزنید." action={<Button onClick={() => setCreating(true)}>ساخت اولین محصول</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border border-line bg-white p-5 shadow-card">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-ink">{p.name}</h3>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${p.isActive ? "bg-pine-light text-pine-dark" : "bg-paper2 text-inkmuted"}`}>
                  {p.isActive ? "فعال" : "غیرفعال"}
                </span>
              </div>
              <p className="mb-1 text-xs text-inkmuted">کد: {p.shortCode}</p>
              <p className="line-clamp-2 text-sm text-inkmuted">{p.descriptionText}</p>
              {p.userId === null && <p className="mt-2 text-xs text-amber">محصول سراسری (قابل ویرایش نیست)</p>}
              {p.userId !== null && (
                <button onClick={() => setEditing(p)} className="mt-3 text-sm font-medium text-pine hover:underline">
                  ویرایش
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <ProductFormModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {editing && (
        <ProductFormModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ProductFormModal({ product, onClose, onSaved }: { product?: SchemaProduct; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [descriptionText, setDescriptionText] = useState(product?.descriptionText ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (product) {
        await productsApi.update(product.id!, { name, descriptionText, isActive });
      } else {
        await productsApi.create({ name, descriptionText });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در ذخیره محصول.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={product ? "ویرایش محصول" : "محصول جدید"} onClose={onClose}>
      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} />
        </div>
      )}
      <form onSubmit={onSubmit}>
        <Field label="نام محصول">
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً کرم مرطوب‌کننده" />
        </Field>
        <Field label="توضیحات (چیزی که AI باید بداند)">
          <TextArea required rows={5} value={descriptionText} onChange={(e) => setDescriptionText(e.target.value)} placeholder="قیمت، حجم، ویژگی‌ها، شرایط ارسال..." />
        </Field>
        {product && (
          <label className="mb-4 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            محصول فعال است
          </label>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "در حال ذخیره..." : "ذخیره"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
