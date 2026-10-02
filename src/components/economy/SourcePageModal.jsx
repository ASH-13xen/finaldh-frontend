import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { sourcePageUrl } from '../../lib/economyApi';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// The original Economy Master File page(s) a topic came from — for tables, charts and anything
// the parser flattened. The server sends one page at a time (never the whole PDF).
export default function SourcePageModal({ pages, title, onClose }) {
  const [idx, setIdx] = useState(0);
  const [width, setWidth] = useState(700);
  const [err, setErr] = useState('');
  const boxRef = useRef(null);
  const page = pages[idx];
  const token = localStorage.getItem('token');
  const file = useMemo(
    () => ({ url: sourcePageUrl(page), httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined }),
    [page, token],
  );

  useEffect(() => { setErr(''); }, [page]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(pages.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pages.length]);

  useEffect(() => {
    if (!boxRef.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(900, e.contentRect.width)));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Original page"
        className="bg-surface border border-border-default w-full sm:max-w-4xl h-full sm:h-[92vh] sm:rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border-default flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Original page {page}</p>
            <p className="text-sm font-semibold text-text-primary truncate">{title}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {pages.length > 1 && (
              <>
                <button disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="px-2.5 py-1 rounded-lg border border-border-default text-xs font-bold disabled:opacity-40 cursor-pointer">‹</button>
                <span className="text-xs text-text-tertiary tabular-nums">{idx + 1}/{pages.length}</span>
                <button disabled={idx === pages.length - 1} onClick={() => setIdx((i) => i + 1)} className="px-2.5 py-1 rounded-lg border border-border-default text-xs font-bold disabled:opacity-40 cursor-pointer">›</button>
              </>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sunken text-text-secondary cursor-pointer text-lg" aria-label="Close">✕</button>
          </div>
        </div>
        <div ref={boxRef} className="flex-1 overflow-auto bg-sunken flex justify-center p-2 sm:p-4" onContextMenu={(e) => e.preventDefault()}>
          {err ? (
            <p className="text-sm text-status-danger-text self-center px-6 text-center">{err}</p>
          ) : (
            <Document
              file={file}
              onLoadError={async () => {
                const r = await fetch(sourcePageUrl(page), { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
                const d = r ? await r.json().catch(() => ({})) : {};
                setErr(d.error || 'Could not load this page.');
              }}
              loading={<p className="text-sm text-text-tertiary self-center">Loading page…</p>}
            >
              <Page pageNumber={1} width={width - 16} renderAnnotationLayer={false} renderTextLayer={false} className="shadow-lg" />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
