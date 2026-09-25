/** پلیفیل ساده‌ی localStorage برای Node — فقط برای اسکریپت‌های تست، هرگز در build مرورگر استفاده نمی‌شود */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

(globalThis as any).localStorage = new MemoryStorage();
