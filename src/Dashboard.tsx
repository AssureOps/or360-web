import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  Legend as RLegend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
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
  section_order?: number | null;
  item_order?: number | null;
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

type ViewMode = "summary" | "detailed";
type IssueFilter = "all" | "blocked" | "overdue" | "high" | "evidence" | "caveat";

type Snapshot = {
  saved_at: string;
  pct: number;
  total: number;
  done: number;
  inprog: number;
  notStarted: number;
  delayed: number;
  caveat: number;
  overdue: number;
  highOpen: number;
  evidenceMissing: number;
};

const COLORS = ["#94a3b8", "#0ea5e9", "#22c55e", "#ef4444", "#a855f7"];

function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toISOString().slice(0, 10);
}
function isOverdue(c: Criterion) {
  if (!c.due_date) return false;
  if (c.status === "done") return false;
  const t = Date.parse(c.due_date);
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}
function severity(c: Criterion): "low" | "medium" | "high" | "critical" | "" {
  const raw = String(c.meta?.severity ?? c.meta?.SEVERITY ?? "").toLowerCase();
  if (raw === "critical") return "critical";
  if (raw === "high") return "high";
  if (raw === "medium") return "medium";
  if (raw === "low") return "low";
  return "";
}
function evidenceRequired(c: Criterion): boolean {
  return !!(c.meta?.evidence_required ?? c.meta?.evidenceRequired ?? c.meta?.EVIDENCE_REQUIRED);
}
function evidenceCountFor(evidence: Evidence[], criterionId: string) {
  return evidence.filter((e) => e.criterion_id === criterionId && e.kind !== "note").length;
}
function weekKey(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function downloadCSV(filename: string, rowsInput: unknown) {
  const rows = safeArr<Record<string, any>>(rowsInput);
  if (!rows.length) return;

  const headerSet = new Set<string>();
  for (const r of rows) Object.keys(r || {}).forEach((k) => headerSet.add(k));
  const headers = Array.from(headerSet);

  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(","))].join(
    "\n"
  );

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TrajectoryChart({ points }: { points: Snapshot[] }) {
  const pts = safeArr<Snapshot>(points);
  if (pts.length < 2) {
    return <div className="text-sm text-slate-600">Save a couple of snapshots to see a trend line.</div>;
  }

  const W = 640;
  const H = 160;
  const pad = 24;

  const xs = pts.map((_, i) => (pts.length === 1 ? pad : pad + (i * (W - pad * 2)) / (pts.length - 1)));
  const yForPct = (pct: number) => pad + ((100 - clamp(pct, 0, 100)) * (H - pad * 2)) / 100;

  const line = (key: "pct" | "overdue" | "delayed") => {
    const max =
      key === "pct"
        ? 100
        : Math.max(
            1,
            ...pts.map((p) => {
              const v = Number((p as any)[key] ?? 0);
              return Number.isFinite(v) ? v : 0;
            })
          );

    const yFor = (v: number) => {
      if (key === "pct") return yForPct(v);
      return pad + ((max - clamp(v, 0, max)) * (H - pad * 2)) / max;
    };

    const d = xs
      .map((x, i) => {
        const v = Number((pts[i] as any)[key] ?? 0);
        const y = yFor(Number.isFinite(v) ? v : 0);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

    return d;
  };

  const last = pts[pts.length - 1];
  const first = pts[0];
  const deltaPct = clamp(last.pct - first.pct, -100, 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{pts.length} points</span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
          {String(first.saved_at).slice(0, 10)} → {String(last.saved_at).slice(0, 10)}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
          Δ completion: {deltaPct > 0 ? "+" : ""}
          {deltaPct}%
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[560px]">
          <path
            d={`M ${pad} ${pad} L ${pad} ${H - pad} L ${W - pad} ${H - pad}`}
            stroke="#e2e8f0"
            strokeWidth="1"
            fill="none"
          />
          <path d={line("pct")} stroke="#10b981" strokeWidth="2" fill="none" />
          <path d={line("overdue")} stroke="#f59e0b" strokeWidth="2" fill="none" opacity="0.85" />
          <path d={line("delayed")} stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.85" />
        </svg>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-6 rounded bg-emerald-500" /> Completion %
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-6 rounded bg-amber-500" /> Overdue (count)
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-6 rounded bg-red-500" /> Blockers (count)
        </span>
      </div>
    </div>
  );
}

function Pill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function HealthBadge({ rag, note }: { rag: "green" | "amber" | "red"; note: string }) {
  const cls =
    rag === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : rag === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-rose-200 bg-rose-50 text-rose-700";
  const label = rag === "green" ? "ON TRACK" : rag === "amber" ? "AT RISK" : "BLOCKED";
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${cls}`}>
      <span className="font-semibold">{label}</span>
      <span className="opacity-80">·</span>
      <span className="opacity-90">{note}</span>
    </div>
  );
}

function Modal({
  title,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold">{title}</div>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [evidence, setEvidence] = useState<Evidence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>("summary");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8);

  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        const email = import.meta.env.VITE_DEMO_EMAIL as string;
        const password = import.meta.env.VITE_DEMO_PASSWORD as string;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setErr(`Sign-in failed: ${error.message}`);
          return;
        }
      }
      const { data: projs, error: pErr } = await supabase
        .from("projects")
        .select("id,name,status,created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (pErr) {
        setErr(pErr.message);
        return;
      }
      setProjects(projs ?? []);
      if (!activeProjectId && projs && projs.length > 0) setActiveProjectId(projs[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    setErr(null);
    (async () => {
      const { data: crits, error: cErr } = await supabase
        .from("criteria")
        .select(
          "id,project_id,title,status,category,owner_email,due_date,caveat_reason,meta,created_at,updated_at,section_order,item_order"
        )
        .eq("project_id", activeProjectId)
        .order("section_order", { ascending: true, nullsFirst: true })
        .order("item_order", { ascending: true, nullsFirst: true })
        .order("title", { ascending: true });

      if (cErr) {
        setErr(cErr.message);
        setLoading(false);
        return;
      }
      setCriteria(crits as Criterion[]);

      const ids = safeArr<any>(crits).map((c) => c.id);
      if (ids.length) {
        const { data: ev, error: eErr } = await supabase
          .from("evidence")
          .select("id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta")
          .in("criterion_id", ids);
        if (eErr) setErr(eErr.message);
        setEvidence((ev ?? []) as Evidence[]);
      } else {
        setEvidence([]);
      }
      setLoading(false);
    })();
  }, [activeProjectId]);

  const projectName = useMemo(() => {
    const p = safeArr<Project>(projects).find((x) => x.id === activeProjectId);
    return p?.name ?? "Project";
  }, [projects, activeProjectId]);

  const stats = useMemo(() => {
    const all = safeArr<Criterion>(criteria);
    const total = all.length;
    const done = all.filter((c) => c.status === "done").length;
    const inprog = all.filter((c) => c.status === "in_progress").length;
    const delayed = all.filter((c) => c.status === "delayed").length;
    const caveat = all.filter((c) => c.status === "caveat").length;
    const notStarted = total - done - inprog - delayed - caveat;

    const overdue = all.filter((c) => isOverdue(c)).length;
    const highOpen = all.filter(
      (c) => (severity(c) === "high" || severity(c) === "critical") && c.status !== "done"
    ).length;

    const ev = safeArr<Evidence>(evidence);
    const evidenceMissing = all.filter(
      (c) => c.status !== "done" && evidenceRequired(c) && evidenceCountFor(ev, c.id) === 0
    ).length;

    const pct = total ? Math.round((done / total) * 100) : 0;

    return { total, done, inprog, delayed, caveat, notStarted, overdue, highOpen, evidenceMissing, pct };
  }, [criteria, evidence]);

  const rag = useMemo(() => {
    if (stats.total === 0) return { rag: "green" as const, note: "No criteria" };
    if (stats.delayed > 0) return { rag: "red" as const, note: `${stats.delayed} blocker${stats.delayed === 1 ? "" : "s"}` };
    if (stats.overdue > 0) return { rag: "red" as const, note: `${stats.overdue} overdue` };
    if (stats.highOpen > 0) return { rag: "amber" as const, note: `${stats.highOpen} high severity open` };
    if (stats.evidenceMissing > 0) return { rag: "amber" as const, note: `${stats.evidenceMissing} evidence missing` };
    if (stats.caveat > 0) return { rag: "amber" as const, note: `${stats.caveat} caveat${stats.caveat === 1 ? "" : "s"}` };
    return { rag: "green" as const, note: "On track" };
  }, [stats]);

  const byStatus = useMemo(() => {
    const s = stats;
    return [
      { name: "Not started", value: s.notStarted },
      { name: "In progress", value: s.inprog },
      { name: "Done", value: s.done },
      { name: "Delayed", value: s.delayed },
      { name: "Caveat", value: s.caveat },
    ].filter((x) => x.value > 0);
  }, [stats]);

  const byCategory = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        order: number;
        total: number;
        done: number;
        delayed: number;
        overdue: number;
        highOpen: number;
        evidenceMissing: number;
      }
    >();

    const all = safeArr<Criterion>(criteria);
    const ev = safeArr<Evidence>(evidence);

    for (const c of all) {
      const k = c.category ?? "Uncategorised";
      if (!map.has(k))
        map.set(k, {
          category: k,
          order: 999,
          total: 0,
          done: 0,
          delayed: 0,
          overdue: 0,
          highOpen: 0,
          evidenceMissing: 0,
        });

      const row = map.get(k)!;
      const so = c.section_order ?? 999;
      if (so < row.order) row.order = so;

      row.total += 1;
      if (c.status === "done") row.done += 1;
      if (c.status === "delayed") row.delayed += 1;
      if (isOverdue(c)) row.overdue += 1;
      if ((severity(c) === "high" || severity(c) === "critical") && c.status !== "done") row.highOpen += 1;
      if (c.status !== "done" && evidenceRequired(c) && evidenceCountFor(ev, c.id) === 0) row.evidenceMissing += 1;
    }

    return Array.from(map.values())
      .map((r) => ({ ...r, pct: r.total ? Math.round((r.done / r.total) * 100) : 0 }))
      .sort(
        (a, b) =>
          (b.delayed + b.overdue + b.highOpen + b.evidenceMissing) -
            (a.delayed + a.overdue + a.highOpen + a.evidenceMissing) ||
          a.category.localeCompare(b.category)
      );
  }, [criteria, evidence]);

  const riskHeatmap = useMemo(() => {
    return byCategory
      .map((r) => {
        const riskScore = r.total
          ? Math.round(
              ((r.delayed * 6 +
                r.overdue * 4 +
                r.highOpen * 3 +
                r.evidenceMissing * 2 +
                Math.max(0, r.total - r.done) * 0.5) /
                Math.max(1, r.total)) *
                10
            )
          : 0;

        const score = clamp(riskScore, 0, 100);
        const rag: "green" | "amber" | "red" = score >= 60 ? "red" : score >= 30 ? "amber" : "green";
        return { ...r, riskScore: score, rag };
      })
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.category.localeCompare(b.category));
  }, [byCategory]);

  const attention = useMemo(() => {
    const all = safeArr<Criterion>(criteria);
    const ev = safeArr<Evidence>(evidence);

    const rows = all
      .map((c) => {
        const overdue = isOverdue(c);
        const blocked = c.status === "delayed";
        const high = (severity(c) === "high" || severity(c) === "critical") && c.status !== "done";
        const evMiss = c.status !== "done" && evidenceRequired(c) && evidenceCountFor(ev, c.id) === 0;
        const caveat = c.status === "caveat";
        const score = (blocked ? 100 : 0) + (overdue ? 60 : 0) + (high ? 25 : 0) + (evMiss ? 15 : 0) + (caveat ? 10 : 0);

        return {
          id: c.id,
          title: c.title,
          category: c.category ?? "Uncategorised",
          owner: c.owner_email ?? "",
          status: c.status,
          due: c.due_date ?? "",
          caveat_reason: c.caveat_reason ?? "",
          blocked,
          overdue,
          high,
          evMiss,
          caveat,
          score,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    return issueFilter === "all"
      ? rows
      : issueFilter === "blocked"
      ? rows.filter((r) => r.blocked)
      : issueFilter === "overdue"
      ? rows.filter((r) => r.overdue)
      : issueFilter === "high"
      ? rows.filter((r) => r.high)
      : issueFilter === "evidence"
      ? rows.filter((r) => r.evMiss)
      : rows.filter((r) => r.caveat);
  }, [criteria, evidence, issueFilter]);

  const weeklyEvidence = useMemo(() => {
    const ev = safeArr<Evidence>(evidence);
    const counts = new Map<string, { week: string; notes: number; evidence: number }>();

    for (const e of ev) {
      const t = Date.parse(e.uploaded_at);
      if (!Number.isFinite(t)) continue;
      const wk = weekKey(new Date(t));
      if (!counts.has(wk)) counts.set(wk, { week: wk, notes: 0, evidence: 0 });
      const row = counts.get(wk)!;
      if (e.kind === "note") row.notes += 1;
      else row.evidence += 1;
    }

    const all = Array.from(counts.values()).sort((a, b) => a.week.localeCompare(b.week));
    return all.slice(-weeks);
  }, [evidence, weeks]);

  const owners = useMemo(() => {
    const all = safeArr<Criterion>(criteria);
    const ev = safeArr<Evidence>(evidence);
    const map = new Map<
      string,
      { owner: string; open: number; blocked: number; overdue: number; high: number; evidenceMissing: number }
    >();

    for (const c of all) {
      const k = c.owner_email ?? "Unassigned";
      if (!map.has(k)) map.set(k, { owner: k, open: 0, blocked: 0, overdue: 0, high: 0, evidenceMissing: 0 });
      const r = map.get(k)!;
      if (c.status !== "done") r.open += 1;
      if (c.status === "delayed") r.blocked += 1;
      if (isOverdue(c)) r.overdue += 1;
      if ((severity(c) === "high" || severity(c) === "critical") && c.status !== "done") r.high += 1;
      if (c.status !== "done" && evidenceRequired(c) && evidenceCountFor(ev, c.id) === 0) r.evidenceMissing += 1;
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        b.blocked + b.overdue + b.high + b.evidenceMissing - (a.blocked + a.overdue + a.high + a.evidenceMissing) ||
        a.owner.localeCompare(b.owner)
    );
  }, [criteria, evidence]);

  const recentActivity = useMemo(() => {
    const ev = safeArr<Evidence>(evidence);
    return ev
      .slice()
      .sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1))
      .slice(0, view === "summary" ? 8 : 18)
      .map((e) => ({
        id: e.id,
        at: e.uploaded_at,
        who: e.created_by ?? "Unknown",
        kind: e.kind,
        detail: e.kind === "note" ? String(e.note ?? "").slice(0, 120) : e.url ?? "",
      }));
  }, [evidence, view]);

  const snapshotKey = useMemo(() => `or360-snapshot-${activeProjectId ?? "none"}`, [activeProjectId]);

  const lastSnapshot = useMemo<Snapshot | null>(() => {
    try {
      const raw = localStorage.getItem(snapshotKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Snapshot;
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }, [snapshotKey]);

  const snapshotDelta = useMemo(() => {
    if (!lastSnapshot) return null;
    return {
      since: lastSnapshot.saved_at,
      pct: stats.pct - lastSnapshot.pct,
      done: stats.done - lastSnapshot.done,
      delayed: stats.delayed - lastSnapshot.delayed,
      overdue: stats.overdue - lastSnapshot.overdue,
      highOpen: stats.highOpen - lastSnapshot.highOpen,
      evidenceMissing: stats.evidenceMissing - lastSnapshot.evidenceMissing,
      caveat: stats.caveat - lastSnapshot.caveat,
    };
  }, [lastSnapshot, stats]);

  const snapshotsKey = useMemo(() => `or360-snapshots-${activeProjectId ?? "none"}`, [activeProjectId]);

  const snapshotHistory = useMemo<Snapshot[]>(() => {
    try {
      const raw = localStorage.getItem(snapshotsKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(Boolean) as Snapshot[];
    } catch {
      return [];
    }
  }, [snapshotsKey]);

  const trajectory = useMemo(() => {
    const hist = [...snapshotHistory];
    const today: Snapshot = {
      saved_at: new Date().toISOString(),
      pct: stats.pct,
      total: stats.total,
      done: stats.done,
      inprog: stats.inprog,
      notStarted: stats.notStarted,
      delayed: stats.delayed,
      caveat: stats.caveat,
      overdue: stats.overdue,
      highOpen: stats.highOpen,
      evidenceMissing: stats.evidenceMissing,
    };
    hist.push(today);
    hist.sort((a, b) => String(a.saved_at).localeCompare(String(b.saved_at)));
    return hist.slice(-12);
  }, [snapshotHistory, stats]);

  const reportText = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    const lines: string[] = [];
    lines.push(`# Operational Readiness Weekly Report`);
    lines.push(`Project: ${projectName}`);
    lines.push(`Date: ${now}`);
    lines.push("");
    lines.push(`Health: ${rag.rag.toUpperCase()} (${rag.note})`);
    lines.push("");
    lines.push(`## KPIs`);
    lines.push(`- Completion: ${stats.pct}% (${stats.done}/${stats.total})`);
    lines.push(`- Blockers (Delayed): ${stats.delayed}`);
    lines.push(`- Overdue: ${stats.overdue}`);
    lines.push(`- High severity open: ${stats.highOpen}`);
    lines.push(`- Evidence missing: ${stats.evidenceMissing}`);
    lines.push(`- Caveats: ${stats.caveat}`);
    lines.push("");

    if (snapshotDelta) {
      const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
      const since = String(snapshotDelta.since ?? "").slice(0, 10) || "—";
      lines.push(`## Change since last snapshot (${since})`);
      lines.push(`- Completion: ${sign(snapshotDelta.pct)}%`);
      lines.push(`- Blockers: ${sign(snapshotDelta.delayed)}`);
      lines.push(`- Overdue: ${sign(snapshotDelta.overdue)}`);
      lines.push(`- High open: ${sign(snapshotDelta.highOpen)}`);
      lines.push(`- Evidence missing: ${sign(snapshotDelta.evidenceMissing)}`);
      lines.push(`- Caveats: ${sign(snapshotDelta.caveat)}`);
      lines.push("");
    }

    lines.push(`## Top issues`);
    safeArr<any>(attention)
      .slice(0, 12)
      .forEach((a) => {
        const tags = [a.blocked ? "BLOCKER" : null, a.overdue ? "OVERDUE" : null, a.high ? "HIGH" : null, a.evMiss ? "EVIDENCE" : null, a.caveat ? "CAVEAT" : null].filter(Boolean);
        lines.push(`- [${tags.join(", ")}] ${a.title} (${a.category}${a.owner ? ` · ${a.owner}` : ""})`);
      });

    lines.push("");
    lines.push(`## Highest-risk categories`);
    safeArr<any>(riskHeatmap)
      .slice(0, 6)
      .forEach((r) => {
        lines.push(`- ${r.category}: ${r.rag.toUpperCase()} (risk ${r.riskScore}/100 · ${r.pct}% complete)`);
      });

    lines.push("");
    lines.push(`## Notes`);
    lines.push(`- Next review:`);
    lines.push(`- Decisions / escalations:`);
    return lines.join("\n");
  }, [projectName, rag, stats, attention, riskHeatmap, snapshotDelta]);

  const saveSnapshot = () => {
    const snap: Snapshot = {
      saved_at: new Date().toISOString(),
      pct: stats.pct,
      total: stats.total,
      done: stats.done,
      inprog: stats.inprog,
      notStarted: stats.notStarted,
      delayed: stats.delayed,
      caveat: stats.caveat,
      overdue: stats.overdue,
      highOpen: stats.highOpen,
      evidenceMissing: stats.evidenceMissing,
    };
    localStorage.setItem(snapshotKey, JSON.stringify(snap));
    try {
      const raw = localStorage.getItem(snapshotsKey);
      const arr = raw ? JSON.parse(raw) : [];
      const list: Snapshot[] = Array.isArray(arr) ? (arr as Snapshot[]) : [];
      list.push(snap);
      const trimmed = list.slice(-26);
      localStorage.setItem(snapshotsKey, JSON.stringify(trimmed));
    } catch {}
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full space-y-5">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-2xl font-semibold text-slate-900">{projectName}</div>
              <HealthBadge rag={rag.rag} note={rag.note} />
              {snapshotDelta ? (
                <span className="hidden lg:inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                  Since {String(snapshotDelta.since ?? "").slice(0, 10) || "—"}: {snapshotDelta.pct > 0 ? "+" : ""}
                  {snapshotDelta.pct}% completion
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={activeProjectId ?? ""}
                onChange={(e) => setActiveProjectId(e.target.value)}
              >
                {safeArr<Project>(projects).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {activeProjectId ? (
                <>
                  <Link
                    to={`/projects/${activeProjectId}`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    Checklist
                  </Link>

                  <Link
                    to={`/projects/${activeProjectId}/dashboard`}
                    className="rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                  >
                    Dashboard
                  </Link>

                  <Link
                    to={`/projects/${activeProjectId}/allocate`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    Allocate
                  </Link>

                  <Link
                    to={`/projects/${activeProjectId}/settings`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    Settings
                  </Link>

                  <Link
                    to={`/projects/${activeProjectId}/evidence`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    Evidence
                  </Link>
                </>
              ) : null}

              <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
                <button
                  className={`rounded-lg px-3 py-1 text-sm ${
                    view === "summary" ? "bg-slate-900 text-white" : "text-slate-700"
                  }`}
                  onClick={() => setView("summary")}
                >
                  Summary
                </button>
                <button
                  className={`rounded-lg px-3 py-1 text-sm ${
                    view === "detailed" ? "bg-slate-900 text-white" : "text-slate-700"
                  }`}
                  onClick={() => setView("detailed")}
                >
                  Detailed
                </button>
              </div>

              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                onClick={() => setReportOpen(true)}
              >
                Weekly report
              </button>

              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                onClick={saveSnapshot}
              >
                Save snapshot
              </button>
            </div>
          </div>
        </header>

        {err ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{err}</div> : null}
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">Loading…</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Completion</div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">{stats.pct}%</div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${stats.pct}%` }} />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {stats.done}/{stats.total} done
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              stats.delayed ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-xs text-slate-500">Blockers</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.delayed}</div>
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              stats.overdue ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-xs text-slate-500">Overdue</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.overdue}</div>
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              stats.highOpen ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-xs text-slate-500">High open</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.highOpen}</div>
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              stats.evidenceMissing ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-xs text-slate-500">Evidence missing</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.evidenceMissing}</div>
          </div>
        </div>

        <div className="grid gap-4 2xl:grid-cols-12">
          <div className="2xl:col-span-4 space-y-4">
            <Card title="Status breakdown">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={85}>
                      {byStatus.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip />
                    <RLegend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card
              title="Evidence activity"
              right={
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Weeks</span>
                  <select
                    className="rounded-md border border-slate-200 bg-white px-2 py-1"
                    value={weeks}
                    onChange={(e) => setWeeks(Number(e.target.value) as any)}
                  >
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                  </select>
                </div>
              }
            >
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyEvidence} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <RTooltip />
                    <Bar dataKey="notes" fill="#94a3b8" name="Notes" />
                    <Bar dataKey="evidence" fill="#0ea5e9" name="Evidence" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="2xl:col-span-8 space-y-4">
            <Card
              title="Attention needed"
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <Pill active={issueFilter === "all"} onClick={() => setIssueFilter("all")}>
                    All
                  </Pill>
                  <Pill active={issueFilter === "blocked"} onClick={() => setIssueFilter("blocked")}>
                    Blocked
                  </Pill>
                  <Pill active={issueFilter === "overdue"} onClick={() => setIssueFilter("overdue")}>
                    Overdue
                  </Pill>
                  <Pill active={issueFilter === "high"} onClick={() => setIssueFilter("high")}>
                    High
                  </Pill>
                  <Pill active={issueFilter === "evidence"} onClick={() => setIssueFilter("evidence")}>
                    Evidence
                  </Pill>
                  <Pill active={issueFilter === "caveat"} onClick={() => setIssueFilter("caveat")}>
                    Caveat
                  </Pill>

                  <button
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() =>
                      downloadCSV(
                        `or360-attention-${projectName}-${new Date().toISOString().slice(0, 10)}.csv`,
                        safeArr<any>(attention).slice(0, 200)
                      )
                    }
                  >
                    Export CSV
                  </button>
                </div>
              }
            >
              {attention.length === 0 ? (
                <div className="text-sm text-slate-600">Nothing flagged. Nice.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr className="border-b border-slate-100">
                        <th className="py-2 text-left">Tags</th>
                        <th className="py-2 text-left">Criterion</th>
                        <th className="py-2 text-left">Category</th>
                        <th className="py-2 text-left">Owner</th>
                        <th className="py-2 text-left">Due</th>
                        <th className="py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {safeArr<any>(attention)
                        .slice(0, view === "summary" ? 8 : 40)
                        .map((a) => (
                          <tr key={a.id} className="align-top">
                            <td className="py-2">
                              <div className="flex flex-wrap gap-1">
                                {a.blocked ? (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                                    BLOCKER
                                  </span>
                                ) : null}
                                {a.overdue ? (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                                    OVERDUE
                                  </span>
                                ) : null}
                                {a.high ? (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                    HIGH
                                  </span>
                                ) : null}
                                {a.evMiss ? (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                    EVIDENCE
                                  </span>
                                ) : null}
                                {a.caveat ? (
                                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                                    CAVEAT
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2">{a.title}</td>
                            <td className="py-2">{a.category}</td>
                            <td className="py-2">{a.owner || "—"}</td>
                            <td className="py-2">{fmtDate(a.due)}</td>
                            <td className="py-2">{a.status}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              {view === "detailed" ? (
                <Card title="Readiness trajectory" subtitle="Snapshots over time (plus today)">
                  <TrajectoryChart points={trajectory} />
                </Card>
              ) : null}

              <Card
                title="Risk heatmap"
                right={
                  <button
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() =>
                      downloadCSV(
                        `or360-risk-heatmap-${projectName}-${new Date().toISOString().slice(0, 10)}.csv`,
                        safeArr<any>(riskHeatmap).slice(0, 999)
                      )
                    }
                  >
                    Export CSV
                  </button>
                }
              >
                <div className="space-y-2">
                  {safeArr<any>(riskHeatmap)
                    .slice(0, view === "summary" ? 6 : 12)
                    .map((r) => (
                      <div key={r.category} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">{r.category}</div>
                          <div className="text-xs text-slate-500">
                            {r.pct}% complete · {r.total - r.done} open · {r.delayed} blockers · {r.overdue} overdue
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${
                              r.rag === "red"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : r.rag === "amber"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {r.rag.toUpperCase()}
                          </span>
                          <span className="w-12 text-right text-xs text-slate-600">{r.riskScore}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>

              <Card
                title="Owner workload"
                right={
                  <button
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() =>
                      downloadCSV(
                        `or360-owners-${projectName}-${new Date().toISOString().slice(0, 10)}.csv`,
                        safeArr<any>(owners).slice(0, 999)
                      )
                    }
                  >
                    Export CSV
                  </button>
                }
              >
                <div className="space-y-2">
                  {safeArr<any>(owners)
                    .slice(0, view === "summary" ? 6 : 12)
                    .map((o) => (
                      <div key={o.owner} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">{o.owner}</div>
                          <div className="text-xs text-slate-500">{o.open} open</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          {o.blocked ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                              B {o.blocked}
                            </span>
                          ) : null}
                          {o.overdue ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                              O {o.overdue}
                            </span>
                          ) : null}
                          {o.high ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                              H {o.high}
                            </span>
                          ) : null}
                          {o.evidenceMissing ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                              E {o.evidenceMissing}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </div>

            <Card title="Recent activity">
              {recentActivity.length === 0 ? (
                <div className="text-sm text-slate-600">No activity yet.</div>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((a) => (
                    <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-600">
                          <span className="font-medium text-slate-800">{a.kind.toUpperCase()}</span> · {fmtDate(a.at)} ·{" "}
                          {a.who}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-slate-800">{a.detail || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        <Modal
          title="Weekly report"
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          footer={
            <>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => navigator.clipboard.writeText(reportText)}
              >
                Copy
              </button>
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() =>
                  downloadText(`or360-weekly-report-${projectName}-${new Date().toISOString().slice(0, 10)}.md`, reportText)
                }
              >
                Download
              </button>
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                onClick={() => setReportOpen(false)}
              >
                Done
              </button>
            </>
          }
        >
          <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">{reportText}</pre>
        </Modal>
      </div>
    </div>
  );
}