import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { conversationsApi } from "../lib/apiClient";
import { toPersianDigits } from "./Primitives";

const NAV_ITEMS = [
  { to: "/dashboard", label: "داشبورد" },
  { to: "/products", label: "محصولات" },
  { to: "/contacts", label: "مخاطبین" },
  { to: "/campaigns", label: "کمپین‌ها" },
  { to: "/conversations/active", label: "مکالمات فعال" },
  { to: "/conversations/waiting", label: "منتظر پاسخ من", badgeKey: "waiting" as const },
  { to: "/orders", label: "سفارش‌ها" },
  { to: "/api-keys", label: "کلیدهای API" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [waitingCount, setWaitingCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadWaitingCount() {
      try {
        const res = await conversationsApi.waiting();
        if (!cancelled) setWaitingCount(res.data.length);
      } catch {
        /* اگر شکست خورد، فقط نشان نمایش داده نمی‌شود؛ باعث کرش صفحه نمی‌شود */
      }
    }
    loadWaitingCount();
    const interval = setInterval(loadWaitingCount, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-l border-line bg-white md:flex">
        <div className="border-b border-line px-5 py-5">
          <p className="text-base font-bold text-pine-dark">پنل فروش بله</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-pine-light text-pine-dark" : "text-inkmuted hover:bg-paper2 hover:text-ink"
                }`
              }
            >
              <span>{item.label}</span>
              {item.badgeKey === "waiting" && !!waitingCount && (
                <span className="rounded-full bg-amber px-2 py-0.5 text-xs font-semibold text-white">{toPersianDigits(waitingCount)}</span>
              )}
            </NavLink>
          ))}
          {user?.isOwner && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="px-3 pb-2 text-xs font-medium text-inkmuted">مدیریت پلتفرم</p>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-pine-light text-pine-dark" : "text-inkmuted hover:bg-paper2 hover:text-ink"}`}
              >
                کاربران
              </NavLink>
              <NavLink
                to="/admin/api-keys"
                className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-pine-light text-pine-dark" : "text-inkmuted hover:bg-paper2 hover:text-ink"}`}
              >
                کلیدهای API همه
              </NavLink>
              <NavLink
                to="/admin/activity"
                className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-pine-light text-pine-dark" : "text-inkmuted hover:bg-paper2 hover:text-ink"}`}
              >
                لاگ فعالیت
              </NavLink>
            </div>
          )}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:px-8">
          <MobileNav waitingCount={waitingCount} isOwner={!!user?.isOwner} />
          <div className="flex items-center gap-3">
            <span className="text-sm text-inkmuted">{user?.email}</span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-inkmuted hover:bg-paper2 hover:text-ink"
            >
              خروج
            </button>
          </div>
        </header>
        <main className="flex-1 bg-paper px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function MobileNav({ waitingCount, isOwner }: { waitingCount: number | null; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg border border-line p-2" aria-label="منو">
        ☰
      </button>
      {open && (
        <div className="absolute right-4 top-14 z-40 w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink hover:bg-paper2"
            >
              <span>{item.label}</span>
              {item.badgeKey === "waiting" && !!waitingCount && (
                <span className="rounded-full bg-amber px-2 py-0.5 text-xs font-semibold text-white">{toPersianDigits(waitingCount)}</span>
              )}
            </NavLink>
          ))}
          {isOwner && (
            <NavLink to="/admin/users" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-paper2">
              مدیریت پلتفرم
            </NavLink>
          )}
        </div>
      )}
    </div>
  );
}
