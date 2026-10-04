import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { EnhancementMargins, EnhancementPins } from './AnswerEnhancementLayer';

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
//   • `enhancement` (optional) draws the topper-copy enhancement layer: margin
//     notes + brackets on wide panels, numbered pins on narrow ones.
const MARGIN_W = 190;
const MARGIN_MIN_PANEL_W = 720; // below this the margins would crush the page → pins
const NOTES_KEY = 'tc_notes_on_v1';

export default function PdfAnswerViewer({ fileUrl, token, startPage = 1, endPage = null, enhancement = null }) {
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(startPage);
  const [fit, setFit] = useState('page'); // 'page' | 'width'
  const [err, setErr] = useState(false);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const wrapRef = useRef(null);
  const [pageEl, setPageEl] = useState(null); // callback ref: the page mounts only after the PDF loads
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 });
  const [notesOn, setNotesOn] = useState(() => {
    try { return localStorage.getItem(NOTES_KEY) !== '0'; } catch { return true; }
  });
  const toggleNotes = () => setNotesOn((v) => {
    try { localStorage.setItem(NOTES_KEY, v ? '0' : '1'); } catch { /* private mode */ }
    return !v;
  });

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

  const allNotes = enhancement?.notes || [];
  const hasNotes = allNotes.length > 0;
  const showNotes = hasNotes && notesOn;
  const marginMode = showNotes && box.w >= MARGIN_MIN_PANEL_W;
  const pageNotes = showNotes ? allNotes.filter((n) => n.page === cur) : [];
  const sideW = marginMode ? MARGIN_W : 0;

  const pageProps = fit === 'width'
    ? { width: Math.max(120, box.w - 24 - sideW * 2) }
    : { height: Math.max(200, box.h - 24) };

  // Track the rendered page size — the notes are positioned in page pixels.
  useEffect(() => {
    if (!pageEl) return undefined;
    const ro = new ResizeObserver(([e]) => setPageSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(pageEl);
    return () => ro.disconnect();
  }, [pageEl]);

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
            <div className="relative" style={{ paddingLeft: sideW, paddingRight: sideW }}>
              <div ref={setPageEl} className="relative">
                <Page
                  pageNumber={cur}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-lg"
                  {...pageProps}
                />
                {!marginMode && pageNotes.length > 0 && pageSize.h > 0 && (
                  <EnhancementPins key={cur} notes={pageNotes} pageW={pageSize.w} pageH={pageSize.h} />
                )}
              </div>
              {marginMode && pageNotes.length > 0 && pageSize.h > 0 && (
                <EnhancementMargins notes={pageNotes} pageW={pageSize.w} pageH={pageSize.h} marginW={MARGIN_W} />
              )}
            </div>
          </Document>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center justify-center gap-x-3 gap-y-1 flex-wrap px-3 py-1.5 border-t border-border-default bg-surface [&>button]:whitespace-nowrap">
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
        {hasNotes && (
          <button
            onClick={toggleNotes}
            className={`px-2 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
              notesOn
                ? 'bg-brand text-text-on-accent border-brand'
                : 'bg-surface-raised border-border-default text-text-secondary hover:bg-sunken'
            }`}
            title="Show or hide the ✨ why-this-works and ➕ value-add notes"
          >
            ✨ Notes: {notesOn ? 'On' : 'Off'}
          </button>
        )}
        {hasNotes && !enhancement.published && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-status-warning-bg text-status-warning-text" title="Only admins can see unpublished notes">
            Draft
          </span>
        )}
      </div>
    </div>
  );
}
