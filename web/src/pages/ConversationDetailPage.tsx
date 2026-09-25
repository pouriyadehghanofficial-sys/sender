import { FormEvent, useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { conversationsApi, ApiError, SchemaConversation } from "../lib/apiClient";
import { LoadingSpinner, ErrorBanner, formatDateTime } from "../components/Primitives";
import { Button, TextArea } from "../components/Form";

const SENDER_LABEL: Record<string, string> = { user: "مشتری", ai: "هوش مصنوعی", human: "شما" };

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<SchemaConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await conversationsApi.get(id);
      setConversation(res.conversation);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در دریافت مکالمه.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSendReply(e: FormEvent) {
    e.preventDefault();
    if (!id || !replyText.trim()) return;
    setSending(true);
    setActionError(null);
    try {
      await conversationsApi.reply(id, replyText.trim());
      setReplyText("");
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "خطا در ارسال پاسخ.");
    } finally {
      setSending(false);
    }
  }

  async function onResolve() {
    if (!id) return;
    setActionError(null);
    try {
      await conversationsApi.resolve(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "خطا در پایان دادن به ارجاع.");
    }
  }

  if (loading) return <LoadingSpinner label="در حال بارگذاری مکالمه..." />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!conversation) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to={conversation.needsHuman ? "/conversations/waiting" : "/conversations/active"} className="text-sm text-inkmuted hover:text-ink">
        ← بازگشت
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink">{conversation.contact?.name ?? "مخاطب"}</h1>
          <p className="text-sm text-inkmuted">{conversation.contact?.phone}</p>
        </div>
        {conversation.needsHuman && (
          <Button variant="secondary" onClick={onResolve}>
            پایان ارجاع (برگرداندن به AI)
          </Button>
        )}
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl border border-line bg-white p-4">
        {conversation.messages && conversation.messages.length > 0 ? (
          conversation.messages.map((m) => (
            <div key={m.id} className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${m.sender === "user" ? "mr-auto bg-paper2 text-ink" : "ml-auto bg-pine-light text-pine-dark"}`}>
              <p className="mb-1 text-[11px] font-medium opacity-70">{SENDER_LABEL[m.sender ?? ""] ?? m.sender}</p>
              <p>{m.text}</p>
              <p className="mt-1 text-[10px] opacity-60">{formatDateTime(m.createdAt)}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-inkmuted">هنوز پیامی ثبت نشده.</p>
        )}
      </div>

      {conversation.needsHuman ? (
        <form onSubmit={onSendReply} className="flex gap-2">
          <TextArea rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="پاسخ خودتان را بنویسید..." className="flex-1" />
          <Button type="submit" disabled={sending || !replyText.trim()}>
            ارسال
          </Button>
        </form>
      ) : (
        <p className="rounded-lg bg-paper2 px-4 py-3 text-sm text-inkmuted">این مکالمه هنوز توسط هوش مصنوعی مدیریت می‌شود؛ پاسخ دستی فقط برای مکالمات ارجاع‌شده فعال است.</p>
      )}
    </div>
  );
}
