// src/Templates.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { useOrg } from "./OrgContext";
import { Upload, FileText, ExternalLink, Download, Trash2, X } from "lucide-react";

type TemplateDoc = {
  id: string;
  org_id: string;
  template_set_id: string | null;
  name: string;
  storage_path: string;  // <org_id>/<uuid>_filename.ext
  mime_type: string;
  created_by: string | null;
  created_at: string;
  extracted: any | null;
  notes: string | null;
  category?: string | null;
};

export default function Templates() {
  const { orgId } = useOrg();
  const [docs, setDocs] = useState<TemplateDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Upload modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("template_docs")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (!alive) return;
      setDocs(data ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(d =>
      (d.name?.toLowerCase().includes(q)) ||
      (d.category?.toLowerCase().includes(q)) ||
      (new Date(d.created_at).toLocaleString().toLowerCase().includes(q))
    );
  }, [docs, search]);

  async function refreshList() {
    if (!orgId) return;
    const { data } = await supabase
      .from("template_docs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    setDocs(data ?? []);
  }

  const onlyFileName = (path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  };

  async function openDoc(storage_path: string) {
    const { data, error } = await supabase.storage
      .from("template_docs")
      .createSignedUrl(storage_path, 300);
    if (error) return alert(error.message);
    window.open(data.signedUrl, "_blank");
  }

  async function downloadDoc(storage_path: string, filename: string) {
    const { data, error } = await supabase.storage
      .from("template_docs")
      .createSignedUrl(storage_path, 300, { download: filename });
    if (error) return alert(error.message);
    window.open(data.signedUrl, "_blank");
  }

  async function deleteDoc(row: TemplateDoc) {
    if (!confirm(`Delete "${row.name}"? This will also remove the file.`)) return;
    const { error } = await supabase.from("template_docs").delete().eq("id", row.id);
    if (error) return alert(error.message);
    await refreshList();
  }

  function resetModal() {
    setFile(null);
    setTitle("");
    setCategory("");
    setUploading(false);
  }

  async function confirmUpload() {
    if (!orgId) return alert("Select an organisation first.");
    if (!file) return alert("Choose a file.");
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext)) {
      return alert("Please upload a PDF or Word document (.pdf, .docx, .doc).");
    }

    setUploading(true);
    try {
      // 1) Upload to Storage
      const path = `${orgId}/${crypto.randomUUID()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("template_docs")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      // 2) Insert audit row
      const { data: me } = await supabase.auth.getUser();
      const mime = file.type || (ext === "pdf"
        ? "application/pdf"
        : ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/msword");

      const displayName = title.trim() || file.name;
      const cat = category.trim() || null;

      const payload: any = {
        org_id: orgId,
        template_set_id: null,
        name: displayName,
        storage_path: path,
        mime_type: mime,
        created_by: me?.user?.id ?? null,
        extracted: null
      };
      if (cat !== null) payload.category = cat;

      const { error: insErr } = await supabase.from("template_docs").insert(payload);
      if (insErr) throw insErr;

      // 3) Done
      await refreshList();
      setModalOpen(false);
      resetModal();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  function onChooseFile(f: File) {
    setFile(f);
    // Prefill Title from filename (without extension)
    const base = f.name.replace(/\.[^.]+$/, "");
    setTitle(base);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">Document Templates</h1>
          <p className="text-sm text-slate-600">Upload and manage your template source documents (PDF / Word).</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
          disabled={!orgId}
          title={!orgId ? "Select an organisation first" : "Upload a document"}
        >
          <Upload className="h-4 w-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search documents by title or category…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
	  
	  

      {/* Docs table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left w-[45%]">Document title</th>
                <th className="px-4 py-3 text-left w-[20%]">Category</th>
                <th className="px-4 py-3 text-left w-[20%]">Uploaded</th>
                <th className="px-4 py-3 text-left w-[15%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No documents yet.</td></tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          {/* Show only the filename, truncated */}
                          <div className="truncate font-medium max-w-[52vw]">
                            {d.name || onlyFileName(d.storage_path)}
                          </div>
                          {/* Removed path line to avoid horizontal scroll */}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{d.category ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                          onClick={() => openDoc(d.storage_path)}
                          title="Open"
                        >
                          <ExternalLink className="h-4 w-4" /> Open
                        </button>
                        <button
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                          onClick={() => downloadDoc(d.storage_path, d.name || onlyFileName(d.storage_path))}
                          title="Download"
                        >
                          <Download className="h-4 w-4" /> Download
                        </button>
                        <button
                          className="inline-flex items-center gap-1 text-red-700 hover:underline"
                          onClick={() => deleteDoc(d)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Upload Modal (hidden panel) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Upload Document</div>
              <button className="p-1 text-slate-500 hover:text-slate-700" onClick={() => { setModalOpen(false); resetModal(); }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Choose file</label>
                <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                  <span className="truncate">{file ? file.name : "Select a PDF / DOCX / DOC"}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) onChooseFile(f);
                      e.currentTarget.value = "";
                    }}
                    disabled={uploading}
                  />
                  <span className="rounded-md border border-slate-300 px-3 py-1 text-xs">Browse</span>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Document title</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g., OR Baseline SAC v1"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g., ITIL, Governance, OR"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  disabled={uploading}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => { setModalOpen(false); resetModal(); }}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmUpload}
                disabled={!file || uploading || !orgId}
                title={!orgId ? "Select an organisation first" : ""}
              >
                {uploading ? "Uploading…" : "Upload Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
