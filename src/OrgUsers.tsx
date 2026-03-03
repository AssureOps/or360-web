// src/OrgUsers.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { useOrg } from "./OrgContext";
import { Plus, Mail, ShieldCheck, Trash2, User } from "lucide-react";

type Member = {
  id: string; // synthetic key for UI
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

  const [me, setMe] = useState<{ id: string | null; email: string | null }>({
    id: null,
    email: null,
  });

  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [myMembership, setMyMembership] = useState<{
    role: string | null;
    status: string | null;
  } | null>(null);

  const orgName = useMemo(
    () => orgs.find((o) => o.id === orgId)?.name ?? "—",
    [orgs, orgId]
  );

  const canManageMembers =
    isSuperadmin ||
    myMembership?.role === "owner" ||
    myMembership?.role === "admin";

  // Load current user once
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.warn("[OrgUsers] getUser error:", error.message);
        setMe({ id: null, email: null });
        return;
      }
      setMe({ id: data.user?.id ?? null, email: data.user?.email ?? null });
    })();
  }, []);

  // Superadmin check (uses your public.is_superadmin() function)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc("is_superadmin");
        setIsSuperadmin(Boolean(data));
      } catch {
        setIsSuperadmin(false);
      }
    })();
  }, []);

  // Load my membership in the selected org
  useEffect(() => {
    (async () => {
      if (!orgId || !me.id) {
        setMyMembership(null);
        return;
      }

      const { data, error } = await supabase
        .from("org_members")
        .select("role,status")
        .eq("org_id", orgId)
        .eq("user_id", me.id)
        .maybeSingle();

      if (error) {
        console.warn("[OrgUsers] membership lookup error:", error.message);
        setMyMembership(null);
        return;
      }

      setMyMembership(data ?? null);
    })();
  }, [orgId, me.id]);

  async function loadMembers() {
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

      // Synthetic id for stable React keys (pk may be (org_id,user_id))
      const list = (data || []).map((m: any) => ({
        ...m,
        id: `${m.org_id}:${m.user_id ?? m.user_email ?? Math.random().toString(36)}`,
      }));

      setRows(list as Member[]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function invite() {
    if (!orgId || !email.trim()) return;
    if (!canManageMembers) {
      setError("You don’t have permission to invite members for this organisation.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { org_id: orgId, email: email.trim(), role },
      });

      if (error) {
        // Stream-safe parse of edge function error body
        const ctx = (error as any).context;
        let parsed: any = null;

        try {
          const raw =
            ctx?.body == null
              ? ""
              : typeof ctx.body === "string"
              ? ctx.body
              : await new Response(ctx.body).text();

          parsed = raw ? JSON.parse(raw) : null;
        } catch (e) {
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
      await loadMembers();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(
    user_id: string | null | undefined,
    user_email: string | null,
    newRole: string
  ) {
    if (!orgId) return;

    if (!canManageMembers) {
      setError("You don’t have permission to change member roles for this organisation.");
      return;
    }

    try {
      let q = supabase
        .from("org_members")
        .update({ role: newRole })
        .eq("org_id", orgId);

      if (user_id) q = q.eq("user_id", user_id);
      else if (user_email) q = q.eq("user_email", user_email);

      const { error } = await q;
      if (error) throw error;

      setRows((r) =>
        r.map((x) =>
          (x.user_id === user_id && x.org_id === orgId) ||
          (x.user_email === user_email && x.org_id === orgId)
            ? { ...x, role: newRole }
            : x
        )
      );
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function removeMember(
    user_id: string | null | undefined,
    user_email: string | null
  ) {
    if (!orgId) return;

    if (!canManageMembers) {
      setError("You don’t have permission to remove members for this organisation.");
      return;
    }

    try {
      let q = supabase.from("org_members").delete().eq("org_id", orgId);

      if (user_id) q = q.eq("user_id", user_id);
      else if (user_email) q = q.eq("user_email", user_email);

      const { error } = await q;
      if (error) throw error;

      setRows((r) =>
        r.filter(
          (x) =>
            !(
              (x.user_id === user_id && x.org_id === orgId) ||
              (x.user_email === user_email && x.org_id === orgId)
            )
        )
      );
    } catch (e: any) {
      setError(e?.message ?? String(e));
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

        <div className="text-right space-y-1">
          <div className="text-sm text-slate-500">{rows.length} members</div>
          <div className="text-xs text-slate-500">
            Signed in as:{" "}
            <span className="font-medium text-slate-700">
              {me.email ?? "unknown"}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            My role:{" "}
            <span className="font-medium text-slate-700">
              {myMembership?.role ?? "none"}
            </span>{" "}
            · Superadmin:{" "}
            <span className="font-medium text-slate-700">
              {isSuperadmin ? "true" : "false"}
            </span>
          </div>
        </div>
      </div>

      {!canManageMembers && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          You can view members, but you don’t have permission to invite, change roles, or remove users.
        </div>
      )}

      {/* Invite form */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className="block text-xs text-slate-600 mb-1">
              Email address
            </label>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-slate-500" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canManageMembers}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Role</label>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-slate-500" />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                disabled={!canManageMembers}
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
              disabled={loading || !email.trim() || !canManageMembers}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus size={16} /> Invite
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-sm text-rose-600">Error: {error}</div>
        )}
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
                  No members yet.
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
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
                    value={m.role || "member"}
                    disabled={!canManageMembers}
                    onChange={(e) =>
                      updateRole(m.user_id, m.user_email, e.target.value)
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-2 text-slate-600">
                  {m.status || "active"}
                </td>

                <td className="px-4 py-2 text-slate-600">
                  {m.created_at
                    ? new Date(m.created_at).toLocaleDateString()
                    : "—"}
                </td>

                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => removeMember(m.user_id, m.user_email)}
                    disabled={!canManageMembers}
                    className="inline-flex items-center gap-2 rounded-md bg-rose-50 px-2 py-1 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
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