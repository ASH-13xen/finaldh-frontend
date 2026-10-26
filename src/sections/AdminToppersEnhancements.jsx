import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import LoadingSpinner from '../components/LoadingSpinner';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// ---------------------------------------------------------------------------
// Admin: the topper-copy "enhancement layer" for one topic (Manage / Publish →
// ✨ Enhancements). Per topper answer: draft it with AI, fix it in the editor
// (drag a note's bracket on the page, reword, add / remove notes), then publish.
// Students only ever see published layers. These are toppers' copies — green notes
// say what was done well, blue notes say how to make it stronger, worded as an
// upgrade; harsh words ("wrong", "mistake"…) are flagged and block publishing
// unless overridden.
// ---------------------------------------------------------------------------

const token = () => localStorage.getItem('token');
const api = async (url, opts = {}) => {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(opts.headers || {}) },
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

// Mirrors CRITIQUE_RE in finaldh/utils/toppersEnhancement.js — live feedback while editing.
const CRITIQUE_RE = /\b(mistake|mistakes|missing|missed|misses|lacks?|lacking|weak|weakness|failed|fails|error|errors|wrong|incorrect|poor|poorly|forgot|ignored|shallow|superficial|careless|sloppy|should have)\b/i;
const critiqueWord = (s) => (String(s || '').match(CRITIQUE_RE) || [])[0] || null;

const KIND = {
  works: { color: 'var(--color-status-success-text)', bg: 'var(--color-status-success-bg)', label: '✨ Done well' },
  addon: { color: 'var(--color-status-info-text)', bg: 'var(--color-status-info-bg)', label: '➕ Make it stronger' },
};

const rangeKey = (a) => `${a.startPage}-${a.endPage}`;

