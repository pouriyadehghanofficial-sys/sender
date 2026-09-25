interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  urgent?: boolean;
}

export function StatCard({ label, value, hint, urgent }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border bg-white px-5 py-4 shadow-card ${
        urgent ? "border-amber/40 border-r-4 border-r-amber" : "border-line"
      }`}
    >
      <p className="text-sm text-inkmuted">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-inkmuted">{hint}</p>}
    </div>
  );
}
