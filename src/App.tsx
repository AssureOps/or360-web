import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { ChevronDown, ChevronRight, Paperclip, Link as LinkIcon, StickyNote } from "lucide-react";

// --- Types ---
export type Criterion = {
  id: string;
  project_id: string;
  title: string;
  status: "not_started" | "in_progress" | "done" | "delayed" | string;
  category?: string | null;
  created_at?: string;
  meta?: any;
};

export type Note = {
  id: string;
  criterion_id: string;
  kind: "note" | "link" | "file";
  note?: string;
  url?: string;
  uploaded_at: string;
  created_by?: string;
};

export type Project = {
  id: string;
  name: string;
  status: string;
  created_at: string;
};

// --- UI helpers ---
const priorityBadge = (p?: string) => {
  if (!p) return null;
  const base = "text-xs rounded-full border px-2 py-0.5";
  if (p === "High") return <span className={`${base} border-red-300 bg-red-50 text-red-700`}>Priority: High</span>;
  if (p === "Medium") return <span className={`${base} border-amber-300 bg-amber-50 text-amber-700`}>Priority: Medium</span>;
  if (p === "Low") return <span className={`${base} border-slate-300 bg-slate-50 text-slate-700`}>Priority: Low</span>;
  return <span className={`${base} border-slate-300`}>Priority: {p}</span>;
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-6 text-center text-slate-600">{message}</div>
  );
}

