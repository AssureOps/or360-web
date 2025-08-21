// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { ChevronDown, ChevronRight } from "lucide-react"; // nice icons

type Project = { id: string; name: string; status?: string | null };
type Criterion = { id: string; title: string; status: string };
type Evidence = {
  id: string;
  kind: string;
  note?: string | null;
  url?: string | null;
  uploaded_at: string;
  criterion_id?: string;
};

const statusChip: Record<string, string> = {
  not_started:
    "bg-gray-100 text-gray-800 ring-1 ring-inset ring-gray-200",
  in_progress:
    "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200",
  done:
    "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200",
};

export default function App() {
  const demoEmail = import.meta.env.VITE_DEMO_EMAIL as string;
  const demoPassword = import.meta.env.VITE_DEMO_PASSWORD as string;

  // Auth / session
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});

  // Derived
  const readiness = useMemo(() => {
    if (!criteria.length) return 0;
    const done = criteria.filter((c) => c.status === "done").length;
    return Math.round((done / criteria.length) * 100);
  }, [criteria]);

  // --- Auth bootstrap ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUserEmail(data.session?.user?.email ?? null);
      setSessionReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUserEmail(s?.user?.email ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });
    if (error) alert("Sign-in failed: " + error.message);
  }
  async function signOut() {
    await supabase.auth.signOut();
  }

  // --- Load projects ---
  useEffect(() => {
    if (!sessionReady) return;
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status")
        .order("name", { ascending: true });
      if (error) {
        console.error(error);
        alert("Failed to load projects: " + error.message);
        return;
      }
      setProjects((data || []) as Project[]);
      if (data && data.length > 0) setActiveProject(data[0] as Project);
    })();
  }, [sessionReady, userEmail]);

  // --- Load criteria for active project ---
  useEffect(() => {
    if (!activeProject) return;
    (async () => {
      const { data, error } = await supabase
        .from("criteria")
        .select("id,title,status")
        .eq("project_id", activeProject.id)
        .order("title", { ascending: true });
      if (error) {
        console.error(error);
        alert("Failed to load criteria: " + error.message);
        return;
      }
      setCriteria((data || []) as Criterion[]);
    })();
  }, [activeProject]);

  // --- Load evidence for those criteria ---
  useEffect(() => {
    if (!criteria.length) {
      setEvidence([]);
      return;
    }
    (async () => {
      const ids = criteria.map((c) => c.id);
      const { data, error } = await supabase
        .from("evidence")
        .select("id,criterion_id,kind,note,url,uploaded_at")
        .in("criterion_id", ids)
        .order("uploaded_at", { ascending: false });
      if (error) {
        console.error(error);
        return;
      }
      setEvidence((data || []) as Evidence[]);
    })();
  }, [criteria]);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("criteria").update({ status }).eq("id", id).select();
    if (error) return alert("Update failed: " + error.message);
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  async function addNote(criterionId: string) {
    const text = noteText.trim();
    if (!text) return;
    const { error } = await supabase
      .from("evidence")
      .insert({ criterion_id: criterionId, kind: "note", note: text })
      .select();
    if (error) return alert("Insert failed: " + error.message);
    setNoteText("");
    setAddingNoteFor(null);

    // refresh evidence for this criterion
    const { data } = await supabase
      .from("evidence")
      .select("id,criterion_id,kind,note,url,uploaded_at")
      .eq("criterion_id", criterionId)
      .order("uploaded_at", { ascending: false });
    setEvidence((prev) => {
      const others = prev.filter((e) => e.criterion_id !== criterionId);
      return [...others, ...(data || [])];
    });
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-sky-600 grid place-items-center text-white font-semibold">O</div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight">OR‑360</span>
              <span className="text-xs text-slate-500">local</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userEmail ? (
              <>
                <span className="hidden sm:block text-sm text-slate-600">{userEmail}</span>
                <button
                  onClick={signOut}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={signIn}
                className="inline-flex items-center rounded-lg bg-sky-600 text-white px-3 py-1.5 text-sm hover:bg-sky-700"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        {/* Projects */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Projects</h2>
            {activeProject && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  statusChip[activeProject.status || "not_started"]
                }`}
              >
                {activeProject.status || "not_started"}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProject(p)}
                className={`inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 transition ${
                  activeProject?.id === p.id ? "bg-sky-50 ring-2 ring-sky-200" : ""
                }`}
              >
                {p.name}
              </button>
            ))}
            {!projects.length && (
              <div className="text-sm text-slate-500">No projects visible (check RLS membership or sign in).</div>
            )}
          </div>
        </section>

        {/* Criteria & Evidence */}
        {activeProject && (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <h3 className="text-lg font-semibold">Criteria — {activeProject.name}</h3>
              {/* Readiness */}
              <div className="w-full sm:w-96">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span>Readiness</span>
                  <span>{readiness}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${readiness}%` }}
                    className="h-full bg-sky-500 transition-[width] duration-200"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {criteria.map((c) => {
                const ev = evidence
                  .filter((e) => e.criterion_id === c.id)
                  .sort(
                    (a, b) =>
                      new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
                  );

                return (
                  <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{c.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {ev.length ? `${ev.length} evidence item${ev.length > 1 ? "s" : ""}` : "No evidence yet"}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusChip[c.status]}`}>
                        {c.status}
                      </span>
                    </div>

                    {/* Status buttons */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["not_started", "in_progress", "done"].map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(c.id, s)}
                          className={`inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 transition ${
                            c.status === s ? "bg-sky-50 ring-2 ring-sky-200" : ""
                          }`}
                        >
                          {s.replace("_", " ")}
                        </button>
                      ))}
                    </div>

                    {/* Add note */}
                    <div className="mt-3 flex items-center gap-2">
                      {addingNoteFor === c.id ? (
                        <>
                          <input
                            autoFocus
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add evidence note…"
                            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                          />
                          <button
                            onClick={() => addNote(c.id)}
                            className="inline-flex items-center rounded-lg bg-sky-600 text-white px-3 py-2 text-sm hover:bg-sky-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setAddingNoteFor(null);
                              setNoteText("");
                            }}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setAddingNoteFor(c.id)}
                          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                          + Add note
                        </button>
                      )}
                    </div>

                    {/* Evidence list */}
{/* Evidence toggle */}
{!!ev.length && (
  <div className="mt-3">
    <button
      onClick={() =>
        setOpenEvidence((prev) => ({
          ...prev,
          [c.id]: !prev[c.id],
        }))
      }
      className="flex items-center gap-1 text-sm text-sky-700 hover:underline"
    >
      {openEvidence[c.id] ? (
        <ChevronDown size={16} />
      ) : (
        <ChevronRight size={16} />
      )}
      {openEvidence[c.id] ? "Hide evidence" : `Show evidence (${ev.length})`}
    </button>

    {openEvidence[c.id] && (
      <div className="mt-2 space-y-1 pl-5 border-l border-slate-200">
        {ev.map((row) => (
          <div key={row.id} className="text-sm text-slate-700">
            {row.kind === "note" && <>📝 {row.note}</>}
            {row.kind === "link" && (
              <>
                🔗{" "}
                <a
                  className="text-sky-700 hover:underline"
                  href={row.url!}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.url}
                </a>
              </>
            )}
            <span className="ml-2 text-xs text-slate-500">
              {new Date(row.uploaded_at).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
)}

                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
