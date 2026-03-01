import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation() as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(() => loc?.state?.from || "/projects", [loc]);

  useEffect(() => {
    // If already signed in, bounce to app.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) nav(from, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      nav(from, { replace: true });
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <img src="/icon-32.png" alt="OR-360" className="h-8 w-8" />
          <div>
            <div className="text-sm text-slate-500">AssureOps</div>
            <div className="text-lg font-semibold leading-tight">OR-360</div>
          </div>
        </div>

        <h1 className="text-xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-slate-600 mb-4">
          Use your work email and password.
        </p>

        {error && (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={signIn} className="space-y-3">
          <label className="block">
            <div className="text-xs text-slate-600 mb-1">Email</div>
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="name@company.com"
              required
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-600 mb-1">Password</div>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
          </label>

          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-500">
          Have an invite?{" "}
          <Link to="/join" className="underline text-slate-700 hover:text-slate-900">
            Activate account
          </Link>
        </div>
      </div>
    </div>
  );
}
