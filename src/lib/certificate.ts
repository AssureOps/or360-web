// src/lib/certificate.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Minimal shapes so we don't import from App.tsx */
export type CertProject = { id: string; name: string };
export type CertCriterion = {
  title: string;
  status: string;
  owner_email?: string | null;
  due_date?: string | null;
  caveat_reason?: string | null;
};

export function generateCertificate(project: CertProject, criteria: CertCriterion[]) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text("Operational Acceptance Certificate", 14, 18);

  doc.setFontSize(12);
  doc.text(`Project: ${project.name}`, 14, 28);
  doc.text(`Project ID: ${project.id}`, 14, 34);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

  // Summary
  const total = criteria.length;
  const done = criteria.filter(c => c.status === "done").length;
  const outstanding = total - done;
  const caveats = criteria.filter(c => c.status === "caveat");

  doc.setFontSize(14);
  doc.text("Summary", 14, 52);

  autoTable(doc, {
    startY: 56,
    head: [["Total Criteria", "Completed", "Outstanding", "Caveats"]],
    body: [[String(total), String(done), String(outstanding), String(caveats.length)]],
    styles: { fontSize: 10 },
  });
  let y = ((doc as any).lastAutoTable?.finalY ?? 56) + 10;

  // Outstanding items
  const incomplete = criteria.filter(c =>
    c.status === "not_started" || c.status === "in_progress" || c.status === "delayed"
  );
  if (incomplete.length > 0) {
    doc.setFontSize(14);
    doc.text("Outstanding Items", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Title", "Status", "Owner", "Due Date"]],
      body: incomplete.map(c => [
        c.title,
        c.status,
        c.owner_email ?? "-",
        c.due_date ?? "-"
      ]),
      styles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 90 } },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
  }

  // Caveats
  if (caveats.length > 0) {
    doc.setFontSize(14);
    doc.text("Caveats", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Title", "Reason", "Owner"]],
      body: caveats.map(c => [
        c.title,
        c.caveat_reason ?? "-",
        c.owner_email ?? "-"
      ]),
      styles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 80 } },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
  }

  // Sign-off
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(12);
  doc.text("Approved by: ____________________", 14, y);
  doc.text("Date: ____________________", 14, y + 10);

  // Download
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`OAC_${project.name}_${stamp}.pdf`);
}
