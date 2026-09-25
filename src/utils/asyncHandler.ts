import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * هر route async که این wrapper را نداشته باشد، اگر promise اش reject شود و
 * کسی catch نکند، در Node.js جدید (>=15) کل پردازه سرور کرش می‌کند
 * (unhandled promise rejection). این wrapper خطا را می‌گیرد و به Express error
 * middleware (در index.ts) پاس می‌دهد تا فقط همان یک درخواست با ۵۰۰ جواب بگیرد،
 * نه اینکه کل سرور و همه‌ی کاربران فعلی قطع شوند.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
