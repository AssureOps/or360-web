import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { useOrg } from "./OrgContext";
import { useNavigate } from "react-router-dom";

type OrgRow = {
  id: string;
  name: string;
  billing_plan: string;
  created_at: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Organisations() {
  const { orgId, setOrgId, refresh: refreshOrgContext } = useOrg();
  const navigate = useNavigate();

  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [saChecked, setSaChecked] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrgRow | null>(null);
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("free");

  const [del, setDel] = useState<OrgRow | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("orgs")
        .select("id,name,billing_plan,created_at")
        .order("name", { ascending: true })
        .limit(1000);

      if (error) throw error;
      setRows((data ?? []) as OrgRow[]);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc("is_superadmin");
        setIsSuperadmin(Boolean(data));
      } catch {
        setIsSuperadmin(false);
      } finally {
        setSaChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, []);

  const canWrite = useMemo(() => saChecked && isSuperadmin, [saChecked, isSuperadmin]);

  function openCreate() {
    setEditing(null);
    setName("");
    setPlan("free");
    setModalOpen(true);
  }

  function openEdit(o: OrgRow) {
    setEditing(o);
    setName(o.name);
    setPlan(o.billing_plan);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setName("");
    setPlan("free");
  }

  async function saveOrg() {
    if (!canWrite) return;
    const n = name.trim();
    if (!n) {
      setErr("Organisation name is required.");
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      if (editing) {
        const { error } = await supabase
          .from("orgs")
          .update({ name: n, billing_plan: plan })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("orgs")
          .insert({ name: n, billing_plan: plan });
        if (error) throw error;
      }

      closeModal();
      await load();
      await refreshOrgContext();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!canWrite || !del) return;

    setLoading(true);
    setErr(null);
    try {
      const { error } = await supabase.from("orgs").delete().eq("id", del.id);
      if (error) throw error;

      if (orgId === del.id) setOrgId("");
      setDel(null);

      await load();
      await refreshOrgContext();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Organisations</h1>
          <div className="text-sm text-slate-500">
            {canWrite
              ? "Superadmin: you can create, edit and delete organisations."
              : "Read-only: only superadmins can manage organisations."}
          </div>
        </div>

        <button
          onClick={openCreate}
          disabled={!canWrite}
          className={`rounded-md px-3 py-2 text-sm ${
            canWrite
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "bg-slate-200 text-slate-500 cursor-not-allowed"
          }`}
        >
          + New organisation
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Plan</div>
          <div className="col-span-3">Created</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-4 text-slate-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-slate-600">No organisations visible.</div>
        ) : (
          rows.map((o) => (
            <div
              key={o.id}
              className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 items-center"
            >
              <div className="col-span-3">
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-slate-500 truncate">{o.id}</div>
              </div>

              <div className="col-span-2">
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs">
                  {o.billing_plan}
                </span>
              </div>

              <div className="col-span-3 text-sm text-slate-600">
                {formatDate(o.created_at)}
              </div>

              <div className="col-span-4 flex justify-end gap-2">
                <button
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                  onClick={() => {
                    setOrgId(o.id);
                    navigate("/org-users");
                  }}
                >
                  Members
                </button>

                <button
                  className={`rounded-md border px-2 py-1 text-xs ${
                    canWrite
                      ? "border-slate-200 bg-white hover:bg-slate-50"
                      : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                  disabled={!canWrite}
                  onClick={() => openEdit(o)}
                >
                  Edit
                </button>

                <button
                  className={`rounded-md border px-2 py-1 text-xs ${
                    canWrite
                      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                  disabled={!canWrite}
                  onClick={() => setDel(o)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200">
              <div className="text-sm font-semibold">
                {editing ? "Edit organisation" : "Create organisation"}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Organisation name"
              />
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="Billing plan"
              />
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                disabled={!canWrite}
                className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm"
                onClick={saveOrg}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {del && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200">
              <div className="text-sm font-semibold">Delete organisation?</div>
            </div>
            <div className="p-4 text-sm text-slate-700">
              {del.name}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                onClick={() => setDel(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-rose-600 text-white px-3 py-2 text-sm"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}