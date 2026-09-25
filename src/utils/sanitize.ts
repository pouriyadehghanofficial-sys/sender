export interface SafeUser {
  id: string;
  email: string;
  isOwner: boolean;
  isActive: boolean;
  createdAt: unknown;
}

export interface SafeApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: unknown;
  lastUsedAt: unknown;
}

/**
 * فقط فیلدهای صریحاً مجاز کاربر را برمی‌گرداند — passwordHash (و هر فیلد دیگری
 * که اضافه شود) هرگز اینجا کپی نمی‌شود چون whitelist است نه blacklist.
 * هیچ‌وقت به‌جایش از الگوی `const { passwordHash, ...rest } = user` استفاده نکنید؛
 * آن الگو یعنی هر فیلد جدیدی که بعداً به مدل User اضافه شود خودکار افشا می‌شود.
 */
export function toSafeUser(user: unknown): SafeUser | null {
  if (!user || typeof user !== "object") return null;
  const u = user as Record<string, unknown>;
  return {
    id: u.id as string,
    email: u.email as string,
    isOwner: Boolean(u.isOwner),
    isActive: Boolean(u.isActive),
    createdAt: u.createdAt,
  };
}

/** همان اصل whitelist برای ApiKey — keyHash هرگز اینجا کپی نمی‌شود */
export function toSafeApiKey(apiKey: unknown): SafeApiKey | null {
  if (!apiKey || typeof apiKey !== "object") return null;
  const k = apiKey as Record<string, unknown>;
  return {
    id: k.id as string,
    name: k.name as string,
    keyPrefix: k.keyPrefix as string,
    isActive: Boolean(k.isActive),
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
  };
}
