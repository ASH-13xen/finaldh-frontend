import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { subjectDisplayName } from './courseHelpers';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function SamplePreviewSection({ activeSampleCourse, sectionRef, status, pendingRequest, onPurchase, onTelegramNotify }) {
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [pdfError, setPdfError] = useState(false);
  const [pdfWidth, setPdfWidth] = useState(700);
  const containerRef = useRef(null);

  useEffect(() => {
    setPageNumber(1);
    setNumPages(null);
    setPdfError(false);
  }, [activeSampleCourse]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setPdfWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [activeSampleCourse]);

  const subjectDisplay = activeSampleCourse ? subjectDisplayName(activeSampleCourse.subject) : '';

  return (
    <div ref={sectionRef} className="mt-12 md:mt-16 pt-10 border-t border-border-default">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-display font-semibold text-text-primary tracking-tight">
          Course Sample Preview
        </h2>
        <p className="text-text-secondary text-xs md:text-sm mt-1 font-medium">
          {activeSampleCourse
            ? `Previewing a free sample of ${activeSampleCourse.name}.`
            : 'Click "See Sample" on any course above to preview it here.'}
        </p>
      </div>

      {!activeSampleCourse ? (
        <div className="py-16 text-center border border-dashed border-border-default rounded-2xl bg-surface-raised">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mx-auto mb-3 text-text-tertiary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p className="text-sm text-text-tertiary font-semibold">No sample selected yet.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: PDF Viewer */}
          <div className="lg:w-[65%] border border-border-default rounded-2xl overflow-hidden">
            <div className="px-4 md:px-6 py-4 flex items-center justify-between border-b border-border-default bg-surface flex-wrap gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-brand shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span className="text-sm font-sans font-bold text-text-primary truncate">{activeSampleCourse.name} — Sample</span>
                {numPages && (
                  <span className="text-[10px] text-text-tertiary font-medium shrink-0">({numPages} pages)</span>
                )}
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {numPages && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                      disabled={pageNumber <= 1}
                      className="px-2 py-1 bg-surface-raised hover:bg-sunken disabled:opacity-30 border border-border-default text-text-secondary rounded-lg text-[11px] font-bold transition cursor-pointer disabled:cursor-default"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] text-text-tertiary font-medium min-w-[60px] text-center tabular-nums">
                      {pageNumber} / {numPages}
                    </span>
                    <button
                      onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                      disabled={pageNumber >= numPages}
                      className="px-2 py-1 bg-surface-raised hover:bg-sunken disabled:opacity-30 border border-border-default text-text-secondary rounded-lg text-[11px] font-bold transition cursor-pointer disabled:cursor-default"
                    >
                      ›
                    </button>
                  </div>
                )}
                <a
                  href={`/api/courses/${activeSampleCourse._id}/sample`}
                  download={activeSampleCourse.sampleFileName || `${activeSampleCourse.name} - Sample.pdf`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg text-[11px] font-sans font-bold transition cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-px"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Sample
                </a>
              </div>
            </div>

            {/* PDF pages are always white — keep this mat a fixed warm-light tone in both
                themes so the page doesn't sit jarringly on a pure ink-black surface. */}
            <div ref={containerRef} className="bg-paper-100 flex justify-center py-6 min-h-[500px]">
              {pdfError ? (
                <div className="flex flex-col items-center justify-center gap-3 text-ink-600 py-16">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="12" x2="12" y2="14"/></svg>
                  <p className="text-sm font-semibold">Could not load sample preview</p>
                </div>
              ) : (
                <Document
                  key={activeSampleCourse._id}
                  file={`/api/courses/${activeSampleCourse._id}/sample`}
                  onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPdfError(false); }}
                  onLoadError={() => setPdfError(true)}
                  loading={
                    <div className="flex flex-col items-center justify-center gap-3 py-20">
                      <div className="w-8 h-8 border-4 border-ink-600/30 border-t-accent-600 rounded-full animate-spin" />
                      <p className="text-xs text-ink-600 font-medium">Loading sample...</p>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    width={Math.min(pdfWidth - 48, 700)}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              )}
            </div>
          </div>

          {/* Right: Purchase sidebar */}
          <div className="lg:w-[35%]">
            <div className="lg:sticky lg:top-6 bg-surface border border-border-default rounded-2xl p-5 space-y-4">
              <span className="text-[8px] md:text-[9px] font-sans font-extrabold text-brand bg-accent-soft-bg border border-accent-soft-border rounded px-1.5 py-0.5 uppercase tracking-wider w-fit block">
                {subjectDisplay}
              </span>
              <h3 className="text-base font-sans font-bold text-text-primary leading-relaxed">
                {activeSampleCourse.name}
              </h3>

              <div className="border-t border-border-default pt-3">
                <span className="text-[8px] md:text-[9px] font-sans font-bold text-text-tertiary block uppercase tracking-wider mb-1">
                  Price
                </span>
                {activeSampleCourse.useDiscount ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-sans font-extrabold text-brand tabular-nums">
                      &#8377;{activeSampleCourse.discountedPrice}
                    </span>
                    <span className="text-xs text-text-tertiary line-through tabular-nums">
                      &#8377;{activeSampleCourse.price}
                    </span>
                  </div>
                ) : (
                  <span className="text-xl font-sans font-extrabold text-text-primary tabular-nums">
                    &#8377;{activeSampleCourse.price || 499}
                  </span>
                )}
              </div>

              <div>
                {status.type === 'purchased' ? (
                  <div className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-status-success-bg border border-status-success-text/25 text-status-success-text rounded-xl text-xs font-sans font-bold shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Purchased
                  </div>
                ) : status.type === 'pending' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-1 px-2 py-2 bg-status-warning-bg border border-status-warning-text/25 text-status-warning-text rounded-xl text-xs font-sans font-bold animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Pending Verification
                    </div>
                    {pendingRequest && pendingRequest.telegramNotificationCount < 2 && (
                      <button
                        onClick={(e) => onTelegramNotify(pendingRequest, activeSampleCourse, e)}
                        className="w-full px-3 py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-[10px] font-sans font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        Notify Admin on Telegram
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onPurchase(activeSampleCourse)}
                    className="w-full px-4 py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-sans font-bold transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                    {status.type === 'guest' ? 'Sign In to Purchase' : status.type === 'rejected' ? 'Retry Purchase' : 'Purchase Now'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