// ==========================================================
// App
// ==========================================================
export default function App() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState<"All" | "S" | "M" | "L">("All");

  // Load user + projects
  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      setCurrentUserEmail(user?.user?.email ?? null);
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,created_at")
        .order("created_at", { ascending: false });
      if (error) {
        setErr(error.message);
        return;
      }
      setProjects(data ?? []);
      if (!activeProjectId && data && data.length > 0) setActiveProjectId(data[0].id);
    })();
  }, []);

  // Load criteria + notes for active project
  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    setErr(null);
    (async () => {
      const { data: crits, error } = await supabase
        .from("criteria")
        .select("id,project_id,title,status,category,meta,created_at")
        .eq("project_id", activeProjectId)
        .order("category", { ascending: true })
        .order("title", { ascending: true });
      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }
      setCriteria(crits as Criterion[] | null);

      const ids = (crits ?? []).map((c: any) => c.id);
      if (ids.length) {
        const { data: ev, error: evErr } = await supabase
          .from("evidence")
          .select("id,criterion_id,kind,note,url,uploaded_at,created_by")
          .in("criterion_id", ids);
        if (evErr) setErr(evErr.message);
        setNotes(ev ?? []);
      } else {
        setNotes([]);
      }
      setLoading(false);
    })();
  }, [activeProjectId]);

  // Derived collections
  const filtered = useMemo(() => {
    const list = criteria ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (sizeFilter !== "All" && c.meta?.size !== sizeFilter) return false;
      if (!q) return true;
      const hay = [c.title, c.category ?? "", c.meta?.description ?? "", ...(c.meta?.prompts ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [criteria, search, sizeFilter]);

  const grouped = useMemo(() => {
    const acc: Record<string, Criterion[]> = {};
    for (const c of filtered) {
      const k = c.category ?? "Uncategorised";
      (acc[k] ||= []).push(c);
    }
    return acc;
  }, [filtered]);

  const categories = useMemo(() => Object.keys(grouped), [grouped]);

  // overall stats
  const stats = useMemo(() => {
    const all = criteria ?? [];
    const total = all.length;
    const done = all.filter((c) => c.status === "done").length;
    const inprog = all.filter((c) => c.status === "in_progress").length;
    const delayed = all.filter((c) => c.status === "delayed").length;
    const notStarted = total - done - inprog - delayed;
    return { total, done, inprog, delayed, notStarted };
  }, [criteria]);

  // Actions
  async function handleUpdateStatus(id: string, status: Criterion["status"]) {
    const snapshot = criteria; // for rollback
    // optimistic UI
    setCriteria(prev => prev?.map(c => c.id === id ? { ...c, status } : c) ?? prev);

    // Use RPC that safely casts text -> enum in DB
    const { error } = await supabase
      .rpc("set_criterion_status", { p_id: id, p_status: status });

    if (error) {
      console.error("Status update failed:", error);
      setErr(`Failed to update status: ${error.message}`);
      setCriteria(snapshot); // rollback UI
      return;
    }

    const label =
      status === "not_started" ? "Not started" :
      status === "in_progress" ? "In progress" :
      status === "done"        ? "Done" :
      status === "delayed"     ? "Delayed" : String(status);

    // add an audit note
    await supabase.from("evidence").insert({
      criterion_id: id,
      kind: "note",
      note: `Status changed to: ${label}`,
      created_by: currentUserEmail
    });

    setNotes(prev => [{
      id: Math.random().toString(),
      criterion_id: id,
      kind: "note",
      note: `Status changed to: ${label}`,
      uploaded_at: new Date().toISOString(),
      created_by: currentUserEmail ?? "Unknown",
    }, ...prev]);
  }

  async function addNote(criterionId: string, text: string) {
    const v = text.trim();
    if (!v) return;
    await supabase
      .from("evidence")
      .insert({ criterion_id: criterionId, kind: "note", note: v, created_by: currentUserEmail });
    setNotes((prev) => [
      {
        id: Math.random().toString(),
        criterion_id: criterionId,
        kind: "note",
        note: v,
        uploaded_at: new Date().toISOString(),
        created_by: currentUserEmail ?? "Unknown",
      },
      ...prev,
    ]);
  }

  async function addLink(criterionId: string, url: string) {
    const v = url.trim();
    if (!v) return;
    await supabase
      .from("evidence")
      .insert({ criterion_id: criterionId, kind: "link", url: v, created_by: currentUserEmail });
    setNotes((prev) => [
      {
        id: Math.random().toString(),
        criterion_id: criterionId,
        kind: "link",
        url: v,
        uploaded_at: new Date().toISOString(),
        created_by: currentUserEmail ?? "Unknown",
      },
      ...prev,
    ]);
  }

  async function uploadFile(criterionId: string, file: File) {
    const path = `${criterionId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("evidence").upload(path, file);
    if (error) {
      alert("Upload failed: " + error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("evidence").getPublicUrl(path);
    await supabase
      .from("evidence")
      .insert({ criterion_id: criterionId, kind: "file", url: pub.publicUrl, created_by: currentUserEmail });
    setNotes((prev) => [
      {
        id: Math.random().toString(),
        criterion_id: criterionId,
        kind: "file",
        url: pub.publicUrl,
        uploaded_at: new Date().toISOString(),
        created_by: currentUserEmail ?? "Unknown",
      },
      ...prev,
    ]);
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      {/* Header + Project Summary */}
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">OR-360</h1>
            <p className="text-slate-600">Operational Readiness — enriched checklist</p>
          </div>
          <select
            className="rounded-xl border px-3 py-2"
            value={activeProjectId ?? ""}
            onChange={(e) => setActiveProjectId(e.target.value)}
          >
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* error banner so TS doesn't warn + helpful UX */}
        {err && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">{err}</div>
        )}

        {/* Overall progress */}
        {stats.total > 0 && (
          <div className="rounded-xl border bg-white p-4 shadow">
            <div className="mb-2 flex justify-between text-sm">
              <span>
                {stats.done}/{stats.total} Complete
              </span>
              <span>{Math.round((stats.done / stats.total) * 100)}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-green-500"
                style={{ width: `${(stats.done / stats.total) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
              <span className="text-green-600">✅ Done: {stats.done}</span>
              <span className="text-amber-600">🔶 In progress: {stats.inprog}</span>
              <span className="text-slate-600">⚪ Not started: {stats.notStarted}</span>
              <span className="text-red-600">⛔ Delayed: {stats.delayed}</span>
            </div>
          </div>
        )}
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-72 rounded-xl border px-3 py-2"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(["All", "S", "M", "L"] as const).map((s) => (
          <button
            key={s}
            className={`rounded-full border px-3 py-1 text-sm ${
              sizeFilter === s ? "bg-slate-100" : ""
            }`}
            onClick={() => setSizeFilter(s)}
          >
            Size: {s}
          </button>
        ))}
      </div>

      {loading && <EmptyState message="Loading criteria…" />}
      {!loading && categories.length === 0 && <EmptyState message="No criteria match." />}

      {/* Categories */}
      <div className="space-y-10">
        {categories.map((cat) => {
          const items = grouped[cat];
          const doneCount = items.filter((i) => i.status === "done").length;
          return (
            <section key={cat}>
              <div className="sticky top-0 z-10 mb-3 bg-white/90 py-2 backdrop-blur">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-xl font-bold">{cat}</h2>
                  <span className="text-sm text-slate-600">
                    {doneCount}/{items.length} done
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${(doneCount / items.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="grid gap-3">
                {items.map((c) => (
                  <CriterionCard
                    key={c.id}
                    c={c}
                    notes={notes.filter((ev) => ev.criterion_id === c.id)}
                    onUpdateStatus={handleUpdateStatus}
                    onAddNote={addNote}
                    onAddLink={addLink}
                    onUploadFile={uploadFile}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================================
// Criterion Card
// ==========================================================
function CriterionCard({
  c,
  notes,
  onUpdateStatus,
  onAddNote,
  onAddLink,
  onUploadFile,
}: {
  c: Criterion;
  notes: Note[];
  onUpdateStatus: (id: string, status: Criterion["status"]) => void;
  onAddNote: (id: string, text: string) => void;
  onAddLink: (id: string, url: string) => void;
  onUploadFile: (id: string, f: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [tab, setTab] = useState<"notes" | "evidence">("notes");

  const noteItems = notes
    .filter((n) => n.kind === "note")
    .sort((a, b) => +new Date(b.uploaded_at) - +new Date(a.uploaded_at));
  const evidenceItems = notes
    .filter((n) => n.kind !== "note")
    .sort((a, b) => +new Date(b.uploaded_at) - +new Date(a.uploaded_at));

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={() => setOpen((o) => !o)} className="mr-2 text-slate-600">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="font-medium">{c.title}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {priorityBadge(c.meta?.priority)}
            {c.meta?.pillar && (
              <span className="rounded-full border px-2 py-0.5">Pillar: {c.meta.pillar}</span>
            )}
            {c.meta?.assuranceType && (
              <span className="rounded-full border px-2 py-0.5">Assurance: {c.meta.assuranceType}</span>
            )}
            {c.meta?.size && <span className="rounded-full border px-2 py-0.5">Size: {c.meta.size}</span>}
          </div>
        </div>
        <div className="shrink-0 space-x-1">
          <button
            className={`rounded-md border px-2 py-1 text-sm ${c.status === "not_started" ? "bg-white" : ""}`}
            onClick={() => onUpdateStatus(c.id, "not_started")}
          >
            Not started
          </button>
          <button
            className={`rounded-md border px-2 py-1 text-sm ${c.status === "in_progress" ? "bg-amber-100" : ""}`}
            onClick={() => onUpdateStatus(c.id, "in_progress")}
          >
            In progress
          </button>
          <button
            className={`rounded-md border px-2 py-1 text-sm ${c.status === "done" ? "bg-green-100" : ""}`}
            onClick={() => onUpdateStatus(c.id, "done")}
          >
            Done
          </button>
          <button
            className={`rounded-md border px-2 py-1 text-sm ${c.status === "delayed" ? "bg-red-200" : ""}`}
            onClick={() => onUpdateStatus(c.id, "delayed")}
          >
            Delayed
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-4 border-t pt-3">
          {c.meta?.description && (
            <p className="text-sm text-slate-700">{c.meta.description}</p>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b pb-2">
            <button
              className={`rounded-t-md px-3 py-1 text-sm ${
                tab === "notes" ? "bg-slate-100 font-semibold" : "text-slate-600"
              }`}
              onClick={() => setTab("notes")}
            >
              Notes ({noteItems.length})
            </button>
            <button
              className={`rounded-t-md px-3 py-1 text-sm ${
                tab === "evidence" ? "bg-slate-100 font-semibold" : "text-slate-600"
              }`}
              onClick={() => setTab("evidence")}
            >
              Evidence ({evidenceItems.length})
            </button>
          </div>

          {tab === "notes" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border px-2 py-1 text-sm"
                  placeholder="Write a note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (noteText.trim()) {
                      onAddNote(c.id, noteText.trim());
                      setNoteText("");
                    }
                  }}
                  className="rounded-md border bg-white px-3 py-1 text-sm hover:bg-slate-100"
                >
                  Add
                </button>
              </div>
              {noteItems.length > 0 ? (
                <ul className="space-y-1">
                  {noteItems.map((n) => (
                    <li key={n.id} className="flex flex-col">
                      <div className="flex items-center gap-2 text-slate-800">
                        <StickyNote size={14} /> {n.note}
                      </div>
                      <div className="ml-6 text-xs text-slate-600">
                        {new Date(n.uploaded_at).toLocaleString()} — {n.created_by ?? "Unknown"}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-slate-600">No notes yet.</div>
              )}
            </div>
          )}

          {tab === "evidence" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  className="min-w-[240px] flex-1 rounded-md border px-2 py-1 text-sm"
                  placeholder="Paste a URL…"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (linkUrl.trim()) {
                      onAddLink(c.id, linkUrl.trim());
                      setLinkUrl("");
                    }
                  }}
                  className="rounded-md border bg-white px-3 py-1 text-sm hover:bg-slate-100"
                >
                  Add URL
                </button>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-1 text-sm hover:bg-slate-100">
                  <Paperclip size={14} /> Upload file
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadFile(c.id, f);
                    }}
                  />
                </label>
              </div>

              {evidenceItems.length > 0 ? (
                <ul className="space-y-1">
                  {evidenceItems.map((ev) => (
                    <li key={ev.id} className="flex flex-col">
                      <div className="flex items-center gap-2 text-slate-800">
                        {ev.kind === "link" && <LinkIcon size={14} />}
                        {ev.kind === "file" && <Paperclip size={14} />}
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-blue-600 underline"
                          >
                            {ev.url}
                          </a>
                        )}
                      </div>
                      <div className="ml-6 text-xs text-slate-600">
                        {new Date(ev.uploaded_at).toLocaleString()} — {ev.created_by ?? "Unknown"}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-slate-600">No evidence yet.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
