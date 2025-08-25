import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { ChevronDown, ChevronRight, Paperclip, Link as LinkIcon, StickyNote, Trash2 } from "lucide-react";

// --- Types ---
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
};

export type Note = {
  id: string;
  criterion_id: string;
  kind: "note" | "link" | "file";
  note?: string;
  url?: string;
  uploaded_at: string;
  created_by?: string;
  updated_at?: string | null;
  meta?: any;
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
  const base = "text-xs rounded-full border border-slate-200 px-2 py-0.5";
  if (p === "High") return <span className={`${base} bg-red-50 text-red-700`}>Priority: High</span>;
  if (p === "Medium") return <span className={`${base} bg-amber-50 text-amber-700`}>Priority: Medium</span>;
  if (p === "Low") return <span className={`${base} bg-slate-50 text-slate-700`}>Priority: Low</span>;
  return <span className={base}>Priority: {p}</span>;
};

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">{message}</div>;
}

// Label helpers for evidence display
function fileNameFromUrl(u?: string | null) {
  if (!u) return "";
  try {
    const url = new URL(u);
    const parts = url.pathname.split("/");
    return parts[parts.length - 1] || url.hostname;
  } catch {
    // fallback if it's not a full URL (e.g. pasted text)
    const parts = u.split("/");
    return parts[parts.length - 1] || u;
  }
}

