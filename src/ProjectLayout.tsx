import { useEffect, useState, useMemo } from "react";
import { NavLink, Outlet, useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ProjectCtx } from "./ProjectContext";
import {
  ClipboardCheck,
  PieChart,
  ListChecks,
  Settings,
  ChevronLeft,
  MoreVertical,
  FileCheck2,
} from "lucide-react";

type Project = {
  id: string;
  name: string;
  status: string;
  org_id: string;
  go_live_date?: string | null;
  start_date?: string | null;
  handover_target_date?: string | null;
};

function rememberLastProject(id: string) {
  localStorage.setItem("lastProjectId", id);
  window.dispatchEvent(new CustomEvent("last-project-changed", { detail: id }));
}

export default function ProjectLayout() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();

  const [project, setProject] = useState<Project | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,org_id,go_live_date,start_date,handover_target_date")
        .eq("id", id)
        .single();
      if (error) setErr(error.message);
      setProject((data as Project) ?? null);
      if (data?.id) rememberLastProject(data.id);
      setLoading(false);
    })();
  }, [id]);

  const section = useMemo(() => {
    if (loc.pathname.endsWith("/dashboard")) return "Dashboard";
    if (loc.pathname.endsWith("/allocate")) return "Allocate";
    if (loc.pathname.endsWith("/settings")) return "Settings";
    return "Checklist";
  }, [loc.pathname]);

  if (loading) {
    return <div className="p-6 text-slate-600">Loading project…</div>;
  }
  if (err || !project) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-rose-700">Can’t load project — {err ?? "check sign-in/RLS."}</div>
        <button
          onClick={() => nav("/projects")}
          className="underline text-slate-700 hover:text-slate-900"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <ProjectCtx.Provider value={{ project }}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {/* Header with breadcrumb + quick actions */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between gap-3">
            {/* Breadcrumb */}
            <div className="min-w-0 flex items-center gap-2">
              <button
                onClick={() => nav("/projects")}
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
                title="Back to Projects"
              >
                <ChevronLeft size={16} />
                Projects
              </button>
              <span className="text-slate-400">/</span>
              <div className="truncate text-sm font-semibold">{project.name}</div>
              <span className="text-slate-400">/</span>
              <div className="text-sm text-slate-600">{section}</div>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Emit event some other part of the app listens to, or call your generator directly in this layout
                  window.dispatchEvent(new CustomEvent("export-certificate"));
                }}
                className="hidden sm:inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                title="Generate Operational Acceptance Certificate"
              >
                <FileCheck2 size={16} /> Certificate
              </button>

              {/* Optional overflow for future actions */}
              <button
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 hover:bg-slate-50"
                title="More"
              >
                <MoreVertical size={16} />
              </button>
            </div>
          </div>

          {/* Top tabs (no inner sidebar) */}
          <nav className="mx-auto max-w-screen-2xl px-2 pb-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <TopTab to="" icon={<ClipboardCheck size={16} />} label="Checklist" end />
              <TopTab to="dashboard" icon={<PieChart size={16} />} label="Dashboard" />
              <TopTab to="allocate" icon={<ListChecks size={16} />} label="Allocate" />
              <TopTab to="settings" icon={<Settings size={16} />} label="Settings" />
			  <TopTab to="evidence" icon={<FileCheck2 size={16} />} label="Evidence" />
            </div>
          </nav>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-screen-2xl p-4">
          <Outlet />
        </main>

        {/* Mobile bottom nav (optional) */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white sm:hidden">
          <div className="grid grid-cols-4">
            <BottomTab to="" icon={<ClipboardCheck size={18} />} label="Checklist" end />
            <BottomTab to="dashboard" icon={<PieChart size={18} />} label="Dashboard" />
            <BottomTab to="allocate" icon={<ListChecks size={18} />} label="Allocate" />
            <BottomTab to="settings" icon={<Settings size={18} />} label="Settings" />
          </div>
        </div>
        <div className="h-14 sm:hidden" /> {/* spacer for bottom bar */}
      </div>
    </ProjectCtx.Provider>
  );
}

/** Compact top tab */
function TopTab({
  to, icon, label, end,
}: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      end={end}
      to={to}
      className={({ isActive }) =>
        `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          isActive
            ? "bg-slate-900 text-white"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`
      }
    >
      {icon} {label}
    </NavLink>
  );
}

/** Bottom nav tab for mobile */
function BottomTab({
  to, icon, label, end,
}: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      end={end}
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center py-2 text-xs ${
          isActive ? "text-slate-900" : "text-slate-500"
        }`
      }
    >
      {icon}
      <span className="mt-0.5">{label}</span>
    </NavLink>
  );
}
