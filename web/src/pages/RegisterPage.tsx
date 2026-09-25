import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/apiClient";
import { Button, Field, TextInput } from "../components/Form";
import { ErrorBanner } from "../components/Primitives";

export function RegisterPage() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    try {
      await register(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در اتصال به سرور.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-8 shadow-card">
        <h1 className="mb-1 text-xl font-bold text-pine-dark">ساخت حساب جدید</h1>
        <p className="mb-6 text-sm text-inkmuted">اولین کسی که ثبت‌نام کند، مدیر کل پلتفرم می‌شود.</p>

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
            <TextInput type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="حداقل ۸ کاراکتر" />
          </Field>
          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? "در حال ساخت حساب..." : "ثبت‌نام"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-inkmuted">
          حساب دارید؟{" "}
          <Link to="/login" className="font-medium text-pine hover:underline">
            وارد شوید
          </Link>
        </p>
      </div>
    </div>
  );
}
