// src/Layout.tsx
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useOrg, type Org } from "./OrgContext";
import {
  Menu, X, Plus,
  ClipboardCheck, PieChart, FileCheck2,
  Building2, Users, FolderKanban,
  Layers, FileArchive,
  ShieldCheck, Settings,
  Bell, Book, History
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
  title
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const cls =
    "w-full px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors " + (
      disabled
        ? "text-slate-400 bg-slate-100 cursor-not-allowed"
        : "text-slate-700 hover:text-slate-900 hover:bg-slate-200"
    );
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
      <label className="block text-xs font-medium text-slate-600 mb-1">Organisation</label>
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
  const [open, setOpen] = useState(false);

  const linkBase =
    "px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors";
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

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside
          className={`${
            open ? "block" : "hidden"
          } fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 p-4 lg:static lg:block lg:shrink-0`}
        >
          <div className="flex items-center gap-2 mb-4">
            <img src="/icon-32.png" alt="AssureOps" className="h-7 w-7" />
            <div className="leading-tight">
              <div className="text-xs text-slate-500">AssureOps</div>
              <div className="text-sm font-semibold">OR-360</div>
            </div>
          </div>

          {/* Workspace */}
          <SectionTitle>Workspace</SectionTitle>
          <nav className="flex flex-col gap-1">
            <NavLink to="/" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
              <ClipboardCheck size={16} /> Checklist
            </NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
              <PieChart size={16} /> Dashboard
            </NavLink>
            <NavBtn onClick={() => window.dispatchEvent(new CustomEvent("export-certificate"))} title="Generate Operational Acceptance Certificate">
              <FileCheck2 size={16} /> Certificate
            </NavBtn>
          </nav>

          {/* Organisation */}
          <SectionTitle>Organisation</SectionTitle>
          <nav className="flex flex-col gap-1">
            <NavBtn disabled title="Coming soon: manage organisations">
              <Building2 size={16} /> Orgs
            </NavBtn>
            <NavLink to="/org-users" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
              <Users size={16} /> Org Users
            </NavLink>
            <NavBtn disabled title="Coming soon: list all org projects">
              <FolderKanban size={16} /> Org Projects
            </NavBtn>
          </nav>

          {/* Library */}
          <SectionTitle>Library</SectionTitle>
          <nav className="flex flex-col gap-1">
            <NavBtn disabled title="Coming soon: criteria and project templates">
              <Layers size={16} /> Templates
            </NavBtn>
            <NavBtn disabled title="Coming soon: all uploaded evidence">
              <FileArchive size={16} /> Evidence
            </NavBtn>
          </nav>

          {/* Admin */}
          <SectionTitle>Admin</SectionTitle>
          <nav className="flex flex-col gap-1">
            <NavBtn disabled title="Coming soon: roles, RACI, permissions">
              <ShieldCheck size={16} /> Roles & Permissions
            </NavBtn>
            <NavBtn disabled title="Coming soon: app settings">
              <Settings size={16} /> Settings
            </NavBtn>
          </nav>

          {/* Utilities */}
          <SectionTitle>Utilities</SectionTitle>
          <nav className="flex flex-col gap-1">
            <NavBtn disabled title="Coming soon: alerts and activity">
              <Bell size={16} /> Notifications
            </NavBtn>
            <NavBtn disabled title="Coming soon: help & docs">
              <Book size={16} /> Help
            </NavBtn>
            <NavBtn disabled title="Coming soon: audit trail">
              <History size={16} /> Audit Log
            </NavBtn>
          </nav>

          <OrgSelectInline />

          <div className="mt-4">
            <button
              onClick={() => {
                setOpen(false);
                nav("/new");
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            >
              <Plus size={16} /> New Project
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 lg:ml-6 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
