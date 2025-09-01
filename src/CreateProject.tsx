// src/CreateProject.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useOrg } from "./OrgContext";
import { CalendarDays, Save, ArrowLeft } from "lucide-react";

export default function CreateProject() {
  const nav = useNavigate();
  const { orgId } = useOrg();

  // Same fields as Edit Project
  const [name, setName] = useState<string>("");
  const [projectCode, setProjectCode] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [goLiveDate, setGoLiveDate] = useState<string>("");
  const [cabDate, setCabDate] = useState<string>("");
  const [handoverTargetDate, setHandoverTargetDate] = useState<string>("");
  const [elsExitDate, setElsExitDate] = useState<string>("");
  const [ownerEmail, setOwnerEmail] = useState<string>("");
  const [projectType, setProjectType] = useState<string>("");
  const [status, setStatus] = useState<string>("draft"); // project_status enum

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function d(x?: string) { return x ? new Date(x + "T00:00:00") : null; }
  const warnings = useMemo(() => {
    const w: string[] = [];
    const start = d(startDate);
    const cab = d(cabDate);
    const golive = d(goLiveDate);
    const handover = d(handoverTargetDate);
    const els = d(elsExitDate);
    if (start && cab && cab < start) w.push("CAB date is before Start date.");
    if (start && golive && golive < start) w.push("Go‑Live date is before Start date.");
    if (cab && golive && cab > golive) w.push("CAB date is after Go‑Live date.");
    if (golive && els && els < golive) w.push("ELS / Hypercare Exit is before Go‑Live date.");
    if (handover && golive && handover > golive) w.push("Handover Target is after Go‑Live date.");
    return w;
  }, [startDate, cabDate, goLiveDate, handoverTargetDate, elsExitDate]);

  async function handleCreate() {
    setBusy(true); setError(null);
    try {
      if (!orgId) {
        setError("Please select an organisation in the sidebar first.");
        return;
      }
      if (!name.trim()) {
        setError("Project name is required.");
        return;
      }

      // Get user id for created_by
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr || !u?.user) {
        setError("Not signed in.");
        return;
      }

      const insert = {
        org_id: orgId,
        name: name.trim(),
        status,
        description: description || null,
        project_code: projectCode || null,
        start_date: startDate || null,
        go_live_date: goLiveDate || null,
        cab_date: cabDate || null,
        handover_target_date: handoverTargetDate || null,
        els_exit_date: elsExitDate || null,
        owner_email: ownerEmail || null,
        project_type: projectType || null,
        created_by: u.user.id,
      };

      const { data, error } = await supabase
        .from("projects")
        .insert(insert)
        .select("id")
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      nav(`/projects/${data!.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 mb-3 text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16}/> Back
      </button>

      <h1 className="text-xl font-semibold mb-2">Create Project</h1>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">{error}</div>}
      {warnings.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-sm">
          <div className="font-medium mb-1">Date warnings</div>
          <ul className="list-disc pl-5">{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">Core</h2>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs mb-1 text-slate-600">Project Name</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={name} onChange={e=>setName(e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs mb-1 text-slate-600">Project Code</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={projectCode} onChange={e=>setProjectCode(e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs mb-1 text-slate-600">Description</label>
              <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                value={description} onChange={e=>setDescription(e.target.value)}/>
            </div>
          </div>
        </div>

        {/* Dates & Milestones */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">Dates & Milestones</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ["startDate","Start Date", startDate, setStartDate],
              ["goLiveDate","Go‑Live Date", goLiveDate, setGoLiveDate],
              ["cabDate","CAB Date", cabDate, setCabDate],
              ["handoverTargetDate","Handover Target Date", handoverTargetDate, setHandoverTargetDate],
              ["elsExitDate","ELS / Hypercare Exit Date", elsExitDate, setElsExitDate],
            ].map(([key,label,val,setter]: any) => (
              <div key={key}>
                <label className="block text-xs mb-1 text-slate-600">{label}</label>
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-slate-500"/>
                  <input type="date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={val}
                    onChange={(e)=>setter(e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ownership & Meta */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">Ownership & Meta</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 text-slate-600">Owner Email</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs mb-1 text-slate-600">Project Type</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={projectType} onChange={e=>setProjectType(e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs mb-1 text-slate-600">Initial Status</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={status} onChange={e=>setStatus(e.target.value)}>
                <option value="draft">draft</option>
                <option value="in_progress">in_progress</option>
                <option value="completed">completed</option>
                <option value="closed">closed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button"
          onClick={handleCreate}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save size={16}/> {busy ? "Creating…" : "Create Project"}
        </button>
        <button type="button" onClick={() => nav(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
        >
          <ArrowLeft size={16}/> Cancel
        </button>
      </div>
    </div>
  );
}