export default function EnhancementManager({ topicId, topicName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [byRange, setByRange] = useState({});
  const [busy, setBusy] = useState(null);   // rangeKey | 'bulk'
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(null); // rangeKey

  const load = useCallback(async () => {
    const [tc, en] = await Promise.all([
      api(`/api/toppers-copy/${topicId}`),
      api(`/api/toppers-copy/admin/${topicId}/enhancements`),
    ]);
    if (!tc.ok) throw new Error(tc.data.error || 'Failed to load topic');
    if (!en.ok) throw new Error(en.data.error || 'Failed to load enhancements');
    setQuestions(tc.data.toppersCopy?.questions || []);
    setByRange(Object.fromEntries((en.data.enhancements || []).map((e) => [rangeKey(e), e])));
  }, [topicId]);

  useEffect(() => {
    load().catch((e) => setMsg(e.message)).finally(() => setLoading(false));
  }, [load]);

  const rows = useMemo(
    () => questions.flatMap((q, qi) => (q.answers || []).map((a, ai) => ({ q, qi, a, ai, key: rangeKey(a) }))),
    [questions],
  );
  const missing = rows.filter((r) => !byRange[r.key]);
  const cleanDrafts = rows.filter((r) => byRange[r.key] && !byRange[r.key].published && !byRange[r.key].toneIssues?.length);

  const setOne = (enh) => setByRange((m) => ({ ...m, [rangeKey(enh)]: enh }));

  const generate = async (r) => {
    const { ok, data } = await api(`/api/toppers-copy/admin/${topicId}/questions/${r.q._id}/answers/${r.ai}/enhance`, { method: 'POST' });
    if (!ok) throw new Error(data.error || 'Enhancement failed');
    setOne(data.enhancement);
    return data.enhancement;
  };

  const runOne = async (r) => {
    if (byRange[r.key]?.published && !confirm('Regenerating replaces the published notes with a new draft. Continue?')) return;
    setBusy(r.key); setMsg(`Drafting notes for ${r.a.name}… (up to a minute)`);
    try {
      const enh = await generate(r);
      setMsg(`${r.a.name}: ${enh.notes.length} notes drafted${enh.toneIssues?.length ? ` — ${enh.toneIssues.length} line(s) need rewording` : ''}.`);
    } catch (e) { setMsg(e.message); } finally { setBusy(null); }
  };

  const runMissing = async () => {
    setBusy('bulk');
    try {
      for (let i = 0; i < missing.length; i++) {
        setMsg(`Drafting ${i + 1}/${missing.length} — ${missing[i].a.name}…`);
        await generate(missing[i]);
      }
      setMsg(`Drafted ${missing.length} answer(s). Review, then publish.`);
    } catch (e) { setMsg(e.message); } finally { setBusy(null); }
  };

  const setPublished = async (enh, published, ignoreTone = false) => {
    const { ok, status, data } = await api(`/api/toppers-copy/admin/enhancements/${enh._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ published, ignoreTone }),
    });
    if (status === 409) {
      const lines = (data.toneIssues || []).slice(0, 5).map((t) => `• "${t.text}" (${t.word})`).join('\n');
      if (confirm(`${data.error}\n\n${lines}\n\nPublish anyway?`)) return setPublished(enh, published, true);
      return null;
    }
    if (!ok) throw new Error(data.error || 'Update failed');
    setOne(data.enhancement);
    return data.enhancement;
  };

  const publishClean = async () => {
    setBusy('bulk');
    try {
      for (const r of cleanDrafts) await setPublished(byRange[r.key], true);
      setMsg(`Published ${cleanDrafts.length} layer(s).`);
    } catch (e) { setMsg(e.message); } finally { setBusy(null); }
  };

  const remove = async (enh) => {
    if (!confirm(`Delete the notes for ${enh.topperName}?`)) return;
    const { ok, data } = await api(`/api/toppers-copy/admin/enhancements/${enh._id}`, { method: 'DELETE' });
    if (!ok) return setMsg(data.error || 'Delete failed');
    setByRange((m) => { const n = { ...m }; delete n[rangeKey(enh)]; return n; });
    if (editing === rangeKey(enh)) setEditing(null);
  };

  if (loading) return <div className="px-4 py-4"><LoadingSpinner text="Loading enhancements…" /></div>;

  return (
    <div className="px-4 py-4 bg-sunken border-t border-border-default">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-xs font-extrabold text-text-primary flex-grow">
          ✨ Enhancement layer — {topicName}
          <span className="ml-2 font-semibold text-text-tertiary">
            {rows.length - missing.length}/{rows.length} drafted · {rows.filter((r) => byRange[r.key]?.published).length} published
          </span>
        </p>
        <button className={btnGhost} disabled={!!busy || !missing.length} onClick={runMissing}>
          Draft {missing.length} missing
        </button>
        <button className={btnGhost} disabled={!!busy || !cleanDrafts.length} onClick={publishClean} title="Publish every draft with no tone issues">
          Publish {cleanDrafts.length} clean
        </button>
        <button className={btnGhost} onClick={onClose}>Close</button>
      </div>
      {msg && <p className="text-[11px] font-semibold text-status-info-text mb-2">{msg}</p>}

      <div className="space-y-3">
        {questions.map((q, qi) => (
          <div key={q._id} className="bg-surface border border-border-default rounded-xl overflow-hidden">
            <p className="px-3 py-2 text-[11px] font-bold text-text-primary bg-surface-raised border-b border-border-default">
              Q{qi + 1}. {q.questionText}
            </p>
            <div className="divide-y divide-border-default">
              {rows.filter((r) => r.qi === qi).map((r) => {
                const enh = byRange[r.key];
                const issues = enh?.toneIssues?.length || 0;
                return (
                  <div key={r.key}>
                    <div className="px-3 py-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-text-secondary flex-grow min-w-[160px]">
                        {r.a.name}{r.a.rank ? ` · AIR ${r.a.rank}` : ''}
                        <span className="text-text-tertiary font-semibold"> · p{r.a.startPage}–{r.a.endPage}</span>
                      </span>
                      {enh ? (
                        <>
                          <span className="text-[10px] text-text-tertiary">{enh.notes.length} notes</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            enh.published ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text'
                          }`}>{enh.published ? 'Published' : 'Draft'}</span>
                          {issues > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-status-danger-bg text-status-danger-text" title="Lines that read like a critique">
                              ⚠ {issues} tone
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-text-tertiary italic">no notes yet</span>
                      )}
                      <button className={btnGhost} disabled={!!busy} onClick={() => runOne(r)}>
                        {busy === r.key ? '…' : enh ? 'Regenerate' : '✨ Draft'}
                      </button>
                      {enh && (
                        <>
                          <button className={editing === r.key ? btnPrimary : btnGhost} onClick={() => setEditing((k) => (k === r.key ? null : r.key))}>
                            {editing === r.key ? 'Close editor' : 'Edit'}
                          </button>
                          <button
                            className={btnGhost}
                            disabled={!!busy}
                            onClick={() => setPublished(enh, !enh.published).catch((e) => setMsg(e.message))}
                          >
                            {enh.published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button className="px-2 py-1 text-[11px] font-bold text-status-danger-text cursor-pointer" onClick={() => remove(enh)}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                    {editing === r.key && enh && (
                      <EnhancementEditor
                        key={enh._id + (enh.generatedAt || '')}
                        topicId={topicId}
                        enhancement={enh}
                        onSaved={(e) => { setOne(e); setMsg(`Saved ${e.topperName}.`); }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================ Editor ============================
// Left: the answer page with each note's span as a draggable band (drag the band to
// move it, the top / bottom grip to resize). Right: the notes of that page + the
// takeaways. Save sends the whole layer.
let tempSeq = 0;
const PREVIEW_H = 620;
const MIN_SPAN = 0.02;

function EnhancementEditor({ topicId, enhancement, onSaved }) {
  const [page, setPage] = useState(enhancement.startPage);
  const [notes, setNotes] = useState(() => enhancement.notes.map((n) => ({ ...n, key: n._id })));
  const [tk, setTk] = useState(() => ({
    techniques: (enhancement.takeaways?.techniques || []).join('\n'),
    enrichment: (enhancement.takeaways?.enrichment || []).join('\n'),
    keywords: (enhancement.takeaways?.keywords || []).join(', '),
    altIntro: enhancement.takeaways?.altIntro?.text || '',
    altIntroKw: (enhancement.takeaways?.altIntro?.keywords || []).join(', '),
    altConclusion: enhancement.takeaways?.altConclusion?.text || '',
    altConclusionKw: (enhancement.takeaways?.altConclusion?.keywords || []).join(', '),
  }));
  const [sel, setSel] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [pageW, setPageW] = useState(0);
  const dragRef = useRef(null);

  const file = useMemo(
    () => ({ url: `/api/toppers-copy/${topicId}/pdf`, httpHeaders: { Authorization: `Bearer ${token()}` } }),
    [topicId],
  );

  const patchNote = (key, patch) => {
    setNotes((ns) => ns.map((n) => (n.key === key ? { ...n, ...patch } : n)));
    setDirty(true);
  };
  const addNote = (kind) => {
    const key = `tmp-${++tempSeq}`;
    setNotes((ns) => [...ns, { key, page, kind, yFrom: 0.45, yTo: 0.52, title: '', text: '', use: '', points: [], diagram: '' }]);
    setSel(key);
    setDirty(true);
  };
  const delNote = (key) => { setNotes((ns) => ns.filter((n) => n.key !== key)); setDirty(true); };

  // Band dragging: mode 'move' | 'top' | 'bottom'. Positions are page-height fractions.
  const startDrag = (e, note, mode) => {
    e.preventDefault();
    e.stopPropagation();
    setSel(note.key);
    dragRef.current = { key: note.key, mode, y0: e.clientY, from: note.yFrom, to: note.yTo };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = (e.clientY - d.y0) / PREVIEW_H;
    let { from, to } = d;
    if (d.mode === 'move') {
      const span = to - from;
      from = Math.min(1 - span, Math.max(0, from + dy));
      to = from + span;
    } else if (d.mode === 'top') {
      from = Math.min(to - MIN_SPAN, Math.max(0, from + dy));
    } else {
      to = Math.max(from + MIN_SPAN, Math.min(1, to + dy));
    }
    patchNote(d.key, { yFrom: from, yTo: to });
  };
  const endDrag = () => { dragRef.current = null; };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const body = {
        notes: notes.map((n) => ({
          ...(n._id ? { _id: n._id } : {}),
          page: n.page, kind: n.kind, yFrom: n.yFrom, yTo: n.yTo,
          title: n.title, text: n.text, use: n.use || '', points: (n.points || []).filter((p) => p.trim()), diagram: n.diagram || '',
        })),
        takeaways: {
          techniques: tk.techniques.split('\n').map((s) => s.trim()).filter(Boolean),
          enrichment: tk.enrichment.split('\n').map((s) => s.trim()).filter(Boolean),
          keywords: tk.keywords.split(',').map((s) => s.trim()).filter(Boolean),
          altIntro: { text: tk.altIntro.trim(), keywords: tk.altIntroKw.split(',').map((s) => s.trim()).filter(Boolean) },
          altConclusion: { text: tk.altConclusion.trim(), keywords: tk.altConclusionKw.split(',').map((s) => s.trim()).filter(Boolean) },
        },
      };
      const { ok, data } = await api(`/api/toppers-copy/admin/enhancements/${enhancement._id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!ok) throw new Error(data.error || 'Save failed');
      setNotes(data.enhancement.notes.map((n) => ({ ...n, key: n._id })));
      setDirty(false);
      onSaved(data.enhancement);
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const pageNotes = notes.filter((n) => n.page === page).sort((a, b) => a.yFrom - b.yFrom);
  const pages = [];
  for (let p = enhancement.startPage; p <= enhancement.endPage; p++) pages.push(p);

  return (
    <div className="px-3 pb-3 flex flex-col lg:flex-row gap-3">
      {/* page preview with draggable bands */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {pages.map((p) => (
            <button key={p} onClick={() => setPage(p)} className={page === p ? btnPrimary : btnGhost}>
              p{p} <span className="opacity-70">({notes.filter((n) => n.page === p).length})</span>
            </button>
          ))}
        </div>
        <div className="relative inline-block border border-border-default bg-surface" onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <Document file={file} loading={<div className="p-10 text-xs text-text-tertiary">Loading page…</div>}>
            <Page
              pageNumber={page}
              height={PREVIEW_H}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onRenderSuccess={(p) => setPageW(p.width * (PREVIEW_H / p.height))}
            />
          </Document>
          {pageW > 0 && pageNotes.map((n) => {
            const k = KIND[n.kind];
            const on = sel === n.key;
            const left = n.kind === 'works';
            return (
              <div key={n.key}>
                {on && (
                  <div
                    className="absolute pointer-events-none"
                    style={{ top: n.yFrom * PREVIEW_H, height: (n.yTo - n.yFrom) * PREVIEW_H, left: 0, right: 0, background: k.bg, opacity: 0.45 }}
                  />
                )}
                <div
                  onPointerDown={(e) => startDrag(e, n, 'move')}
                  title={`${k.label}: ${n.title || '(untitled)'} — drag to move`}
                  className="absolute cursor-grab active:cursor-grabbing rounded-sm touch-none"
                  style={{
                    top: n.yFrom * PREVIEW_H,
                    height: Math.max(6, (n.yTo - n.yFrom) * PREVIEW_H),
                    [left ? 'left' : 'right']: 0,
                    width: on ? 16 : 10,
                    background: k.color,
                    opacity: on ? 0.95 : 0.7,
                  }}
                >
                  <div onPointerDown={(e) => startDrag(e, n, 'top')} className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize" />
                  <div onPointerDown={(e) => startDrag(e, n, 'bottom')} className="absolute -bottom-1 left-0 right-0 h-2 cursor-ns-resize" />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-text-tertiary mt-1">Drag a coloured band to move a note; drag its top or bottom edge to resize.</p>
      </div>

      {/* note fields */}
      <div className="flex-grow min-w-0 space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          <button className={btnGhost} onClick={() => addNote('works')}>+ ✨ Done well</button>
          <button className={btnGhost} onClick={() => addNote('addon')}>+ ➕ Make it stronger</button>
          <span className="flex-grow" />
          <button className={btnPrimary} disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button>
        </div>
        {err && <p className="text-[11px] font-semibold text-status-danger-text">{err}</p>}
        {pageNotes.length === 0 && <p className="text-[11px] text-text-tertiary italic">No notes on page {page}.</p>}
        {pageNotes.map((n) => {
          const bad = [n.title, n.text, n.use, n.diagram, ...(n.points || [])].map(critiqueWord).find(Boolean);
          return (
            <div
              key={n.key}
              onClick={() => setSel(n.key)}
              className="rounded-lg border bg-surface p-2 space-y-1"
              style={{ borderColor: sel === n.key ? KIND[n.kind].color : 'var(--color-border-default)', borderLeftWidth: 3, borderLeftColor: KIND[n.kind].color }}
            >
              <div className="flex items-center gap-1.5">
                <select
                  value={n.kind}
                  onChange={(e) => patchNote(n.key, { kind: e.target.value })}
                  className="bg-sunken border border-border-default rounded px-1 py-0.5 text-[11px] font-bold"
                  style={{ color: KIND[n.kind].color }}
                >
                  <option value="works">✨ Done well (green, left)</option>
                  <option value="addon">➕ Make it stronger (blue, right)</option>
                </select>
                <span className="text-[10px] text-text-tertiary tabular-nums">
                  {Math.round(n.yFrom * 100)}–{Math.round(n.yTo * 100)}% down
                </span>
                {bad && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-status-danger-bg text-status-danger-text" title="Word improvements as upgrades, not faults">
                    ⚠ “{bad}”
                  </span>
                )}
                <span className="flex-grow" />
                <button className="text-[11px] font-bold text-status-danger-text cursor-pointer" onClick={() => delNote(n.key)}>Remove</button>
              </div>
              <input
                className={inputClass}
                placeholder={n.kind === 'works' ? 'Technique, e.g. “Opens with a thinker’s definition”' : 'Heading, e.g. “Enrich with”'}
                value={n.title}
                onChange={(e) => patchNote(n.key, { title: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder={n.kind === 'works' ? 'Why it works (one line)' : 'How it can be made stronger, e.g. “Can be made stronger by quantifying…”'}
                value={n.text}
                onChange={(e) => patchNote(n.key, { text: e.target.value })}
              />
              {n.kind === 'works' && (
                <input
                  className={inputClass}
                  placeholder="Use it: how to replicate this in your own answer"
                  value={n.use || ''}
                  onChange={(e) => patchNote(n.key, { use: e.target.value })}
                />
              )}
              {n.kind === 'addon' && (
                <input
                  className={inputClass}
                  placeholder="Diagram that could be drawn (optional), e.g. “Flowchart: A → B → C”"
                  value={n.diagram || ''}
                  onChange={(e) => patchNote(n.key, { diagram: e.target.value })}
                />
              )}
              {n.kind === 'addon' && (
                <textarea
                  className={inputClass}
                  rows={3}
                  placeholder="Examples / case laws / data / facts, one per line (max 3)"
                  value={(n.points || []).join('\n')}
                  onChange={(e) => patchNote(n.key, { points: e.target.value.split('\n').slice(0, 3) })}
                />
              )}
            </div>
          );
        })}

        <div className="rounded-lg border border-border-default bg-surface p-2 space-y-1.5">
          <p className="text-[11px] font-extrabold text-text-primary">Takeaways card</p>
          <label className="block text-[10px] font-bold text-text-tertiary uppercase">Techniques to copy (one per line)</label>
          <textarea className={inputClass} rows={3} value={tk.techniques} onChange={(e) => { setTk({ ...tk, techniques: e.target.value }); setDirty(true); }} />
          <label className="block text-[10px] font-bold text-text-tertiary uppercase">Enrichment bank (one per line)</label>
          <textarea className={inputClass} rows={3} value={tk.enrichment} onChange={(e) => { setTk({ ...tk, enrichment: e.target.value }); setDirty(true); }} />
          <label className="block text-[10px] font-bold text-text-tertiary uppercase">Keywords (comma separated)</label>
          <input className={inputClass} value={tk.keywords} onChange={(e) => { setTk({ ...tk, keywords: e.target.value }); setDirty(true); }} />
          <label className="block text-[10px] font-bold text-text-tertiary uppercase">Alternate introduction</label>
          <textarea className={inputClass} rows={3} value={tk.altIntro} onChange={(e) => { setTk({ ...tk, altIntro: e.target.value }); setDirty(true); }} />
          <input className={inputClass} placeholder="Its keywords / jargon (comma separated)" value={tk.altIntroKw} onChange={(e) => { setTk({ ...tk, altIntroKw: e.target.value }); setDirty(true); }} />
          <label className="block text-[10px] font-bold text-text-tertiary uppercase">Alternate conclusion</label>
          <textarea className={inputClass} rows={3} value={tk.altConclusion} onChange={(e) => { setTk({ ...tk, altConclusion: e.target.value }); setDirty(true); }} />
          <input className={inputClass} placeholder="Its keywords / jargon (comma separated)" value={tk.altConclusionKw} onChange={(e) => { setTk({ ...tk, altConclusionKw: e.target.value }); setDirty(true); }} />
        </div>
      </div>
    </div>
  );
}
