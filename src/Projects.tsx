// Projects.tsx (updated 'New Project' flow) — navigate to /projects/new instead of immediate insert
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useOrg } from "./OrgContext";
import ConfirmDialog from "./components/ConfirmDialog";
import {
  Plus, ClipboardCheck, PieChart, ListChecks, Trash2, Copy, ChevronRight, Settings
} from "lucide-react";

/** Types aligned with your schema */
type Project = {
  id: string;
  org_id: string;
  name: string;
  status: "draft" | "planned" | "active" | "closed" | string;
  created_at: string;
  go_live_date?: string | null;
  start_date?: string | null;
  handover_target_date?: string | null;
};

type Criterion = {
  id: string;
  project_id: string;
  status: "not_started" | "in_progress" | "done" | "delayed" | "caveat" | string;
  due_date?: string | null;
};

function rememberLastProject(id: string) {
  localStorage.setItem("lastProjectId", id);
  window.dispatchEvent(new CustomEvent("last-project-changed", { detail: id }));
}

export default function Projects() {
  const nav = useNavigate();
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [del, setDel] = useState<Project | null>(null);

  useEffect(() => {
    (async () => {
      if (!orgId) return;
      setLoading(true);
      setErr(null);
      try {
        const { data: projs, error: pErr } = await supabase
          .from("projects")
          .select("id,org_id,name,status,created_at,go_live_date,start_date,handover_target_date")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(500);
        if (pErr) throw pErr;
        setProjects((projs || []) as Project[]);

        const ids = (projs || []).map((p: any) => p.id);
        if (ids.length) {
          const { data: crits, error: cErr } = await supabase
            .from("criteria")
            .select("id,project_id,status,due_date")
            .in("project_id", ids);
          if (cErr) throw cErr;
          setCriteria((crits || []) as Criterion[]);
        } else {
          setCriteria([]);
        }
      } catch (e: any) {
        setErr(e.message || String(e));
        setProjects([]);
        setCriteria([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  const statsByProject = useMemo(() => {
    const map = new Map<string, {
      total: number; done: number; inprog: number; delayed: number; caveat: number; notStarted: number; overdue: number;
    }>();
    const today = new Date(); today.setHours(0,0,0,0);
    for (const p of projects) {
      map.set(p.id, { total:0, done:0, inprog:0, delayed:0, caveat:0, notStarted:0, overdue:0 });
    }
    for (const c of criteria) {
      const row = map.get(c.project_id);
      if (!row) continue;
      row.total += 1;
      if (c.status === "done") row.done += 1;
      else if (c.status === "in_progress") row.inprog += 1;
      else if (c.status === "delayed") row.delayed += 1;
      else if (c.status === "caveat") row.caveat += 1;
      else row.notStarted += 1;

      if (c.due_date && c.status !== "done") {
        const d = new Date(c.due_date + "T00:00:00");
        if (d < today) row.overdue += 1;
      }
    }
    return map;
  }, [projects, criteria]);

  function goToNewProject() {
    if (!orgId) {
      alert("Select an organisation first.");
      return;
    }
    nav("/projects/new");
  }

  async function duplicateProject(p: Project) {
    try {
      const { data: au } = await supabase.auth.getUser();
      const uid = au?.user?.id || null;
      const { data: newP, error: pe } = await supabase
        .from("projects")
        .insert({
          org_id: p.org_id, name: `${p.name} (copy)`, status: "draft",
          created_by: uid, description: null, project_code: null,
          go_live_date: p.go_live_date, start_date: p.start_date, handover_target_date: p.handover_target_date
        })
        .select("id")
        .single();
      if (pe) throw pe;

      const { data: srcCrit } = await supabase
        .from("criteria")
        .select("template_id,org_id,title,description,category,severity,status,evidence_required,due_date,owner_email,ai_source,meta")
        .eq("project_id", p.id);
      if (srcCrit && srcCrit.length) {
        const rows = srcCrit.map((r: any) => ({ ...r, project_id: newP!.id }));
        await supabase.from("criteria").insert(rows);
      }
      rememberLastProject(newP!.id);
      nav(`/projects/${newP!.id}`);
    } catch (e: any) {
      alert(e.message || String(e));
    }
  }

  async function reallyDeleteProject(p: Project) {
    try { await supabase.from("criteria").delete().eq("project_id", p.id); } catch {}
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) throw error;
    setProjects((prev) => prev.filter(x => x.id !== p.id));
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Projects</h1>
        <button
          onClick={goToNewProject}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
        >
          <Plus size={16} /> New Project
        </button>
      </header>

      {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{err}</div>}
      {loading && <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">Loading…</div>}

      {!loading && projects.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
          No projects yet. Click <b>New Project</b> to get started.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => {
          const s = statsByProject.get(p.id) || { total:0, done:0, inprog:0, delayed:0, caveat:0, notStarted:0, overdue:0 };
          const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;

          return (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.status.toUpperCase()}</div>
                </div>
                <button
                  className="text-slate-600 hover:text-slate-900"
                  onClick={() => { rememberLastProject(p.id); }}
                  title="Mark as last opened"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify_between text-sm">
                  <span className="text-slate-600">Completion</span>
                  <span className="font-medium">{pct}%</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <span className="text-green-700">✅ {s.done} done</span>
                  <span className="text-amber-700">🔶 {s.inprog} in-progress</span>
                  <span className="text-purple-700">☑️ {s.caveat} caveat</span>
                  <span className="text-slate-700">⚪ {s.notStarted} not started</span>
                  <span className="text-red-700">⛔ {s.delayed} delayed</span>
                  <span className="text-red-700">⚠ {s.overdue} overdue</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link to={`/projects/${p.id}`} onClick={() => { rememberLastProject(p.id); }}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50" title="Open Checklist">
                  <ClipboardCheck size={16} /> Checklist
                </Link>
                <Link to={`/projects/${p.id}/dashboard`} onClick={() => { rememberLastProject(p.id); }}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50" title="View Dashboard">
                  <PieChart size={16} /> Dashboard
                </Link>
                <Link to={`/projects/${p.id}/settings`} onClick={() => { rememberLastProject(p.id); }}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50" title="Project Settings">
                  <Settings size={16} /> Settings
                </Link>
                <Link to={`/projects/${p.id}/allocate`} onClick={() => { rememberLastProject(p.id); }}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50" title="Allocate Criteria">
                  <ListChecks size={16} /> Allocate
                </Link>
                <button onClick={() => duplicateProject(p)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50" title="Duplicate project (copies criteria)">
                  <Copy size={16} /> Duplicate
                </button>
                <button onClick={() => setDel(p)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100" title="Delete project">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <ConfirmDialog open={!!del} title="Delete this project?"
        message={<div className="space-y-1"><div>This will remove the project and its criteria.</div><div className="text-xs text-slate-500">{del?.name}</div></div>}
        confirmLabel="Delete" cancelLabel="Cancel" destructive
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          if (!del) return;
          try { await reallyDeleteProject(del); } catch (e: any) { alert(e.message || String(e)); } finally { setDel(null); }
        }}
      />
    </div>
  );
}
