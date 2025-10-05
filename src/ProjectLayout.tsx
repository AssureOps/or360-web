import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ProjectCtx, type Project } from "./ProjectContext";
import {
  ClipboardCheck,
  PieChart,
  ListChecks,
  Settings,
  ChevronLeft
} from "lucide-react";

export default function ProjectLayout() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,org_id,go_live_date,start_date,handover_target_date")
        .eq("id", id)
        .single();
      if (!error && data) {
        setProject(data);
        localStorage.setItem("lastProjectId", data.id);
        window.dispatchEvent(new CustomEvent("last-project-changed", { detail: data.id }));
      }
    })();
  }, [id]);

  if (!project)
    return <div className="p-6 text-slate-600">Loading project...</div>;

  return (
    <ProjectCtx.Provider value={{ project }}>
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        {/* Project Sidebar */}
        <aside className="w-72 border-r border-slate-200 bg-white p-4">
          <div className="mb-4">
            <button
              onClick={() => nav("/projects")}
              className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
            >
              <ChevronLeft size={16} /> Projects
            </button>
            <div className="truncate text-base font-semibold">{project.name}</div>
            <div className="text-xs text-slate-500">{project.status.toUpperCase()}</div>
          </div>

          <nav className="flex flex-col gap-1">
            <NavLink
              end
              to=""
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-200"}`
              }
            >
              <ClipboardCheck size={16} className="inline-block mr-2" />
              Checklist
            </NavLink>
            <NavLink
              to="dashboard"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-200"}`
              }
            >
              <PieChart size={16} className="inline-block mr-2" />
              Dashboard
            </NavLink>
            <NavLink
              to="allocate"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-200"}`
              }
            >
              <ListChecks size={16} className="inline-block mr-2" />
              Allocate Criteria
            </NavLink>
            <NavLink
              to="settings"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-200"}`
              }
            >
              <Settings size={16} className="inline-block mr-2" />
              Settings
            </NavLink>
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-6">
          <Outlet />
        </main>
      </div>
    </ProjectCtx.Provider>
  );
}
