"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
/**
 * هر route async که این wrapper را نداشته باشد، اگر promise اش reject شود و
 * کسی catch نکند، در Node.js جدید (>=15) کل پردازه سرور کرش می‌کند
 * (unhandled promise rejection). این wrapper خطا را می‌گیرد و به Express error
 * middleware (در index.ts) پاس می‌دهد تا فقط همان یک درخواست با ۵۰۰ جواب بگیرد،
 * نه اینکه کل سرور و همه‌ی کاربران فعلی قطع شوند.
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
