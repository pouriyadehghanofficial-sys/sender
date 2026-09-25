import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { campaignsApi, ApiError, SchemaCampaign } from "../lib/apiClient";
import { LoadingSpinner, ErrorBanner, StatusBadge, toPersianDigits, formatDateTime } from "../components/Primitives";
import { Button } from "../components/Form";

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<SchemaCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await campaignsApi.get(id);
      setCampaign(res.campaign);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات کمپین.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // وقتی کمپین در حال اجراست، پیشرفت واقعی را هر ۳ ثانیه دوباره می‌خوانیم
  useEffect(() => {
    if (campaign?.status !== "running") return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [campaign?.status, load]);

  async function runAction(action: "start" | "pause" | "resume" | "cancel") {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await campaignsApi[action](id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "خطا در انجام عملیات.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <LoadingSpinner label="در حال بارگذاری کمپین..." />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!campaign) return null;

  const progress = campaign.progress;
  const status = campaign.status ?? "draft";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/campaigns" className="text-sm text-inkmuted hover:text-ink">
          ← بازگشت به کمپین‌ها
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-bold text-ink">{campaign.name || campaign.product?.name || "کمپین"}</h1>
          <StatusBadge status={status} />
        </div>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      <div className="rounded-xl border border-line bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-inkmuted">پیشرفت ارسال</span>
          <span className="text-sm font-medium text-ink">{toPersianDigits(progress?.percentage ?? 0)}٪</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper2">
          <div className="h-full rounded-full bg-pine transition-all" style={{ width: `${progress?.percentage ?? 0}%` }} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-5">
          <MiniStat label="کل" value={progress?.total} />
          <MiniStat label="ارسال‌شده" value={progress?.processed} />
          <MiniStat label="موفق" value={progress?.successful} tone="pine" />
          <MiniStat label="ناموفق" value={progress?.failed} tone="brick" />
          <MiniStat label="باقیمانده" value={progress?.pending} tone="amber" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          {status === "draft" && (
            <Button onClick={() => runAction("start")} disabled={actionLoading}>
              شروع ارسال
            </Button>
          )}
          {status === "running" && (
            <Button variant="secondary" onClick={() => runAction("pause")} disabled={actionLoading}>
              توقف موقت
            </Button>
          )}
          {status === "paused" && (
            <Button onClick={() => runAction("resume")} disabled={actionLoading}>
              ادامه ارسال
            </Button>
          )}
          {(status === "running" || status === "paused" || status === "draft") && (
            <Button variant="danger" onClick={() => runAction("cancel")} disabled={actionLoading}>
              لغو کمپین
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-inkmuted">
        <p>ساخته‌شده: {formatDateTime(campaign.createdAt)}</p>
        <p>شروع: {formatDateTime(campaign.startedAt)}</p>
        <p>پایان: {formatDateTime(campaign.completedAt)}</p>
        <p>لغو: {formatDateTime(campaign.cancelledAt)}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value?: number; tone?: "pine" | "amber" | "brick" }) {
  const toneClass = tone === "pine" ? "text-pine-dark" : tone === "amber" ? "text-amber" : tone === "brick" ? "text-brick" : "text-ink";
  return (
    <div>
      <p className="text-xs text-inkmuted">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${toneClass}`}>{toPersianDigits(value ?? 0)}</p>
    </div>
  );
}
