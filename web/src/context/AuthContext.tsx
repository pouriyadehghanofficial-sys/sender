import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { authApi, setUnauthorizedHandler, SchemaUser } from "../lib/apiClient";
import { getToken, setToken, clearToken } from "../lib/auth";

interface AuthContextValue {
  user: SchemaUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_CACHE_KEY = "bale_dashboard_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<SchemaUser | null>(() => {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(false);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(USER_CACHE_KEY);
    setTokenState(null);
    setUser(null);
  }, []);

  // اگر سرور در هر درخواستی ۴۰۱ برگرداند (توکن منقضی/باطل)، همه‌جا بلافاصله خارج شویم
  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const persistSession = (t: string, u: SchemaUser) => {
    setToken(t);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
    setTokenState(t);
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      persistSession(res.token, res.user);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authApi.register(email, password);
      persistSession(res.token, res.user);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({ user, token, loading, login, register, logout }), [user, token, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth باید داخل AuthProvider استفاده شود.");
  return ctx;
}
