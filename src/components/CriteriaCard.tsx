import React, { useEffect, useMemo, useState } from "react";

/** Keep this exported for App.tsx imports */
export type CriteriaStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "done"
  | "delayed"
  | "caveat"
  | string;

type LastAction = {
  type: string;
  summary: string;
  at: string;
  by: string;
} | null;

type Activity = {
  id: string;
  type: "note";
  summary: string;
  created_at: string;
  created_by: string;
};

type EvidenceRow = {
  id: string;
  name: string;
  url?: string;
  file: boolean;
  created_at: string;
  created_by: string;
};

type Item = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  severity?: string;
  status: CriteriaStatus;
  owner_email?: string;
  due_date?: string;
  last_action?: LastAction;
};

type Props = {
  item: Item;
  activities: Activity[];      // notes only
  evidence: EvidenceRow[];     // links/files only
  onChangeStatus: (next: CriteriaStatus) => void;
  onChangeOwner: (email: string) => void;
  onChangeDueDate: (iso: string | null) => void;
  onAddNote: (text: string) => void;
  onAddEvidenceFile: () => void;   // file picker handled in parent
  onAddEvidenceLink: () => void;   // ConfirmDialog handled in parent
  onRequestDeleteEvidence?: (opts: { id: string; name: string }) => void;
};

/* ---------- helpers ---------- */
const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  delayed: "Delayed",
  caveat: "Caveat",
};

function dotForStatus(s: CriteriaStatus) {
  switch (s) {
    case "not_started": return "bg-gray-400";
    case "in_progress": return "bg-blue-600";
    case "blocked": return "bg-amber-600";
    case "done": return "bg-emerald-600";
    case "delayed": return "bg-red-600";
    case "caveat": return "bg-purple-700";
    default: return "bg-gray-400";
  }
}

function Pager({
  page, pageCount, onPageChange, className = ""
}: { page: number; pageCount: number; onPageChange: (n: number) => void; className?: string }) {
  const canPrev = page > 1;
  const canNext = page < pageCount;
  return (
    <div className={"flex items-center justify-end gap-2 " + className}>
      <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(1)} disabled={!canPrev} title="First page">«</button>
      <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(page - 1)} disabled={!canPrev} title="Previous page">‹</button>
      <span className="text-xs text-slate-600">Page {page} of {pageCount}</span>
      <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(page + 1)} disabled={!canNext} title="Next page">›</button>
      <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(pageCount)} disabled={!canNext} title="Last page">»</button>
    </div>
  );
}

function isImageUrl(u?: string) {
  if (!u) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(u);
}
function isPdfUrl(u?: string) {
  if (!u) return false;
  return /\.pdf(\?.*)?$/i.test(u);
}
function absoluteUrl(u?: string) {
  if (!u) return "";
  return u.startsWith("http") ? u : `https://${u.replace(/^https?:\/\//, "")}`;
}

