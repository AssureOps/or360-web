import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import App from "./App";
import Dashboard from "./Dashboard";
import "./index.css"; // keep your Tailwind styles

function Root() {
  return (
    <BrowserRouter>
      <div className="mx-auto max-w-7xl">
        {/* Simple nav */}
        <nav className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
          <Link
            to="/"
            className="rounded-md px-3 py-1 text-sm hover:bg-slate-100"
          >
            Checklist
          </Link>
          <Link
            to="/dashboard"
            className="rounded-md px-3 py-1 text-sm hover:bg-slate-100"
          >
            Dashboard
          </Link>
        </nav>

        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
