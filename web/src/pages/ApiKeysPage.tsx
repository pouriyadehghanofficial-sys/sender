import { FormEvent, useState } from "react";
import { apiKeysApi, ApiError, SchemaApiKeyCreated } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { LoadingSpinner, ErrorBanner, EmptyState, formatDateTime } from "../components/Primitives";
import { Button, Field, Modal, TextInput } from "../components/Form";

export function ApiKeysPage() {
  const { data, loading, error, reload } = useApiResource(() => apiKeysApi.list());
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<SchemaApiKeyCreated | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function onRevoke(id: string) {
    if (!confirm("این کلید باطل شود؟ هر برنامه‌ای که از آن استفاده می‌کند دیگر کار نخواهد کرد.")) return;
    setRevokingId(id);
    try {
      await apiKeysApi.revoke(id);
      reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "خطا در باطل کردن کلید.");
    } finally {
      setRevokingId(null);
    }
  }

  if (loading) return <LoadingSpinner label="در حال بارگذاری کلیدهای API..." />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const keys = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">کلیدهای API</h1>
          <p className="text-sm text-inkmuted">برای اتصال برنامه‌های دیگر (مثلاً ارسال خودکار اکسل) از این کلیدها استفاده کنید.</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ کلید جدید</Button>
      </div>

      {keys.length === 0 ? (
        <EmptyState title="هنوز کلیدی نساخته‌اید" action={<Button onClick={() => setCreating(true)}>ساخت اولین کلید</Button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-paper2 text-right text-xs text-inkmuted">
              <tr>
                <th className="px-4 py-3 font-medium">نام</th>
                <th className="px-4 py-3 font-medium">کلید</th>
                <th className="px-4 py-3 font-medium">آخرین استفاده</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 text-ink">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-inkmuted">{k.keyPrefix}</td>
                  <td className="px-4 py-3 text-inkmuted">{formatDateTime(k.lastUsedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${k.isActive ? "bg-pine-light text-pine-dark" : "bg-paper2 text-inkmuted"}`}>
                      {k.isActive ? "فعال" : "باطل‌شده"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    {k.isActive && (
                      <button onClick={() => onRevoke(k.id!)} disabled={revokingId === k.id} className="text-sm font-medium text-brick hover:underline">
                        باطل کردن
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateApiKeyModal
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            setJustCreated(created);
            reload();
          }}
        />
      )}

      {justCreated && (
        <Modal title="کلید API ساخته شد" onClose={() => setJustCreated(null)}>
          <p className="mb-3 text-sm text-brick">⚠️ این توکن فقط همین یک‌بار نمایش داده می‌شود. همین الان جایی امن کپی‌اش کنید.</p>
          <div className="mb-4 break-all rounded-lg bg-paper2 p-3 font-mono text-xs text-ink">{justCreated.token}</div>
          <Button
            onClick={() => {
              navigator.clipboard?.writeText(justCreated.token || "");
            }}
            variant="secondary"
            className="w-full"
          >
            کپی کردن
          </Button>
        </Modal>
      )}
    </div>
  );
}

function CreateApiKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (k: SchemaApiKeyCreated) => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await apiKeysApi.create(name);
      onCreated(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در ساخت کلید.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="کلید API جدید" onClose={onClose}>
      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} />
        </div>
      )}
      <form onSubmit={onSubmit}>
        <Field label="نام (برای شناسایی خودتان)">
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً سرور فروشگاه" />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "در حال ساخت..." : "ساخت کلید"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
