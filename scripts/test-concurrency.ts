import { runExclusive } from "../src/utils/chatMutex";
import { isRateLimited } from "../src/utils/rateLimiter";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testMutex() {
  console.log("--- تست ۱: runExclusive باید پیام‌های یک chatId را ترتیبی پردازش کند ---");
  const events: string[] = [];

  async function fakeProcessMessage(chatId: string, msgNum: number) {
    return runExclusive(chatId, async () => {
      events.push(`start:${chatId}:${msgNum}`);
      await sleep(50); // شبیه‌سازی زمان پردازش (فراخوانی AI و ...)
      events.push(`end:${chatId}:${msgNum}`);
    });
  }

  // سه پیام «همزمان» از همان کاربر (chatId=A) — باید ترتیبی اجرا شوند
  await Promise.all([
    fakeProcessMessage("A", 1),
    fakeProcessMessage("A", 2),
    fakeProcessMessage("A", 3),
  ]);

  console.log("ترتیب رویدادها برای chatId=A:", events);

  const expectedOrder = [
    "start:A:1", "end:A:1",
    "start:A:2", "end:A:2",
    "start:A:3", "end:A:3",
  ];
  const strictlySequential = JSON.stringify(events) === JSON.stringify(expectedOrder);

  console.log((strictlySequential ? "✅" : "❌") + " پیام‌های یک chatId کاملاً ترتیبی پردازش شدند (بدون هم‌پوشانی)");
  return strictlySequential;
}

async function testMutexDifferentKeysNotBlocked() {
  console.log("\n--- تست ۲: chatId های متفاوت نباید یکدیگر را بلاک کنند ---");
  const order: string[] = [];

  const taskA = runExclusive("chatA", async () => {
    order.push("A-start");
    await sleep(100);
    order.push("A-end");
  });
  const taskB = runExclusive("chatB", async () => {
    order.push("B-start");
    await sleep(10);
    order.push("B-end");
  });

  await Promise.all([taskA, taskB]);
  console.log("ترتیب رویدادها (دو chatId متفاوت):", order);

  // چون B سریع‌تر است و مستقل از A، باید B-end قبل از A-end تمام شود (یعنی بلاک نشده)
  const bFinishedBeforeA = order.indexOf("B-end") < order.indexOf("A-end");
  console.log((bFinishedBeforeA ? "✅" : "❌") + " دو chatId مستقل، موازی اجرا شدند (یکی منتظر دیگری نماند)");
  return bFinishedBeforeA;
}

async function testRateLimiter() {
  console.log("\n--- تست ۳: isRateLimited باید بعد از سقف، جلوی درخواست را بگیرد ---");
  const key = "test-chat-rate";
  const maxCalls = 3;
  const windowMs = 300;

  const results: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    results.push(isRateLimited(key, maxCalls, windowMs));
  }
  console.log("نتیجه ۵ فراخوانی پشت‌سرهم (limited=true یعنی رد شد):", results);

  const firstThreeAllowed = results.slice(0, 3).every((r) => r === false);
  const nextTwoBlocked = results.slice(3).every((r) => r === true);

  console.log((firstThreeAllowed ? "✅" : "❌") + " ۳ درخواست اول مجاز بودند");
  console.log((nextTwoBlocked ? "✅" : "❌") + " درخواست‌های بعد از سقف مسدود شدند");

  console.log("در حال صبر برای اتمام پنجره زمانی...");
  await sleep(windowMs + 50);
  const afterWindow = isRateLimited(key, maxCalls, windowMs);
  console.log((!afterWindow ? "✅" : "❌") + " بعد از اتمام پنجره، دوباره مجاز شد");

  return firstThreeAllowed && nextTwoBlocked && !afterWindow;
}

async function main() {
  console.log("=== تست: قفل ترتیبی و محدودیت نرخ (سخت‌سازی امنیتی) ===\n");
  const r1 = await testMutex();
  const r2 = await testMutexDifferentKeysNotBlocked();
  const r3 = await testRateLimiter();

  const allPass = r1 && r2 && r3;
  console.log("\n" + (allPass ? "✅ همه‌ی تست‌ها پاس شدند." : "❌ برخی تست‌ها ناموفق بودند."));
  if (!allPass) process.exitCode = 1;
}

main();
