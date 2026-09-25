import { Queue, Worker, Job } from "bullmq";
import { isQueueEnabled, getRedisConnection } from "./queueConnection";

const QUEUE_NAME = "reply-debounce";
let queue: Queue | null = null;
let worker: Worker | null = null;

function getQueue(): Queue {
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
  return queue;
}

/**
 * جایگزین تایمر درون‌حافظه‌ای وقتی REDIS_URL تنظیم شده: هر بار با پیام جدید صدا
 * زده می‌شود؛ job قبلیِ همین chatId (اگر هنوز اجرا نشده) حذف و با delay کامل دوباره
 * اضافه می‌شود — یعنی همان رفتار «debounce» قبلی، با این تفاوت که روی ری‌استارت
 * سرور هم دوام می‌آورد (چون در Redis ذخیره است، نه در حافظه‌ی پردازه).
 */
export async function enqueueDebouncedReply(chatId: string, delayMs: number) {
  const q = getQueue();
  const existing = await q.getJob(chatId);
  if (existing) {
    const state = await existing.getState();
    if (state === "delayed" || state === "waiting") await existing.remove().catch(() => undefined);
  }
  await q.add("reply", { chatId }, { jobId: chatId, delay: delayMs, removeOnComplete: true, removeOnFail: true });
}

/** Worker صف پاسخ؛ فقط وقتی REDIS_URL تنظیم شده باشد فعال می‌شود (یک‌بار، در index.ts) */
export function startReplyQueueWorker(handler: (chatId: string) => Promise<void>) {
  if (!isQueueEnabled || worker) return;
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      await handler(job.data.chatId);
    },
    { connection: getRedisConnection(), concurrency: Number(process.env.AI_MAX_CONCURRENCY) || 5 }
  );
  worker.on("failed", (job, err) => console.error(`[reply-queue] خطا برای chatId=${job?.data?.chatId}:`, err.message));
  console.log("[reply-queue] Worker صف پاسخ (Redis/BullMQ) فعال شد.");
}