/* ---------- component ---------- */
export default function CriteriaCard({
  item, activities, evidence,
  onChangeStatus, onChangeOwner, onChangeDueDate,
  onAddNote, onAddEvidenceFile, onAddEvidenceLink,
  onRequestDeleteEvidence,
}: Props) {
  const [tab, setTab] = useState<"updates" | "details">("updates");

  // Composer state (narrative-first + attachment)
  const [narrative, setNarrative] = useState("");
  const [attachMode, setAttachMode] = useState<"note" | "link" | "file">("note"); // “None” → “Note”

  // Pagination
  const [actPage, setActPage] = useState(1);
  const [evPage, setEvPage] = useState(1);
  const pageSize = 5;

  const actTotal = activities.length;
  const evTotal = evidence.length;

  const actPageCount = Math.max(1, Math.ceil(actTotal / pageSize));
  const evPageCount = Math.max(1, Math.ceil(evTotal / pageSize));

  useEffect(() => { if (actPage > actPageCount) setActPage(actPageCount); }, [actPage, actPageCount]);
  useEffect(() => { if (evPage > evPageCount) setEvPage(evPageCount); }, [evPage, evPageCount]);

  const actSlice = useMemo(() => {
    const start = (actPage - 1) * pageSize;
    return activities.slice(start, start + pageSize);
  }, [activities, actPage]);

  const evSlice = useMemo(() => {
    const start = (evPage - 1) * pageSize;
    return evidence.slice(start, start + pageSize);
  }, [evidence, evPage]);

  // Local (optimistic) details state
  const [ownerLocal, setOwnerLocal] = useState(item.owner_email ?? "");
  const [dueLocal, setDueLocal] = useState(item.due_date ?? "");
  useEffect(() => { setOwnerLocal(item.owner_email ?? ""); }, [item.owner_email]);
  useEffect(() => { setDueLocal(item.due_date ?? ""); }, [item.due_date]);

  return (
    <div className="rounded-2xl border bg-white p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={"inline-block h-2 w-2 rounded-full " + dotForStatus(item.status)} />
            <h3 className="truncate text-sm font-semibold leading-5">{item.title}</h3>
          </div>
          {item.description && <p className="mt-1 text-sm text-slate-700">{item.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {item.category && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">{item.category}</span>}
            {item.severity && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">{String(item.severity).toUpperCase()}</span>}
            {ownerLocal && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">{ownerLocal}</span>}
            {dueLocal && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">{dueLocal}</span>}
          </div>
          {item.last_action && (
            <div className="mt-2 text-xs text-slate-500">
              Last: {item.last_action.summary} — {new Date(item.last_action.at).toLocaleString()}
            </div>
          )}
        </div>
        <StatusSelect value={item.status} onChange={onChangeStatus} />
      </div>

      {/* Tabs */}
      <div className="mt-4 flex items-center gap-2">
        <TabButton active={tab === "updates"} onClick={() => setTab("updates")}>
          Updates (Notes {actTotal} · Evidence {evTotal})
        </TabButton>
        <TabButton active={tab === "details"} onClick={() => setTab("details")}>
          Details
        </TabButton>
      </div>

      {/* Bodies */}
      <div className="mt-3">
        {tab === "updates" && (
          <UpdatesTab
            narrative={narrative}
            setNarrative={setNarrative}
            attachMode={attachMode}
            setAttachMode={setAttachMode}
            onSubmit={() => {
              const text = narrative.trim();
              if (!text) return;
              // Always add the note first
              onAddNote(text);
              if (attachMode === "link") onAddEvidenceLink();
              if (attachMode === "file") onAddEvidenceFile();
              setNarrative(""); setAttachMode("note");
            }}
            // activity
            actSlice={actSlice} actTotal={actTotal}
            actPage={actPage} actPageCount={actPageCount} onActPageChange={setActPage}
            // evidence
            evSlice={evSlice} evTotal={evTotal}
            evPage={evPage} evPageCount={evPageCount} onEvPageChange={setEvPage}
            onDeleteEvidence={(row) => onRequestDeleteEvidence?.({ id: row.id, name: row.name })}
          />
        )}

        {tab === "details" && (
          <DetailsTab
            ownerLocal={ownerLocal}
            setOwnerLocal={setOwnerLocal}
            dueLocal={dueLocal}
            setDueLocal={setDueLocal}
            onSave={() => {
              onChangeOwner(ownerLocal);
              onChangeDueDate(dueLocal || null);
              const ownerTxt = ownerLocal ? `Owner: ${ownerLocal}` : "Owner cleared";
              const dueTxt = dueLocal ? `Target: ${dueLocal}` : "Target cleared";
              onAddNote(`Details updated — ${ownerTxt}; ${dueTxt}`);
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
    >
      {children}
    </button>
  );
}

function StatusSelect({ value, onChange }: { value: CriteriaStatus; onChange: (v: CriteriaStatus) => void }) {
  const [open, setOpen] = useState(false);
  const options: CriteriaStatus[] = ["not_started", "in_progress", "blocked", "done", "delayed", "caveat"];
  return (
    <div className="relative">
      <button
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={"h-1.5 w-1.5 rounded-full " + dotForStatus(value)} />
        {STATUS_LABEL[String(value)] ?? String(value)}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border bg-white p-1 shadow">
          {options.map((s) => (
            <button
              key={s}
              className={"flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-50 " + (s === value ? "font-semibold" : "")}
              onClick={() => { onChange(s); setOpen(false); }}
            >
              <span className={"h-2 w-2 rounded-full " + dotForStatus(s)} />
              {STATUS_LABEL[String(s)] ?? String(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UpdatesTab({
  narrative, setNarrative, attachMode, setAttachMode, onSubmit,
  actSlice, actTotal, actPage, actPageCount, onActPageChange,
  evSlice, evTotal, evPage, evPageCount, onEvPageChange,
  onDeleteEvidence,
}: {
  narrative: string; setNarrative: (v: string) => void;
  attachMode: "note" | "link" | "file"; setAttachMode: (m: "note" | "link" | "file") => void; onSubmit: () => void;
  actSlice: Activity[]; actTotal: number; actPage: number; actPageCount: number; onActPageChange: (n: number) => void;
  evSlice: EvidenceRow[]; evTotal: number; evPage: number; evPageCount: number; onEvPageChange: (n: number) => void;
  onDeleteEvidence: (row: EvidenceRow) => void;
}) {
  const [openPreview, setOpenPreview] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      {/* Composer */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="block text-xs text-slate-600 mb-1">Narrative / Description (required)</label>
        <textarea
          className="w-full min-h-[90px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="What changed, why, by whom…"
          value={narrative}
          onChange={(e)=>setNarrative(e.currentTarget.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-slate-600">Attach:</span>
          <label className={"rounded-full border px-2 py-0.5 " + (attachMode==="note" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300")}>
            <input type="radio" className="hidden" checked={attachMode==="note"} onChange={()=>setAttachMode("note")} />
            Note
          </label>
          <label className={"rounded-full border px-2 py-0.5 " + (attachMode==="link" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300")}>
            <input type="radio" className="hidden" checked={attachMode==="link"} onChange={()=>setAttachMode("link")} />
            Link
          </label>
          <label className={"rounded-full border px-2 py-0.5 " + (attachMode==="file" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300")}>
            <input type="radio" className="hidden" checked={attachMode==="file"} onChange={()=>setAttachMode("file")} />
            File
          </label>
          <button
            className="ml-auto rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            onClick={onSubmit}
            disabled={!narrative.trim()}
            title={attachMode==="link" ? "You’ll be prompted for a URL" : attachMode==="file" ? "You’ll be prompted to choose a file" : "Add a note only"}
          >
            Add
          </button>
        </div>
      </section>

      {/* Activity list */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Activity</div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>{actTotal} total</span>
            <Pager page={actPage} pageCount={actPageCount} onPageChange={onActPageChange} />
          </div>
        </div>
        {actSlice.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center text-slate-600">No activity yet.</div>
        ) : (
          <ul className="grid gap-2">
            {actSlice.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-sm">{a.summary}</div>
                <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()} · {a.created_by}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Evidence list */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Evidence</div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>{evTotal} total</span>
            <Pager page={evPage} pageCount={evPageCount} onPageChange={onEvPageChange} />
          </div>
        </div>
        {evSlice.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center text-slate-600">No evidence yet.</div>
        ) : (
          <ul className="grid gap-2">
            {evSlice.map((e) => {
              const canPreview = isImageUrl(e.url) || isPdfUrl(e.url);
              const isOpen = openPreview === e.id;
              return (
                <li key={e.id} className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium break-all">
                        {e.file ? (e.name || "File") : (e.url ? e.url : e.name)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(e.created_at).toLocaleString()} · {e.created_by}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.url && (
                        <a
                          href={absoluteUrl(e.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline text-slate-700"
                          title="Open in a new tab"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          View
                        </a>
                      )}
                      {canPreview && (
                        <button
                          className="text-xs underline"
                          onClick={() => setOpenPreview(isOpen ? null : e.id)}
                          title={isOpen ? "Hide preview" : "Show preview"}
                        >
                          {isOpen ? "Hide preview" : "Preview"}
                        </button>
                      )}
                      <button className="text-xs underline text-slate-700" onClick={() => onDeleteEvidence(e)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  {isOpen && e.url && (
                    <div className="border-t border-slate-100 p-3">
                      {isImageUrl(e.url) && (
                        <img
                          src={absoluteUrl(e.url)}
                          alt={e.name || "evidence image"}
                          className="max-h-[320px] w-auto rounded-md border border-slate-200"
                          loading="lazy"
                        />
                      )}
                      {isPdfUrl(e.url) && (
                        <iframe
                          src={absoluteUrl(e.url)}
                          className="h-[420px] w-full rounded-md border border-slate-200"
                          title={e.name || "evidence pdf"}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function DetailsTab({
  ownerLocal, setOwnerLocal, dueLocal, setDueLocal, onSave,
}: {
  ownerLocal: string; setOwnerLocal: (v: string) => void;
  dueLocal: string; setDueLocal: (v: string) => void;
  onSave: () => void;
}) {
  const [pristineOwner, setPristineOwner] = useState(ownerLocal);
  const [pristineDue, setPristineDue] = useState(dueLocal);
  useEffect(() => { setPristineOwner(ownerLocal); }, [ownerLocal]);
  useEffect(() => { setPristineDue(dueLocal); }, [dueLocal]);
  const dirty = ownerLocal !== pristineOwner || dueLocal !== pristineDue;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid gap-3 md:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">Owner</span>
        <input
          type="email"
          value={ownerLocal}
          onChange={(e) => setOwnerLocal(e.currentTarget.value)}
          placeholder="name@acme.com"
          className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900"
        />
        <span className="text-xs text-slate-500">Who is accountable for this criterion?</span>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">Target date</span>
        <input
          type="date"
          value={dueLocal}
          onChange={(e) => setDueLocal(e.currentTarget.value)}
          className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900"
        />
        <span className="text-xs text-slate-500">Optional target for completion.</span>
      </label>

      <div className="md:col-span-2 flex items-center justify-end gap-2">
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() => { setOwnerLocal(pristineOwner); setDueLocal(pristineDue); }}
          disabled={!dirty}
        >
          Reset
        </button>
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={onSave}
          disabled={!dirty}
          title="Save owner and target date, and add an activity note"
        >
          Save
        </button>
      </div>
    </div>
  );
}
