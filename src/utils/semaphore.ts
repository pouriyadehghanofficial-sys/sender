/**
 * محدودکننده‌ی هم‌زمانی: حداکثر `max` کار به‌صورت هم‌زمان اجرا می‌شود و بقیه در صف می‌مانند.
 * برای اینکه وقتی صدها کاربر هم‌زمان پیام می‌دهند، سرویس AI (و rate limit آن) زیر بار
 * ناگهانی نرود و درخواست‌ها به‌جای شکست خوردن، نوبتی پردازش شوند.
 */
export class Semaphore {
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release() {
    const next = this.waiters.shift();
    if (next) next(); // نوبت را مستقیم به نفر بعدی می‌دهیم (active تغییر نمی‌کند)
    else this.active--;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
