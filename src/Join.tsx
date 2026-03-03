// src/Join.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "./lib/supabase";

export default function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orgId = params.get("org_id");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // 1️⃣ Exchange invite token for session
  useEffect(() => {
    (async () => {
      const hash = window.location.hash;

      // If Supabase returned an error (expired/invalid token)
      if (hash.includes("error=")) {
        setError("Invite link is invalid or has expired. Please request a new invite.");
        return;
      }

      // Try exchanging code for session (PKCE flow safe)
      try {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch {}

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSessionReady(true);
      } else {
        setError("No valid session found. Please use a fresh invite link.");
      }
    })();
  }, []);

  async function handleActivate() {
    if (!sessionReady) return;
    if (!password || password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 2️⃣ Set password
      const { error: pwErr } = await supabase.auth.updateUser({
        password,
      });
      if (pwErr) throw pwErr;

      // 3️⃣ Accept org invite
      if (orgId) {
        const { error: rpcErr } = await supabase.rpc("accept_org_invite", {
          p_org_id: orgId,
        });
        if (rpcErr) throw rpcErr;
      }

      // 4️⃣ Redirect to projects
      navigate("/projects", { replace: true });
    } catch (e: any) {
      setError(e?.message ?? "Activation failed.");
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="p-10 text-center">
        <div className="text-red-600 font-medium mb-4">{error}</div>
        <button
          onClick={() => navigate("/login")}
          className="px-4 py-2 bg-slate-900 text-white rounded"
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow">
        <h1 className="text-lg font-semibold mb-4">Activate your account</h1>

        <input
          type="password"
          placeholder="New password"
          className="w-full mb-3 rounded border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirm password"
          className="w-full mb-4 rounded border px-3 py-2"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button
          onClick={handleActivate}
          disabled={loading || !sessionReady}
          className="w-full rounded bg-slate-900 text-white py-2 disabled:opacity-50"
        >
          {loading ? "Activating..." : "Activate account"}
        </button>
      </div>
    </div>
  );
}