import { useEffect, useState, useMemo } from "react";
import { Outlet, useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ProjectCtx } from "./ProjectContext";
import { ChevronLeft, MoreVertical } from "lucide-react";

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
    if (loc.pathname.endsWith("/evidence")) return "Evidence";
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
        {/* Slim header only */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="w-full px-6 py-4 flex items-center justify-between gap-3">
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

            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 hover:bg-slate-50"
                title="More"
              >
                <MoreVertical size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Full-width content */}
        <main className="w-full px-6 py-6">
          <Outlet />
        </main>
      </div>
    </ProjectCtx.Provider>
  );
}