function hostPath(u?: string | null) {
  if (!u) return "";
  try {
    const url = new URL(u);
    const p = url.pathname.replace(/^\/+/, "");
    const label = p ? `${url.hostname}/${p}` : url.hostname;
    return label;
  } catch {
    return u;
  }
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

  // category collapse state (default collapsed)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Auto sign-in + load projects
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        const email = import.meta.env.VITE_DEMO_EMAIL as string;
        const password = import.meta.env.VITE_DEMO_PASSWORD as string;
        const { data: signInData, error: signInErr } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) { setErr(`Sign-in failed: ${signInErr.message}`); return; }
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

      if (error) { setErr(error.message); return; }
      setProjects(data ?? []);
      if (!activeProjectId && data && data.length > 0) setActiveProjectId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load criteria + notes for active project
  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    setErr(null);
    (async () => {
      const { data: crits, error } = await supabase
        .from("criteria")
        .select("id,project_id,title,status,category,meta,owner_email,due_date,caveat_reason,created_at,updated_at")
        .eq("project_id", activeProjectId)
        .order("title", { ascending: true });
      if (error) { setErr(error.message); setLoading(false); return; }
      setCriteria(crits as Criterion[] | null);

      const ids = (crits ?? []).map((c: any) => c.id);
      if (ids.length) {
        const { data: ev, error: evErr } = await supabase
          .from("evidence")
          .select("id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta")
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
      if (!q) return true;
      const hay = [c.title, c.category ?? "", c.meta?.description ?? "", ...(c.meta?.prompts ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [criteria, search]);

  const grouped = useMemo(() => {
    const acc: Record<string, Criterion[]> = {};
    for (const c of filtered) {
      const k = c.category ?? "Uncategorised";
      (acc[k] ||= []).push(c);
    }
    return acc;
  }, [filtered]);

 // const categories = useMemo(() => Object.keys(grouped), [grouped]);
  const categories = useMemo(() => Object.keys(grouped).sort(), [grouped]);


  // overall stats
  const stats = useMemo(() => {
    const all = criteria ?? [];
    const total = all.length;
    const done = all.filter((c) => c.status === "done").length;
    const inprog = all.filter((c) => c.status === "in_progress").length;
    const delayed = all.filter((c) => c.status === "delayed").length;
    const caveat = all.filter((c) => c.status === "caveat").length;
    const notStarted = total - done - inprog - delayed - caveat;
    return { total, done, inprog, delayed, caveat, notStarted };
  }, [criteria]);

  // Actions
  async function handleUpdateStatus(id: string, status: Criterion["status"]) {
    const snapshot = criteria;
    setCriteria(prev => prev?.map(c => c.id === id ? { ...c, status } : c) ?? prev);

    const { error } = await supabase
      .rpc("set_criterion_status", { p_id: id, p_status: status });

    if (error) {
      setErr(`Failed to update status: ${error.message}`);
      setCriteria(snapshot);
      return;
    }

    const label =
      status === "not_started" ? "Not started" :
      status === "in_progress" ? "In progress" :
      status === "done"        ? "Done" :
      status === "delayed"     ? "Delayed" :
      status === "caveat"      ? "Caveat" :
      String(status);

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
    const { data, error } = await supabase
      .from("evidence")
      .insert({ criterion_id: criterionId, kind: "note", note: v, created_by: currentUserEmail })
      .select("id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta")
      .single();
    if (error) { setErr(error.message); return; }
    setNotes((prev) => [ data as Note, ...prev ]);
  }

  async function addLink(criterionId: string, url: string) {
    const v = url.trim();
    if (!v) return;
    // Insert the link evidence
    const { data: linkRow, error } = await supabase
      .from("evidence")
      .insert({ criterion_id: criterionId, kind: "link", url: v, created_by: currentUserEmail })
      .select("id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta")
      .single();
    if (error) { setErr(error.message); return; }
    setNotes((prev) => [ linkRow as Note, ...prev ]);
    // Cover note
    try {
      const noteText = `Link added: ${v}`;
      const { data: noteRow } = await supabase
        .from("evidence")
        .insert({ criterion_id: criterionId, kind: "note", note: noteText, created_by: currentUserEmail })
        .select("id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta")
        .single();
      if (noteRow) setNotes(prev => [ noteRow as Note, ...prev ]);
    } catch {}
  }

  async function uploadFile(criterionId: string, file: File) {
    const path = `${criterionId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("evidence").upload(path, file);
    if (error) { alert("Upload failed: " + error.message); return; }
    const { data: pub } = supabase.storage.from("evidence").getPublicUrl(path);
    // Insert the file evidence
    const { data: fileRow, error: insErr } = await supabase
      .from("evidence")
      .insert({ criterion_id: criterionId, kind: "file", url: pub.publicUrl, created_by: currentUserEmail, meta: { storage_path: path } })
      .select("id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta")
      .single();
    if (insErr) { setErr(insErr.message); return; }
    setNotes((prev) => [ fileRow as Note, ...prev ]);
    // Cover note
    try {
      const noteText = `File uploaded: ${file.name}`;
      const { data: noteRow } = await supabase
        .from("evidence")
        .insert({ criterion_id: criterionId, kind: "note", note: noteText, created_by: currentUserEmail })
        .select("id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta")
        .single();
      if (noteRow) setNotes(prev => [ noteRow as Note, ...prev ]);
    } catch {}
  }



  async function deleteEvidence(entry: Note) {
    const storagePath = entry.meta?.storage_path as (string | undefined);
    if (entry.kind === "file" && storagePath) {
      await supabase.storage.from("evidence").remove([storagePath]);
    }
    const { error } = await supabase.from("evidence").delete().eq("id", entry.id);
    if (error) { setErr(error.message); return; }
    setNotes(prev => prev.filter(n => n.id !== entry.id));
    // Cover note for deletion
    try {
      const message =
        entry.kind === "link"
          ? `Link removed: ${entry.url ?? ""}`
          : entry.kind === "file"
            ? `File removed: ${entry.url ?? ""}`
            : `Evidence removed`;
      const { data: noteRow } = await supabase
        .from("evidence")
        .insert({ criterion_id: entry.criterion_id, kind: "note", note: message, created_by: currentUserEmail })
        .select("id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta")
        .single();
      if (noteRow) setNotes(prev => [ noteRow as Note, ...prev ]);
    } catch {}
  }


const supaHost = (() => {
    try { return new URL(import.meta.env.VITE_SUPABASE_URL!).host; }
    catch { return "invalid-url"; }
  })();

  return (

  
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      {/* Header + Project Summary */}
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">OR-360 V1.0</h1>
            <p className="text-slate-600">Operational Readiness — enriched checklist</p>
          </div>
		    <div className="fixed bottom-3 right-3 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 backdrop-blur">
        Supabase: {supaHost}
      </div>
          <select
            className="rounded-xl border border-slate-200 px-3 py-2"
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

        {/* Project debug/quick switcher */}
        <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
          <span>Projects: {projects?.length ?? 0}</span>
          <div className="flex flex-wrap gap-2">
            {projects?.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className={`rounded-full border border-slate-200 px-2 py-1 ${activeProjectId === p.id ? "bg-slate-100" : "bg-white"}`}
                title={p.id}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* error banner */}
        {err && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{err}</div>
        )}

        {/* Overall progress */}
        {stats.total > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex justify-between text-sm">
              <span>
                {stats.done}/{stats.total} Complete
              </span>
              <span>{Math.round((stats.done / stats.total) * 100)}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-green-500"
                style={{ width: `${(stats.done / stats.total) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
              <span className="text-green-600">✅ Done: {stats.done}</span>
              <span className="text-amber-600">🔶 In progress: {stats.inprog}</span>
              <span className="text-purple-600">☑️ Caveat: {stats.caveat}</span>
              <span className="text-slate-600">⚪ Not started: {stats.notStarted}</span>
              <span className="text-red-600">⛔ Delayed: {stats.delayed}</span>
            </div>
          </div>
        )}
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-72 rounded-xl border border-slate-200 px-3 py-2"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <EmptyState message="Loading criteria…" />}
      {!loading && categories.length === 0 && <EmptyState message="No criteria match." />}

      {/* Categories */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const items = grouped[cat];
          const doneCount = items.filter((i) => i.status === "done").length;
          const inprogCount = items.filter((i) => i.status === "in_progress").length;
          const delayedCount = items.filter((i) => i.status === "delayed").length;
          const caveatCount = items.filter((i) => i.status === "caveat").length;
          const notStartedCount = items.length - doneCount - inprogCount - delayedCount - caveatCount;
          const isCollapsed = collapsed[cat] ?? true; // default collapsed

          return (
            <section key={cat} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Section header with collapse toggle */}
              <button
                className="flex w-full items-center justify-between gap-3 px-4 py-3"
                onClick={() => setCollapsed(prev => ({ ...prev, [cat]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  <h2 className="text-lg font-semibold">{cat}</h2>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="text-green-700">✅ {doneCount}</span>
                  <span className="text-amber-700">🔶 {inprogCount}</span>
                  <span className="text-purple-700">☑️ {caveatCount}</span>
                  <span className="text-slate-700">⚪ {notStartedCount}</span>
                  <span className="text-red-700">⛔ {delayedCount}</span>
                  <span className="ml-2 rounded-full border border-slate-200 px-2 py-0.5">{doneCount}/{items.length} done</span>
                </div>
              </button>

              {/* Progress bar */}
              <div className="mx-4 mb-3 mt-0 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-green-500 transition-all"
                  style={{ width: `${(doneCount / items.length) * 100}%` }}
                />
              </div>

              {!isCollapsed && (
                <div className="grid gap-3 px-4 pb-4">
                  {items.map((c) => (
                    <CriterionCard
                      key={c.id}
                      c={c}
                      notes={notes.filter((ev) => ev.criterion_id === c.id)}
                      onUpdateStatus={handleUpdateStatus}
                      onAddNote={addNote}
                      onAddLink={addLink}
                      onUploadFile={uploadFile}
                      onDeleteEvidence={deleteEvidence}
                    />
                  ))}
                </div>
              )}
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
  onDeleteEvidence,
}: {
  c: Criterion;
  notes: Note[];
  onUpdateStatus: (id: string, status: Criterion["status"]) => void;
  onAddNote: (id: string, text: string) => void;
  onAddLink: (id: string, url: string) => void;
  onUploadFile: (id: string, f: File) => void;
  onDeleteEvidence: (entry: Note) => void;
}) {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [tab, setTab] = useState<"activity" | "evidence">("activity");

  // Sorted derived lists for this criterion
  const noteItems = [...notes]
    .filter((n) => n.kind === "note")
    .sort((a, b) => +new Date(b.uploaded_at) - +new Date(a.uploaded_at));
  const evidenceItems = [...notes]
    .filter((n) => n.kind !== "note")
    .sort((a, b) => +new Date(b.uploaded_at) - +new Date(a.uploaded_at));
  const lastAction = [...notes].sort((a, b) => +new Date(b.uploaded_at) - +new Date(a.uploaded_at))[0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <button onClick={() => setOpen((o) => !o)} className="text-slate-600">
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium flex items-center gap-2">
                  {c.title} {priorityBadge(c.meta?.priority)}
                </span>
                <div className="shrink-0 space-x-1">
                  <button
                    className={`rounded-md border border-slate-200 px-2 py-1 text-sm ${c.status === "not_started" ? "bg-white" : ""}`}
                    onClick={() => onUpdateStatus(c.id, "not_started")}
                  >
                    Not started
                  </button>
                  <button
                    className={`rounded-md border border-slate-200 px-2 py-1 text-sm ${c.status === "in_progress" ? "bg-amber-100" : ""}`}
                    onClick={() => onUpdateStatus(c.id, "in_progress")}
                  >
                    In progress
                  </button>
                  <button
                    className={`rounded-md border border-slate-200 px-2 py-1 text-sm ${c.status === "done" ? "bg-green-100" : ""}`}
                    onClick={() => onUpdateStatus(c.id, "done")}
                  >
                    Done
                  </button>
                  <button
                    className={`rounded-md border border-slate-200 px-2 py-1 text-sm ${c.status === "delayed" ? "bg-red-100" : ""}`}
                    onClick={() => onUpdateStatus(c.id, "delayed")}
                  >
                    Delayed
                  </button>
                  <button
                    className={`rounded-md border border-slate-200 px-2 py-1 text-sm ${c.status === "caveat" ? "bg-purple-100" : ""}`}
                    onClick={() => onUpdateStatus(c.id, "caveat")}
                  >
                    Caveat
                  </button>
                </div>
              </div>

              {/* Meta badges line — only show Caveat badge now */}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {c.status === "caveat" && c.caveat_reason && (
                  <span className="rounded-full border border-slate-200 bg-purple-50 px-2 py-0.5 text-purple-700">
                    Caveat: {c.caveat_reason}
                  </span>
                )}
              </div>

              {/* Description above Ownership & Target */}
              {c.meta?.description && (
                <p className="mt-2 text-sm text-slate-700">{c.meta.description}</p>
              )}

              {/* Ownership & Target */}
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="mb-1 text-xs font-semibold text-slate-700">Ownership &amp; Target</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <input
                    className="w-52 rounded-md border border-slate-200 px-2 py-1"
                    placeholder="Owner email"
                    defaultValue={c.owner_email ?? ""}
                    onBlur={async (e) => {
                      const v = e.target.value.trim() || null;
                      await supabase.from('criteria').update({ owner_email: v }).eq('id', c.id);
                    }}
                  />
                  <input
                    type="date"
                    className="rounded-md border border-slate-200 px-2 py-1"
                    defaultValue={c.due_date ?? ""}
                    onChange={async (e) => {
                      const v = e.target.value || null;
                      await supabase.from('criteria').update({ due_date: v }).eq('id', c.id);
                    }}
                  />
                </div>

                {/* Last Action */}
                {lastAction && (
                  <div className="mt-2 rounded-md border border-slate-200 bg-indigo-50 p-2 text-xs text-slate-700">
                    Last action: {lastAction.kind === "note" ? "🗒️ Note" : lastAction.kind === "link" ? "🔗 Link" : "📎 File"}
                    {" — "}{lastAction.kind === "note" ? (lastAction.note ?? "") : (lastAction.url ?? "")}
                    {" — "}{new Date(lastAction.uploaded_at).toLocaleString()} — {lastAction.created_by ?? "Unknown"}
                  </div>
                )}
              </div>

              {/* Caveat Reason (inline) */}
              {c.status === "caveat" && (
                <div className="mt-2 rounded-md border border-slate-200 bg-purple-50 p-2">
                  <div className="mb-1 text-xs font-semibold text-purple-700">Caveat reason</div>
                  <input
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                    placeholder="Enter caveat reason"
                    defaultValue={c.caveat_reason ?? ""}
                    onBlur={async (e) => {
                      const v = e.target.value.trim() || null;
                      await supabase.from("criteria").update({ caveat_reason: v }).eq("id", c.id);
                    }}
                  />
                  {c.caveat_reason && (
                    <div className="mt-1 text-xs text-purple-700">Current: {c.caveat_reason}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-4 border-t border-slate-200 pt-3">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              className={`rounded-t-md px-3 py-1 text-sm ${tab === "activity" ? "bg-slate-100 font-semibold" : "text-slate-600"}`}
              onClick={() => setTab("activity")}
            >
              Activity ({noteItems.length})
            </button>
            <button
              className={`rounded-t-md px-3 py-1 text-sm ${tab === "evidence" ? "bg-slate-100 font-semibold" : "text-slate-600"}`}
              onClick={() => setTab("evidence")}
            >
              Evidence ({evidenceItems.length})
            </button>
          </div>

          {tab === "activity" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
                  placeholder="Add an activity note…"
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
                  className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-100"
                >
                  Add
                </button>
              </div>
              {noteItems.length > 0 ? (
                <ul className="space-y-1">
                  {noteItems.map((n) => (
                    <li key={n.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-slate-800">
                        <StickyNote size={14} />
                        {/* read-only note text */}
                        <span className="flex-1">{n.note}</span>
                      </div>
                      <div className="ml-6 text-xs text-slate-600">
                        {new Date(n.uploaded_at).toLocaleString()} — {n.created_by ?? "Unknown"}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-slate-600">No activity yet.</div>
              )}
            </div>
          )}

          {tab === "evidence" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  className="min-w-[240px] flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
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
                  className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-100"
                >
                  Add URL
                </button>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-100">
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
                  {evidenceItems.map((ev) => {
                    const label = ev.kind === "file" ? fileNameFromUrl(ev.url) : hostPath(ev.url);
                    return (
                      <li key={ev.id} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-slate-800">
                          {ev.kind === "link" && <LinkIcon size={14} />}
                          {ev.kind === "file" && <Paperclip size={14} />}
                          {ev.url && (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              title={ev.url}
                              className="max-w-[70%] truncate text-blue-600 underline"
                            >
                              {label}
                            </a>
                          )}
                          <button className="text-xs underline text-red-600 flex items-center gap-1" onClick={()=>onDeleteEvidence(ev)}><Trash2 size={12}/>Remove</button>
                        </div>
                        <div className="ml-6 text-xs text-slate-600">
                          {new Date(ev.uploaded_at).toLocaleString()} — {ev.created_by ?? "Unknown"}
                        </div>
                      </li>
                    );
                  })}
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
