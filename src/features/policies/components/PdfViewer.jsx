import { useEffect, useRef, useState } from "react";
import { ZoomControls } from "./ZoomControls";

// Shows a PDF INSIDE the page by drawing each page onto a canvas with PDF.js. It does not rely on the
// browser's own PDF viewer, which is often switched off or blocked when the app runs inside Microsoft
// Teams (an embedded PDF then shows up blank). PDF.js and its worker are loaded only when a PDF is
// actually opened, so they add nothing to the app's normal start-up.
//
// Zoom: the document is parsed once; changing the zoom only redraws the pages at the new size.
export function PdfViewer({ blob }) {
  const hostRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState({ loading: true, error: null });

  // 1) Load the document.
  useEffect(() => {
    let cancelled = false;
    let doc = null;
    setPdfDoc(null);
    setStatus({ loading: true, error: null });

    // Never leave the user on "Loading" forever: if the first page isn't visible in 20 seconds, say so.
    const giveUp = setTimeout(() => {
      if (!cancelled) setStatus(s => (s.loading ? { loading: false, error: "The document is taking too long to display." } : s));
    }, 20000);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        const data = new Uint8Array(await blob.arrayBuffer());
        // isEvalSupported: false -- the page's security policy forbids eval, and PDF.js must not need it.
        doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        if (cancelled) { doc.destroy(); return; }
        setPdfDoc(doc);
      } catch (err) {
        if (!cancelled) setStatus({ loading: false, error: err?.message || "This PDF could not be displayed." });
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      doc?.destroy();
    };
  }, [blob]);

  // 2) Draw the pages (again) whenever the document or the zoom changes.
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      try {
        const host = hostRef.current;
        if (!host) return;
        // Draw into a fragment and swap it in at the end, so the viewer doesn't flash blank while re-zooming.
        const progressive = host.childElementCount === 0;
        const fragment = document.createDocumentFragment();
        const baseWidth = Math.max(280, host.clientWidth - 24);
        const cssWidth = baseWidth * zoom;
        const dpr = window.devicePixelRatio || 1;

        for (let n = 1; n <= pdfDoc.numPages; n++) {
          const page = await pdfDoc.getPage(n);
          if (cancelled) return;
          const fit = cssWidth / page.getViewport({ scale: 1 }).width;   // fit the page to the viewer's width x zoom
          const viewport = page.getViewport({ scale: fit * dpr });       // drawn at device resolution (sharp)

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
          // Zoomed in, a page can be wider than the viewer: left-aligned so it scrolls sideways; otherwise centred.
          canvas.className = "block mb-3 bg-white shadow-md";
          canvas.style.marginLeft = "auto";
          canvas.style.marginRight = "auto";
          // First open (viewer empty): pages appear one by one as they are drawn. Re-zoom: the new pages are
          // built off-screen and swapped in at the end.
          (progressive ? host : fragment).appendChild(canvas);

          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          if (cancelled) return;
          if (n === 1) setStatus({ loading: false, error: null }); // first page is visible: stop the spinner
        }
        if (cancelled) return;
        if (!progressive) host.replaceChildren(fragment);
        setStatus({ loading: false, error: null });
      } catch (err) {
        if (!cancelled) setStatus({ loading: false, error: err?.message || "This PDF could not be displayed." });
      }
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, zoom]);

  return (
    <div className="flex flex-col gap-2">
      <ZoomControls zoom={zoom} onZoom={setZoom}/>
      <div className="relative">
        <div ref={hostRef} className="h-[calc(100vh-18rem)] overflow-auto rounded-md bg-muted p-3" />
        {status.loading && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Loading the document…</p>
        )}
        {status.error && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-destructive">
            {status.error} Use Download to open it on your computer.
          </p>
        )}
      </div>
    </div>
  );
}
