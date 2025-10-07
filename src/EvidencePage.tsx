import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useToast } from "./toast";
import { Link2, Paperclip } from "lucide-react";

/** Types aligned with your schema */
type Criterion = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  category?: string | null;
  owner_email?: string | null;
  due_date?: string | null;
};

type Evidence = {
  id: string;
  criterion_id: string;
  kind: "note" | "link" | "file";
  note?: string | null;   // narrative
  url?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  uploaded_at: string;
  created_by?: string | null;
};

export default function EvidencePage() {
  const { id: projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const { show } = useToast();

  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const [rows, setRows] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Composer state
  const [narrative, setNarrative] = useState("");
  const [mode, setMode] = useState<"none" | "link" | "file">("none");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const dropRef = useRef<HTMLLabelElement | null>(null);

  // Load criteria for project and preselect
  useEffect(() => {
    (async () => {
      if (!projectId) return;
      const { data, error } = await supabase
        .from("criteria")
        .select("id,project_id,title,status,category,owner_email,due_date")
        .eq("project_id", projectId)
        .order("title", { ascending: true });
      if (error) { setErr(error.message); return; }
      const list = (data ?? []) as Criterion[];
      setCriteria(list);
      const qp = params.get("cid");
      if (qp && list.some(c => c.id === qp)) setSelected(qp);
      else if (!selected && list.length) setSelected(list[0].id);
    })();
  }, [projectId]);

  // Load evidence for selected criterion
  useEffect(() => {
    (async () => {
      if (!selected) { setRows([]); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from("evidence")
        .select("id,criterion_id,kind,note,url,file_path,mime_type,size_bytes,uploaded_at,created_by")
        .eq("criterion_id", selected)
        .order("uploaded_at", { ascending: false });
      if (error) setErr(error.message);
      setRows((data ?? []) as Evidence[]);
      setLoading(false);
    })();
  }, [selected]);

  function resetComposer() {
    setNarrative("");
    setMode("none");
    setUrl("");
    setFile(null);
  }

  async function submit() {
    if (!selected) return;
    const text = narrative.trim();
    if (!text) { show("Please add a short narrative/description.", "error"); return; }

    try {
      if (mode === "none") {
        const { data, error } = await supabase
          .from("evidence")
          .insert({ criterion_id: selected, kind: "note", note: text })
          .select("*").single();
        if (error) throw error;
        setRows(prev => [data as Evidence, ...prev]);
        show("Note added", "success");
        resetComposer();
        return;
      }
      if (mode === "link") {
        const u = url.trim();
        if (!u) { show("Paste a valid URL.", "error"); return; }
        const { data, error } = await supabase
          .from("evidence")
          .insert({ criterion_id: selected, kind: "link", url: u, note: text })
          .select("*").single();
        if (error) throw error;
        setRows(prev => [data as Evidence, ...prev]);
        show("Link added", "success");
        resetComposer();
        return;
      }
      // file
      if (!file) { show("Choose a file to upload.", "error"); return; }
      const path = `${selected}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("evidence").upload(path, file);
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("evidence").getPublicUrl(path);
      const publicUrl = pub?.publicUrl || null;
      const { data, error } = await supabase
        .from("evidence")
        .insert({ criterion_id: selected, kind: "file", file_path: path, url: publicUrl, note: text, mime_type: file.type || null, size_bytes: file.size })
        .select("*").single();
      if (error) throw error;
      setRows(prev => [data as Evidence, ...prev]);
      show("File uploaded", "success");
      resetComposer();
    } catch (e: any) {
      show(e?.message ?? String(e), "error");
    }
  }

  async function remove(ev: Evidence) {
    try {
      if (ev.kind === "file" && ev.file_path) {
        try { await supabase.storage.from("evidence").remove([ev.file_path]); } catch {}
      }
      const { error } = await supabase.from("evidence").delete().eq("id", ev.id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== ev.id));
      show("Evidence removed", "success");
    } catch (e: any) {
      show(e?.message ?? String(e), "error");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { setFile(f); setMode("file"); }
  }
  function prevent(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); }

  const selectedCriterion = useMemo(() => criteria.find(c => c.id === selected) || null, [criteria, selected]);
  
  

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-slate-600">Criterion</div>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={selected ?? ""}
          onChange={(e)=>{
            setSelected(e.target.value);
            params.set("cid", e.target.value);
            setParams(params, { replace: true });
          }}
        >
          {criteria.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {selectedCriterion && (
          <div className="text-xs text-slate-500">
            {selectedCriterion.category ?? "Uncategorised"} · {selectedCriterion.status}
          </div>
        )}
      </header>
{err && (
  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
    {err}
  </div>
)}
      {/* Composer */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold">Add Evidence</div>

        <label className="block text-xs text-slate-600 mb-1">Narrative / Description (required)</label>
        <textarea
          className="w-full min-h-[90px] rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="What is this evidence? What changed, why, by whom…"
          value={narrative}
          onChange={(e)=>setNarrative(e.target.value)}
        />

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className={`flex items-center gap-2 rounded-md border px-2 py-2 text-sm ${mode==='link'?'border-slate-900 bg-slate-50':'border-slate-200'}`}>
            <input type="radio" checked={mode==='link'} onChange={()=>setMode('link')} />
            <span className="inline-flex items-center gap-1"><Link2 size={14}/> Add a link</span>
          </label>
          <label className={`flex items-center gap-2 rounded-md border px-2 py-2 text-sm ${mode==='file'?'border-slate-900 bg-slate-50':'border-slate-200'}`}>
            <input type="radio" checked={mode==='file'} onChange={()=>setMode('file')} />
            <span className="inline-flex items-center gap-1"><Paperclip size={14}/> Attach a file</span>
          </label>
        </div>

        {mode==='link' && (
          <div className="mt-2">
            <label className="block text-xs text-slate-600 mb-1">URL</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="https://…"
              value={url}
              onChange={(e)=>setUrl(e.target.value)}
            />
          </div>
        )}

        {mode==='file' && (
          <div className="mt-2">
            <label
              ref={dropRef}
              onDrop={onDrop}
              onDragEnter={prevent}
              onDragOver={prevent}
              className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 px-3 py-6 text-sm text-slate-600"
            >
              {file ? (
                <div className="text-slate-700">{file.name}</div>
              ) : (
                <>
                  <div className="text-xs">Drag & drop a file here</div>
                  <div className="text-xs">or</div>
                  <div><input type="file" onChange={(e)=>setFile(e.target.files?.[0]||null)} /></div>
                </>
              )}
            </label>
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={resetComposer}>Clear</button>
          <button className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={submit} disabled={!narrative.trim()}>
            Add Evidence
          </button>
        </div>
      </section>

      {/* Evidence list */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Evidence</div>
          <div className="text-xs text-slate-500">{rows.length}</div>
        </div>

        {loading && <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center text-slate-600">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center text-slate-600">No evidence yet.</div>
        )}

        <div className="grid gap-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {r.note || (r.kind === "link" ? (r.url ?? "Link") : (r.file_path?.split('/').pop() ?? "File"))}
                </div>
                <div className="text-xs text-slate-500">{new Date(r.uploaded_at).toLocaleString()} · {r.created_by ?? "Unknown"}</div>
                {r.kind === "link" && r.url && (
                  <div className="mt-1 text-xs"><a className="underline break-all" href={r.url} target="_blank" rel="noreferrer">{r.url}</a></div>
                )}
                {r.kind === "file" && r.file_path && (
                  <div className="mt-1 text-xs text-slate-600">{r.file_path.split('/').pop()}</div>
                )}
              </div>
              <button className="text-xs underline text-slate-700" onClick={()=>remove(r)}>Remove</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
