import { useEffect, useMemo, useState } from "react";

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
  activities: Activity[]; // notes only
  evidence: EvidenceRow[]; // links/files only
  onChangeStatus: (next: CriteriaStatus) => void;
  onChangeOwner: (email: string) => void;
  onChangeDueDate: (iso: string | null) => void;
  onAddNote: (text: string) => void;
  onAddEvidenceFile: () => void; // file picker handled in parent
  onAddEvidenceLink: () => void; // ConfirmDialog handled in parent
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
    case "not_started":
      return "bg-slate-400";
    case "in_progress":
      return "bg-blue-600";
    case "blocked":
      return "bg-amber-600";
    case "done":
      return "bg-emerald-600";
    case "delayed":
      return "bg-red-600";
    case "caveat":
      return "bg-purple-700";
    default:
      return "bg-slate-400";
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
function absoluteUrl(u?: string) {
  if (!u) return "";
  return u.startsWith("http") ? u : `https://${u.replace(/^https?:\/\//, "")}`;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  size?: "sm" | "md";
}) {
  const base = size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm";
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-slate-300 bg-white">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`${base} ${
            o.value === value
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- component ---------- */
export default function CriteriaCard({
  item,
  activities,
  evidence,
  onChangeStatus,
  onChangeOwner,
  onChangeDueDate,
  onAddNote,
  onAddEvidenceFile,
  onAddEvidenceLink,
  onRequestDeleteEvidence,
}: Props) {
  // Progressive composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [attachMode, setAttachMode] = useState<"note" | "link" | "file">("note");

  // Details
  const [ownerLocal, setOwnerLocal] = useState(item.owner_email ?? "");
  const [dueLocal, setDueLocal] = useState(item.due_date ?? "");
  useEffect(() => setOwnerLocal(item.owner_email ?? ""), [item.owner_email]);
  useEffect(() => setDueLocal(item.due_date ?? ""), [item.due_date]);

  // Description
  const [descExpanded, setDescExpanded] = useState(false);
  const desc = (item.description ?? "").trim();
  const descTooLong = desc.length > 160;
  const descText = descExpanded || !descTooLong ? desc : desc.slice(0, 160) + "…";

  // Timeline
  const [timelineFilter, setTimelineFilter] = useState<"all" | "updates" | "evidence">("all");
  const [timelineLimit, setTimelineLimit] = useState(8);

  const actTotal = activities.length;
  const evTotal = evidence.length;

  const timeline = useMemo(() => {
    const items: Array<
      | { kind: "update"; id: string; at: string; by: string; summary: string }
      | { kind: "evidence"; id: string; at: string; by: string; name: string; url?: string; file: boolean }
    > = [];

    for (const a of activities) {
      items.push({ kind: "update", id: a.id, at: a.created_at, by: a.created_by, summary: a.summary });
    }
    for (const e of evidence) {
      items.push({ kind: "evidence", id: e.id, at: e.created_at, by: e.created_by, name: e.name, url: e.url, file: e.file });
    }

    items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return items;
  }, [activities, evidence]);

  const visibleTimeline = useMemo(() => {
    const filtered = timeline.filter((t) => {
      if (timelineFilter === "all") return true;
      if (timelineFilter === "updates") return t.kind === "update";
      return t.kind === "evidence";
    });
    return filtered.slice(0, timelineLimit);
  }, [timeline, timelineFilter, timelineLimit]);

  // Reset per criterion
  useEffect(() => {
    setDescExpanded(false);
    setComposerOpen(false);
    setNarrative("");
    setAttachMode("note");
    setTimelineFilter("all");
    setTimelineLimit(8);
  }, [item.id]);

  const submitComposer = () => {
    const text = narrative.trim();
    if (!text) return;

    // Always add note first, then optional attach action
    onAddNote(text);
    if (attachMode === "link") onAddEvidenceLink();
    if (attachMode === "file") onAddEvidenceFile();

    setNarrative("");
    setAttachMode("note");
    setComposerOpen(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={"inline-block h-2 w-2 rounded-full " + dotForStatus(item.status)} />
            <h3 className="truncate text-sm font-semibold leading-5">{item.title}</h3>
          </div>

          {desc && (
            <div className="mt-1 text-sm text-slate-700">
              <span>{descText}</span>
              {descTooLong && (
                <button
                  type="button"
                  className="ml-2 text-xs font-medium text-slate-700 underline"
                  onClick={() => setDescExpanded((v) => !v)}
                >
                  {descExpanded ? "Less" : "More"}
                </button>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {item.category && (
              <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5">
                {item.category}
              </span>
            )}
            {item.severity && (
              <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5">
                {String(item.severity).toUpperCase()}
              </span>
            )}
            {ownerLocal && (
              <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5">
                {ownerLocal}
              </span>
            )}
            {dueLocal && (
              <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5">
                {dueLocal}
              </span>
            )}
          </div>

          {item.last_action && (
            <div className="mt-2 text-xs text-slate-500">
              Last: {item.last_action.summary} — {new Date(item.last_action.at).toLocaleString()}
            </div>
          )}
        </div>

        <StatusSelect value={item.status} onChange={onChangeStatus} />
      </div>

      {/* Composer (progressive) */}
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
        {!composerOpen ? (
          <button
            type="button"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => setComposerOpen(true)}
          >
            Add update…
          </button>
        ) : (
          <>
            <label className="mb-1 block text-xs text-slate-600">Update</label>
            <textarea
              className="w-full min-h-[84px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="What changed, why, by whom…"
              value={narrative}
              onChange={(e) => setNarrative(e.currentTarget.value)}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600">Attach:</span>
              <Segmented
                value={attachMode}
                onChange={setAttachMode}
                options={[
                  { value: "note", label: "Note" },
                  { value: "link", label: "Link" },
                  { value: "file", label: "File" },
                ]}
              />

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onClick={() => {
                    setComposerOpen(false);
                    setNarrative("");
                    setAttachMode("note");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                  onClick={submitComposer}
                  disabled={!narrative.trim()}
                  title={
                    attachMode === "link"
                      ? "You’ll be prompted for a URL"
                      : attachMode === "file"
                      ? "You’ll be prompted to choose a file"
                      : "Add a note"
                  }
                >
                  {attachMode === "note" ? "Add note" : attachMode === "link" ? "Add link" : "Upload file"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Timeline (merged) */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <div className="text-sm font-semibold">History</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Notes {actTotal} · Evidence {evTotal}</span>
            <Segmented
              value={timelineFilter}
              onChange={setTimelineFilter}
              options={[
                { value: "all", label: "All" },
                { value: "updates", label: "Updates" },
                { value: "evidence", label: "Evidence" },
              ]}
              size="sm"
            />
          </div>
        </div>

        {timeline.length === 0 ? (
          <div className="p-4 text-sm text-slate-600">No updates yet.</div>
        ) : (
          <TimelineList
            rows={visibleTimeline}
            onDeleteEvidence={onRequestDeleteEvidence ? (id, name) => onRequestDeleteEvidence({ id, name }) : undefined}
          />
        )}

        {timeline.length > visibleTimeline.length && (
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              className="w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
              onClick={() => setTimelineLimit((n) => n + 8)}
            >
              Show more
            </button>
          </div>
        )}
      </div>

      {/* Details (collapsible) */}
      <details className="mt-4 rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold">
          Details
          <span className="ml-2 text-xs font-normal text-slate-500">(owner, target date)</span>
        </summary>
        <div className="border-t border-slate-100 p-3">
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
        </div>
      </details>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function StatusSelect({ value, onChange }: { value: CriteriaStatus; onChange: (v: CriteriaStatus) => void }) {
  const [open, setOpen] = useState(false);
  const options: CriteriaStatus[] = ["not_started", "in_progress", "blocked", "done", "delayed", "caveat"];
  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={"h-1.5 w-1.5 rounded-full " + dotForStatus(value)} />
        {STATUS_LABEL[String(value)] ?? String(value)}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border bg-white p-1 shadow">
          {options.map((s) => (
            <button
              type="button"
              key={s}
              className={
                "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-50 " +
                (s === value ? "font-semibold" : "")
              }
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
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

function TimelineList({
  rows,
  onDeleteEvidence,
}: {
  rows: Array<
    | { kind: "update"; id: string; at: string; by: string; summary: string }
    | { kind: "evidence"; id: string; at: string; by: string; name: string; url?: string; file: boolean }
  >;
  onDeleteEvidence?: (id: string, name: string) => void;
}) {
  const [openPreview, setOpenPreview] = useState<string | null>(null);

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />
      <ul className="divide-y divide-slate-100">
      {rows.map((r) => {
        const at = new Date(r.at).toLocaleString();

        if (r.kind === "update") {
          return (
            <li key={r.id} className="relative px-3 py-2 pl-10 group hover:bg-slate-50">
              <div className="min-w-0">
                <span className="absolute left-3 top-4 inline-block h-2 w-2 rounded-full bg-slate-900" />
                <div className="min-w-0">
                  <div className="text-sm text-slate-900">{r.summary}</div>
                  <div className="text-xs text-slate-500">
                    {at} · {r.by}
                  </div>
                </div>
              </div>
            </li>
          );
        }

        const canPreview = isImageUrl(r.url) || isPdfUrl(r.url);
        const isOpen = openPreview === r.id;
        const display = r.file ? r.name || "File" : r.url ? r.url : r.name;

        return (
          <li key={r.id} className="relative px-3 py-2 pl-10 group hover:bg-slate-50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="absolute left-3 top-4 inline-block h-2 w-2 rounded-full bg-slate-400" />
                <div className="min-w-0">
                  <div className="break-all text-sm font-medium text-slate-900">{display}</div>
                  <div className="text-xs text-slate-500">
                    {at} · {r.by}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {r.url && (
                  <a
                    href={absoluteUrl(r.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-700 hover:underline"
                  >
                    View
                  </a>
                )}
                {canPreview && (
                  <button
                    type="button"
                    className="text-xs text-slate-700 hover:underline"
                    onClick={() => setOpenPreview(isOpen ? null : r.id)}
                  >
                    {isOpen ? "Hide" : "Preview"}
                  </button>
                )}
                {onDeleteEvidence && (
                  <button
                    type="button"
                    className="text-xs text-slate-700 hover:underline"
                    onClick={() => onDeleteEvidence(r.id, r.name)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {isOpen && r.url && (
              <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 p-2">
                {isImageUrl(r.url) && (
                  <img
                    src={absoluteUrl(r.url)}
                    alt={r.name || "evidence image"}
                    className="max-h-[320px] w-auto rounded-md border border-slate-100"
                    loading="lazy"
                  />
                )}
                {isPdfUrl(r.url) && (
                  <iframe
                    src={absoluteUrl(r.url)}
                    className="h-[420px] w-full rounded-md border border-slate-100"
                    title={r.name || "evidence pdf"}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
    </div>
  );
}

function DetailsTab({
  ownerLocal,
  setOwnerLocal,
  dueLocal,
  setDueLocal,
  onSave,
}: {
  ownerLocal: string;
  setOwnerLocal: (v: string) => void;
  dueLocal: string;
  setDueLocal: (v: string) => void;
  onSave: () => void;
}) {
  const [pristineOwner, setPristineOwner] = useState(ownerLocal);
  const [pristineDue, setPristineDue] = useState(dueLocal);
  useEffect(() => {
    setPristineOwner(ownerLocal);
  }, [ownerLocal]);
  useEffect(() => {
    setPristineDue(dueLocal);
  }, [dueLocal]);
  const dirty = ownerLocal !== pristineOwner || dueLocal !== pristineDue;

  return (
    <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-2">
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
          type="button"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() => {
            setOwnerLocal(pristineOwner);
            setDueLocal(pristineDue);
          }}
          disabled={!dirty}
        >chipForStatus
          Reset
        </button>
        <button
          type="button"
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
