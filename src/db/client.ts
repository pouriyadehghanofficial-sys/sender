import { PrismaClient } from "@prisma/client";

// یک نمونه واحد از PrismaClient در کل برنامه استفاده می‌شود
// تا در حالت dev با hot-reload چندین اتصال دیتابیس باز نشود.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
