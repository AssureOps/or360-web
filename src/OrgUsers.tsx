// src/OrgUsers.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { useOrg } from "./OrgContext";
import { Plus, Mail, ShieldCheck, Trash2, User } from "lucide-react";

type Member = {
  id: string;
  org_id: string;
  user_email: string;
  role: string | null;
  status?: string | null;
  created_at?: string | null;
};

const ROLES = ["admin", "manager", "member", "viewer"] as const;

export default function OrgUsers() {
  const { orgId, orgs } = useOrg();
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("member");

  const orgName = useMemo(() => orgs.find(o => o.id === orgId)?.name ?? "All", [orgs, orgId]);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      // Expecting a table like: org_members(id, org_id, user_email, role, status, created_at)
      const { data, error } = await supabase
        .from("org_members")
        .select("id, org_id, user_email, role, status, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data || []) as Member[]);
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
      const { data, error } = await supabase
        .from("org_members")
        .insert([{ org_id: orgId, user_email: email.trim(), role, status: "invited" }])
        .select("id, org_id, user_email, role, status, created_at")
        .single();
      if (error) throw error;
      setRows(r => [data as Member, ...r]);
      setEmail("");
      setRole("member");
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(id: string, newRole: string) {
    try {
      const { error } = await supabase.from("org_members").update({ role: newRole }).eq("id", id);
      if (error) throw error;
      setRows(r => r.map(x => (x.id === id ? { ...x, role: newRole } : x)));
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function removeMember(id: string) {
    try {
      const { error } = await supabase.from("org_members").delete().eq("id", id);
      if (error) throw error;
      setRows(r => r.filter(x => x.id !== id));
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  if (!orgId) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-xl font-semibold mb-2">Org Users</h1>
        <p className="text-slate-600">Select an organisation in the sidebar to manage its users.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Org Users — <span className="text-slate-500">{orgName}</span></h1>
        <div className="text-sm text-slate-500">{rows.length} members</div>
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
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
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
            {rows.map(m => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-slate-200 grid place-items-center">
                      <User size={14} />
                    </div>
                    <div className="font-medium">{m.user_email}</div>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    value={m.role || "member"}
                    onChange={(e) => updateRole(m.id, e.target.value)}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-slate-600">{m.status || "active"}</td>
                <td className="px-4 py-2 text-slate-600">{m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => removeMember(m.id)}
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
    </div>
  );
}
