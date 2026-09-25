import { ReactNode } from "react";

export function LoadingSpinner({ label = "در حال بارگذاری..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-inkmuted">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pine" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-brick/30 bg-brick-light px-4 py-3 text-sm text-brick">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-medium underline decoration-brick/50 underline-offset-2 hover:decoration-brick">
          تلاش دوباره
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-white/40 px-6 py-14 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-inkmuted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-paper2 text-inkmuted",
  sent: "bg-pine-light text-pine-dark",
  completed: "bg-pine-light text-pine-dark",
  successful: "bg-pine-light text-pine-dark",
  failed: "bg-brick-light text-brick",
  no_bale: "bg-amber-light text-amber",
  running: "bg-pine-light text-pine-dark",
  draft: "bg-paper2 text-inkmuted",
  paused: "bg-amber-light text-amber",
  cancelled: "bg-brick-light text-brick",
  active: "bg-pine-light text-pine-dark",
  referred: "bg-amber-light text-amber",
  resolved: "bg-pine-light text-pine-dark",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار",
  sent: "ارسال‌شده",
  completed: "تکمیل‌شده",
  successful: "موفق",
  failed: "ناموفق",
  no_bale: "بدون بله",
  running: "در حال اجرا",
  draft: "پیش‌نویس",
  paused: "متوقف",
  cancelled: "لغوشده",
  active: "فعال",
  referred: "ارجاع‌شده",
  resolved: "حل‌شده",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-paper2 text-inkmuted";
  const label = STATUS_LABELS[status] ?? status;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{label}</span>;
}

export function toPersianDigits(input: string | number): string {
  const map: Record<string, string> = { "0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴", "5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹" };
  return String(input).replace(/[0-9]/g, (d) => map[d]);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}
