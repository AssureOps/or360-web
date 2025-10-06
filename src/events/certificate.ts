// src/events/certificate.ts
// Listens for "export-certificate" events (emitted by ProjectLayout header button)
// and generates the Operational Acceptance Certificate for the user's last project.

import { supabase } from "../lib/supabase";
import { generateCertificate } from "../lib/certificate";

type Project = { id: string; name: string };

async function runExport() {
  const id = localStorage.getItem("lastProjectId");
  if (!id) {
    alert("Open a project first to generate a certificate.");
    return;
  }
  try {
    const { data: proj, error: pErr } = await supabase
      .from("projects")
      .select("id,name")
      .eq("id", id)
      .single();
    if (pErr || !proj) throw pErr || new Error("Project not found");

    const { data: crits, error: cErr } = await supabase
      .from("criteria")
      .select("title,status,owner_email,due_date,caveat_reason")
      .eq("project_id", id);
    if (cErr) throw cErr;

    generateCertificate(
      { id: (proj as Project).id, name: (proj as Project).name },
      (crits || []).map((c: any) => ({
        title: c.title,
        status: String(c.status),
        owner_email: c.owner_email ?? null,
        due_date: c.due_date ?? null,
        caveat_reason: c.caveat_reason ?? null,
      }))
    );
  } catch (e: any) {
    alert("Certificate generation failed: " + (e?.message ?? String(e)));
  }
}

// Register once
if (typeof window !== "undefined") {
  window.addEventListener("export-certificate", () => {
    runExport();
  });
}
