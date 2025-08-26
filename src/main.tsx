import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import App from "./App";
import Dashboard from "./Dashboard";
import "./index.css";

function Root() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        {/* Shared header */}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
            {/* Logo + title */}
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/assureops-logo.png"
                alt="AssureOps logo"
                className="h-10 w-auto sm:h-15 md:h-25"
              />
              <div className="flex flex-col min-w-0">
          
                <p className="text-xs text-slate-600 sm:text-sm md:text-base lg:text-lg">
                 OR 360 Operational Readiness
                </p>
              </div>
            </div>

            {/* Nav */}
<nav className="flex gap-4">
  <NavLink
    to="/"
    end
    className={({ isActive }) =>
      `rounded-md px-3 py-1 text-sm ${
        isActive
          ? "bg-slate-100 font-semibold text-slate-900"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`
    }
  >
    Checklist
  </NavLink>
  <NavLink
    to="/dashboard"
    className={({ isActive }) =>
      `rounded-md px-3 py-1 text-sm ${
        isActive
          ? "bg-slate-100 font-semibold text-slate-900"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`
    }
  >
    Dashboard
  </NavLink>
</nav>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-7xl p-6">
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
