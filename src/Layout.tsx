// src/Layout.tsx
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useOrg, type Org } from "./OrgContext";
import {
  Menu, X, Plus,
  ClipboardCheck, PieChart, FileCheck2,
  Building2, Users, FolderKanban,
  Layers, FileArchive,
  ShieldCheck, Settings,
  Bell, Book, History,
  PanelLeftClose, PanelLeftOpen
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
  const [open, setOpen] = useState(false); // mobile drawer state
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return typeof window !== "undefined" &&
      localStorage.getItem("sidebarCollapsed") === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  const linkBase = `${collapsed ? "px-2 justify-center" : "px-3"
    } py-2 rounded-lg text-sm flex items-center gap-2 transition-colors`;
  const active = "bg-slate-900 text-white";
  const idle = "text-slate-700 hover:text-slate-900 hover:bg-slate-200";

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
          onClick={() => nav("/new")}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          title="Create Project"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

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

          {/* Workspace */}
          {!collapsed && <SectionTitle>Workspace</SectionTitle>}
          <nav className="flex flex-col gap-1">
            <NavLink to="/" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
              <ClipboardCheck size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Checklist</span>
            </NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
              <PieChart size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Dashboard</span>
            </NavLink>
            <NavBtn
              collapsed={collapsed}
              onClick={() => window.dispatchEvent(new CustomEvent("export-certificate"))}
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
            <NavLink to="/org-users" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
              <Users size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Org Users</span>
            </NavLink>
            <NavBtn disabled title="Coming soon: list all org projects" collapsed={collapsed}>
              <FolderKanban size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>Org Projects</span>
            </NavBtn>
          </nav>

          {/* Library */}
          {!collapsed && <SectionTitle>Library</SectionTitle>}
          <nav className="flex flex-col gap-1">
            <NavLink to="/templates" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
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

          <div className="mt-4">
            <button
              onClick={() => {
                setOpen(false);
                nav("/new");
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            >
              <Plus size={16} />{" "}
              <span className={collapsed ? "hidden" : ""}>New Project</span>
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className={`flex-1 min-w-0 px-4 py-6 ${collapsed ? "lg:ml-16" : "lg:ml-72"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
