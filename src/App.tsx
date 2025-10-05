import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { ChevronDown, ChevronRight } from "lucide-react";
import { generateCertificate } from "./lib/certificate";
import { Link } from "react-router-dom";
import CriteriaCard, { type CriteriaStatus } from "./components/CriteriaCard";
import ConfirmDialog from "./components/ConfirmDialog";

/** Types (unchanged) **/
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
};

export type Note = {
  id: string;
  criterion_id: string;
  kind: "note" | "link" | "file";
  note?: string | null;
  url?: string | null;
  uploaded_at: string;
  created_by?: string | null;
  updated_at?: string | null;
  meta?: any;
  // DB columns we may read for files (not always present in earlier rows)
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

/** UI helpers **/
function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
      {message}
    </div>
  );
}

export default function App() {
  // Expose supabase in dev console to check which DB we’re hitting
  useEffect(() => {
    (window as any).__sb = supabase;
  }, []);

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const activeProject = useMemo(
    () => (projects || []).find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({}); // categories collapsed by default

  // --- Add Link Modal state (plain text; no http formatting/validation) ---
  const [linkForId, setLinkForId] = useState<string | null>(null);
  const [linkURL, setLinkURL] = useState("");
  const [linkErr, setLinkErr] = useState<string | null>(null);

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
  
  function rememberLastProject(id: string) {
  localStorage.setItem("lastProjectId", id);
  window.dispatchEvent(new CustomEvent("last-project-changed", { detail: id }));
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

  // Auto sign-in (demo creds) + load projects
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        const email = import.meta.env.VITE_DEMO_EMAIL as string;
        const password = import.meta.env.VITE_DEMO_PASSWORD as string;
        const { data: signInData, error: signInErr } =
          await supabase.auth.signInWithPassword({ email, password });
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
      if (!activeProjectId && data && data.length > 0) setActiveProjectId(data[0].id);  rememberLastProject(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load criteria + evidence for active project
  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    setErr(null);
    (async () => {
      const { data: crits, error } = await supabase
        .from("criteria")
        .select(
          "id,project_id,title,status,category,description,meta,owner_email,due_date,caveat_reason,created_at,updated_at"
        )
        .eq("project_id", activeProjectId)
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
          .select(
            "id,criterion_id,kind,note,url,file_path,mime_type,size_bytes,uploaded_at,created_by,updated_at,meta"
          )
          .in("criterion_id", ids);
        if (evErr) setErr(evErr.message);
        setNotes((ev ?? []) as Note[]);
      } else {
        setNotes([]);
      }
      setLoading(false);
    })();
  }, [activeProjectId]);

  // Derived
  const filtered = useMemo(() => {
    const list = criteria ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (!q) return true;
      const hay = [
        c.title,
        c.category ?? "",
        c.description ?? "",
        c.meta?.description ?? "",
        ...(c.meta?.prompts ?? []),
      ]
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

  const categories = useMemo(() => Object.keys(grouped).sort(), [grouped]);

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

  /** Actions **/
  async function handleUpdateStatus(id: string, status: Criterion["status"]) {
    const snapshot = criteria;
    setCriteria(
      (prev) => prev?.map((c) => (c.id === id ? { ...c, status } : c)) ?? prev
    );

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

    await supabase.from("evidence").insert({
      criterion_id: id,
      kind: "note",
      note: `Status changed to: ${label}`,
      created_by: currentUserEmail,
    });

    setNotes((prev) => [
      {
        id: Math.random().toString(),
        criterion_id: id,
        kind: "note",
        note: `Status changed to: ${label}`,
        uploaded_at: new Date().toISOString(),
        created_by: currentUserEmail ?? "Unknown",
      } as Note,
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
        "id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta"
      )
      .single();
    if (error) {
      setErr(error.message);
      return;
    }
    setNotes((prev) => [data as Note, ...prev]);
  }

  async function uploadFile(criterionId: string, file: File) {
    const path = `${criterionId}/${Date.now()}-${file.name}`;
    // 1) Upload to storage
    const { error } = await supabase.storage.from("evidence").upload(path, file);
    if (error) {
      alert("Upload failed: " + error.message);
      return;
    }
    // 2) Optionally generate a public URL for convenience (adjust if private)
    const { data: pub } = supabase.storage.from("evidence").getPublicUrl(path);
    const publicUrl = pub?.publicUrl || null;

    // 3) Insert evidence row using DB columns (file_path, mime_type, size_bytes)
    const { data: fileRow, error: insErr } = await supabase
      .from("evidence")
      .insert({
        criterion_id: criterionId,
        kind: "file",
        file_path: path,
        url: publicUrl, // convenience for quick open; remove if bucket is private
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
    setNotes((prev) => [fileRow as Note, ...prev]);

    // 4) Optional note
    try {
      const noteText = `File uploaded: ${file.name}`;
      const { data: noteRow } = await supabase
        .from("evidence")
        .insert({
          criterion_id: criterionId,
          kind: "note",
          note: noteText,
          created_by: currentUserEmail,
        })
        .select(
          "id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta"
        )
        .single();
      if (noteRow) setNotes((prev) => [noteRow as Note, ...prev]);
    } catch {}
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
        "id,criterion_id,kind,note,url,uploaded_at,created_by,updated_at,meta"
      )
      .single();
    if (error) {
      setErr(error.message);
      return;
    }
    setNotes((prev) => [data as Note, ...prev]);
  }

  // NEW: Delete evidence (files & links only — notes are protected)
  async function deleteEvidence(evidenceId: string) {
    try {
      const row = notes.find((n) => n.id === evidenceId);
      if (!row) return;
      if (row.kind === "note") {
        alert("Activity notes cannot be deleted.");
        return;
      }
      // If it's a file, delete from storage first (best-effort)
      if (row.kind === "file" && row.file_path) {
        try {
          await supabase.storage.from("evidence").remove([row.file_path]);
        } catch {}
      }
      // Delete DB row
      const { error } = await supabase.from("evidence").delete().eq("id", evidenceId);
      if (error) throw error;
      // Update UI
      setNotes((prev) => prev.filter((n) => n.id !== evidenceId));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  // Evidence prompt (opens native picker and uses upload flow)
  function promptEvidenceUpload(criterionId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const f = (input.files && input.files[0]) || null;
      if (f) uploadFile(criterionId, f);
    };
    input.click();
  }


const [delEv, setDelEv] = useState<{ id: string; name: string } | null>(null);

function openDeleteModal(opts: { id: string; name: string }) {
  setDelEv(opts);
}
function closeDeleteModal() {
  setDelEv(null);
}

async function confirmDeleteEvidence() {
  if (!delEv) return;
  await deleteEvidence(delEv.id);   // your existing deleter (files/links only)
  setDelEv(null);
}
  // Derived UI render
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-[40ch] truncate text-lg font-semibold">
            {activeProject?.name || "—"}
          </div>

          {/* Project selector (inline on ≥sm) */}
          <div className="hidden sm:block">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 md:px-4 md:py-2.5"
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

          {/* REMOVED header "Edit project" button per request */}
        </div>

        {/* Project selector for mobile */}
        <div className="sm:hidden">
          <div className="mb-1 text-xs text-slate-500">Project</div>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
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

        {err && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {err}
          </div>
        )}

        {/* Overall progress */}
        {stats.total > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex justify-between text-sm">
              <span>{stats.done}/{stats.total} Complete</span>
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

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  if (!activeProjectId || !projects || !criteria) return;
                  const project = projects.find((p) => p.id === activeProjectId);
                  if (!project) return;
                  generateCertificate(
                    { id: project.id, name: project.name },
                    criteria.map((c) => ({
                      title: c.title,
                      status: String(c.status),
                      owner_email: c.owner_email ?? null,
                      due_date: c.due_date ?? null,
                      caveat_reason: c.caveat_reason ?? null,
                    }))
                  );
                }}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-100"
              >
                Generate Certificate
              </button>

            {activeProjectId && (
  <Link
    to={`/projects/${activeProjectId}/dashboard`}   // ✅ project-scoped
    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-100"
  >
    View Dashboard
  </Link>
)}

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
      {!loading && categories.length === 0 && (
        <EmptyState message="No criteria match." />
      )}

      {/* Categories */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const items = grouped[cat];
          const doneCount = items.filter((i) => i.status === "done").length;
          const inprogCount = items.filter((i) => i.status === "in_progress").length;
          const delayedCount = items.filter((i) => i.status === "delayed").length;
          const caveatCount = items.filter((i) => i.status === "caveat").length;
          const notStartedCount =
            items.length - doneCount - inprogCount - delayedCount - caveatCount;
          const isCollapsed = collapsed[cat] ?? true; // default collapsed

          return (
            <section
              key={cat}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              {/* Section header with collapse toggle */}
              <button
                className="flex w-full items-center justify-between gap-3 px-4 py-3"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [cat]: !isCollapsed }))
                }
                aria-expanded={!isCollapsed}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                  <h2 className="text-lg font-semibold">{cat}</h2>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="text-green-700">✅ {doneCount}</span>
                  <span className="text-amber-700">🔶 {inprogCount}</span>
                  <span className="text-purple-700">☑️ {caveatCount}</span>
                  <span className="text-slate-700">⚪ {notStartedCount}</span>
                  <span className="text-red-700">⛔ {delayedCount}</span>
                  <span className="ml-2 rounded-full border border-slate-200 px-2 py-0.5">
                    {doneCount}/{items.length} done
                  </span>
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
                  {items.map((c) => {
                    const critNotes = notes.filter((n) => n.criterion_id === c.id);
                    const activities = critNotes
                      .filter((n) => n.kind === "note")
                      .map((n) => ({
                        id: n.id,
                        type: "note" as const,
                        summary: n.note ?? "",
                        created_at: n.uploaded_at,
                        created_by: n.created_by ?? "Unknown",
                      }));
                    // Build evidence list and tag files vs links for the card
                    const evItems = critNotes
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
                          url: ev.url ?? undefined, // may be null for private buckets
                          file: isFile,
                          created_at: ev.uploaded_at,
                          created_by: ev.created_by ?? "Unknown",
                        };
                      });

                    // Last action for narrative footer
                    const last = [...critNotes].sort(
                      (a, b) =>
                        +new Date(a.uploaded_at) < +new Date(b.uploaded_at) ? 1 : -1
                    )[0];
                    const last_action = last
                      ? {
                          type: last.kind,
                          summary:
                            last.kind === "note"
                              ? last.note ?? ""
                              : last.url ?? (last as any).file_path ?? "",
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
                        onChangeStatus={(next) =>
                          handleUpdateStatus(c.id, next as CriteriaStatus)
                        }
                        onChangeOwner={(email) => updateOwner(c.id, email)}
                        onChangeDueDate={(dateISO) =>
                          updateDueDate(c.id, dateISO)
                        }
                        onAddNote={(text) => addNote(c.id, text)}
                         onAddEvidenceFile={() => promptEvidenceUpload(c.id)}
  onAddEvidenceLink={() => openLinkModal(c.id)}
  onRequestDeleteEvidence={(opts: { id: string; name: string }) => openDeleteModal(opts)}

                        // NOTE: wire a delete control in CriteriaCard to call this:
                        // onDeleteEvidence={(evidenceId) => deleteEvidence(evidenceId)}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Add Link modal (reuses ConfirmDialog) */}
      <ConfirmDialog
        open={!!linkForId}
        title="Add a link as evidence"
        message={
          <div className="space-y-2">
            <label className="block text-xs text-slate-600">URL</label>
            <input
              type="text" // plain text per request
              placeholder="Paste URL or reference"
              value={linkURL}
              onChange={(e) => {
                setLinkURL(e.target.value);
                setLinkErr(null);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {linkErr && <div className="text-xs text-rose-600">{linkErr}</div>}
            <p className="text-xs text-slate-500">
              This will save a new row to <code>evidence</code> with{" "}
              <code>kind="link"</code>.
            </p>
          </div>
        }
        confirmLabel="Add link"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={confirmAddLink}
        onCancel={closeLinkModal}
      />
	  
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
  );
}

// Owner & due date updaters for CriteriaCard
async function updateOwner(criterionId: string, newEmail: string) {
  const v = newEmail || null;
  const { error } = await supabase.from("criteria").update({ owner_email: v }).eq("id", criterionId);
  if (error) {
    return;
  }
}

async function updateDueDate(criterionId: string, newISO: string | null) {
  const v = newISO || null;
  const { error } = await supabase.from("criteria").update({ due_date: v }).eq("id", criterionId);
  if (error) {
    return;
  }
}
