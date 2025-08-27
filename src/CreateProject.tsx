import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { useNavigate } from "react-router-dom";

type Org = { id: string; name: string };
type TemplateSet = { id: string; name: string; description?: string | null };

export default function CreateProject() {
  const nav = useNavigate();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [sets, setSets] = useState<TemplateSet[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [name, setName] = useState<string>("New Project");
  const [status, setStatus] = useState<string>("active");
  const [templateSetId, setTemplateSetId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

 useEffect(() => {
  (async () => {
    // 1) Ensure signed in (demo creds)
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) {
      const email = import.meta.env.VITE_DEMO_EMAIL as string;
      const password = import.meta.env.VITE_DEMO_PASSWORD as string;
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) { setErr(`Sign-in failed: ${signInErr.message}`); return; }
    }

    // 2) Get current user id (for filtering)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) { setErr("No auth user found."); return; }
    const uid = userData.user.id;

    // 3) Load orgs where THIS user is a member (inner join)
    const { data: orgRows, error: orgErr } = await supabase
      .from("orgs")
      .select("id,name, org_members!inner(user_id)")
      .eq("org_members.user_id", uid);

    if (orgErr) { setErr(orgErr.message); return; }

    const list = (orgRows ?? []).map(({ id, name }) => ({ id, name })) as Org[];
    setOrgs(list);
    if (!orgId && list.length) setOrgId(list[0].id);

    // 4) Load template sets (global + org-scoped if we have an org)
    const { data: globalSets, error: gErr } = await supabase
      .from("template_sets")
      .select("id,name,description")
      .is("org_id", null);
    if (gErr) { setErr(gErr.message); return; }

    let combined = [...(globalSets ?? [])];
    if (list.length) {
      const { data: scopedSets } = await supabase
        .from("template_sets")
        .select("id,name,description")
        .eq("org_id", list[0].id);
      combined = [...combined, ...(scopedSets ?? [])];
    }
    setSets(combined);
    if (!templateSetId && combined.length) setTemplateSetId(combined[0].id);
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  async function handleCreate() {
    try {
      setBusy(true); setErr(null);
      if (!orgId || !templateSetId || !name.trim()) {
        setErr("Please select an org, template set, and project name.");
        setBusy(false);
        return;
      }
      const { error } = await supabase.rpc("create_project_with_template", {
        p_org_id: orgId,
        p_name: name.trim(),
        p_status: status,
        p_template_set: templateSetId,
      });
      if (error) { setErr(error.message); setBusy(false); return; }
      nav("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Create Project</h1>
      {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{err}</div>}

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-sm text-slate-600">Organisation</label>
        <select value={orgId} onChange={e => setOrgId(e.target.value)} className="w-full rounded-md border px-3 py-2">
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
{orgs.length === 0 && (
  <p className="mt-1 text-xs text-slate-500">
    No organisations found for your account. In dev, add a row to <code>org_members</code> for your user.
  </p>
)}
        <label className="mt-3 block text-sm text-slate-600">Project name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-md border px-3 py-2" />

        <label className="mt-3 block text-sm text-slate-600">Initial status</label>
        <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-md border px-3 py-2">
          <option value="active">active</option>
          <option value="planned">planned</option>
          <option value="closed">closed</option>
        </select>

        <label className="mt-3 block text-sm text-slate-600">Template set</label>
        <select value={templateSetId} onChange={e => setTemplateSetId(e.target.value)} className="w-full rounded-md border px-3 py-2">
          {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleCreate}
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
          <button onClick={() => nav(-1)} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-100">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
