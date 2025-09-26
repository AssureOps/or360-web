import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useOrg, type Org } from "./OrgContext";
import { supabase } from "./lib/supabase";
import {
  Menu, X, Plus,
  ClipboardCheck, PieChart, FileCheck2,
  Building2, Users, FolderKanban,
  Layers, FileArchive,
  ShieldCheck, Settings,
  Bell, Book, History,
  PanelLeftClose, PanelLeftOpen,
  ListChecks, Edit3
} from "lucide-react";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}

function NavBtn({
  children,
  disabled = false,
  onClick,
  title,
  collapsed = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  collapsed?: boolean;
}) {
  const cls =
    "w-full py-2 rounded-lg text-sm flex items-center gap-2 transition-colors " +
    (collapsed ? "justify-center px-2 " : "px-3 ") +
    (disabled
      ? "text-slate-400 bg-slate-100 cursor-not-allowed"
      : "text-slate-700 hover:text-slate-900 hover:bg-slate-200");
  return (
    <button className={cls} disabled={disabled} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

// Inline org picker with refresh
function OrgSelectInline() {
  const { orgs, orgId, setOrgId, refresh } = useOrg();
  return (
    <div className="mt-4">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        Organisation
      </label>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
          value={orgId ?? ""}
          onChange={(e) => setOrgId(e.target.value)}
        >
          {orgs.length ? (
            orgs.map((o: Org) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))
          ) : (
            <option value="">No orgs</option>
          )}
        </select>
        <button
          onClick={refresh}
          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs hover:bg-slate-100"
          title="Refresh organisations"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const nav = useNavigate();
  const location = useLocation();
  const { orgId } = useOrg();

  // Mobile drawer open/close
  const [open, setOpen] = useState(false);

  // Persistent desktop collapse state
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return typeof window !== "undefined" &&
      localStorage.getItem("sidebarCollapsed") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  // Close the mobile drawer on any route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Track the last opened project for "Edit Project"
  const [lastProjectId, setLastProjectId] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("lastProjectId") : null
  );
  useEffect(() => {
    const onStorage = () => setLastProjectId(localStorage.getItem("lastProjectId"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const linkBase =
    `${collapsed ? "px-2 justify-center" : "px-3"} py-2 rounded-lg text-sm flex items-center gap-2 transition-colors`;
  const active = "bg-slate-900 text-white";
  const idle = "text-slate-700 hover:text-slate-900 hover:bg-slate-200";

  // Create a stub project and navigate to its edit page
  async function createProjectAndGo() {
    if (!orgId) {
      alert("Select an organisation first.");
      return;
    }
    try {
      // get current user id for created_by
      const { data: au } = await supabase.auth.getUser();
      const uid = au?.user?.id;
      if (!uid) {
        alert("You need to be signed in to create a project.");
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          org_id: orgId,
          name: "Untitled Project",
          status: "draft",
          created_by: uid,            // <-- important
        })
        .select("id")
        .single();

      if (error) throw error;
      setOpen(false); // close mobile drawer if open
      nav(`/projects/${data!.id}`);
    } catch (e: any) {
      alert(`Failed to create project: ${e?.message ?? e}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-md hover:bg-slate-100"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <img src="/icon-32.png" alt="AssureOps" className="h-6 w-6" />
          <span className="text-sm font-semibold">AssureOps — OR-360</span>
        </div>
        <button
          onClick={createProjectAndGo}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          title="Create Project"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Backdrop (mobile only) */}
      <div
        className={`${open ? "fixed inset-0 z-20 bg-black/20 lg:hidden" : "hidden"}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className="flex w-full">
        {/* Sidebar */}
        <aside
          className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-30 w-72 ${collapsed ? "lg:w-16" : "lg:w-72"
            } bg-white border-r border-slate-200 p-4 overflow-y-auto lg:block`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/icon-32.png" alt="AssureOps" className="h-7 w-7" />
              <div className={`leading-tight ${collapsed ? "hidden" : ""}`}>
                <div className="text-xs text-slate-500">AssureOps</div>
                <div className="text-sm font-semibold">OR-360</div>
              </div>
            </div>
            {/* Collapse/Expand (desktop only) */}
            <button
              className="hidden lg:inline-flex p-2 rounded-md hover:bg-slate-100"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          {/* Operational Readiness */}
          {!collapsed && <SectionTitle>Operational Readiness</SectionTitle>}
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
            >
              <ClipboardCheck size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Checklist</span>
            </NavLink>
            <NavLink
              to="/dashboard"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
            >
              <PieChart size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Dashboard</span>
            </NavLink>
            <NavBtn
              collapsed={collapsed}
              onClick={() => {
                window.dispatchEvent(new CustomEvent("export-certificate"));
                setOpen(false);
              }}
              title="Generate Operational Acceptance Certificate"
            >
              <FileCheck2 size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Certificate</span>
            </NavBtn>
          </nav>

          {/* Organisation */}
          {!collapsed && <SectionTitle>Organisation</SectionTitle>}
          <nav className="flex flex-col gap-1">
            <NavBtn disabled title="Coming soon: manage organisations" collapsed={collapsed}>
              <Building2 size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Orgs</span>
            </NavBtn>
            <NavLink
              to="/org-users"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
            >
              <Users size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Org Users</span>
            </NavLink>
            <NavBtn disabled title="Coming soon: list all org projects" collapsed={collapsed}>
              <FolderKanban size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Org Projects</span>
            </NavBtn>
          </nav>

          {/* Project Management */}
          {!collapsed && <SectionTitle>Project Management</SectionTitle>}
          <nav className="flex flex-col gap-1">
            <button
              onClick={createProjectAndGo}
              className={`${linkBase} ${idle}`}
              title="Create a new project and open it"
            >
              <Plus size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Create Project</span>
            </button>
            <NavLink
              to="/allocate"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
            >
              <ListChecks size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Allocate Criteria</span>
            </NavLink>
            {/* New: Edit Project (uses lastProjectId) */}
            {lastProjectId ? (
              <NavLink
                to={`/projects/${lastProjectId}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
                title="Edit last opened project"
              >
                <Edit3 size={16} />{" "}
                <span className={collapsed ? "hidden" : ""}>Edit Project</span>
              </NavLink>
            ) : (
              <NavBtn collapsed={collapsed} disabled title="Open a project to enable">
                <Edit3 size={16} />{" "}
                <span className={collapsed ? "hidden" : ""}>Edit Project</span>
              </NavBtn>
            )}
          </nav>

          {/* Library */}
          {!collapsed && <SectionTitle>Library</SectionTitle>}
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/templates"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}
            >
              <Layers size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Templates</span>
            </NavLink>
            <NavBtn disabled title="Coming soon: all uploaded evidence" collapsed={collapsed}>
              <FileArchive size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Evidence</span>
            </NavBtn>
          </nav>

          {/* Admin */}
          {!collapsed && <SectionTitle>Admin</SectionTitle>}
          <nav className="flex flex-col gap-1">
            <NavBtn disabled title="Coming soon: roles, RACI, permissions" collapsed={collapsed}>
              <ShieldCheck size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Roles & Permissions</span>
            </NavBtn>
            <NavBtn disabled title="Coming soon: app settings" collapsed={collapsed}>
              <Settings size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Settings</span>
            </NavBtn>
          </nav>

          {/* Utilities */}
          {!collapsed && <SectionTitle>Utilities</SectionTitle>}
          <nav className="flex flex-col gap-1">
            <NavBtn disabled title="Coming soon: alerts and activity" collapsed={collapsed}>
              <Bell size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Notifications</span>
            </NavBtn>
            <NavBtn disabled title="Coming soon: help & docs" collapsed={collapsed}>
              <Book size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Help</span>
            </NavBtn>
            <NavBtn disabled title="Coming soon: audit trail" collapsed={collapsed}>
              <History size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Audit Log</span>
            </NavBtn>
          </nav>

          {/* Org picker (hidden when collapsed) */}
          {!collapsed && <OrgSelectInline />}

          {/* Note: removed the bottom “New Project” button per request */}
        </aside>

        {/* Content */}
        <main className={`flex-1 min-w-0 px-4 py-6 ${collapsed ? "lg:ml-16" : "lg:ml-72"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
