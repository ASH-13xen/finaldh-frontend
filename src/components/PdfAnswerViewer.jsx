import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Canvas-rendered PDF viewer for a single topper's answer.
//   • No browser PDF toolbar, no download button, no "open in new tab".
//   • Page navigation is clamped to [startPage, endPage] so the reader only ever
//     sees the selected topper's answer, never the rest of the compendium.
//   • The file is fetched with the bearer token; the bytes are never handed back
//     to the user as a file.
export default function PdfAnswerViewer({ fileUrl, token, startPage = 1, endPage = null }) {
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(startPage);
  const [fit, setFit] = useState('page'); // 'page' | 'width'
  const [err, setErr] = useState(false);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const wrapRef = useRef(null);

  // A stable object identity, or react-pdf re-fetches on every render.
  const file = useMemo(
    () => ({ url: fileUrl, httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined }),
    [fileUrl, token],
  );

  useEffect(() => { setPage(startPage); setErr(false); }, [startPage, fileUrl]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const lo = Math.max(1, startPage);
  const hi = Math.min(endPage || numPages || startPage, numPages || 999999);
  const cur = Math.min(Math.max(page, lo), hi >= lo ? hi : lo);
  const pageCount = Math.max(1, hi - lo + 1);
  const idx = cur - lo + 1;

  const pageProps = fit === 'width'
    ? { width: Math.max(120, box.w - 24) }
    : { height: Math.max(200, box.h - 24) };

  return (
    <div className="absolute inset-0 flex flex-col bg-sunken">
      <div ref={wrapRef} className="flex-grow overflow-auto flex items-start justify-center p-3">
        {err ? (
          <div className="m-auto text-xs text-text-tertiary">Could not load this answer copy.</div>
        ) : (
          <Document
            key={fileUrl}
            file={file}
            onLoadSuccess={({ numPages: n }) => { setNumPages(n); setErr(false); }}
            onLoadError={() => setErr(true)}
            loading={<div className="m-auto text-xs text-text-tertiary py-16">Loading answer copy…</div>}
            error={<div className="m-auto text-xs text-text-tertiary py-16">Could not load this answer copy.</div>}
          >
            <Page
              pageNumber={cur}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-lg"
              {...pageProps}
            />
          </Document>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center justify-center gap-3 px-3 py-1.5 border-t border-border-default bg-surface">
        <button
          onClick={() => setPage((p) => Math.max(lo, p - 1))}
          disabled={cur <= lo}
          className="px-2 py-1 rounded-md text-[11px] font-bold bg-surface-raised border border-border-default text-text-secondary hover:bg-sunken disabled:opacity-30 cursor-pointer disabled:cursor-default"
        >
          ‹ Prev
        </button>
        <span className="text-[11px] text-text-tertiary font-medium tabular-nums min-w-[90px] text-center">
          Page {idx} / {pageCount}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(hi, p + 1))}
          disabled={cur >= hi}
          className="px-2 py-1 rounded-md text-[11px] font-bold bg-surface-raised border border-border-default text-text-secondary hover:bg-sunken disabled:opacity-30 cursor-pointer disabled:cursor-default"
        >
          Next ›
        </button>
        <button
          onClick={() => setFit((f) => (f === 'page' ? 'width' : 'page'))}
          className="px-2 py-1 rounded-md text-[11px] font-bold bg-surface-raised border border-border-default text-text-secondary hover:bg-sunken cursor-pointer ml-2"
          title="Toggle fit mode"
        >
          Fit: {fit === 'page' ? 'Page' : 'Width'}
        </button>
      </div>
    </div>
  );
}
