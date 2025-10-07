import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrg } from "./OrgContext";
import { supabase } from "./lib/supabase";

type Status = "draft" | "planned" | "active" | "closed";

export default function NewProject() {
  const nav = useNavigate();
  const { orgId } = useOrg();

  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("draft");
  const [start_date, setStartDate] = useState<string>("");
  const [go_live_date, setGoLiveDate] = useState<string>("");
  const [handover_target_date, setHandoverTargetDate] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!orgId) { setErr("Select an organisation first."); return; }
    if (!name.trim()) { setErr("Project name is required."); return; }
    setSaving(true); setErr(null);
    try {
      const { data: au } = await supabase.auth.getUser();
      const uid = au?.user?.id || null;
      const { data, error } = await supabase
        .from("projects")
        .insert({
          org_id: orgId,
          name: name.trim(),
          status,
          start_date: start_date || null,
          go_live_date: go_live_date || null,
          handover_target_date: handover_target_date || null,
          created_by: uid
        })
        .select("id").single();
      if (error) throw error;
      localStorage.setItem("lastProjectId", data!.id);
      window.dispatchEvent(new CustomEvent("last-project-changed", { detail: data!.id }));
      nav(`/projects/${data!.id}/settings`, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Create Project</h1>
      </header>

      {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{err}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Project name *</span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="e.g., OR-360 Rollout"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Status</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900"
            value={status}
            onChange={(e) => setStatus(e.currentTarget.value as Status)}
          >
            <option value="draft">Draft</option>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Start date</span>
          <input
            type="date"
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900"
            value={start_date}
            onChange={(e) => setStartDate(e.currentTarget.value)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Go-live date</span>
          <input
            type="date"
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900"
            value={go_live_date}
            onChange={(e) => setGoLiveDate(e.currentTarget.value)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Handover target date</span>
          <input
            type="date"
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900"
            value={handover_target_date}
            onChange={(e) => setHandoverTargetDate(e.currentTarget.value)}
          />
        </label>
      </section>

      <div className="flex items-center justify-end gap-2">
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          onClick={() => nav("/projects")}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={save}
          disabled={saving || !name.trim() || !orgId}
        >
          {saving ? "Saving…" : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}
