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
  activities: Activity[];
  evidence: EvidenceRow[];
  onChangeStatus: (next: CriteriaStatus) => void;
  onChangeOwner: (email: string) => void;
  onChangeDueDate: (iso: string | null) => void;
  onAddNote: (text: string) => void;
  onAddEvidenceFile: () => void;
  onAddEvidenceLink: () => void;
  onRequestDeleteEvidence?: (opts: { id: string; name: string }) => void;
};

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
function isImageUrl(u?: string) {
  if (!u) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(u);
}

function isPdfUrl(u?: string) {
  if (!u) return false;
  return /\.pdf(\?.*)?$/i.test(u);
}
export default function CriteriaCard({
  item, activities, evidence,
  onChangeStatus, onChangeOwner, onChangeDueDate,
  onAddNote, onAddEvidenceFile, onAddEvidenceLink,
  onRequestDeleteEvidence,
}: Props) {
  const [tab, setTab] = useState<"activity" | "evidence" | "details">("activity");

  // Evidence composer state (narrative-first, optional attachment)
  const [narrative, setNarrative] = useState("");
  const [attachMode, setAttachMode] = useState<"none" | "link" | "file">("none");

  // Pagination state
  const [actPage, setActPage] = useState(1);
  const [evPage, setEvPage] = useState(1);
  const pageSize = 5;

  const actTotal = activities.length;
  const evTotal = evidence.length;

  const actPageCount = Math.max(1, Math.ceil(actTotal / pageSize));
  const evPageCount = Math.max(1, Math.ceil(evTotal / pageSize));

  const actSlice = useMemo(() => {
    const start = (actPage - 1) * pageSize;
    return activities.slice(start, start + pageSize);
  }, [activities, actPage]);

  const evSlice = useMemo(() => {
    const start = (evPage - 1) * pageSize;
    return evidence.slice(start, start + pageSize);
  }, [evidence, evPage]);

  // Keep pages valid when totals change
  useEffect(() => { if (actPage > actPageCount) setActPage(actPageCount); }, [actPage, actPageCount]);
  useEffect(() => { if (evPage > evPageCount) setEvPage(evPageCount); }, [evPage, evPageCount]);

  // Local (optimistic) details state so the header chips update immediately on Save
  const [ownerLocal, setOwnerLocal] = useState(item.owner_email ?? "");
  const [dueLocal, setDueLocal] = useState(item.due_date ?? "");

  // keep local in sync if parent changes
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
          {item.description && (
            <p className="mt-1 text-sm text-slate-700">{item.description}</p>
          )}
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

        {/* Status control */}
        <StatusSelect value={item.status} onChange={onChangeStatus} />
      </div>

      {/* Tabs */}
      <div className="mt-4 flex items-center gap-2">
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
          Activity ({actTotal})
        </TabButton>
        <TabButton active={tab === "evidence"} onClick={() => setTab("evidence")}>
          Evidence ({evTotal})
        </TabButton>
        <TabButton active={tab === "details"} onClick={() => setTab("details")}>Details</TabButton>
      </div>

      {/* Bodies */}
      <div className="mt-3">
        {tab === "activity" && (
          <ActivityTab
            activities={actSlice}
            total={actTotal}
            page={actPage}
            pageCount={actPageCount}
            onPageChange={setActPage}
            onAdd={(t) => { if (t.trim()) onAddNote(t.trim()); }}
          />
        )}

        {tab === "evidence" && (
          <EvidenceTab
            narrative={narrative}
            setNarrative={setNarrative}
            attachMode={attachMode}
            setAttachMode={setAttachMode}
            onSubmit={() => {
              const text = narrative.trim();
              if (!text) return;
              // Save narrative as an activity entry first
              onAddNote(text);
              // Then attach the link or file if requested
              if (attachMode === "link") onAddEvidenceLink();
              if (attachMode === "file") onAddEvidenceFile();
              // Reset composer
              setNarrative("");
              setAttachMode("none");
            }}
            evidence={evSlice}
            total={evTotal}
            page={evPage}
            pageCount={evPageCount}
            onPageChange={setEvPage}
            onDelete={(row) => onRequestDeleteEvidence?.({ id: row.id, name: row.name })}
          />
        )}

        {tab === "details" && (
          <DetailsTab
            ownerLocal={ownerLocal}
            setOwnerLocal={setOwnerLocal}
            dueLocal={dueLocal}
            setDueLocal={setDueLocal}
            onSave={() => {
              // Optimistically reflect in header via local state (already done above)
              onChangeOwner(ownerLocal);
              onChangeDueDate(dueLocal || null);
              // Activity entry
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

function Pager({
  page, pageCount, onPageChange, className = ""
}: { page: number; pageCount: number; onPageChange: (n: number) => void; className?: string }) {
  const canPrev = page > 1;
  const canNext = page < pageCount;
  return (
    <div className={"flex items-center justify-end gap-2 " + className}>
      <button
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(1)}
        disabled={!canPrev}
        title="First page"
      >
        «
      </button>
      <button
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev}
        title="Previous page"
      >
        ‹
      </button>
      <span className="text-xs text-slate-600">Page {page} of {pageCount}</span>
      <button
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext}
        title="Next page"
      >
        ›
      </button>
      <button
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(pageCount)}
        disabled={!canNext}
        title="Last page"
      >
        »
      </button>
    </div>
  );
}

function ActivityTab({
  activities, total, page, pageCount, onPageChange, onAdd
}: {
  activities: Activity[]; total: number; page: number; pageCount: number;
  onPageChange: (n: number) => void; onAdd: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Write a quick activity note…"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={!text.trim()}
          onClick={() => { onAdd(text); setText(""); }}
        >
          Add
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{total} total</span>
        <Pager page={page} pageCount={pageCount} onPageChange={onPageChange} />
      </div>

      <ul className="divide-y">
        {activities.length === 0 && (
          <li className="py-4 text-sm text-slate-600">No activity yet.</li>
        )}
        {activities.map((a) => (
          <li key={a.id} className="py-2">
            <div className="text-sm">{a.summary}</div>
            <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()} · {a.created_by}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceTab({
  narrative, setNarrative, attachMode, setAttachMode, onSubmit,
  evidence, total, page, pageCount, onPageChange, onDelete,
}: {
  narrative: string;
  setNarrative: (v: string) => void;
  attachMode: "none" | "link" | "file";
  setAttachMode: (m: "none" | "link" | "file") => void;
  onSubmit: () => void;
  evidence: EvidenceRow[];
  total: number;
  page: number;
  pageCount: number;
  onPageChange: (n: number) => void;
  onDelete: (row: EvidenceRow) => void;
}) {
  // Track which evidence id is expanded for preview
  const [openPreview, setOpenPreview] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      {/* Composer */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="block text-xs text-slate-600 mb-1">Narrative / Description (required)</label>
        <textarea
          className="w-full min-h-[90px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="What is this evidence? What changed, why, by whom…"
          value={narrative}
          onChange={(e)=>setNarrative(e.currentTarget.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-slate-600">Attach:</span>
          <label className={"rounded-full border px-2 py-0.5 " + (attachMode==="none" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300")}>
            <input type="radio" className="hidden" checked={attachMode==="none"} onChange={()=>setAttachMode("none")} />
            None
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
            title={attachMode==="link" ? "You’ll be prompted for a URL" : attachMode==="file" ? "You’ll be prompted to choose a file" : "Add a narrative-only entry"}
          >
            Add Evidence
          </button>
        </div>
      </section>

      {/* List */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Evidence</div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>{total} total</span>
            <Pager page={page} pageCount={pageCount} onPageChange={onPageChange} />
          </div>
        </div>

        {evidence.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center text-slate-600">
            No evidence yet.
          </div>
        ) : (
          <ul className="grid gap-2">
            {evidence.map((e) => {
              const canPreview = isImageUrl(e.url) || isPdfUrl(e.url);
              const isOpen = openPreview === e.id;
              return (
                <li key={e.id} className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium break-all">
                        {/* For links and files, always provide a View button (new tab) */}
                        {e.file
                          ? (e.name || "File")
                          : (e.url ? e.url : e.name)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(e.created_at).toLocaleString()} · {e.created_by}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* View in new tab for both link and file */}
                      {e.url && (
                     <a
    href={e.url.startsWith("http") ? e.url : `https://${e.url.replace(/^https?:\/\//, "")}`}
    target="_blank"
    rel="noopener noreferrer"
    className="text-xs underline text-slate-700"
    title="Open in a new tab"
    onClick={(ev) => ev.stopPropagation()}
  >
    View
  </a>
                      )}

                      {/* Inline preview toggle (images / pdfs only) */}
                      {canPreview && (
                        <button
                          className="text-xs underline"
                          onClick={() => setOpenPreview(isOpen ? null : e.id)}
                          title={isOpen ? "Hide preview" : "Show preview"}
                        >
                          {isOpen ? "Hide preview" : "Preview"}
                        </button>
                      )}

                      <button
                        className="text-xs underline text-slate-700"
                        onClick={() => onDelete(e)}
                        title="Remove evidence"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Inline preview panel */}
                  {isOpen && e.url && (
                    <div className="border-t border-slate-100 p-3">
                      {isImageUrl(e.url) && (
                        <img
                          src={e.url}
                          alt={e.name || "evidence image"}
                          className="max-h-[320px] w-auto rounded-md border border-slate-200"
                          loading="lazy"
                        />
                      )}
                      {isPdfUrl(e.url) && (
                        <iframe
                          src={e.url}
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
  ownerLocal: string;
  setOwnerLocal: (v: string) => void;
  dueLocal: string;
  setDueLocal: (v: string) => void;
  onSave: () => void;
}) {
  // dirty flag
  const [pristineOwner, setPristineOwner] = useState(ownerLocal);
  const [pristineDue, setPristineDue] = useState(dueLocal);

  useEffect(() => { setPristineOwner(ownerLocal); }, [ownerLocal]);
  useEffect(() => { setPristineDue(dueLocal); }, [dueLocal]);

  const dirty = ownerLocal !== pristineOwner || dueLocal !== pristineDue;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid gap-3 md:grid-cols-2">
      {/* Owner */}
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

      {/* Target date */}
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
