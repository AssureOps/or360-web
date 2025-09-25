// src/AllocateCriteria.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { useOrg } from "./OrgContext";
import {
  ListChecks, Filter, CheckCircle2,
  ChevronDown, ChevronRight, X, CalendarDays, Trash2
} from "lucide-react";

/** Types — aligned with your schema */
type Project = {
  id: string;
  org_id: string;
  name: string;
  start_date: string | null;
  go_live_date: string | null;
};

type CriteriaTemplate = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: "low" | "med" | "high" | string;
  default_status: string;
  evidence_required: boolean;
  version: number;
  is_active: boolean;
  org_id: string | null;
  meta: any;
  default_due_offset_days: number | null;
};

type CriteriaRow = { id: string; template_id: string | null };

/** Draft row for preview drawer */
type DraftRow = {
  template_id: string;
  project_id: string;
  org_id: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string;
  status: string;
  evidence_required: boolean;
  due_date: string | null;
  ai_source: any;
  meta: any;
};

export default function AllocateCriteria() {
  const { orgId } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectMap, setProjectMap] = useState<Record<string, Project>>({});

  const [templates, setTemplates] = useState<CriteriaTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const [existing, setExisting] = useState<Set<string>>(new Set()); // templates already allocated to project
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [anchor, setAnchor] = useState<"go_live" | "start">("go_live"); // due date anchor
  const [excludeExisting, setExcludeExisting] = useState<boolean>(true); // NEW: auto-unselect & hide already added

  // Preview drawer
  const [previewOpen, setPreviewOpen] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);

  // Load projects for current org
  useEffect(() => {
    (async () => {
      if (!orgId) return;
      setLoading(true);
      const { data: projs, error } = await supabase
        .from("projects")
        .select("id, org_id, name, start_date, go_live_date")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error && projs) {
        setProjects(projs as any);
        const pm: Record<string, Project> = {};
        (projs as any).forEach((p: Project) => (pm[p.id] = p));
        setProjectMap(pm);
        if (!projectId && projs.length) setProjectId(projs[0].id);
      }
      setLoading(false);
    })();
  }, [orgId]);

  // Load criteria templates (global + org)
  useEffect(() => {
    (async () => {
      if (!orgId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("criteria_templates")
        .select("id,title,description,category,severity,default_status,evidence_required,version,is_active,org_id,meta,default_due_offset_days")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("title", { ascending: true });
      if (error) { setLoading(false); return; }
      const rows = (data || []).filter((t: any) => !t.org_id || t.org_id === orgId);
      setTemplates(rows as CriteriaTemplate[]);
      setLoading(false);
    })();
  }, [orgId]);

  // Load existing criteria for the chosen project to avoid duplicates
  useEffect(() => {
    (async () => {
      if (!projectId) { setExisting(new Set()); return; }
      const { data, error } = await supabase
        .from("criteria")
        .select("id, template_id")
        .eq("project_id", projectId);
      if (error) { setExisting(new Set()); return; }
      const ids = new Set<string>();
      (data as CriteriaRow[]).forEach(r => { if (r.template_id) ids.add(r.template_id); });
      setExisting(ids);
    })();
  }, [projectId]);

  // Auto-unselect any selected IDs that are already in project (when toggle ON or when 'existing' changes)
  useEffect(() => {
    if (!excludeExisting) return;
    setSelected(prev => {
      const next = new Set<string>();
      for (const id of prev) if (!existing.has(id)) next.add(id);
      return next;
    });
  }, [excludeExisting, existing]);

  // Filters
  const categories = useMemo(() => {
    const set = new Set((templates || []).map(t => t.category || "Uncategorised"));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter(t => {
      if (excludeExisting && existing.has(t.id)) return false;
      if (categoryFilter !== "all") {
        const cat = (t.category || "Uncategorised").toLowerCase();
        if (cat !== categoryFilter.toLowerCase()) return false;
      }
      if (!q) return true;
      const hay = [t.title, t.description || "", t.category || "", t.severity].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [templates, search, categoryFilter, excludeExisting, existing]);

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, CriteriaTemplate[]> = {};
    filtered.forEach(t => {
      const k = t.category || "Uncategorised";
      (map[k] ||= []).push(t);
    });
    return map;
  }, [filtered]);

  function toggle(id: string) {
    if (existing.has(id)) return; // safety
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    const next = new Set<string>(selected);
    for (const t of filtered) {
      if (!existing.has(t.id)) next.add(t.id);
    }
    setSelected(next);
  }
  function clearSelection() {
    setSelected(new Set());
  }

  function computeDueDate(t: CriteriaTemplate, p: Project | undefined) {
    const offset = t.default_due_offset_days ?? null; // from schema (days before the anchor) :contentReference[oaicite:3]{index=3}
    if (!p || offset === null) return null;
    const baseStr = anchor === "go_live" ? p.go_live_date : p.start_date;
    if (!baseStr) return null;
    const base = new Date(baseStr + "T00:00:00Z");
    base.setUTCDate(base.getUTCDate() - offset);
    return base.toISOString().slice(0, 10);
  }

  // Build draft rows for preview based on current selection
  function buildDraftRows(): DraftRow[] {
    if (!projectId || !orgId) return [];
    const p = projectMap[projectId];
    const nowIso = new Date().toISOString();
    return templates
      .filter(t => selected.has(t.id) && !existing.has(t.id))
      .map(t => ({
        template_id: t.id,
        project_id: projectId,
        org_id: p.org_id,
        title: t.title,
        description: t.description,
        category: t.category,
        severity: t.severity || "med",
        status: t.default_status || "not_started",
        evidence_required: t.evidence_required ?? true,
        due_date: computeDueDate(t, p),
        ai_source: { source: "template", created_at: nowIso, template_version: t.version ?? 1 },
        meta: t.meta ?? {}
      }));
  }

  function openPreview() {
    const rows = buildDraftRows();
    setDraftRows(rows);
    setPreviewOpen(true);
  }

  async function confirmInsert() {
    if (!projectId || !orgId || draftRows.length === 0) return;
    setInserting(true);
    try {
      const { error } = await supabase.from("criteria").insert(draftRows);
      if (error) throw error;

      // refresh existing → auto-clears selection (when excludeExisting = true)
      const { data } = await supabase
        .from("criteria")
        .select("template_id")
        .eq("project_id", projectId);
      const ids = new Set<string>();
      (data || []).forEach((r: any) => { if (r.template_id) ids.add(r.template_id); });
      setExisting(ids);

      setPreviewOpen(false);
      setDraftRows([]);
      setSelected(new Set());
      alert(`Added ${draftRows.length} item(s) to the project.`);
    } catch (e: any) {
      alert("Failed to add criteria: " + (e?.message ?? e));
    } finally {
      setInserting(false);
    }
  }

  const selectedCount = selected.size;
  const remainingCount = filtered.filter(t => !existing.has(t.id)).length;

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Allocate Criteria</h1>
          <p className="text-sm text-slate-600">
            Choose service acceptance criteria from predefined templates (global or your org) and add them to a project.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-600">Project</div>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={projectId ?? ""}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </header>

      {/* Controls */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <input
              className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Search title, description or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Category</span>
            <select
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Due date anchor</span>
            <select
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value as any)}
            >
              <option value="go_live">Go‑Live − offset</option>
              <option value="start">Start − offset</option>
            </select>
          </div>

          {/* NEW: auto-unselect + hide already-added */}
          <label className="ml-2 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={excludeExisting}
              onChange={(e) => setExcludeExisting(e.target.checked)}
            />
            Exclude items already in project
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onClick={selectAllVisible}
              disabled={remainingCount === 0}
            >
              Select all ({remainingCount})
            </button>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onClick={clearSelection}
              disabled={selectedCount === 0}
            >
              Clear selection
            </button>
            <button
              className="btn btn-primary"
              onClick={openPreview}
              disabled={!projectId || selectedCount === 0}
              title={!projectId ? "Choose a project first" : ""}
            >
              Review &amp; Add ({selectedCount})
            </button>
          </div>
        </div>
      </section>

      {/* Templates list */}
      <section className="space-y-4">
        {Object.keys(grouped).sort().map(cat => (
          <CategoryBlock
            key={cat}
            title={cat}
            items={grouped[cat]}
            existing={existing}
            selected={selected}
            onToggle={toggle}
          />
        ))}

        {loading && <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">No templates match.</div>
        )}
      </section>

      {/* Review & Add Drawer */}
      {previewOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setPreviewOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <ListChecks size={18} />
                <div className="text-sm font-semibold">Review &amp; Add</div>
              </div>
              <button className="rounded-md p-1 hover:bg-slate-100" onClick={() => setPreviewOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-3 text-sm text-slate-600">
              {draftRows.length} item(s) will be added to the selected project. You can adjust the due dates and evidence flags before confirming.
            </div>

            <div className="grid max-h-[70vh] gap-3 overflow-y-auto px-4 pb-20">
              {draftRows.length === 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center text-slate-600">
                  Nothing selected.
                </div>
              )}

              {draftRows.map((row, i) => (
                <div key={row.template_id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{row.title}</div>
                      <div className="mt-0.5 text-xs text-slate-600">
                        {(row.category ?? "Uncategorised")} · {String(row.severity).toUpperCase()} · Status: {row.status}
                      </div>
                    </div>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-red-700 hover:bg-rose-50"
                      onClick={() => {
                        setDraftRows((prev) => prev.filter((r) => r.template_id !== row.template_id));
                        setSelected((prev) => {
                          const next = new Set(prev);
                          next.delete(row.template_id);
                          return next;
                        });
                      }}
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>

                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {/* Due date */}
                    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                      <CalendarDays size={14} className="text-slate-500" />
                      <span className="text-xs text-slate-600">Due date</span>
                      <input
                        type="date"
                        className="ml-auto rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        value={row.due_date ?? ""}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          setDraftRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, due_date: v } : r)));
                        }}
                      />
                    </label>

                    {/* Evidence required */}
                    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                      <input
                        type="checkbox"
                        checked={row.evidence_required}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setDraftRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, evidence_required: v } : r)));
                        }}
                      />
                      <span className="text-xs text-slate-600">Evidence required</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 right-0 z-50 w-full max-w-xl border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">{draftRows.length} item(s) ready</div>
                <div className="flex items-center gap-2">
                  <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setPreviewOpen(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary disabled:opacity-50"
                    onClick={confirmInsert}
                    disabled={draftRows.length === 0 || inserting}
                  >
                    {inserting ? "Adding…" : `Confirm & Add (${draftRows.length})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CategoryBlock({
  title,
  items,
  existing,
  selected,
  onToggle
}: {
  title: string;
  items: CriteriaTemplate[];
  existing: Set<string>;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="text-xs text-slate-600">{items.length} items</div>
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {items.map(t => {
            const isExisting = existing.has(t.id);
            const isChecked = selected.has(t.id);
            return (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  checked={isChecked}
                  disabled={isExisting}
                  onChange={() => onToggle(t.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.title}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                      {t.severity?.toUpperCase() || "MED"}
                    </span>
                    {isExisting && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                        <CheckCircle2 size={12}/> Already added
                      </span>
                    )}
                    {t.default_due_offset_days != null && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700" title="Default due date is anchored to the selected anchor minus this offset">
                        −{t.default_due_offset_days} days
                      </span>
                    )}
                  </div>
                  {t.description && <div className="mt-1 text-sm text-slate-700">{t.description}</div>}
                  {t.meta?.prompts && Array.isArray(t.meta.prompts) && t.meta.prompts.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-[12px] text-slate-600">
                      {t.meta.prompts.slice(0, 3).map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
