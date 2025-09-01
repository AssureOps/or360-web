// src/ProjectPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { CalendarDays, Save, ArrowLeft } from "lucide-react";

type Project = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  project_code: string | null;
  go_live_date: string | null;
  cab_date: string | null;
  els_exit_date: string | null;
  status: string;
  project_type: string | null;
  start_date: string | null;
  handover_target_date: string | null;
  owner_email: string | null;
};

export default function ProjectPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data, error } = await supabase
        .from("projects")
        .select("id, org_id, name, description, project_code, go_live_date, cab_date, els_exit_date, status, project_type, start_date, handover_target_date, owner_email")
        .eq("id", id)
        .single();
      if (error) {
        setError(error.message);
      } else {
        setP(data as any);
      }
    }
    load();
  }, [id]);

  function d(x?: string | null) {
    return x ? new Date(x + "T00:00:00") : null;
  }

  const warnings = useMemo(() => {
    if (!p) return [] as string[];
    const w: string[] = [];
    const start = d(p.start_date);
    const cab = d(p.cab_date);
    const golive = d(p.go_live_date);
    const handover = d(p.handover_target_date);
    const els = d(p.els_exit_date);

    if (start && cab && cab < start) w.push("CAB date is before Start date.");
    if (start && golive && golive < start) w.push("Go‑Live date is before Start date.");
    if (cab && golive && cab > golive) w.push("CAB date is after Go‑Live date.");
    if (golive && els && els < golive) w.push("ELS / Hypercare Exit is before Go‑Live date.");
    if (handover && golive && handover > golive) w.push("Handover Target is after Go‑Live date.");
    return w;
  }, [p]);

  async function save() {
    if (!p) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const { id: pid, ...rest } = p;
    const { error } = await supabase.from("projects").update(rest).eq("id", pid);
    if (error) setError(error.message);
    else setSavedMsg("Saved");
    setSaving(false);
  }

  if (!p) {
    return (
      <div className="max-w-5xl">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 mb-3 text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16}/> Back
        </button>
        {error ? <div className="text-rose-600">Error: {error}</div> : <div>Loading...</div>}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 mb-3 text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16}/> Back
      </button>

      <h1 className="text-xl font-semibold mb-2">Project</h1>

      {warnings.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-sm">
          <div className="font-medium mb-1">Date warnings</div>
          <ul className="list-disc pl-5">
            {warnings.map((w,i) => (<li key={i}>{w}</li>))}
          </ul>
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
                value={p.name} onChange={e=>setP({...p, name:e.target.value})}/>
            </div>
            <div>
              <label className="block text-xs mb-1 text-slate-600">Project Code</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={p.project_code || ""} onChange={e=>setP({...p, project_code:e.target.value})}/>
            </div>
            <div>
              <label className="block text-xs mb-1 text-slate-600">Description</label>
              <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                value={p.description || ""} onChange={e=>setP({...p, description:e.target.value})}/>
            </div>
          </div>
        </div>

        {/* Dates & Milestones */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">Dates & Milestones</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ["start_date","Start Date"],
              ["go_live_date","Go‑Live Date"],
              ["cab_date","CAB Date"],
              ["handover_target_date","Handover Target Date"],
              ["els_exit_date","ELS / Hypercare Exit Date"],
            ].map(([key,label]) => (
              <div key={key}>
                <label className="block text-xs mb-1 text-slate-600">{label}</label>
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-slate-500"/>
                  <input type="date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={(p as any)[key] || ""}
                    onChange={e=>setP({...p, [key]: e.target.value}) as any}
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
                value={p.owner_email || ""} onChange={e=>setP({...p, owner_email:e.target.value})}/>
            </div>
            <div>
              <label className="block text-xs mb-1 text-slate-600">Project Type</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={p.project_type || ""} onChange={e=>setP({...p, project_type:e.target.value})}/>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save size={16}/> Save Changes
        </button>
        {savedMsg && <span className="text-sm text-green-700">{savedMsg}</span>}
        {saving && <span className="text-sm text-slate-500">Saving…</span>}
        {error && <span className="text-sm text-rose-600">Error: {error}</span>}
      </div>
    </div>
  );
}
