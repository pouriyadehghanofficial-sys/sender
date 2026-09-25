import crypto from "crypto";

interface CacheEntry {
  allRows: string[][];
  columns: string[];
  createdAt: number;
}

const TTL_MS = 15 * 60 * 1000; // ۱۵ دقیقه
const store = new Map<string, CacheEntry>();

function cleanupExpired() {
  const now = Date.now();
  for (const [token, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) store.delete(token);
  }
}

/**
 * توجه: این کش درون‌حافظه‌ای (in-memory) است و فقط برای اجرای تک-پردازه (single instance)
 * مناسب است. اگر پروژه را روی چند نمونه (instance) همزمان دیپلوی می‌کنید، این بخش را
 * با یک جدول موقت در دیتابیس یا Redis جایگزین کنید.
 */
export function storeUploadPreview(columns: string[], allRows: string[][]): string {
  cleanupExpired();
  const token = crypto.randomUUID();
  store.set(token, { allRows, columns, createdAt: Date.now() });
  return token;
}

export function getUploadPreview(token: string): CacheEntry | null {
  cleanupExpired();
  return store.get(token) ?? null;
}

export function deleteUploadPreview(token: string): void {
  store.delete(token);
}
