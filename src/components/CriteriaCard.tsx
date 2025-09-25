import { useMemo, useState } from "react";
import { CalendarDays, Check, FileText, MessageSquareText, Paperclip } from "lucide-react";

export type CriteriaStatus =
  | "not_started"
  | "in_progress"
  | "done"
  | "delayed"
  | "caveat";

export type ActivityItem = {
  id: string;
  type: "note" | "status" | "evidence";
  summary: string;
  created_at: string; // ISO
  created_by: string; // email or name
};

export type EvidenceItem = {
  id: string;
  name: string;
  url?: string; // optional signed/public URL
  created_at: string; // ISO
  created_by: string;
};

export type Criteria = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  severity?: "low" | "med" | "high" | string | null;
  status: CriteriaStatus;
  owner_email?: string | null;
  due_date?: string | null; // yyyy-mm-dd
  last_action?: { type: string; summary: string; at: string; by: string } | null;
};

type Props = {
  item: Criteria;
  activities: ActivityItem[];
  evidence: EvidenceItem[];

  onChangeStatus: (next: CriteriaStatus) => void;
  onChangeOwner: (email: string) => void;
  onChangeDueDate: (dateISO: string | null) => void;

  onAddNote: (text: string) => Promise<void> | void;
  onAddEvidence?: () => void; // open your existing evidence upload flow
};

export default function CriteriaCard({
  item,
  activities,
  evidence,
  onChangeStatus,
  onChangeOwner,
  onChangeDueDate,
  onAddNote,
  onAddEvidence,
}: Props) {
  const [tab, setTab] = useState<"activity" | "evidence">("activity");
  const [note, setNote] = useState("");

  const statusOptions: { value: CriteriaStatus; label: string }[] = [
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "done", label: "Done" },
    { value: "delayed", label: "Delayed" },
    { value: "caveat", label: "Caveat" },
  ];

  const statusBadge = useMemo(() => {
    const m: Record<CriteriaStatus, string> = {
      not_started: "bg-slate-100 text-slate-700",
      in_progress: "bg-blue-100 text-blue-700",
      done: "bg-emerald-100 text-emerald-700",
      delayed: "bg-amber-100 text-amber-700",
      caveat: "bg-violet-100 text-violet-700",
    };
    return m[item.status];
  }, [item.status]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{item.title}</h3>
            {item.severity && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
                {(item.severity ?? "").toString().toUpperCase()}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${statusBadge}`}
              title="Current status"
            >
              {statusOptions.find((o) => o.value === item.status)?.label}
            </span>
          </div>
          {item.description && (
            <p className="mt-1 text-sm italic text-slate-600">{item.description}</p>
          )}
        </div>

        {/* Status dropdown (replaces buttons) */}
        <div className="shrink-0">
          <label className="block text-xs font-medium text-slate-600">
            Status
          </label>
          <select
            value={item.status}
            onChange={(e) => onChangeStatus(e.target.value as CriteriaStatus)}
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ownership & Target */}
      <div className="mx-5 mt-4 rounded-xl bg-slate-50 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ownership &amp; Target
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Owner (email)
            </label>
            <input
              type="email"
              placeholder="owner@example.com"
              value={item.owner_email || ""}
              onChange={(e) => onChangeOwner(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Target date
            </label>
            <div className="mt-1 flex items-center gap-2">
              <CalendarDays size={16} className="text-slate-500" />
              <input
                type="date"
                value={item.due_date || ""}
                onChange={(e) => onChangeDueDate(e.target.value || null)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 px-5">
        <div className="flex items-center gap-3">
          <button
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === "activity"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => setTab("activity")}
          >
            Activity ({activities.length})
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === "evidence"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => setTab("evidence")}
          >
            Evidence ({evidence.length})
          </button>
          {tab === "evidence" && onAddEvidence && (
            <button
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={onAddEvidence}
              title="Upload/attach evidence"
            >
              <Paperclip size={16} /> Add evidence
            </button>
          )}
        </div>
      </div>

      {/* Tab panes */}
      <div className="px-5 pb-4">
        {tab === "activity" ? (
          <>
            <div className="mt-3 flex items-center gap-2">
              <MessageSquareText size={16} className="text-slate-500" />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an activity note…"
                className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && note.trim()) {
                    await onAddNote(note.trim());
                    setNote("");
                  }
                }}
              />
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                onClick={async () => {
                  if (!note.trim()) return;
                  await onAddNote(note.trim());
                  setNote("");
                }}
              >
                Add
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {activities.length === 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No activity yet.
                </div>
              )}
              {activities.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                >
                  <FileText size={16} className="mt-1 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{a.summary}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {fmt(a.created_at)} — {a.created_by}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-3">
            {evidence.length === 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                No evidence attached.
              </div>
            )}
            {evidence.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
              >
                <Check size={16} className="mt-1 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    {ev.url ? (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {ev.name}
                      </a>
                    ) : (
                      ev.name
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {fmt(ev.created_at)} — {ev.created_by}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last action narrative */}
      {item.last_action && (
        <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-sm">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs">
              <FileText size={14} /> Last action:
            </span>{" "}
            <span className="rounded-md bg-white px-2 py-0.5 text-xs">
              {item.last_action.type}
            </span>{" "}
            {item.last_action.summary}
          </div>
          <div className="text-xs text-slate-500">
            {fmt(item.last_action.at)} — {item.last_action.by}
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
