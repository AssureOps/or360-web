import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend as RLegend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from "recharts";
import { ChevronRight } from "lucide-react";

/** Types (aligned with App.tsx) */
type Project = { id: string; name: string; status: string; created_at: string };
type Criterion = {
  id: string;
  project_id: string;
  title: string;
  status: "not_started" | "in_progress" | "done" | "delayed" | "caveat" | string;
  category?: string | null;
  owner_email?: string | null;
  due_date?: string | null;
  caveat_reason?: string | null;
  meta?: any;
  created_at?: string;
  updated_at?: string | null;
};
type Evidence = {
  id: string;
  criterion_id: string;
  kind: "note" | "link" | "file";
  note?: string | null;
  url?: string | null;
  uploaded_at: string;
  created_by?: string | null;
  updated_at?: string | null;
  meta?: any;
};

/** Helpers */
const COLORS = ["#d1d5db", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"]; // gray, amber, green, red, purple

function weekKey(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // 1..7
  date.setUTCDate(date.getUTCDate() - day + 1); // Monday of this week
  return date.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [evidence, setEvidence] = useState<Evidence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Demo auth (same as App.tsx)
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        const email = import.meta.env.VITE_DEMO_EMAIL as string;
        const password = import.meta.env.VITE_DEMO_PASSWORD as string;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setErr(`Sign-in failed: ${error.message}`); return; }
      }
      // load projects
      const { data: projs, error: pErr } = await supabase
        .from("projects")
        .select("id,name,status,created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (pErr) { setErr(pErr.message); return; }
      setProjects(projs ?? []);
      if (!activeProjectId && projs && projs.length > 0) setActiveProjectId(projs[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load criteria + evidence for selected project
  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    setErr(null);
    (async () => {
      const { data: crits, error: cErr } = await supabase
        .from("criteria")
        .select("id,project_id,title,status,category,owner_email,due_date,caveat_reason,meta,created_at,updated_at")
        .eq("project_id", activeProjectId)
        .order("title", { ascending: true });
      if (cErr) { setErr(cErr.message); setLoading(false); return; }
      setCriteria(crits as Criterion[]);

      const ids = (crits ?? []).map((c: any) => c.id);
      if (ids.length) {
        const { data: ev, error: eErr } = await supabase
          .from("evidence")
          .select("id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta")
          .in("criterion_id", ids);
        if (eErr) setErr(eErr.message);
        setEvidence(ev ?? []);
      } else {
        setEvidence([]);
      }
      setLoading(false);
    })();
  }, [activeProjectId]);

  /** Derived stats */
  const stats = useMemo(() => {
    const all = criteria ?? [];
    const total = all.length;
    const done = all.filter(c => c.status === "done").length;
    const inprog = all.filter(c => c.status === "in_progress").length;
    const delayed = all.filter(c => c.status === "delayed").length;
    const caveat = all.filter(c => c.status === "caveat").length;
    const notStarted = total - done - inprog - delayed - caveat;
    const overdue = all.filter(c => c.due_date && new Date(c.due_date) < new Date() && c.status !== "done").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, inprog, delayed, caveat, notStarted, overdue, pct };
  }, [criteria]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { category: string; total: number; done: number }>();
    (criteria ?? []).forEach(c => {
      const k = c.category ?? "Uncategorised";
      const row = map.get(k) ?? { category: k, total: 0, done: 0 };
      row.total += 1;
      if (c.status === "done") row.done += 1;
      map.set(k, row);
    });
    return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category))
      .map(r => ({ ...r, pct: r.total ? Math.round((r.done / r.total) * 100) : 0 }));
  }, [criteria]);

  const statusData = useMemo(() => ([
    { name: "Not Started", value: stats.notStarted },
    { name: "In Progress", value: stats.inprog },
    { name: "Done", value: stats.done },
    { name: "Delayed", value: stats.delayed },
    { name: "Caveat", value: stats.caveat },
  ]), [stats]);

  const evidenceByWeek = useMemo(() => {
    const map = new Map<string, { week: string; Notes: number; Links: number; Files: number }>();
    (evidence ?? []).forEach(ev => {
      const wk = weekKey(new Date(ev.uploaded_at));
      const row = map.get(wk) ?? { week: wk, Notes: 0, Links: 0, Files: 0 };
      if (ev.kind === "note") row.Notes += 1;
      else if (ev.kind === "link") row.Links += 1;
      else row.Files += 1;
      map.set(wk, row);
    });
    return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
  }, [evidence]);

  const overdueItems = useMemo(() => {
    return (criteria ?? [])
      .filter(c => c.due_date && new Date(c.due_date) < new Date() && c.status !== "done")
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  }, [criteria]);

  const caveatItems = useMemo(() => {
    return (criteria ?? [])
      .filter(c => c.status === "caveat")
      .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.title.localeCompare(b.title));
  }, [criteria]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="mb-2 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         
          <div className="flex items-center gap-2">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={activeProjectId ?? ""}
              onChange={(e) => setActiveProjectId(e.target.value)}
            >
              {projects?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{err}</div>}
      </header>

      {/* KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Completion</div>
          <div className="mt-1 text-3xl font-bold">{stats.pct}%</div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-green-500" style={{ width: `${stats.pct}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-600">{stats.done}/{stats.total} done</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Total Criteria</div>
          <div className="mt-1 text-3xl font-bold">{stats.total}</div>
          <div className="mt-2 text-xs text-slate-600">Tracked in this project</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Overdue</div>
          <div className="mt-1 text-3xl font-bold text-red-600">{stats.overdue}</div>
          <div className="mt-2 text-xs text-slate-600">Due date in the past</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Caveats</div>
          <div className="mt-1 text-3xl font-bold text-purple-700">{stats.caveat}</div>
          <div className="mt-2 text-xs text-slate-600">Require attention</div>
        </div>
      </section>

      {/* Charts */}
      <section className="grid gap-3 lg:grid-cols-5">
        {/* Status Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="mb-2 text-sm font-semibold text-slate-700">Status Distribution</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <RTooltip />
              <RLegend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Completion by Category */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-3">
          <div className="mb-2 text-sm font-semibold text-slate-700">Completion by Category</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis unit="%" />
              <RTooltip />
              <Bar dataKey="pct" name="% Complete" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Evidence Activity */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-semibold text-slate-700">Evidence Activity by Week</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={evidenceByWeek}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis allowDecimals={false} />
            <RTooltip />
            <RLegend content={() => null} />
            <Bar dataKey="Notes" />
            <Bar dataKey="Links" />
            <Bar dataKey="Files" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Tables */}
      <section className="grid gap-3 lg:grid-cols-2">
        {/* Overdue */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">Overdue Items</div>
            <span className="text-xs text-slate-500">{overdueItems.length}</span>
          </div>
          {overdueItems.length === 0 ? (
            <div className="text-sm text-slate-500">No overdue items 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-1">Title</th>
                    <th className="px-2 py-1">Owner</th>
                    <th className="px-2 py-1">Due</th>
                    <th className="px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdueItems.map(o => (
                    <tr key={o.id} className="align-top">
                      <td className="px-2 py-2">
                        <div className="flex items-start gap-2">
                          <ChevronRight size={14} className="text-slate-400 mt-0.5" />
                          <div>
                            <div className="font-medium text-slate-800">{o.title}</div>
                            <div className="text-xs text-slate-500">{o.category ?? "Uncategorised"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2">{o.owner_email ?? "-"}</td>
                      <td className="px-2 py-2 text-red-600">{o.due_date ?? "-"}</td>
                      <td className="px-2 py-2">{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Caveats */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">Caveats</div>
            <span className="text-xs text-slate-500">{caveatItems.length}</span>
          </div>
          {caveatItems.length === 0 ? (
            <div className="text-sm text-slate-500">No caveats 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-1">Title</th>
                    <th className="px-2 py-1">Category</th>
                    <th className="px-2 py-1">Owner</th>
                    <th className="px-2 py-1">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {caveatItems.map(c => (
                    <tr key={c.id} className="align-top">
                      <td className="px-2 py-2">{c.title}</td>
                      <td className="px-2 py-2">{c.category ?? "-"}</td>
                      <td className="px-2 py-2">{c.owner_email ?? "-"}</td>
                      <td className="px-2 py-2">{c.caveat_reason ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {loading && <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">Loading…</div>}
    </div>
  );
}
