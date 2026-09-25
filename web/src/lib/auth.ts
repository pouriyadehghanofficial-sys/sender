const TOKEN_KEY = "bale_dashboard_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * فقط برای تجربه‌ی کاربری (نمایش زودهنگام «نشست منقضی شد») استفاده می‌شود؛
 * اعتبار واقعی توکن همیشه توسط خودِ سرور در هر درخواست بررسی می‌شود.
 */
export function isJwtExpired(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false; // کلید API (نه JWT) فرمت متفاوتی دارد؛ فرض بر معتبر بودن
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}
