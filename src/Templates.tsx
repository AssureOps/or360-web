import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { useOrg } from "./OrgContext";
import { Link } from "react-router-dom";
import * as mammoth from "mammoth";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

type TemplateSet = {
  id: string;
  name: string;
  description: string | null;
  org_id: string | null;
  created_at: string;
};

type ChecklistTemplate = {
  id: string;
  template_id: string;
  title: string;
  category: string | null;
  sort_order: number | null;
};

type ProjectLite = {
  id: string;
  name: string;
};

type TemplateDoc = {
  id: string;
  org_id: string;
  template_set_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string;
  created_by: string | null;
  created_at: string;
  extracted: any | null;
};

type ProposedItem = { title: string; category: string | null; sort_order: number };

const bulletRe = /^[-–•*]\s+|^\d+\.\s+/;

function guessItemsFromText(text: string): ProposedItem[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Heuristic: bullet/numbered lines or short heading-like lines
  const raw = lines.filter(l => bulletRe.test(l) || (l.length > 2 && l.length <= 140));
  const cleaned = raw.map((l, i) => ({
    title: l.replace(bulletRe, "").trim(),
    category: null as string | null,
    sort_order: i + 1
  })).filter(i => i.title.length >= 3);
  const seen = new Set<string>();
  return cleaned.filter(i => {
    const k = i.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function extractDocx(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer });
  return res.value || "";
}

async function extractPdf(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  let full = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    full += tc.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return full;
}

export default function Templates() {
  const { orgId } = useOrg();
  const [prebuilt, setPrebuilt] = useState<TemplateSet[]>([]);
  const [mine, setMine] = useState<TemplateSet[]>([]);
  const [selected, setSelected] = useState<TemplateSet | null>(null);
  const [items, setItems] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [docs, setDocs] = useState<TemplateDoc[]>([]);

  // Extraction review state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [proposedName, setProposedName] = useState("");
  const [proposedItems, setProposedItems] = useState<ProposedItem[]>([]);
  const [sourceFileInfo, setSourceFileInfo] = useState<{ storage_path: string; mime_type: string; name: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data: pre }, { data: yours }, { data: projs }, { data: myDocs }] = await Promise.all([
        supabase.from("template_sets").select("id,name,description,org_id,created_at").is("org_id", null).order("name", { ascending: true }),
        supabase.from("template_sets").select("id,name,description,org_id,created_at").eq("org_id", orgId).order("created_at", { ascending: false }),
        supabase.from("projects").select("id,name").eq("org_id", orgId).order("created_at", { ascending: false }),
        supabase.from("template_docs").select("*").eq("org_id", orgId).order("created_at", { ascending: false })
      ]);
      if (!mounted) return;
      setPrebuilt(pre ?? []);
      setMine(yours ?? []);
      setProjects(projs ?? []);
      setProjectId(projs?.[0]?.id ?? "");
      setDocs(myDocs ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [orgId]);

  useEffect(() => {
    (async () => {
      if (!selected) { setItems([]); return; }
      const { data } = await supabase
        .from("checklist_templates")
        .select("id,template_id,title,category,sort_order")
        .eq("template_id", selected.id)
        .order("sort_order", { ascending: true });
      setItems(data ?? []);
    })();
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.title ?? "").toLowerCase().includes(q) ||
      (i.category ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  async function applyToProject() {
    if (!selected || !projectId) return;
    const { error } = await supabase.rpc("apply_template", {
      p_project: projectId,
      p_template: selected.id,
    });
    if (error) { alert(`Apply failed: ${error.message}`); return; }
    alert("Template applied to project!");
  }

  async function onUploadFile(file: File) {
    try {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!["pdf", "docx"].includes(ext)) {
        alert("Please upload a PDF or DOCX file.");
        return;
      }
      const mime = ext === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      // 1) Upload to Storage
      const path = `${orgId}/${crypto.randomUUID()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("template_docs")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      // 2) Extract text client-side
      let text = "";
      if (ext === "docx") text = await extractDocx(file);
      if (ext === "pdf")  text = await extractPdf(file);

      // 3) Build proposed items and open review dialog
      const proposed = guessItemsFromText(text);
      setProposedName(file.name.replace(/\.[^.]+$/, ""));
      setProposedItems(proposed);
      setSourceFileInfo({ storage_path: path, mime_type: mime, name: file.name });
      setReviewOpen(true);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function saveReviewedTemplate() {
    if (!sourceFileInfo) return;
    try {
      // 4) Create template_set
      const setId = crypto.randomUUID();
      const { data: setRow, error: setErr } = await supabase
        .from("template_sets")
        .insert({
          id: setId,
          name: proposedName || "Imported Template",
          description: "Imported from document",
          org_id: orgId
        })
        .select()
        .single();
      if (setErr) throw setErr;

      // 5) Insert checklist items
      if (proposedItems.length) {
        const rows = proposedItems.map((it, i) => ({
          id: crypto.randomUUID(),
          template_id: setId,
          title: it.title,
          category: it.category,
          sort_order: Number.isFinite(it.sort_order as any) ? it.sort_order : i + 1
        }));
        const { error: itemsErr } = await supabase.from("checklist_templates").insert(rows);
        if (itemsErr) throw itemsErr;
      }

      // 6) Insert audit row
      const { data: me } = await supabase.auth.getUser();
      await supabase.from("template_docs").insert({
        org_id: orgId,
        template_set_id: setId,
        name: sourceFileInfo.name,
        storage_path: sourceFileInfo.storage_path,
        mime_type: sourceFileInfo.mime_type,
        created_by: me?.user?.id ?? null,
        extracted: proposedItems.length ? { items: proposedItems } : null
      });

      // 7) Refresh “Your templates” & “Docs”
      const [{ data: yours }, { data: myDocs }] = await Promise.all([
        supabase.from("template_sets").select("id,name,description,org_id,created_at").eq("org_id", orgId).order("created_at", { ascending: false }),
        supabase.from("template_docs").select("*").eq("org_id", orgId).order("created_at", { ascending: false })
      ]);
      setMine(yours ?? []);
      setDocs(myDocs ?? []);
      setReviewOpen(false);
      setSelected(setRow);
      alert("Template created from document.");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  function removeProposedRow(idx: number) {
    setProposedItems(prev => prev.filter((_, i) => i !== idx));
  }
  function updateProposedRow(idx: number, patch: Partial<ProposedItem>) {
    setProposedItems(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  if (loading) return <div className="p-4 text-sm text-slate-600">Loading templates…</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Templates</h1>
        <div className="flex gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={e => e.target.files?.[0] && onUploadFile(e.target.files[0])}
            />
            Upload PDF / Word
          </label>
          <Link to="/projects" className="hidden sm:inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
            Manage Projects
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Left: Libraries */}
        <div className="space-y-4 xl:col-span-1">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-3 text-sm font-semibold">Pre-built (ITIL / OR)</div>
            <ul className="max-h-72 overflow-auto p-2">
              {prebuilt.map(t => (
                <li key={t.id}>
                  <button
                    className={`w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${selected?.id === t.id ? "bg-slate-100" : ""}`}
                    onClick={() => setSelected(t)}
                  >
                    <div className="text-sm font-medium">{t.name}</div>
                    {t.description && <div className="truncate text-xs text-slate-500">{t.description}</div>}
                  </button>
                </li>
              ))}
              {prebuilt.length === 0 && <li className="p-2 text-xs text-slate-500">No pre-built templates yet.</li>}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-3 text-sm font-semibold">Your templates</div>
            <ul className="max-h-72 overflow-auto p-2">
              {mine.map(t => (
                <li key={t.id}>
                  <button
                    className={`w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${selected?.id === t.id ? "bg-slate-100" : ""}`}
                    onClick={() => setSelected(t)}
                  >
                    <div className="text-sm font-medium">{t.name}</div>
                    {t.description && <div className="truncate text-xs text-slate-500">{t.description}</div>}
                  </button>
                </li>
              ))}
              {mine.length === 0 && <li className="p-2 text-xs text-slate-500">You haven’t uploaded any templates yet.</li>}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-3 text-sm font-semibold">Your uploaded docs</div>
            <ul className="max-h-72 overflow-auto p-2">
              {docs.map(d => (
                <li key={d.id} className="rounded-lg px-2 py-2 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      <div className="truncate text-xs text-slate-500">{new Date(d.created_at).toLocaleString()}</div>
                    </div>
                    {d.template_set_id ? (
                      <Link to="#" onClick={() => setSelected({ id: d.template_set_id, name: "", description: null, org_id: orgId!, created_at: "" } as any)} className="text-xs text-blue-700 hover:underline">
                        View set
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
              {docs.length === 0 && <li className="p-2 text-xs text-slate-500">No documents uploaded yet.</li>}
            </ul>
          </section>
        </div>

        {/* Right: Preview + Apply */}
        <div className="xl:col-span-2 space-y-3">
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{selected ? selected.name : "Select a template"}</div>
                {selected?.description && <div className="truncate text-xs text-slate-500">{selected.description}</div>}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                  title="Choose project to apply to"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn btn-primary" disabled={!selected || !projectId} onClick={applyToProject}>
                  Apply to project
                </button>
              </div>
            </div>

            <div className="mt-3">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items (title/category)…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-3 max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
              {selected ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Title</th>
                      <th className="px-3 py-2 text-left">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((i, idx) => (
                      <tr key={i.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 w-12">{i.sort_order ?? idx + 1}</td>
                        <td className="px-3 py-2">{i.title}</td>
                        <td className="px-3 py-2 text-slate-500">{i.category ?? "—"}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">No items match your search.</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-slate-500">Choose a template on the left to preview its checklist items.</div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Review dialog (simple inline panel) */}
      {reviewOpen && (
        <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Review extracted items</div>
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setReviewOpen(false)}>Close</button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <label className="text-xs text-slate-600">Template name</label>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={proposedName}
              onChange={e => setProposedName(e.target.value)}
            />
          </div>
          <div className="mt-3 max-h-[40vh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left w-14">#</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {proposedItems.map((r, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-3 py-2 w-14">
                      <input
                        type="number"
                        className="w-14 rounded border border-slate-300 px-2 py-1"
                        value={r.sort_order}
                        onChange={e => updateProposedRow(idx, { sort_order: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1"
                        value={r.title}
                        onChange={e => updateProposedRow(idx, { title: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1"
                        placeholder="(optional)"
                        value={r.category ?? ""}
                        onChange={e => updateProposedRow(idx, { category: e.target.value || null })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-xs text-red-600 hover:underline" onClick={() => removeProposedRow(idx)}>Remove</button>
                    </td>
                  </tr>
                ))}
                {proposedItems.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No items detected. You can still save an empty template.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setReviewOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveReviewedTemplate}>Save template</button>
          </div>
        </section>
      )}
    </div>
  );
}
