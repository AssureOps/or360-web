import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend as RLegend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from "recharts";




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

const COLORS = ["#475569", "#0ea5e9", "#10b981", "#ef4444", "#8b5cf6"];

function weekKey(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [evidence, setEvidence] = useState<Evidence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [weeks, setWeeks] = useState<4 | 8 | 12>(8);
  const [issueFilter, setIssueFilter] = useState<"all" | "overdue" | "caveat">("all");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        const email = import.meta.env.VITE_DEMO_EMAIL as string;
        const password = import.meta.env.VITE_DEMO_PASSWORD as string;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setErr(`Sign-in failed: ${error.message}`); return; }
      }
      const { data: projs, error: pErr } = await supabase
        .from("projects")
        .select("id,name,status,created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (pErr) { setErr(pErr.message); return; }
      setProjects(projs ?? []);
      if (!activeProjectId && projs && projs.length > 0) setActiveProjectId(projs[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true); setErr(null);
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
    const all = Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
    return all.slice(-weeks);
  }, [evidence, weeks]);


  const issues = useMemo(() => {
    const over = (criteria ?? [])
      .filter(c => c.due_date && new Date(c.due_date) < new Date() && c.status !== "done")
      .map(c => ({ kind: "overdue" as const, ...c }));
    const cav = (criteria ?? [])
      .filter(c => c.status === "caveat")
      .map(c => ({ kind: "caveat" as const, ...c }));
    let rows = [...over, ...cav].sort((a, b) =>
      (a.kind === "overdue" ? (a.due_date ?? "") : a.title)
        .toString()
        .localeCompare((b.kind === "overdue" ? (b.due_date ?? "") : b.title).toString())
    );
    if (issueFilter !== "all") rows = rows.filter(r => r.kind === issueFilter);
    return rows;
  }, [criteria, issueFilter]);

  return (
    <div className="p-4 sm:p-6 space-y-4" data-project-name={
      (projects?.find(p => p.id === activeProjectId)?.name) || undefined
    }>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span>Status:</span>
            <span className="rounded-full border border-slate-200 px-2 py-0.5">
              {projects?.find(p => p.id === activeProjectId)?.status ?? "-"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-600">
            <span>Activity range:</span>
            {[4,8,12].map(w => (
              <button
                key={w}
                onClick={() => setWeeks(w as 4|8|12)}
                className={`rounded-full border px-2 py-0.5 ${weeks===w ? "bg-slate-900 text-white border-slate-900":"bg-white text-slate-700 border-slate-300"}`}
              >
                {w}w
              </button>
            ))}
          </div>
<button
  onClick={() => {
    // Optional: add a quick class to stabilize before print
    document.body.classList.add("export-safe"); // if you want any extra tweaks
    setTimeout(() => window.print(), 0);
    // Remove the class after a moment (Chrome fires print async)
    setTimeout(() => document.body.classList.remove("export-safe"), 2000);
  }}
  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
  title="Export to PDF"
>
  Export PDF
</button>
        </div>
      </header>

      <div id="dashboard-root" className="space-y-4">
        <section className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi title="Completion" value={`${stats.pct}%`} accent />
          <Kpi title="Total" value={stats.total} />
          <Kpi title="In Progress" value={stats.inprog} />
          <Kpi title="Done" value={stats.done} />
          <Kpi title="Overdue" value={stats.overdue} warn />
          <Kpi title="Caveats" value={stats.caveat} violet />
        </section>

        <section className="grid gap-3 lg:grid-cols-5">
          <Card title="Status Distribution" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <RTooltip />
                <RLegend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Completion by Category" className="lg:col-span-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis unit="%" />
                <RTooltip />
                <Bar dataKey="pct" name="% Complete" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </section>

        <Card title={`Evidence Activity (last ${weeks}w)`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={evidenceByWeek}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis allowDecimals={false} />
              <RTooltip />
              <Bar dataKey="Notes" />
              <Bar dataKey="Links" />
              <Bar dataKey="Files" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="Attention Needed"
          right={
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <span>Show:</span>
              {(["all","overdue","caveat"] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setIssueFilter(key)}
                  className={`rounded-full border px-2 py-0.5 ${
                    issueFilter===key ? "bg-slate-900 text-white border-slate-900":"bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  {key === "all" ? "All" : key[0].toUpperCase()+key.slice(1)}
                </button>
              ))}
            </div>
          }
        >
          {issues.length === 0 ? (
            <div className="text-sm text-slate-500">No issues 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-1">Type</th>
                    <th className="px-2 py-1">Title</th>
                    <th className="px-2 py-1">Category</th>
                    <th className="px-2 py-1">Owner</th>
                    <th className="px-2 py-1">Due / Reason</th>
                    <th className="px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-2 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${
                          r.kind === "overdue" ? "border-red-200 bg-red-50 text-red-700" : "border-violet-200 bg-violet-50 text-violet-700"
                        }`}>
                          {r.kind === "overdue" ? "Overdue" : "Caveat"}
                        </span>
                      </td>
                      <td className="px-2 py-2">{r.title}</td>
                      <td className="px-2 py-2">{r.category ?? "-"}</td>
                      <td className="px-2 py-2">{r.owner_email ?? "-"}</td>
                      <td className="px-2 py-2">
                        {r.kind === "overdue" ? (r.due_date ?? "-") : (r.caveat_reason ?? "-")}
                      </td>
                      <td className="px-2 py-2">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {loading && <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">Loading…</div>}
        {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{err}</div>}
      </div>
    </div>
  );
}

function Kpi({ title, value, accent, warn, violet }: { title: string; value: string | number; accent?: boolean; warn?: boolean; violet?: boolean }) {
  const cls = accent ? "border-slate-300" : warn ? "border-red-200" : violet ? "border-violet-200" : "border-slate-200";
  const valCls = warn ? "text-red-600" : violet ? "text-violet-700" : "text-slate-800";
  return (
    <div className={`rounded-xl border ${cls} bg-white p-3`}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${valCls}`}>{value}</div>
    </div>
  );
}

function Card({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        <div className="text-xs">{right}</div>
      </div>
      {children}
    </section>
  );
}
