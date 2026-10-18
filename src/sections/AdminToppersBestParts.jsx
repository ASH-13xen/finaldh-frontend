import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import LoadingSpinner from '../components/LoadingSpinner';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// ---------------------------------------------------------------------------
// Admin: "Best part of the answer" crops for one topic (Manage / Publish →
// 📸 Best parts). Per question: pick a topper's answer page, drag a box over the
// strongest stretch (an intro, a diagram, a conclusion), add a caption, save.
// The crop is rendered here from the PDF at high resolution and uploaded as a PNG;
// students see it at the top of the answer view.
// ---------------------------------------------------------------------------

const token = () => localStorage.getItem('token');
const api = async (url, opts = {}) => {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const btnGhost =
  'px-2.5 py-1 bg-surface border border-border-default hover:bg-surface-raised text-text-secondary rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary =
  'px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const inputClass =
  'w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-lg px-2 py-1 text-[11px] focus:outline-none';

const MAX_PER_QUESTION = 6;
const PREVIEW_H = 720;
const CROP_SCALE = 2.5; // render the crop at 2.5× the PDF's own size so handwriting stays sharp

const bestPartImageUrl = (id) => `/api/toppers-copy/best-parts/${id}/image?token=${encodeURIComponent(token() || '')}`;

export default function BestPartsManager({ topicId, topicName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [parts, setParts] = useState([]);
  const [msg, setMsg] = useState('');
  const [cropping, setCropping] = useState(null); // question id

  const load = useCallback(async () => {
    const [tc, bp] = await Promise.all([
      api(`/api/toppers-copy/${topicId}`),
      api(`/api/toppers-copy/admin/${topicId}/best-parts`),
    ]);
    if (!tc.ok) throw new Error(tc.data.error || 'Failed to load topic');
    if (!bp.ok) throw new Error(bp.data.error || 'Failed to load best parts');
    setQuestions(tc.data.toppersCopy?.questions || []);
    setParts(bp.data.bestParts || []);
  }, [topicId]);

  useEffect(() => {
    load().catch((e) => setMsg(e.message)).finally(() => setLoading(false));
  }, [load]);

  const byQuestion = useMemo(() => {
    const m = {};
    for (const p of parts) (m[p.questionId] ||= []).push(p);
    return m;
  }, [parts]);

  const saveCaption = async (part, caption) => {
    if (caption === part.caption) return;
    const { ok, data } = await api(`/api/toppers-copy/admin/best-parts/${part._id}`, { method: 'PATCH', body: JSON.stringify({ caption }) });
    if (!ok) return setMsg(data.error || 'Save failed');
    setParts((ps) => ps.map((p) => (p._id === part._id ? data.bestPart : p)));
    setMsg('Caption saved.');
  };

  const remove = async (part) => {
    if (!confirm('Delete this best part?')) return;
    const { ok, data } = await api(`/api/toppers-copy/admin/best-parts/${part._id}`, { method: 'DELETE' });
    if (!ok) return setMsg(data.error || 'Delete failed');
    setParts((ps) => ps.filter((p) => p._id !== part._id));
  };

  if (loading) return <div className="px-4 py-4"><LoadingSpinner text="Loading best parts…" /></div>;

  const withParts = questions.filter((q) => byQuestion[q._id]?.length).length;

  return (
    <div className="px-4 py-4 bg-sunken border-t border-border-default">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-xs font-extrabold text-text-primary flex-grow">
          📸 Best parts — {topicName}
          <span className="ml-2 font-semibold text-text-tertiary">{withParts}/{questions.length} questions have one</span>
        </p>
        <button className={btnGhost} onClick={onClose}>Close</button>
      </div>
      {msg && <p className="text-[11px] font-semibold text-status-info-text mb-2">{msg}</p>}

      <div className="space-y-3">
        {questions.map((q, qi) => {
          const list = byQuestion[q._id] || [];
          return (
            <div key={q._id} className="bg-surface border border-border-default rounded-xl overflow-hidden">
              <div className="px-3 py-2 flex flex-wrap items-center gap-2 bg-surface-raised border-b border-border-default">
                <p className="text-[11px] font-bold text-text-primary flex-grow min-w-[200px]">Q{qi + 1}. {q.questionText}</p>
                <span className="text-[10px] text-text-tertiary">{list.length}/{MAX_PER_QUESTION}</span>
                <button
                  className={cropping === q._id ? btnPrimary : btnGhost}
                  disabled={!q.answers?.length || (list.length >= MAX_PER_QUESTION && cropping !== q._id)}
                  onClick={() => setCropping((c) => (c === q._id ? null : q._id))}
                >
                  {cropping === q._id ? 'Close' : '+ Crop best part'}
                </button>
              </div>

              {list.length > 0 && (
                <div className="p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((p) => (
                    <div key={p._id} className="rounded-lg border border-border-default overflow-hidden bg-sunken">
                      <img src={bestPartImageUrl(p._id)} alt={p.caption || 'Best part'} className="w-full max-h-48 object-contain bg-white" loading="lazy" />
                      <div className="p-2 space-y-1">
                        <p className="text-[10px] text-text-tertiary">{p.topperName} · p{p.page}</p>
                        <input
                          className={inputClass}
                          placeholder="Why this part is good"
                          defaultValue={p.caption}
                          onBlur={(e) => saveCaption(p, e.target.value.trim())}
                        />
                        <button className="text-[11px] font-bold text-status-danger-text cursor-pointer" onClick={() => remove(p)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cropping === q._id && (
                <CropTool
                  topicId={topicId}
                  question={q}
                  onSaved={(part) => {
                    setParts((ps) => [...ps, part]);
                    setMsg('Best part saved.');
                    if (list.length + 1 >= MAX_PER_QUESTION) setCropping(null);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================ Crop tool ============================
// Pick a topper + page, drag a box on the page, add a caption, save. The selected
// region is re-rendered from the PDF at CROP_SCALE (not cut from the preview) so the
// saved image is sharp.
function CropTool({ topicId, question, onSaved }) {
  const answers = question.answers || [];
  const [aidx, setAidx] = useState(0);
  const answer = answers[aidx];
  const [page, setPage] = useState(answer?.startPage || 1);
  const [box, setBox] = useState(null); // {x,y,w,h} fractions of the page
  const [caption, setCaption] = useState('');
  const [pageW, setPageW] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const pdfRef = useRef(null);
  const areaRef = useRef(null);
  const dragRef = useRef(null);

  const file = useMemo(
    () => ({ url: `/api/toppers-copy/${topicId}/pdf`, httpHeaders: { Authorization: `Bearer ${token()}` } }),
    [topicId],
  );

  const pages = [];
  if (answer) for (let p = answer.startPage; p <= (answer.endPage || answer.startPage); p++) pages.push(p);

  const pickAnswer = (i) => { setAidx(i); setPage(answers[i].startPage); setBox(null); };
  const pickPage = (p) => { setPage(p); setBox(null); };

  const point = (e) => {
    const r = areaRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const onDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = point(e);
    dragRef.current = p;
    setBox({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMove = (e) => {
    const s = dragRef.current;
    if (!s) return;
    const p = point(e);
    setBox({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = () => { dragRef.current = null; };

  const valid = box && box.w > 0.03 && box.h > 0.02;

  const save = async () => {
    if (!valid || !pdfRef.current) return;
    setSaving(true); setErr('');
    try {
      const pdfPage = await pdfRef.current.getPage(page);
      const vp = pdfPage.getViewport({ scale: CROP_SCALE });
      const full = document.createElement('canvas');
      full.width = Math.round(vp.width);
      full.height = Math.round(vp.height);
      await pdfPage.render({ canvasContext: full.getContext('2d'), viewport: vp }).promise;

      const sx = Math.round(box.x * full.width);
      const sy = Math.round(box.y * full.height);
      const sw = Math.max(1, Math.round(box.w * full.width));
      const sh = Math.max(1, Math.round(box.h * full.height));
      const crop = document.createElement('canvas');
      crop.width = sw;
      crop.height = sh;
      crop.getContext('2d').drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise((res) => crop.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Could not create the image');

      const fd = new FormData();
      fd.append('image', blob, 'best-part.png');
      fd.append('questionId', question._id);
      fd.append('page', String(page));
      fd.append('rect', JSON.stringify(box));
      fd.append('caption', caption.trim());
      fd.append('topperName', answer?.name || '');
      fd.append('width', String(sw));
      fd.append('height', String(sh));
      const { ok, data } = await api(`/api/toppers-copy/admin/${topicId}/best-parts`, { method: 'POST', body: fd });
      if (!ok) throw new Error(data.error || 'Save failed');
      onSaved(data.bestPart);
      setBox(null);
      setCaption('');
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  if (!answer) return <p className="px-3 pb-3 text-[11px] text-text-tertiary">This question has no topper answers.</p>;

  return (
    <div className="px-3 py-3 flex flex-col lg:flex-row gap-3 border-t border-border-default">
      <div className="flex-shrink-0">
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {answers.length > 1 && answers.map((a, i) => (
            <button key={i} onClick={() => pickAnswer(i)} className={aidx === i ? btnPrimary : btnGhost}>{a.name}</button>
          ))}
          {answers.length > 1 && <span className="w-px h-5 bg-border-default mx-1" />}
          {pages.map((p) => (
            <button key={p} onClick={() => pickPage(p)} className={page === p ? btnPrimary : btnGhost}>p{p}</button>
          ))}
        </div>
        <div className="relative inline-block border border-border-default bg-surface select-none">
          <Document
            file={file}
            onLoadSuccess={(pdf) => { pdfRef.current = pdf; }}
            loading={<div className="p-10 text-xs text-text-tertiary">Loading page…</div>}
          >
            <Page
              pageNumber={page}
              height={PREVIEW_H}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onRenderSuccess={(p) => setPageW(p.width * (PREVIEW_H / p.height))}
            />
          </Document>
          {pageW > 0 && (
            <div
              ref={areaRef}
              className="absolute inset-0 cursor-crosshair touch-none"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {box && (
                <div
                  className="absolute border-2 border-brand pointer-events-none"
                  style={{
                    left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                  }}
                />
              )}
            </div>
          )}
        </div>
        <p className="text-[10px] text-text-tertiary mt-1">Drag on the page to draw a box around the best part. Drag again to redo it.</p>
      </div>

      <div className="flex-grow min-w-0 space-y-2 lg:max-w-sm">
        <p className="text-[11px] font-extrabold text-text-primary">{answer.name}{answer.rank ? ` · AIR ${answer.rank}` : ''} · p{page}</p>
        <label className="block text-[10px] font-bold text-text-tertiary uppercase">Caption — why this part is good</label>
        <textarea
          className={inputClass}
          rows={3}
          placeholder="e.g. Opens with a crisp constitutional definition, then a data point"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        {err && <p className="text-[11px] font-semibold text-status-danger-text">{err}</p>}
        <button className={btnPrimary} disabled={!valid || saving} onClick={save}>
          {saving ? 'Saving…' : valid ? 'Save best part' : 'Draw a box first'}
        </button>
      </div>
    </div>
  );
}
