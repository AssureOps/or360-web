// src/Layout.tsx
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useOrg } from "./OrgContext";
import { supabase } from "./lib/supabase";
import {
  Menu, X, Plus, FolderKanban,
  Layers, Users, Building2,
  PanelLeftClose, PanelLeftOpen
} from "lucide-react";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}

export default function Layout() {
  const nav = useNavigate();
  const location = useLocation();
  const { orgId } = useOrg();

  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return typeof window !== "undefined" &&
      localStorage.getItem("sidebarCollapsed") === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  useEffect(() => setOpen(false), [location.pathname]);

  async function createProjectAndGo() {
    if (!orgId) return alert("Select an organisation first.");
    const { data: au } = await supabase.auth.getUser();
    const uid = au?.user?.id;
    if (!uid) return alert("You must be signed in.");
    const { data, error } = await supabase
      .from("projects")
      .insert({ org_id: orgId, name: "Untitled Project", status: "draft", created_by: uid })
      .select("id")
      .single();
    if (error) return alert(error.message);
    nav(`/projects/${data!.id}`);
  }

  const linkBase =
    `${collapsed ? "px-2 justify-center" : "px-3"} py-2 rounded-lg text-sm flex items-center gap-2 transition-colors`;
  const active = "bg-slate-900 text-white";
  const idle = "text-slate-700 hover:text-slate-900 hover:bg-slate-200";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between lg:hidden">
        <button
          className="p-2 rounded-md hover:bg-slate-100"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="flex items-center gap-2">
          <img src="/icon-32.png" alt="AssureOps" className="h-6 w-6" />
          <span className="text-sm font-semibold">AssureOps — OR-360</span>
        </div>
        <button
          onClick={createProjectAndGo}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Backdrop */}
      <div
        className={`${open ? "fixed inset-0 z-20 bg-black/20 lg:hidden" : "hidden"}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className="flex w-full">
        {/* Sidebar */}
        <aside
          className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-30 w-72 ${collapsed ? "lg:w-16" : "lg:w-72"} bg-white border-r border-slate-200 p-4 overflow-y-auto lg:block`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/icon-32.png" alt="AssureOps" className="h-7 w-7" />
              <div className={`leading-tight ${collapsed ? "hidden" : ""}`}>
                <div className="text-xs text-slate-500">AssureOps</div>
                <div className="text-sm font-semibold">OR-360</div>
              </div>
            </div>
            <button
              className="hidden lg:inline-flex p-2 rounded-md hover:bg-slate-100"
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          {!collapsed && <SectionTitle>Global</SectionTitle>}
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/projects"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
            >
              <FolderKanban size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Projects</span>
            </NavLink>
            <NavLink
              to="/templates"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
            >
              <Layers size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Templates</span>
            </NavLink>
            <NavLink
              to="/org-users"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
            >
              <Users size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Org Users</span>
            </NavLink>
            <NavLink
              to="/orgs"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
            >
              <Building2 size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Organisations</span>
            </NavLink>
          </nav>
        </aside>

        {/* Main */}
        <main className={`flex-1 min-w-0 px-4 py-6 ${collapsed ? "lg:ml-16" : "lg:ml-72"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
