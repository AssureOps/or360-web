// src/lib/certificate.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type CertProject = { id: string; name: string };
export type CertCriterion = {
  title: string;
  status: string;
  owner_email?: string | null;
  due_date?: string | null;
  caveat_reason?: string | null;
};

// Utility to load image from /public into base64
async function loadLogoBase64(path: string): Promise<string | null> {
  try {
    const resp = await fetch(path);
    const blob = await resp.blob();
    const reader = new FileReader();
    return await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateCertificate(
  project: CertProject,
  criteria: CertCriterion[]
) {
  const doc = new jsPDF();

  // Try to embed logo from /public
  const logoBase64 = await loadLogoBase64("/assureops-logo.png");
  if (logoBase64) {
   doc.addImage(logoBase64, "PNG", 150, 8, 50, 30);
  }

  // Header
  doc.setFontSize(18);
  doc.text("Operational Acceptance Certificate", 14, 20);

  doc.setFontSize(12);
  doc.text(`Project: ${project.name}`, 14, 30);
  doc.text(`Project ID: ${project.id}`, 14, 36);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

  // Summary
  const total = criteria.length;
  const done = criteria.filter((c) => c.status === "done").length;
  const outstanding = total - done;
  const caveats = criteria.filter((c) => c.status === "caveat");

  doc.setFontSize(14);
  doc.text("Summary", 14, 54);
  autoTable(doc, {
    startY: 58,
    head: [["Total Criteria", "Completed", "Outstanding", "Caveats"]],
    body: [[String(total), String(done), String(outstanding), String(caveats.length)]],
    styles: { fontSize: 10 },
  });
  let y = ((doc as any).lastAutoTable?.finalY ?? 58) + 10;

  // Outstanding items
  const incomplete = criteria.filter((c) =>
    ["not_started", "in_progress", "delayed"].includes(c.status)
  );
  if (incomplete.length > 0) {
    doc.setFontSize(14);
    doc.text("Outstanding Items", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Title", "Status", "Owner", "Due Date"]],
      body: incomplete.map((c) => [
        c.title,
        c.status,
        c.owner_email ?? "-",
        c.due_date ?? "-",
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
      body: caveats.map((c) => [c.title, c.caveat_reason ?? "-", c.owner_email ?? "-"]),
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

  // Save file
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`OAC_${project.name}_${stamp}.pdf`);
}
