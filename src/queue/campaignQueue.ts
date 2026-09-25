import { Queue, Worker, Job } from "bullmq";
import { isQueueEnabled, getRedisConnection } from "./queueConnection";

export const isCampaignQueueEnabled = isQueueEnabled;

const QUEUE_NAME = "campaign-send";
let queue: Queue | null = null;
let worker: Worker | null = null;

export interface CampaignSendJobData {
  productId: string;
  contactId: string;
  introText: string;
  photoUrl?: string;
}

function getQueue(): Queue {
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
  return queue;
}

/**
 * به‌جای حلقه‌ی ساده‌ی درون‌پردازه‌ای، همه‌ی مخاطبین pending یک کمپین به‌صورت job
 * جداگانه به صف اضافه می‌شوند. مزیت نسبت به حلقه‌ی ساده: ماندگاری کامل در Redis
 * (حتی اگر سرور در وسط کار کاملاً از بین برود و دیگر خودش را resume نکند، صف باقی
 * می‌ماند)، کنترل نرخ ارسال با limiter داخلی Worker، و توزیع بار بین چند نمونه سرور.
 */
export async function enqueuePendingContactsForCampaign(
  productId: string,
  contactIds: string[],
  introText: string,
  photoUrl?: string
) {
  if (contactIds.length === 0) return;
  const q = getQueue();
  const jobs = contactIds.map((contactId) => ({
    name: "send",
    data: { productId, contactId, introText, photoUrl } as CampaignSendJobData,
    opts: { jobId: `${productId}:${contactId}`, removeOnComplete: true, removeOnFail: 200 },
  }));
  await q.addBulk(jobs);
  console.log(`[campaign-queue] ${jobs.length} مخاطب برای محصول ${productId} به صف Redis اضافه شد.`);
}

/**
 * Worker صف ارسال کمپین؛ فقط وقتی REDIS_URL تنظیم شده باشد فعال می‌شود (یک‌بار، در index.ts).
 * `limiter` نرخ ارسال کلی را کنترل می‌کند (هماهنگ با DELAY_BETWEEN_MESSAGES_MS قبلی).
 */
export function startCampaignQueueWorker(handler: (data: CampaignSendJobData) => Promise<unknown>) {
  if (!isQueueEnabled || worker) return;
  worker = new Worker(QUEUE_NAME, async (job: Job) => handler(job.data as CampaignSendJobData), {
    connection: getRedisConnection(),
    concurrency: 3,
    limiter: { max: 1, duration: 1500 },
  });
  worker.on("failed", (job, err) =>
    console.error(`[campaign-queue] خطا برای contactId=${job?.data?.contactId}:`, err.message)
  );
  console.log("[campaign-queue] Worker صف ارسال کمپین (Redis/BullMQ) فعال شد.");
}
