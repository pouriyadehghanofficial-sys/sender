import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/apiClient";
import { Button, Field, TextInput } from "../components/Form";
import { ErrorBanner } from "../components/Primitives";

export function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در اتصال به سرور.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-8 shadow-card">
        <h1 className="mb-1 text-xl font-bold text-pine-dark">ورود به پنل</h1>
        <p className="mb-6 text-sm text-inkmuted">با ایمیل و رمز عبور حساب کسب‌وکارتان وارد شوید.</p>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <form onSubmit={onSubmit}>
          <Field label="ایمیل">
            <TextInput type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="shop@example.com" />
          </Field>
          <Field label="رمز عبور">
            <TextInput type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? "در حال ورود..." : "ورود"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-inkmuted">
          حساب ندارید؟{" "}
          <Link to="/register" className="font-medium text-pine hover:underline">
            ثبت‌نام کنید
          </Link>
        </p>
      </div>
    </div>
  );
}
