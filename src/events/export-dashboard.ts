// src/events/export-dashboard.ts
// Robust dashboard exporter with two layers of hardening:
// 1) Try html2canvas with aggressive clone-sanitizing (removes oklch() in SVG)
// 2) Fallback to dom-to-image-more after stripping cross-origin stylesheets
//    and forcing a system font, then build a multipage PDF via jsPDF.

export async function exportDashboardPDF(opts?: { projectName?: string }) {
  const root = document.getElementById("dashboard-root");
  if (!root) { alert("Could not find #dashboard-root to export."); return; }

  const projectName =
    (opts?.projectName ||
      (document.querySelector('[data-project-name]') as HTMLElement)?.dataset?.projectName) ||
    "project";
  const filename = `${projectName}_dashboard_${new Date().toISOString().slice(0, 10)}.pdf`;

  // --- common helper: draw tall image across multiple PDF pages
  function addImageMultipage(pdf: any, img: HTMLImageElement) {
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = img.width / img.height;
    const targetW = pageW;                     // fit width
    const targetH = targetW / ratio;

    if (targetH <= pageH) {
      pdf.addImage(img, "PNG", 0, 0, targetW, targetH, "", "FAST");
      return;
    }
    const slice = document.createElement("canvas");
    const ctx = slice.getContext("2d")!;
    const scale = targetW / img.width;         // scale from img px to page px
    const srcSliceH = Math.floor(pageH / scale);
    let y = 0;
    let page = 0;
    while (y < img.height) {
      const thisH = Math.min(srcSliceH, img.height - y);
      slice.width = img.width;
      slice.height = thisH;
      ctx.clearRect(0, 0, slice.width, slice.height);
      ctx.drawImage(img, 0, y, img.width, thisH, 0, 0, slice.width, slice.height);
      const data = slice.toDataURL("image/png");
      const onPageH = thisH * scale;
      if (page > 0) pdf.addPage();
      pdf.addImage(data, "PNG", 0, 0, targetW, onPageH, "", "FAST");
      y += thisH; page += 1;
    }
  }

  // --- 1) Try html2canvas with clone-sanitizer
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const OKLCH = /oklch\([^)]*\)/gi;

    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: document.documentElement.clientWidth,
      onclone: (doc) => {
        const nroot = doc.getElementById("dashboard-root");
        if (!nroot) return;

        // Scope export-only overrides
        nroot.classList.add("export-safe");
        const style = doc.createElement("style");
        style.setAttribute("data-export-safe", "true");
        style.textContent = `
          .export-safe, .export-safe * {
            color: #0f172a !important;           /* slate-900 */
            background-image: none !important;   /* kill gradients (color-mix/oklch) */
            box-shadow: none !important;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji" !important;
          }
          .export-safe { background-color: #ffffff !important; }
          .export-safe .border { border-color: #e2e8f0 !important; } /* slate-200 */
          .export-safe .no-print, .export-safe header, .export-safe nav, .export-safe .fixed, .export-safe .sticky {
            display: none !important;
          }
        `;
        doc.head.appendChild(style);

        // Strip oklch() in SVG attributes (fill/stroke/style)
        const nodes = doc.querySelectorAll(
          "svg, svg *, [style*='oklch('], [fill*='oklch('], [stroke*='oklch(']"
        );
        nodes.forEach((el) => {
          const st = el.getAttribute("style"); if (st && OKLCH.test(st)) el.setAttribute("style", st.replace(OKLCH, "#475569"));
          const fl = el.getAttribute("fill");  if (fl && OKLCH.test(fl)) el.setAttribute("fill", "#475569");
          const sk = el.getAttribute("stroke");if (sk && OKLCH.test(sk)) el.setAttribute("stroke", "#475569");
        });
      },
    });

    // build PDF
    const img = new Image();
    img.src = canvas.toDataURL("image/png");
    await img.decode();
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    addImageMultipage(pdf, img);
    pdf.save(filename);
    return;
  } catch (err) {
    console.warn("[exportDashboardPDF] html2canvas failed; switching to dom-to-image-more:", err);
  }

  // --- 2) Fallback: dom-to-image-more with cross-origin stylesheet stripping
  try {
    const [{ default: jsPDF }, domtoimage] = await Promise.all([
      import("jspdf"),
      import("dom-to-image-more") as any,
    ]);

    // Clone root for manipulation (don’t mutate live tree)
    const clone = root.cloneNode(true) as HTMLElement;
    // Create a detached document to render in memory
    const sandbox = document.createElement("div");
    sandbox.style.position = "fixed";
    sandbox.style.left = "-99999px";
    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    // Mark export-safe + force system font (avoid cross-origin font/layout shifts)
    clone.classList.add("export-safe");
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .export-safe, .export-safe * {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji" !important;
        background-image: none !important;
        box-shadow: none !important;
      }
      .export-safe .no-print, .export-safe header, .export-safe nav, .export-safe .fixed, .export-safe .sticky {
        display: none !important;
      }
    `;
    sandbox.appendChild(styleEl);

    // Remove cross-origin <link rel="stylesheet"> (e.g. rsms.me/inter)
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    const sameOrigin = (url: string) => {
      try { const u = new URL(url, location.origin); return u.origin === location.origin; }
      catch { return false; }
    };
    links.forEach((ln) => {
      if (!sameOrigin(ln.href)) {
        // mirror by adding a neutral placeholder (so layout still has margins)
        const ghost = document.createElement("style"); ghost.textContent = "";
        sandbox.appendChild(ghost);
      }
    });

    // Render PNG via dom-to-image-more
    const dataUrl: string = await domtoimage.toPng(clone, {
      quality: 1,
      bgcolor: "#ffffff",
      filter: (node: HTMLElement) => {
        const cl = (node.classList || { contains: () => false });
        if (cl.contains("no-print") || cl.contains("fixed") || cl.contains("sticky")) return false;
        const tag = node.tagName?.toLowerCase();
        if (tag === "header" || tag === "nav") return false;
        return true;
      },
    });

    document.body.removeChild(sandbox);

    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    addImageMultipage(pdf, img);
    pdf.save(filename);
  } catch (err) {
    console.error("[exportDashboardPDF] fallback failed:", err);
    alert("Export failed. If the problem persists, try a browser print (Ctrl/Cmd+P) as a temporary workaround.");
  }
}

export function registerDashboardExportListener() {
  if (typeof window === "undefined") return;
  const handler = async () => {
    const projectName =
      (document.querySelector('[data-project-name]') as HTMLElement)?.dataset?.projectName || undefined;
    await exportDashboardPDF({ projectName });
  };
  window.addEventListener("export-dashboard", handler);
}
