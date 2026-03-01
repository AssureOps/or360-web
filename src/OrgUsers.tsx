// src/OrgUsers.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { useOrg } from "./OrgContext";
import { Plus, Mail, ShieldCheck, Trash2, User } from "lucide-react";

type Member = {
  id: string;
  org_id: string;
  user_id?: string | null;
  user_email: string | null;
  role: string | null;
  status?: string | null;
  created_at?: string | null;
};

const ROLES = ["owner", "admin", "member", "viewer"] as const;

export default function OrgUsers() {
  const { orgId, orgs } = useOrg();
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("member");
  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: string | null; email: string | null }>({ id: null, email: null });
const [myMembership, setMyMembership] = useState<{ role: string | null; status: string | null } | null>(null);

  const orgName = useMemo(
    () => orgs.find((o) => o.id === orgId)?.name ?? "All",
    [orgs, orgId]
  );

useEffect(() => {
  (async () => {
    const { data: u } = await supabase.auth.getUser();
    const user = u.user;
    setMe({ id: user?.id ?? null, email: user?.email ?? null });

    if (!orgId || !user?.id) {
      setMyMembership(null);
      return;
    }

    const { data, error } = await supabase
      .from("org_members")
      .select("role,status")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[OrgUsers] membership lookup error:", error.message);
      setMyMembership(null);
      return;
    }

    setMyMembership(data ?? null);
  })();
}, [orgId]);

useEffect(() => {
  (async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("[OrgUsers] getUser error:", error.message);
      setMeEmail(null);
      return;
    }
    setMeEmail(data.user?.email ?? null);
  })();
}, []);


useEffect(() => {
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    setMeEmail(session?.user?.email ?? null);
  });
  return () => sub.subscription.unsubscribe();
}, []);


useEffect(() => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setMeEmail(session?.user?.email ?? null);
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id,user_id,user_email,role,status,created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Supabase may not include a synthetic id if table pk is (org_id,user_id)
      // We'll create a stable key below.
      const list = (data || []).map((m: any) => ({
        ...m,
        id: `${m.org_id}:${m.user_id ?? m.user_email ?? Math.random().toString(36)}`,
      }));
      setRows(list as Member[]);
    } catch (e: any) {
      setError(e.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

 async function invite() {
  if (!orgId || !email.trim()) return;
  setLoading(true);
  setError(null);
  try {
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { org_id: orgId, email: email.trim(), role },
    });

    if (error) {
  // @ts-expect-error Supabase hides this in typings
  const ctx = error.context;

  let parsed: any = null;

  try {
    const raw =
      ctx?.body == null
        ? ""
        : typeof ctx.body === "string"
          ? ctx.body
          : await new Response(ctx.body).text(); // ✅ handles ReadableStream

    parsed = raw ? JSON.parse(raw) : null;
  } catch (e) {
    // if it isn't JSON
    parsed = { raw: String(e) };
  }

  console.error("[invite-user] status:", ctx?.status);
  console.error("[invite-user] parsed body:", parsed);

  throw new Error(parsed?.error || parsed?.message || error.message);
}

    if (data && (data as any).ok !== true) {
      throw new Error((data as any).error || "Invite failed");
    }

    setEmail("");
    setRole("member");
    await load();
  } catch (e: any) {
    setError(e.message || String(e));
  } finally {
    setLoading(false);
  }
}

  async function updateRole(user_id: string | null | undefined, user_email: string | null, newRole: string) {
    try {
      // Admin action should be enforced by RLS (is_org_admin), but this update will only work if your RLS allows it.
      // If you lock down org_members writes more strictly, move this to an Edge Function too.
      if (!orgId) return;
      let q = supabase.from("org_members").update({ role: newRole }).eq("org_id", orgId);
      if (user_id) q = q.eq("user_id", user_id);
      else if (user_email) q = q.eq("user_email", user_email);
      const { error } = await q;
      if (error) throw error;
      setRows((r) =>
        r.map((x) =>
          (x.user_id === user_id && x.org_id === orgId) || (x.user_email === user_email && x.org_id === orgId)
            ? { ...x, role: newRole }
            : x
        )
      );
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function removeMember(user_id: string | null | undefined, user_email: string | null) {
    try {
      if (!orgId) return;
      let q = supabase.from("org_members").delete().eq("org_id", orgId);
      if (user_id) q = q.eq("user_id", user_id);
      else if (user_email) q = q.eq("user_email", user_email);
      const { error } = await q;
      if (error) throw error;
      setRows((r) => r.filter((x) => !((x.user_id === user_id && x.org_id === orgId) || (x.user_email === user_email && x.org_id === orgId))));
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  if (!orgId) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-xl font-semibold mb-2">Org Users</h1>
        <p className="text-slate-600">
          Select an organisation in the sidebar to manage its users.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          Org Users — <span className="text-slate-500">{orgName}</span>
        </h1>
        <div className="text-right">
			
  
  
  <div className="text-right">
  <div className="text-sm text-slate-500">{rows.length} members</div>
  <div className="text-xs text-slate-500">
    Signed in as: <span className="font-medium text-slate-700">{me.email ?? "unknown"}</span>
  </div>
  <div className="text-xs text-slate-500">
    My role:{" "}
    <span className="font-medium text-slate-700">
      {myMembership?.role ?? "none"}
    </span>{" "}
    · Status:{" "}
    <span className="font-medium text-slate-700">
      {myMembership?.status ?? "none"}
    </span>
  </div>
</div>
  
  
</div>
      </div>

      {/* Invite form */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className="block text-xs text-slate-600 mb-1">Email address</label>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-slate-500" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Role</label>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-slate-500" />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <button
              onClick={invite}
              disabled={loading || !email.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus size={16} /> Invite
            </button>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-rose-600">Error: {error}</div>}
      </div>

      {/* Members table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left font-medium">User</th>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Added</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  No members yet. Invite someone above.
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-slate-200 grid place-items-center">
                      <User size={14} />
                    </div>
                    <div className="font-medium">{m.user_email ?? "—"}</div>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    value={m.role || "member"}
                    onChange={(e) => updateRole(m.user_id, m.user_email, e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-slate-600">{m.status || "active"}</td>
                <td className="px-4 py-2 text-slate-600">
                  {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => removeMember(m.user_id, m.user_email)}
                    className="inline-flex items-center gap-2 rounded-md bg-rose-50 px-2 py-1 text-rose-700 hover:bg-rose-100"
                    title="Remove member"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Invites send an email with a link to OR-360’s <code>/join</code> page.
      </div>
    </div>
  );
}
