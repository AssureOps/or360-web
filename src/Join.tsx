import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "./lib/supabase";

function parseHashParams() {
  // window.location.hash looks like: "#access_token=...&refresh_token=...&type=invite"
  const raw = window.location.hash?.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash || "";
  const sp = new URLSearchParams(raw);
  return {
    access_token: sp.get("access_token") || "",
    refresh_token: sp.get("refresh_token") || "",
    expires_at: sp.get("expires_at") || "",
    token_type: sp.get("token_type") || "",
    type: sp.get("type") || "",
  };
}

export default function Join() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  // Query-string invite format
  const token_hash = params.get("token_hash") || "";
  const type_qs = params.get("type") || "";

  // Local email invite format (hash fragment)
  const hash = parseHashParams();
  const type_hash = hash.type || "";

  // Your org id comes from redirectTo .../join?org_id=...
  const org_id = params.get("org_id") || "";

  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  const inviteType = type_qs || type_hash; // prefer querystring, fallback to hash

  const canProceed = useMemo(() => {
    const pwOk = password.length >= 8 && password === password2;
    const hasOrg = !!org_id;
    const hasInviteProof =
      (inviteType === "invite" && !!token_hash) ||
      (inviteType === "invite" && !!hash.access_token && !!hash.refresh_token);
    return pwOk && hasOrg && hasInviteProof;
  }, [password, password2, org_id, token_hash, inviteType, hash.access_token, hash.refresh_token]);

  useEffect(() => {
    (async () => {
      // If already signed in, go to app
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        nav("/projects", { replace: true });
        return;
      }
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function acceptInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!org_id) {
      setError("Invite link is missing org_id. Ask your admin to resend the invite.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }
    if (inviteType !== "invite") {
      setError("This link is not an invite link.");
      return;
    }

    setBusy(true);
    try {
      // 1) Establish a session
      if (token_hash) {
        // querystring token_hash format
        const { error: vErr } = await supabase.auth.verifyOtp({
          type: "invite",
          token_hash,
        });
        if (vErr) throw vErr;
      } else if (hash.access_token && hash.refresh_token) {
        // hash fragment format (local supabase often uses this)
        const { error: sErr } = await supabase.auth.setSession({
          access_token: hash.access_token,
          refresh_token: hash.refresh_token,
        });
        if (sErr) throw sErr;

        // Clean the hash so refreshes don't re-run session logic forever
        if (window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
      } else {
        throw new Error("Invite link is missing required token data.");
      }

      // 2) Set password
      const { error: pErr } = await supabase.auth.updateUser({ password });
      if (pErr) throw pErr;

      // 3) Activate org membership server-side
      const { data: fn, error: fnErr } = await supabase.functions.invoke("accept-invite", {
        body: { org_id },
      });
      if (fnErr) throw fnErr;
      if (fn && (fn as any).ok !== true) {
        throw new Error((fn as any).error || "Failed to activate membership.");
      }

      // 4) Done
      nav("/projects", { replace: true });
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

        <h1 className="text-xl font-semibold mb-1">Activate your account</h1>
        <p className="text-sm text-slate-600 mb-4">
          Set a password to finish accepting your invite.
        </p>

        {checking && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Checking session…
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={acceptInvite} className="space-y-3">
          <label className="block">
            <div className="text-xs text-slate-600 mb-1">New password</div>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              placeholder="At least 8 characters"
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-600 mb-1">Confirm password</div>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              value={password2}
              onChange={(e) => setPassword2(e.currentTarget.value)}
            />
          </label>

          <button
            type="submit"
            disabled={busy || !canProceed}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Activating…" : "Activate account"}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-500">
          If you already set a password, you can just sign in from the login screen.
        </div>
      </div>
    </div>
  );
}
