import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { ChevronDown, ChevronRight } from "lucide-react";
import { generateCertificate } from "./lib/certificate";
import { Link } from "react-router-dom";

import CriteriaCard, { type CriteriaStatus } from "./components/CriteriaCard";
import CriteriaRow from "./components/CriteriaRow";
import ConfirmDialog from "./components/ConfirmDialog";

/** Types **/
export type Criterion = {
  id: string;
  project_id: string;
  title: string;
  status: "not_started" | "in_progress" | "done" | "delayed" | "caveat" | string;
  category?: string | null;
  created_at?: string;
  updated_at?: string | null;
  owner_email?: string | null;
  due_date?: string | null;
  caveat_reason?: string | null;
  meta?: any;
  description?: string | null;
  section_order?: number | null;
  item_order?: number | null;
};

export type Evidence = {
  id: string;
  criterion_id: string;
  kind: "note" | "link" | "file";
  note?: string | null;
  url?: string | null;
  uploaded_at: string;
  created_by?: string | null;
  updated_at?: string | null;
  meta?: any;
  file_path?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
};

export type Project = {
  id: string;
  name: string;
  status: string;
  created_at: string;
};

/** Helpers **/
function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
      {message}
    </div>
  );
}

function fmtPct(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function isOverdue(c: Criterion) {
  if (!c.due_date) return false;
  if (c.status === "done") return false;
  const t = Date.parse(c.due_date);
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

function isHighSeverity(c: Criterion) {
  const raw = (c.meta?.severity ?? c.meta?.SEVERITY ?? "").toString().toLowerCase();
  return raw === "high" || raw === "critical";
}

function evidenceRequired(c: Criterion) {
  return !!(c.meta?.evidence_required ?? c.meta?.evidenceRequired ?? c.meta?.EVIDENCE_REQUIRED);
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

function SectionBadge({
  rag,
  score,
}: {
  rag: "green" | "amber" | "red";
  score: number;
}) {
  const cls =
    rag === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : rag === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-rose-200 bg-rose-50 text-rose-700";
  const label = rag === "green" ? "GREEN" : rag === "amber" ? "AMBER" : "RED";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <span>{label}</span>
      <span className="opacity-80">· {score}</span>
    </span>
  );
}

type KPICardProps = {
  title: string;
  value: string | number;
  hint?: string;
  active?: boolean;
  tone?: "neutral" | "warning" | "danger";
  onClick?: () => void;
  children?: React.ReactNode;
};

function KPIBox({ title, value, hint, active, tone = "neutral", onClick, children }: KPICardProps) {
  const toneCls =
    tone === "danger"
      ? "border-rose-200 bg-rose-50"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-white";

  const activeCls = active ? "ring-2 ring-slate-900" : "";
  const clickableCls = onClick ? "cursor-pointer hover:bg-slate-50" : "";

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${toneCls} ${activeCls} ${clickableCls}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export default function App() {
  // Expose supabase in dev console
  useEffect(() => {
    (window as any).__sb = supabase;
  }, []);

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  const activeProject = useMemo(
    () => (projects || []).find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({}); // category collapse
  const [compactView, setCompactView] = useState(true); // Compact vs Detailed
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({});

  type QuickFilter = "blocked" | "overdue" | "high" | "evidence" | null;
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);

  // Add Link modal
  const [linkForId, setLinkForId] = useState<string | null>(null);
  const [linkURL, setLinkURL] = useState("");
  const [linkErr, setLinkErr] = useState<string | null>(null);

  // Delete Evidence modal
  const [delEv, setDelEv] = useState<{ id: string; name: string } | null>(null);

  function openLinkModal(criterionId: string) {
    setLinkForId(criterionId);
    setLinkURL("");
    setLinkErr(null);
  }
  function closeLinkModal() {
    setLinkForId(null);
    setLinkURL("");
    setLinkErr(null);
  }
  async function confirmAddLink() {
    const v = linkURL.trim();
    if (!v) {
      setLinkErr("Please enter a URL or reference.");
      return;
    }
    if (!linkForId) return;
    await addLink(linkForId, v);
    closeLinkModal();
  }

  function openDeleteModal(opts: { id: string; name: string }) {
    setDelEv(opts);
  }
  function closeDeleteModal() {
    setDelEv(null);
  }
  async function confirmDeleteEvidence() {
    if (!delEv) return;
    await deleteEvidence(delEv.id);
    setDelEv(null);
  }

  // Persist last project id for nav
  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem("lastProjectId", activeProjectId);
      window.dispatchEvent(new CustomEvent("last-project-changed", { detail: activeProjectId }));
    }
  }, [activeProjectId]);

  // Auto sign-in (demo creds) + load projects
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        const email = import.meta.env.VITE_DEMO_EMAIL as string;
        const password = import.meta.env.VITE_DEMO_PASSWORD as string;
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) {
          setErr(`Sign-in failed: ${signInErr.message}`);
          return;
        }
        setCurrentUserEmail(signInData.user?.email ?? null);
      } else {
        const { data: userData } = await supabase.auth.getUser();
        setCurrentUserEmail(userData.user?.email ?? null);
      }

      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,created_at")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        setErr(error.message);
        return;
      }
      setProjects(data ?? []);
      if (!activeProjectId && data && data.length > 0) setActiveProjectId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset per-item expansion when switching projects
  useEffect(() => {
    setExpandedCriteria({});
  }, [activeProjectId]);

  // Load criteria + evidence for active project
  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    setErr(null);

    (async () => {
      const { data: crits, error } = await supabase
        .from("criteria")
        .select(
          "id,project_id,title,status,category,section_order,item_order,description,meta,owner_email,due_date,caveat_reason,created_at,updated_at"
        )
        .eq("project_id", activeProjectId)
        .order("section_order", { ascending: true, nullsFirst: false })
        .order("item_order", { ascending: true, nullsFirst: false })
        .order("title", { ascending: true });

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const critList = (crits ?? []) as Criterion[];
      setCriteria(critList);

      const ids = critList.map((c) => c.id);
      if (ids.length) {
        const { data: ev, error: evErr } = await supabase
          .from("evidence")
          .select(
            "id,criterion_id,kind,note,url,file_path,mime_type,size_bytes,uploaded_at,created_by,updated_at,meta"
          )
          .in("criterion_id", ids);

        if (evErr) setErr(evErr.message);
        setEvidence((ev ?? []) as Evidence[]);
      } else {
        setEvidence([]);
      }

      setLoading(false);
    })();
  }, [activeProjectId]);

  /** Evidence counts **/
  const evidenceCountByCriterion = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of evidence) {
      if (n.kind === "note") continue;
      map.set(n.criterion_id, (map.get(n.criterion_id) ?? 0) + 1);
    }
    return map;
  }, [evidence]);

  /** KPI + RAG **/
  const stats = useMemo(() => {
    const all = criteria ?? [];
    const total = all.length;
    const done = all.filter((c) => c.status === "done").length;
    const inprog = all.filter((c) => c.status === "in_progress").length;
    const delayed = all.filter((c) => c.status === "delayed").length;
    const caveat = all.filter((c) => c.status === "caveat").length;
    const notStarted = total - done - inprog - delayed - caveat;

    const blockedCount = delayed;
    const overdueCount = all.filter((c) => isOverdue(c)).length;
    const highOpenCount = all.filter((c) => c.status !== "done" && isHighSeverity(c)).length;

    const evidenceMissingCount = all.filter((c) => {
      if (c.status === "done") return false;
      if (!evidenceRequired(c)) return false;
      return (evidenceCountByCriterion.get(c.id) ?? 0) === 0;
    }).length;

    const readinessPct = fmtPct(done, total);

    return {
      total,
      done,
      inprog,
      delayed,
      caveat,
      notStarted,
      readinessPct,
      blockedCount,
      overdueCount,
      highOpenCount,
      evidenceMissingCount,
    };
  }, [criteria, evidenceCountByCriterion]);

  const rag = useMemo(() => {
    if (stats.total === 0) return { rag: "green" as const, note: "No criteria" };
    if (stats.blockedCount > 0) return { rag: "red" as const, note: `${stats.blockedCount} blocker(s)` };
    if (stats.overdueCount > 0) return { rag: "red" as const, note: `${stats.overdueCount} overdue` };
    if (stats.highOpenCount > 0) return { rag: "amber" as const, note: `${stats.highOpenCount} high severity open` };
    if (stats.evidenceMissingCount > 0)
      return { rag: "amber" as const, note: `${stats.evidenceMissingCount} evidence missing` };
    if (stats.caveat > 0) return { rag: "amber" as const, note: `${stats.caveat} caveat(s)` };
    return { rag: "green" as const, note: "On track" };
  }, [stats]);

  /** Derived list **/
  const filtered = useMemo(() => {
    const list = criteria ?? [];
    const q = search.trim().toLowerCase();

    const matchesSearch = (c: Criterion) => {
      if (!q) return true;
      const hay = [c.title, c.category ?? "", c.description ?? "", c.meta?.description ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    };

    const matchesQuick = (c: Criterion) => {
      if (!quickFilter) return true;

      if (quickFilter === "blocked") return c.status === "delayed";
      if (quickFilter === "overdue") return isOverdue(c);
      if (quickFilter === "high") return c.status !== "done" && isHighSeverity(c);

      if (quickFilter === "evidence") {
        if (c.status === "done") return false;
        if (!evidenceRequired(c)) return false;
        return (evidenceCountByCriterion.get(c.id) ?? 0) === 0;
      }

      return true;
    };

    return list.filter((c) => matchesSearch(c) && matchesQuick(c));
  }, [criteria, search, quickFilter, evidenceCountByCriterion]);

  const groupedList = useMemo(() => {
    const map = new Map<string, { section_order: number; items: Criterion[] }>();

    for (const c of filtered) {
      const cat = c.category ?? "Uncategorised";
      const so = c.section_order ?? 999;
      if (!map.has(cat)) map.set(cat, { section_order: so, items: [] });

      const g = map.get(cat)!;
      g.section_order = Math.min(g.section_order, so);
      g.items.push(c);
    }

    const groups = Array.from(map.entries()).map(([category, v]) => ({
      category,
      section_order: v.section_order,
      items: v.items.sort(
        (a, b) => (a.item_order ?? 9999) - (b.item_order ?? 9999) || a.title.localeCompare(b.title)
      ),
    }));

    groups.sort((a, b) => a.section_order - b.section_order || a.category.localeCompare(b.category));
    return groups;
  }, [filtered]);

  /** Score-based section health (mirrors Dashboard weighting + thresholds) **/
  const sectionHealth = useMemo(() => {
    const m = new Map<string, { rag: "green" | "amber" | "red"; riskScore: number; note: string }>();

    const scoreFor = (items: Criterion[]) => {
      const total = items.length;
      const done = items.filter((c) => c.status === "done").length;
      const open = total - done;

      const blockers = items.filter((c) => c.status === "delayed").length;
      const overdue = items.filter((c) => isOverdue(c)).length;
      const highOpen = items.filter((c) => c.status !== "done" && isHighSeverity(c)).length;
      const evidenceMissing = items.filter((c) => {
        if (c.status === "done") return false;
        if (!evidenceRequired(c)) return false;
        return (evidenceCountByCriterion.get(c.id) ?? 0) === 0;
      }).length;

      const raw = total
        ? Math.round(
            ((blockers * 6 + overdue * 4 + highOpen * 3 + evidenceMissing * 2 + open * 0.5) / Math.max(1, total)) *
              10
          )
        : 0;

      const riskScore = clamp(raw, 0, 100);
      const rag: "green" | "amber" | "red" = riskScore >= 60 ? "red" : riskScore >= 30 ? "amber" : "green";

      const note =
        blockers > 0
          ? `${blockers} blocker${blockers === 1 ? "" : "s"}`
          : overdue > 0
          ? `${overdue} overdue`
          : highOpen > 0
          ? `${highOpen} high open`
          : evidenceMissing > 0
          ? `${evidenceMissing} evidence missing`
          : open > 0
          ? `${open} open`
          : "On track";

      return { rag, riskScore, note };
    };

    for (const g of groupedList) {
      m.set(g.category, scoreFor(g.items));
    }
    return m;
  }, [groupedList, evidenceCountByCriterion]);

  /** Actions **/
  async function handleUpdateStatus(id: string, status: Criterion["status"]) {
    const snapshot = criteria;
    setCriteria((prev) => prev?.map((c) => (c.id === id ? { ...c, status } : c)) ?? prev);

    // IMPORTANT: do NOT auto-expand in compact mode.
    // Leave expandedCriteria exactly as the user set it.

    const { error } = await supabase.rpc("set_criterion_status", {
      p_id: id,
      p_status: status,
    });

    if (error) {
      setErr(`Failed to update status: ${error.message}`);
      setCriteria(snapshot);
      return;
    }

    const label =
      status === "not_started"
        ? "Not started"
        : status === "in_progress"
        ? "In progress"
        : status === "done"
        ? "Done"
        : status === "delayed"
        ? "Delayed"
        : status === "caveat"
        ? "Caveat"
        : String(status);

    // Add an activity note
    await supabase.from("evidence").insert({
      criterion_id: id,
      kind: "note",
      note: `Status changed to: ${label}`,
      created_by: currentUserEmail,
    });

    // Optimistic UI: prepend a local evidence note
    setEvidence((prev) => [
      {
        id: `local-${Math.random().toString(36).slice(2)}`,
        criterion_id: id,
        kind: "note",
        note: `Status changed to: ${label}`,
        uploaded_at: new Date().toISOString(),
        created_by: currentUserEmail ?? "Unknown",
      },
      ...prev,
    ]);
  }

  async function addNote(criterionId: string, text: string) {
    const v = text.trim();
    if (!v) return;

    const { data, error } = await supabase
      .from("evidence")
      .insert({
        criterion_id: criterionId,
        kind: "note",
        note: v,
        created_by: currentUserEmail,
      })
      .select(
        "id,criterion_id,kind,note,url,file_path,mime_type,size_bytes,uploaded_at,created_by,updated_at,meta"
      )
      .single();

    if (error) {
      setErr(error.message);
      return;
    }
    setEvidence((prev) => [data as Evidence, ...prev]);
  }

  async function uploadFile(criterionId: string, file: File) {
    const path = `${criterionId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("evidence").upload(path, file);
    if (error) {
      alert("Upload failed: " + error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("evidence").getPublicUrl(path);
    const publicUrl = pub?.publicUrl || null;

    const { data: fileRow, error: insErr } = await supabase
      .from("evidence")
      .insert({
        criterion_id: criterionId,
        kind: "file",
        file_path: path,
        url: publicUrl,
        mime_type: file.type || null,
        size_bytes: file.size ?? null,
        created_by: currentUserEmail,
        meta: { storage_path: path },
      })
      .select(
        "id,criterion_id,kind,note,url,file_path,mime_type,size_bytes,uploaded_at,created_by,updated_at,meta"
      )
      .single();

    if (insErr) {
      setErr(insErr.message);
      return;
    }
    setEvidence((prev) => [fileRow as Evidence, ...prev]);
  }

  async function addLink(criterionId: string, url: string) {
    const v = url.trim();
    if (!v) return;

    const { data, error } = await supabase
      .from("evidence")
      .insert({
        criterion_id: criterionId,
        kind: "link",
        url: v,
        created_by: currentUserEmail,
      })
      .select(
        "id,criterion_id,kind,note,url,file_path,mime_type,size_bytes,uploaded_at,created_by,updated_at,meta"
      )
      .single();

    if (error) {
      setErr(error.message);
      return;
    }
    setEvidence((prev) => [data as Evidence, ...prev]);
  }

  async function deleteEvidence(evidenceId: string) {
    try {
      const row = evidence.find((n) => n.id === evidenceId);
      if (!row) return;

      if (row.kind === "note") {
        alert("Activity notes cannot be deleted.");
        return;
      }

      if (row.kind === "file" && row.file_path) {
        try {
          await supabase.storage.from("evidence").remove([row.file_path]);
        } catch {}
      }

      const { error } = await supabase.from("evidence").delete().eq("id", evidenceId);
      if (error) throw error;

      setEvidence((prev) => prev.filter((n) => n.id !== evidenceId));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  function promptEvidenceUpload(criterionId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const f = (input.files && input.files[0]) || null;
      if (f) uploadFile(criterionId, f);
    };
    input.click();
  }

  function renderCriterionCard(c: Criterion) {
    const critEvidence = evidence.filter((n) => n.criterion_id === c.id);

    const activities = critEvidence
      .filter((n) => n.kind === "note")
      .map((n) => ({
        id: n.id,
        type: "note" as const,
        summary: n.note ?? "",
        created_at: n.uploaded_at,
        created_by: n.created_by ?? "Unknown",
      }));

    const evItems = critEvidence
      .filter((n) => n.kind !== "note")
      .map((ev) => {
        const isFile = ev.kind === "file";
        const name =
          (ev.file_path ?? "").split("/").pop() ||
          (ev.url ?? "").split("/").pop() ||
          (isFile ? "file" : ev.url ?? "link");
        return {
          id: ev.id,
          name,
          url: ev.url ?? undefined,
          file: isFile,
          created_at: ev.uploaded_at,
          created_by: ev.created_by ?? "Unknown",
        };
      });

    const last = [...critEvidence].sort((a, b) => (+new Date(a.uploaded_at) < +new Date(b.uploaded_at) ? 1 : -1))[0];

    const last_action = last
      ? {
          type: last.kind,
          summary: last.kind === "note" ? last.note ?? "" : last.url ?? (last as any).file_path ?? "",
          at: last.uploaded_at,
          by: last.created_by ?? "Unknown",
        }
      : null;

    return (
      <CriteriaCard
        key={c.id}
        item={{
          id: c.id,
          title: c.title,
          description: (c as any).description ?? c.meta?.description ?? "",
          category: c.category ?? "",
          severity: c.meta?.severity ?? "",
          status: c.status as CriteriaStatus,
          owner_email: c.owner_email ?? "",
          due_date: c.due_date ?? "",
          last_action,
        }}
        activities={activities}
        evidence={evItems as any}
        onChangeStatus={(next) => handleUpdateStatus(c.id, next as CriteriaStatus)}
        onChangeOwner={(email) => updateOwner(c.id, email)}
        onChangeDueDate={(dateISO) => updateDueDate(c.id, dateISO)}
        onAddNote={(text) => addNote(c.id, text)}
        onAddEvidenceFile={() => promptEvidenceUpload(c.id)}
        onAddEvidenceLink={() => openLinkModal(c.id)}
        onRequestDeleteEvidence={(opts) => openDeleteModal(opts)}
      />
    );
  }

  // Completion bar width
  const progressPct = clamp(stats.readinessPct, 0, 100);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full space-y-5">
        {/* Header */}
        <header className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="max-w-[46ch] truncate text-lg font-semibold text-slate-900">
                {activeProject?.name || "—"}
              </div>
              <HealthBadge rag={rag.rag} note={rag.note} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
  <select
    className="rounded-xl border border-slate-200 bg-white px-3 py-2"
    value={activeProjectId ?? ""}
    onChange={(e) => setActiveProjectId(e.target.value)}
  >
    {projects?.map((p) => (
      <option key={p.id} value={p.id}>
        {p.name}
      </option>
    ))}
  </select>

  {activeProjectId ? (
    <>
      <Link
        to={`/projects/${activeProjectId}`}
        className="rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
      >
        Checklist
      </Link>

      <Link
        to={`/projects/${activeProjectId}/dashboard`}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100"
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

  <button
    onClick={() => {
      if (!activeProjectId || !projects || !criteria) return;
      const project = projects.find((p) => p.id === activeProjectId);
      if (!project) return;
      generateCertificate(
        { id: project.id, name: project.name },
        (criteria ?? []).map((c) => ({
          title: c.title,
          status: String(c.status),
          owner_email: c.owner_email ?? null,
          due_date: c.due_date ?? null,
          caveat_reason: c.caveat_reason ?? null,
        }))
      );
    }}
    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100"
  >
    Certificate
  </button>
</div>
          </div>

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {err}
            </div>
          )}
        </header>

        {/* KPI Strip */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KPIBox
            title="Completion"
            value={`${stats.readinessPct}%`}
            hint={`${stats.done}/${stats.total} done`}
            tone="neutral"
            onClick={() => setQuickFilter(null)}
            active={!quickFilter}
          >
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
            </div>
          </KPIBox>

          <KPIBox
            title="Blockers"
            value={stats.blockedCount}
            tone={stats.blockedCount > 0 ? "danger" : "neutral"}
            active={quickFilter === "blocked"}
            onClick={() => setQuickFilter((v) => (v === "blocked" ? null : "blocked"))}
          />

          <KPIBox
            title="Overdue"
            value={stats.overdueCount}
            tone={stats.overdueCount > 0 ? "danger" : "neutral"}
            active={quickFilter === "overdue"}
            onClick={() => setQuickFilter((v) => (v === "overdue" ? null : "overdue"))}
          />

          <KPIBox
            title="High open"
            value={stats.highOpenCount}
            tone={stats.highOpenCount > 0 ? "warning" : "neutral"}
            active={quickFilter === "high"}
            onClick={() => setQuickFilter((v) => (v === "high" ? null : "high"))}
          />

          <KPIBox
            title="Evidence missing"
            value={stats.evidenceMissingCount}
            tone={stats.evidenceMissingCount > 0 ? "warning" : "neutral"}
            active={quickFilter === "evidence"}
            onClick={() => setQuickFilter((v) => (v === "evidence" ? null : "evidence"))}
          />
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="w-full sm:w-80 rounded-xl border border-slate-200 bg-white px-3 py-2"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            onClick={() => {
              setQuickFilter(null);
              setSearch("");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100"
          >
            Reset
          </button>

          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-slate-500">View:</span>
            <button
              onClick={() => setCompactView(true)}
              className={`rounded-md px-2 py-1 text-xs ${
                compactView ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Compact
            </button>
            <button
              onClick={() => setCompactView(false)}
              className={`rounded-md px-2 py-1 text-xs ${
                !compactView ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Detailed
            </button>
          </div>
        </div>

        {loading && <EmptyState message="Loading criteria…" />}
        {!loading && groupedList.length === 0 && <EmptyState message="No criteria match." />}

        {/* Categories */}
        <div className="space-y-6">
          {groupedList.map((g) => {
            const cat = g.category;
            const items = g.items;

            const doneCount = items.filter((i) => i.status === "done").length;
            const inprogCount = items.filter((i) => i.status === "in_progress").length;
            const delayedCount = items.filter((i) => i.status === "delayed").length;
            const caveatCount = items.filter((i) => i.status === "caveat").length;
            const notStartedCount = items.length - doneCount - inprogCount - delayedCount - caveatCount;

            const isCollapsed = collapsed[cat] ?? true;
            const sh = sectionHealth.get(cat) ?? { rag: "green" as const, riskScore: 0, note: "On track" };

            return (
              <section key={cat} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-3"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [cat]: !isCollapsed }))}
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    <h2 className="text-lg font-semibold">{cat}</h2>

                    <SectionBadge rag={sh.rag} score={sh.riskScore} />
                    <span className="hidden md:inline text-xs text-slate-500">{sh.note}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    {!isCollapsed && compactView && (
                      <div className="hidden sm:flex items-center gap-2 mr-2">
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            const updates: Record<string, boolean> = {};
                            items.forEach((i) => (updates[i.id] = true));
                            setExpandedCriteria((prev) => ({ ...prev, ...updates }));
                          }}
                        >
                          Expand all
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            const updates: Record<string, boolean> = {};
                            items.forEach((i) => (updates[i.id] = false));
                            setExpandedCriteria((prev) => ({ ...prev, ...updates }));
                          }}
                        >
                          Collapse all
                        </button>
                      </div>
                    )}

                    <span className="text-emerald-700">✅ {doneCount}</span>
                    <span className="text-sky-700">🔵 {inprogCount}</span>
                    <span className="text-purple-700">☑️ {caveatCount}</span>
                    <span className="text-slate-700">⚪ {notStartedCount}</span>
                    <span className="text-rose-700">⛔ {delayedCount}</span>

                    <span className="ml-2 rounded-full border border-slate-200 px-2 py-0.5">
                      {doneCount}/{items.length} done
                    </span>
                  </div>
                </button>

                {/* Progress bar */}
                <div className="mx-4 mb-3 mt-0 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
                  />
                </div>

                {!isCollapsed &&
                  (compactView ? (
                    <div className="grid gap-2 px-4 pb-4">
                      {items.map((c) => {
                        const isExpanded = !!expandedCriteria[c.id];

                        return (
                          <div key={c.id} className="space-y-2">
                            <CriteriaRow
                              title={c.title}
                              expanded={isExpanded}
                              severity={c.meta?.severity ?? c.meta?.SEVERITY}
                              status={c.status as any}
                              owner={c.owner_email ?? undefined}
                              due={c.due_date ?? undefined}
                              onStatusChange={(s) => handleUpdateStatus(c.id, s as any)}
                              onOpen={() =>
                                setExpandedCriteria((prev) => ({
                                  ...prev,
                                  [c.id]: !prev[c.id],
                                }))
                              }
                            />

                            {isExpanded && renderCriterionCard(c)}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid gap-3 px-4 pb-4">{items.map((c) => renderCriterionCard(c))}</div>
                  ))}
              </section>
            );
          })}
        </div>

        {/* Add Link modal */}
        <ConfirmDialog
          open={!!linkForId}
          title="Add a link as evidence"
          message={
            <div className="space-y-2">
              <label className="block text-xs text-slate-600">URL or reference</label>
              <input
                type="text"
                placeholder="Paste URL or reference"
                value={linkURL}
                onChange={(e) => {
                  setLinkURL(e.target.value);
                  setLinkErr(null);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {linkErr && <div className="text-xs text-rose-600">{linkErr}</div>}
            </div>
          }
          confirmLabel="Add link"
          cancelLabel="Cancel"
          destructive={false}
          onConfirm={confirmAddLink}
          onCancel={closeLinkModal}
        />

        {/* Delete Evidence modal */}
        <ConfirmDialog
          open={!!delEv}
          title="Delete evidence?"
          message={
            <div className="space-y-1">
              <div>This will remove the selected evidence from this criterion.</div>
              <div className="text-xs text-slate-500">{delEv?.name}</div>
            </div>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          destructive
          onConfirm={confirmDeleteEvidence}
          onCancel={closeDeleteModal}
        />
      </div>
    </div>
  );
}

// Owner & due date updaters for CriteriaCard
async function updateOwner(criterionId: string, newEmail: string) {
  const v = newEmail || null;
  await supabase.from("criteria").update({ owner_email: v }).eq("id", criterionId);
}

async function updateDueDate(criterionId: string, newISO: string | null) {
  const v = newISO || null;
  await supabase.from("criteria").update({ due_date: v }).eq("id", criterionId);
}