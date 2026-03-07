
import { useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type Status =
  | "not_started"
  | "in_progress"
  | "done"
  | "delayed"
  | "caveat"
  | (string & {});

export default function CriteriaRow({
  title,
  severity,
  status,
  owner,
  due,
  onStatusChange,
  onOpen,
  expanded,
  taskProgress,
}: {
  title: string;
  severity?: "low" | "med" | "high" | string | null;
  status: Status;
  owner?: string | null;
  due?: string | null;
  onStatusChange?: (next: Status) => void;
  onOpen?: () => void;
  expanded?: boolean;
  taskProgress?: { complete: number; total: number } | null;
}) {
  const statusClasses: Record<string, string> = {
    not_started: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-100 text-blue-700",
    done: "bg-emerald-100 text-emerald-700",
    delayed: "bg-amber-100 text-amber-700",
    caveat: "bg-violet-100 text-violet-700",
  };
  const badge = statusClasses[status] ?? "bg-slate-100 text-slate-700";
  const sev = (severity || "").toString().toUpperCase();

  const isOverdue = useMemo(() => {
    if (!due) return false;
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const d = new Date(due + "T00:00:00");
      return d < today && status !== "done";
    } catch { return false; }
  }, [due, status]);

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left hover:opacity-90"
          aria-label={`Open ${title}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="mt-[1px] inline-flex h-4 w-4 items-center justify-center text-slate-500">
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            <div className="truncate font-medium">{title}</div>
            {severity && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px]">
                {sev}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            {owner && <span>👤 {owner}</span>}
            {due && (
              <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                📅 {due}{isOverdue && " • overdue"}
              </span>
            )}
            {taskProgress && taskProgress.total > 0 && (
              <span className={
                taskProgress.complete === taskProgress.total
                  ? "text-emerald-600 font-medium"
                  : taskProgress.complete > 0
                  ? "text-blue-600"
                  : "text-slate-500"
              }>
                ✓ {taskProgress.complete}/{taskProgress.total} tasks
              </span>
            )}
          </div>
        </button>

        <label className="shrink-0 text-xs text-slate-600">
          <span className="sr-only">Status</span>
          <select
            value={status}
            onChange={(e) => onStatusChange?.(e.target.value as Status)}
            className={`ml-2 rounded-full px-2 py-1 text-xs ${badge}`}
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
            <option value="delayed">Delayed</option>
            <option value="caveat">Caveat</option>
          </select>
        </label>
      </div>
    </div>
  );
}
