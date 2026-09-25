import { useState } from "react";
import { contactsApi, productsApi, ApiError, SchemaImportResult, SchemaProduct } from "../lib/apiClient";
import { useApiResource } from "../lib/useApiResource";
import { Button, Field } from "../components/Form";
import { ErrorBanner, toPersianDigits } from "../components/Primitives";

export function ContactsImportPage() {
  const { data: productsData } = useApiResource(() => productsApi.list());
  const [file, setFile] = useState<File | null>(null);
  const [productId, setProductId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SchemaImportResult | null>(null);

  const products: SchemaProduct[] = productsData?.data ?? [];

  async function onUpload() {
    if (!file) {
      setError("اول یک فایل اکسل انتخاب کنید.");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await contactsApi.import(file, { productId: productId || undefined });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در آپلود فایل.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">مخاطبین</h1>
        <p className="text-sm text-inkmuted">فایل اکسل مشتری‌ها را آپلود کنید تا برایشان کمپین بزنید.</p>
      </div>

      <div className="rounded-xl border border-line bg-white p-6 shadow-card">
        <Field label="محصول مرتبط (اختیاری)">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-pine"
          >
            <option value="">— بدون محصول مشخص —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="فایل اکسل (.xlsx یا .xls)">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-inkmuted file:me-3 file:rounded-lg file:border-0 file:bg-pine-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-pine-dark"
          />
        </Field>

        {error && (
          <div className="mb-3 mt-1">
            <ErrorBanner message={error} />
          </div>
        )}

        <Button onClick={onUpload} disabled={uploading || !file} className="mt-2">
          {uploading ? "در حال آپلود..." : "آپلود و ثبت مخاطبین"}
        </Button>
      </div>

      {result && (
        <div className="rounded-xl border border-line bg-white p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-ink">نتیجه import</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <ResultStat label="کل ردیف‌ها" value={result.totalRows} />
            <ResultStat label="ثبت‌شده" value={result.imported} tone="pine" />
            <ResultStat label="تکراری" value={result.duplicates} tone="amber" />
            <ResultStat label="نامعتبر" value={result.invalid} tone="brick" />
            <ResultStat label="ناموفق" value={result.failed} tone="brick" />
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, tone }: { label: string; value?: number; tone?: "pine" | "amber" | "brick" }) {
  const toneClass = tone === "pine" ? "text-pine-dark" : tone === "amber" ? "text-amber" : tone === "brick" ? "text-brick" : "text-ink";
  return (
    <div>
      <p className="text-xs text-inkmuted">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{toPersianDigits(value ?? 0)}</p>
    </div>
  );
}
