"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeUploadPreview = storeUploadPreview;
exports.getUploadPreview = getUploadPreview;
exports.deleteUploadPreview = deleteUploadPreview;
const crypto_1 = __importDefault(require("crypto"));
const TTL_MS = 15 * 60 * 1000; // ۱۵ دقیقه
const store = new Map();
function cleanupExpired() {
    const now = Date.now();
    for (const [token, entry] of store.entries()) {
        if (now - entry.createdAt > TTL_MS)
            store.delete(token);
    }
}
/**
 * توجه: این کش درون‌حافظه‌ای (in-memory) است و فقط برای اجرای تک-پردازه (single instance)
 * مناسب است. اگر پروژه را روی چند نمونه (instance) همزمان دیپلوی می‌کنید، این بخش را
 * با یک جدول موقت در دیتابیس یا Redis جایگزین کنید.
 */
function storeUploadPreview(columns, allRows) {
    cleanupExpired();
    const token = crypto_1.default.randomUUID();
    store.set(token, { allRows, columns, createdAt: Date.now() });
    return token;
}
function getUploadPreview(token) {
    cleanupExpired();
    return store.get(token) ?? null;
}
function deleteUploadPreview(token) {
    store.delete(token);
}
