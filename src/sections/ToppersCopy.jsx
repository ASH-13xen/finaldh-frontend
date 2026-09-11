import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import PdfAnswerViewer from '../components/PdfAnswerViewer';
import AnswerDiagram from '../components/AnswerDiagram';
import PyqAnswerView from '../components/PyqAnswerView';
import { diagramIsRenderable } from '../lib/answerDiagram';

// ---------------------------------------------------------------------------
// Student-facing "Toppers Copy" section.
//   subject tabs -> full-width topic accordions -> clickable question rows
//     -> answer view: question text, a tab per topper who answered it, the
//        scanned answer (canvas PDF, jumped to that topper's pages), and the
//        per-question AI analysis.
//   A slide-in left drawer shows the current topic's related PYQs.
// "Seen" ticks are kept per-browser in localStorage (no cross-device sync).
// ---------------------------------------------------------------------------

const authedFetch = (url, opts = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
};

const SUBJECT_LABELS = {
  'GS-1': 'GS Paper 1',
  'GS-2': 'GS Paper 2',
  'GS-3': 'GS Paper 3',
  'GS-4': 'GS Paper 4 (Ethics)',
};
const subjectLabel = (s) =>
  SUBJECT_LABELS[s] || s.replace(/^OptionalSubject/, 'Optional: ').replace(/([a-z])([A-Z])/g, '$1 $2');

const topperLabel = (a) => `${a.name}${a.rank ? ` · AIR ${a.rank}` : ''}`;
const firstPage = (q) => q.answers?.[0]?.startPage || null;

// --- per-browser "seen" markers -------------------------------------------
const SEEN_KEY = 'tc_seen_v1';
const loadSeen = () => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { return {}; }
};
const persistSeen = (obj) => {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(obj)); } catch { /* private mode, ignore */ }
};

export default function ToppersCopy() {
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  const [activeSubject, setActiveSubject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // topic detail cache: { [topicId]: { toppersCopy, relatedPyqs } }
  const [details, setDetails] = useState({});
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState({});
  const [lastOpenedTopicId, setLastOpenedTopicId] = useState(null);

  const [activeTopicId, setActiveTopicId] = useState(null);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [activeAnswerIdx, setActiveAnswerIdx] = useState(0);

  const [pyqOpen, setPyqOpen] = useState(false);
  const [selectedPyqId, setSelectedPyqId] = useState(null);
  const [seen, setSeen] = useState(loadSeen);

  // Width (px) of the model-answer reading panel — drag its left edge to resize.
  const PYQ_ANSWER_W_KEY = 'tc_pyq_answer_w';
  const clampAnswerW = (w) => {
    const max = (typeof window !== 'undefined' ? window.innerWidth : 1280) - 384 - 24;
    return Math.max(380, Math.min(Math.max(380, max), w));
  };
  const [answerW, setAnswerW] = useState(() => {
    const v = parseFloat(readLS(PYQ_ANSWER_W_KEY, ''));
    return Number.isFinite(v) ? v : 560;
  });
  const answerDragRef = useRef(false);
  const [answerWide, setAnswerWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const on = () => setAnswerWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PYQ_ANSWER_W_KEY, String(answerW)); } catch { /* private mode */ }
  }, [answerW]);
  useEffect(() => {
    const onMove = (e) => {
      if (!answerDragRef.current) return;
      if (e.cancelable) e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      setAnswerW(clampAnswerW(window.innerWidth - cx));
    };
    const stop = () => { answerDragRef.current = false; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
    };
  }, []);

  const pdfPanelRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const token = localStorage.getItem('token');
  const inAnswerView = !!activeQuestionId;

  // Completion is explicit and reversible: the checkbox and the in-question
  // button both call this. Value is the owning topic id (legacy entries are
  // plain `true`, still truthy) so collapsed topics can still report progress.
  const toggleSeen = useCallback((id, topicId) => {
    setSeen((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = topicId || true;
      persistSeen(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === pdfPanelRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    const el = pdfPanelRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  // --- load subjects on mount ---
  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch('/api/toppers-copy/subjects');
        const data = await res.json();
        const list = data.subjects || [];
        setSubjects(list);
        if (list.length) setActiveSubject(list[0].subject);
      } catch (err) {
        console.error('subjects load failed', err);
      } finally {
        setLoadingSubjects(false);
      }
    })();
  }, []);

  // --- load topics when subject changes ---
  useEffect(() => {
    if (!activeSubject) return;
    setLoadingTopics(true);
    setTopics([]);
    setExpandedTopicIds({});
    setLastOpenedTopicId(null);
    setActiveTopicId(null);
    setActiveQuestionId(null);
    (async () => {
      try {
        const res = await authedFetch(`/api/toppers-copy/topics?subject=${encodeURIComponent(activeSubject)}`);
        const data = await res.json();
        const list = data.topics || [];
        setTopics(list);
        if (list.length) { setExpandedTopicIds({ [list[0]._id]: true }); setLastOpenedTopicId(list[0]._id); }
      } catch (err) {
        console.error('topics load failed', err);
      } finally {
        setLoadingTopics(false);
      }
    })();
  }, [activeSubject]);

  const loadDetail = useCallback(
    async (topicId, force = false) => {
      if (!topicId || (details[topicId] && !force)) return details[topicId];
      setLoadingDetailId(topicId);
      try {
        const res = await authedFetch(`/api/toppers-copy/${topicId}`);
        const data = await res.json();
        setDetails((d) => ({ ...d, [topicId]: data }));
        return data;
      } catch (err) {
        console.error('detail load failed', err);
        return null;
      } finally {
        setLoadingDetailId(null);
      }
    },
    [details]
  );

  // fetch detail for every expanded topic
  useEffect(() => {
    Object.keys(expandedTopicIds).forEach((id) => { if (expandedTopicIds[id]) loadDetail(id); });
  }, [expandedTopicIds, loadDetail]);

  const seenCountFor = useCallback(
    (topicId, questions) =>
      questions.length
        ? questions.filter((q) => seen[q._id]).length
        : Object.values(seen).filter((v) => v === topicId).length,
    [seen]
  );

  const overall = useMemo(() => {
    let done = 0;
    let total = 0;
    topics.forEach((t) => {
      const qs = details[t._id]?.toppersCopy?.questions || [];
      total += qs.length || t.questionCount || 0;
      done += seenCountFor(t._id, qs);
    });
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [topics, details, seenCountFor]);

  const toggleTopic = (id) => {
    const wasOpen = !!expandedTopicIds[id];
    setExpandedTopicIds((m) => ({ ...m, [id]: !m[id] }));
    if (!wasOpen) setLastOpenedTopicId(id); // opening → this topic drives the PYQ drawer
  };

  const openQuestion = async (topicId, questionId) => {
    // force-refresh: analysis may have been (re)generated since this topic was cached
    await loadDetail(topicId, true);
    setActiveTopicId(topicId);
    setActiveQuestionId(questionId);
    setActiveAnswerIdx(0);
    window.scrollTo({ top: 0 });
  };
  const backToBrowse = () => {
    setActiveQuestionId(null);
    if (document.fullscreenElement) document.exitFullscreen?.();
  };

  const activeDetail = activeTopicId ? details[activeTopicId] : null;
  const activeTc = activeDetail?.toppersCopy;
  const activeQuestion = useMemo(
    () => (activeTc?.questions || []).find((q) => q._id === activeQuestionId) || null,
    [activeTc, activeQuestionId]
  );
  const activeAnswer = activeQuestion?.answers?.[activeAnswerIdx] || null;

  const pdfUrl = useMemo(
    () => (activeTopicId ? `/api/toppers-copy/${activeTopicId}/pdf` : null),
    [activeTopicId]
  );

  // PYQ drawer content: the active topic (answer view) else the most recently
  // opened accordion (falling back to any open one).
  const openTopicIds = Object.keys(expandedTopicIds).filter((id) => expandedTopicIds[id]);
  const drawerTopicId = activeTopicId
    || (openTopicIds.includes(lastOpenedTopicId) ? lastOpenedTopicId : openTopicIds[openTopicIds.length - 1]);
  const drawerDetail = drawerTopicId ? details[drawerTopicId] : null;
  const drawerPyqs = drawerDetail?.relatedPyqs || [];
  const drawerTopicName = topics.find((t) => t._id === drawerTopicId)?.topic || '';
  // The PYQ whose model answer is open in the side panel — only valid while it is
  // in the current topic's list (so switching topics closes the panel).
  const selectedPyq = drawerPyqs.find((p) => p._id === selectedPyqId) || null;

  if (loadingSubjects) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-16 flex justify-center">
        <LoadingSpinner text="Loading Toppers Copy library..." />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold text-text-primary">Toppers Copy</h1>
        <p className="text-text-secondary text-base mt-3">
          No topper-copy content has been published yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ---- slide-in Related PYQs drawer ---- */}
      <div
        className={`fixed left-0 top-[73px] bottom-0 w-80 sm:w-96 z-40 bg-surface border-r border-border-default shadow-2xl flex flex-col transition-transform duration-300 ${
          pyqOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-border-default flex items-start justify-between flex-shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-text-primary text-base">Related PYQs</h3>
            <p className="text-[11px] text-text-tertiary font-medium mt-0.5 truncate">
              {drawerTopicName || 'Pick a topic'}
            </p>
          </div>
          <button
            onClick={() => setPyqOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-sunken text-text-secondary cursor-pointer text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <PyqList
            pyqs={drawerPyqs}
            selectedId={selectedPyqId}
            onOpen={(q) => setSelectedPyqId((cur) => (cur === q._id ? null : q._id))}
          />
        </div>
      </div>

      {/* ---- model-answer panel, sits right of the PYQ list ---- */}
      {pyqOpen && selectedPyq && (
        <>
          <div
            className="fixed inset-0 top-[73px] z-40 bg-black/30 sm:hidden"
            onClick={() => setSelectedPyqId(null)}
          />
          <div
            className="fixed top-[73px] bottom-0 right-0 left-0 sm:left-auto z-[45] w-full bg-surface border-l border-border-default shadow-2xl flex flex-col"
            style={answerWide ? { width: answerW } : undefined}
          >
            {answerWide && (
              <div
                onMouseDown={() => { answerDragRef.current = true; document.body.style.userSelect = 'none'; }}
                onTouchStart={() => { answerDragRef.current = true; }}
                className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize group z-10"
                title="Drag to resize"
              >
                <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-border-default group-hover:bg-brand transition-colors" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border-default group-hover:bg-brand" />
              </div>
            )}
            <div className="px-5 py-3.5 border-b border-border-default flex-shrink-0 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] font-bold text-text-on-accent bg-brand px-1.5 py-0.5 rounded">{selectedPyq.year}</span>
                  {selectedPyq.marks ? (
                    <span className="text-[11px] font-bold text-text-secondary bg-sunken px-1.5 py-0.5 rounded">{selectedPyq.marks} marks</span>
                  ) : null}
                  <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wide">Model answer</span>
                </div>
                <p className="font-reading text-sm font-semibold text-text-primary leading-snug">{selectedPyq.questionText}</p>
              </div>
              <button
                onClick={() => setSelectedPyqId(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-sunken text-text-secondary cursor-pointer text-lg leading-none flex-shrink-0"
                aria-label="Close model answer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <PyqAnswerView answer={selectedPyq.pyqAnswer} pyqId={selectedPyq._id} />
            </div>
          </div>
        </>
      )}

      {!pyqOpen && (
        <button
          onClick={() => setPyqOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-brand hover:bg-brand-hover text-text-on-accent text-[11px] font-extrabold px-2 py-4 rounded-r-xl shadow-xl cursor-pointer tracking-widest uppercase"
          style={{ writingMode: 'vertical-rl' }}
        >
          PYQs
        </button>
      )}

      {inAnswerView ? (
        <AnswerView
          activeTc={activeTc}
          activeQuestion={activeQuestion}
          activeAnswer={activeAnswer}
          activeAnswerIdx={activeAnswerIdx}
          setActiveAnswerIdx={setActiveAnswerIdx}
          loading={loadingDetailId === activeTopicId}
          pdfUrl={pdfUrl}
          token={token}
          pdfPanelRef={pdfPanelRef}
          isFullscreen={isFullscreen}
          toggleFullscreen={toggleFullscreen}
          isCompleted={!!seen[activeQuestionId]}
          onToggleCompleted={() => toggleSeen(activeQuestionId, activeTopicId)}
          onBack={backToBrowse}
        />
      ) : (
        <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-6">
          <h1 className="text-xl md:text-2xl font-extrabold text-text-primary tracking-tight">Toppers Copy</h1>
          <p className="text-text-secondary text-sm mt-1">
            Pick a paper, open a question — see how every topper answered it, plus an AI breakdown.
          </p>

          <div className="flex flex-wrap gap-2 mt-4 mb-6">
            {subjects.map((s) => (
              <button
                key={s.subject}
                onClick={() => setActiveSubject(s.subject)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer border ${
                  activeSubject === s.subject
                    ? 'bg-brand text-text-on-accent border-brand shadow-sm'
                    : 'bg-surface text-text-secondary border-border-default hover:bg-surface-raised'
                }`}
              >
                {subjectLabel(s.subject)}
                <span className="ml-1.5 opacity-70">({s.topicCount})</span>
              </button>
            ))}
          </div>

          {topics.length > 0 && overall.total > 0 && (
            <div className="mb-6 bg-surface border border-border-default rounded-2xl px-5 py-4">
              <div className="flex items-baseline justify-between gap-3 mb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Your progress</span>
                <span className="text-[11px] font-bold tabular-nums text-text-secondary">
                  {overall.done}/{overall.total} read
                  <span className="ml-1.5 text-text-tertiary">({overall.pct}%)</span>
                </span>
              </div>
              <ProgressBar value={overall.done} total={overall.total} />
            </div>
          )}

          {loadingTopics ? (
            <div className="py-16 flex justify-center"><LoadingSpinner text="Loading topics..." /></div>
          ) : topics.length === 0 ? (
            <div className="bg-surface border border-border-default rounded-2xl p-16 text-center text-text-tertiary text-base font-medium">
              No topics published for this paper yet.
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((t, ti) => {
                const isOpen = !!expandedTopicIds[t._id];
                const detail = details[t._id];
                const questions = detail?.toppersCopy?.questions || [];
                const total = questions.length || t.questionCount || 0;
                const seenCount = seenCountFor(t._id, questions);
                const done = total > 0 && seenCount === total;
                return (
                  <div
                    key={t._id}
                    className={`bg-surface border rounded-2xl overflow-hidden transition-colors ${
                      done ? 'border-brand' : seenCount > 0 ? 'border-brand/40' : 'border-border-default'
                    }`}
                  >
                    <button
                      onClick={() => toggleTopic(t._id)}
                      className="w-full px-5 py-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-sunken/40 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        {t.syllabusSection && (
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-0.5">
                            {t.syllabusSection}
                          </span>
                        )}
                        <h3 className="font-bold text-text-primary text-base leading-snug">
                          <span className="text-text-tertiary mr-1.5">{ti + 1})</span>
                          {t.topic}
                          {!t.published && (
                            <span className="ml-2 text-[11px] font-bold text-status-warning-text uppercase">draft</span>
                          )}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[11px] font-bold tabular-nums ${done ? 'text-brand' : 'text-text-tertiary'}`}>
                          {seenCount}/{total}
                        </span>
                        <span className={`text-text-tertiary text-sm transition-transform ${isOpen ? '' : '-rotate-90'}`}>▾</span>
                      </div>
                    </button>

                    {total > 0 && (
                      <div className="px-5 pb-3.5 -mt-0.5">
                        <ProgressBar value={seenCount} total={total} />
                      </div>
                    )}

                    {isOpen && (
                      <div className="border-t border-border-default divide-y divide-border-default">
                        {loadingDetailId === t._id && !detail ? (
                          <div className="px-5 py-6"><LoadingSpinner text="Loading questions..." /></div>
                        ) : questions.length === 0 ? (
                          <p className="px-5 py-6 text-sm text-text-tertiary italic">No questions in this topic yet.</p>
                        ) : (
                          questions.map((q, qi) => {
                            const pg = firstPage(q);
                            const isSeen = !!seen[q._id];
                            return (
                              <div
                                key={q._id}
                                className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-sunken/50 transition-colors group"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSeen(q._id, t._id)}
                                  aria-pressed={isSeen}
                                  title={isSeen ? 'Mark as not completed' : 'Mark as completed'}
                                  aria-label={`Q${qi + 1}: ${isSeen ? 'mark as not completed' : 'mark as completed'}`}
                                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 text-[11px] font-bold cursor-pointer transition-colors ${
                                    isSeen
                                      ? 'bg-brand border-brand text-text-on-accent hover:opacity-80'
                                      : 'border-border-default text-transparent hover:border-brand hover:text-text-tertiary'
                                  }`}
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openQuestion(t._id, q._id)}
                                  className="min-w-0 flex-1 text-left cursor-pointer"
                                >
                                  <span className={`block text-sm leading-relaxed font-medium ${isSeen ? 'text-text-tertiary' : 'text-text-primary'}`}>
                                    <span className="text-text-tertiary font-bold mr-1">Q{qi + 1}.</span>
                                    {q.questionText || <span className="italic text-text-tertiary">Untitled question</span>}
                                  </span>
                                  <span className="flex items-center gap-2 mt-1 flex-wrap text-[11px] font-semibold text-text-tertiary">
                                    {pg && <span className="tabular-nums">pg. {pg}</span>}
                                    <span>{q.answers?.length || 0} topper{(q.answers?.length || 0) === 1 ? '' : 's'}</span>
                                    {q.year ? <span>{q.year}</span> : null}
                                    {q.marks ? <span>{q.marks} marks</span> : null}
                                    {q.aiAnalysis ? <span className="text-brand">AI analysis</span> : null}
                                  </span>
                                </button>
                                <span className="text-text-tertiary text-sm mt-0.5 flex-shrink-0 group-hover:text-brand" aria-hidden="true">→</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

const TC_LAYOUT_KEY = 'tc_layout_v1';       // 'split' | 'stack' | 'hidden'
const TC_RATIO_KEY = 'tc_split_ratio_v1';   // PDF width fraction in split mode
const clampRatio = (r) => Math.min(0.8, Math.max(0.3, r));
const readLS = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v == null ? fallback : v; } catch { return fallback; }
};

function AnswerView({
  activeTc, activeQuestion, activeAnswer, activeAnswerIdx, setActiveAnswerIdx,
  loading, pdfUrl, token, pdfPanelRef, isFullscreen, toggleFullscreen, onBack,
  isCompleted, onToggleCompleted,
}) {
  const [layout, setLayout] = useState(() => readLS(TC_LAYOUT_KEY, 'split'));
  const [ratio, setRatio] = useState(() => clampRatio(parseFloat(readLS(TC_RATIO_KEY, '0.62')) || 0.62));
  const [isWide, setIsWide] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));
  const splitRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsWide(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => { try { localStorage.setItem(TC_LAYOUT_KEY, layout); } catch { /* private mode */ } }, [layout]);
  useEffect(() => { try { localStorage.setItem(TC_RATIO_KEY, String(ratio)); } catch { /* private mode */ } }, [ratio]);

  // Drag the divider (split mode, wide screens only).
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      setRatio(clampRatio(x / rect.width));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const startDrag = () => {
    draggingRef.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const sideBySide = isWide && layout === 'split';
  const showAnalysis = layout !== 'hidden';
  const pdfStyle = sideBySide ? { flexBasis: `${ratio * 100}%`, flexGrow: 0, flexShrink: 0 } : undefined;
  const analysisStyle = sideBySide ? { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0 } : undefined;

  const LayoutBtn = ({ mode, label, title }) => (
    <button
      onClick={() => setLayout(mode)}
      title={title}
      className={`px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap border cursor-pointer transition-colors ${
        layout === mode
          ? 'bg-brand text-text-on-accent border-brand'
          : 'bg-surface text-text-secondary border-border-default hover:bg-surface-raised'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 md:px-6 py-4 h-[calc(100vh-73px)] flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <button
          onClick={onBack}
          className="text-sm font-bold text-text-secondary hover:text-text-primary cursor-pointer flex items-center gap-1"
        >
          ← Back to questions
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleCompleted}
            aria-pressed={isCompleted}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
              isCompleted
                ? 'bg-brand border-brand text-text-on-accent hover:opacity-90'
                : 'bg-surface border-border-default text-text-secondary hover:border-brand hover:text-text-primary'
            }`}
          >
            <span aria-hidden="true">{isCompleted ? '✓' : '○'}</span>
            <span className="hidden sm:inline">{isCompleted ? 'Completed' : 'Mark as completed'}</span>
          </button>
          <span className="w-px h-5 bg-border-default mx-1 hidden sm:block" aria-hidden="true" />
          <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider hidden sm:inline">Layout</span>
          {isWide && <LayoutBtn mode="split" label="⇄ Side by side" title="Resizable split — drag the divider" />}
          <LayoutBtn mode="stack" label="≡ Stacked" title="Analysis below the answer sheet" />
          <LayoutBtn mode="hidden" label="✕ Hide analysis" title="Answer sheet only" />
        </div>
      </div>

      <div
        ref={splitRef}
        className={`flex-grow flex min-h-0 overflow-hidden ${sideBySide ? 'flex-row' : 'flex-col gap-4'}`}
      >
        {/* PDF + question header */}
        <div
          ref={pdfPanelRef}
          style={pdfStyle}
          className="flex-grow flex flex-col min-h-0 bg-surface border border-border-default rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border-default bg-surface-raised flex-shrink-0">
            <p className="text-sm font-bold text-text-primary leading-snug">
              {activeQuestion?.questionText || 'Untitled question'}
            </p>
            <p className="text-[11px] text-text-tertiary mt-1">
              {activeTc?.topic}
              {activeQuestion?.year ? ` · ${activeQuestion.year}` : ''}
              {activeQuestion?.marks ? ` · ${activeQuestion.marks} marks` : ''}
            </p>
            {activeAnswer?.curatorNote ? (
              <p className="text-[11px] text-brand italic mt-1">
                {topperLabel(activeAnswer)} — {activeAnswer.curatorNote}
              </p>
            ) : null}
          </div>
          <div className="px-4 py-2 border-b border-border-default bg-surface flex items-center gap-2 flex-shrink-0 overflow-x-auto">
            <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex-shrink-0">Toppers</span>
            <div className="flex gap-1.5">
              {(activeQuestion?.answers || []).map((a, i) => (
                <button
                  key={i}
                  onClick={() => setActiveAnswerIdx(i)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    i === activeAnswerIdx
                      ? 'bg-brand text-text-on-accent border-brand'
                      : 'bg-surface text-text-secondary border-border-default hover:bg-surface-raised'
                  }`}
                  title={`Pages ${a.startPage}-${a.endPage}${a.marks ? ` · ${a.marks} marks` : ''}`}
                >
                  {topperLabel(a)}
                  <span className="ml-1 opacity-60 font-semibold">· p{a.startPage}</span>
                </button>
              ))}
            </div>
            {activeAnswer && (
              <button
                onClick={toggleFullscreen}
                className="ml-auto flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap bg-surface text-text-secondary border border-border-default hover:bg-surface-raised cursor-pointer"
                title="Toggle full screen (Esc to exit)"
              >
                {isFullscreen ? '✕ Exit full screen' : '⛶ Full screen'}
              </button>
            )}
          </div>
          <div className="flex-grow bg-sunken relative min-h-[300px]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <LoadingSpinner text="Loading copy..." />
              </div>
            ) : activeAnswer && pdfUrl ? (
              <PdfAnswerViewer
                key={`${pdfUrl}-${activeQuestion?._id}-${activeAnswerIdx}`}
                fileUrl={pdfUrl}
                token={token}
                startPage={activeAnswer.startPage}
                endPage={activeAnswer.endPage}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-sm">
                This question has no answer copy attached.
              </div>
            )}
          </div>
        </div>

        {/* draggable divider — split mode, wide screens */}
        {sideBySide && showAnalysis && (
          <div
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            title="Drag to resize"
            className="group flex-shrink-0 w-3 mx-0.5 cursor-col-resize flex items-center justify-center"
          >
            <div className="w-1 h-10 rounded-full bg-border-default group-hover:bg-brand transition-colors" />
          </div>
        )}

        {/* AI analysis */}
        {showAnalysis && (
          <div
            style={analysisStyle}
            className={`flex flex-col min-h-0 bg-surface border border-border-default rounded-2xl overflow-hidden ${
              sideBySide ? '' : 'flex-1 lg:flex-none lg:h-72'
            }`}
          >
            <div className="px-4 py-2.5 border-b border-border-default bg-surface-raised flex-shrink-0">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wide">AI Analysis</span>
            </div>
            <div className="flex-grow overflow-y-auto p-4">
              <AnalysisView analysis={activeQuestion?.aiAnalysis} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value, total, className = '' }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div
      className={`h-1.5 w-full bg-sunken rounded-full overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${value} of ${total} questions read`}
    >
      <div
        className="h-full bg-brand rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PyqCard({ q, selected, onOpen }) {
  const hasAnswer = !!q.pyqAnswer;
  return (
    <div className={`p-3 border rounded-xl transition-colors ${selected ? 'bg-surface border-brand' : 'bg-sunken border-border-default'}`}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[11px] font-bold text-text-on-accent bg-brand px-1.5 py-0.5 rounded">{q.year}</span>
        {q.marks ? (
          <span className="text-[11px] font-bold text-text-secondary bg-surface px-1.5 py-0.5 rounded">{q.marks} marks</span>
        ) : null}
        {q.topic || q.microtheme ? (
          <span className="text-[11px] font-semibold text-text-tertiary uppercase truncate">{q.topic || q.microtheme}</span>
        ) : null}
        {q.pyqAnswerStatus === 'draft' ? (
          <span className="text-[11px] font-bold text-status-warning-text bg-status-warning-bg px-1.5 py-0.5 rounded">answer draft</span>
        ) : null}
      </div>
      <p className="font-reading text-sm text-text-primary leading-relaxed font-medium">{q.questionText}</p>

      {hasAnswer && (
        <button
          className="mt-2 text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1 cursor-pointer"
          onClick={() => onOpen(q)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
            className={`w-3 h-3 transition-transform ${selected ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6" /></svg>
          {selected ? 'Model answer open' : 'Show model answer'}
        </button>
      )}
    </div>
  );
}

function PyqList({ pyqs, selectedId, onOpen }) {
  if (!pyqs.length) {
    return <p className="text-sm text-text-tertiary italic">No related previous-year questions for this topic.</p>;
  }
  const byYear = [...pyqs].sort((a, b) => (b.year || 0) - (a.year || 0));
  return (
    <div className="space-y-2.5">
      {byYear.map((q, i) => (
        <PyqCard key={q._id || i} q={q} selected={!!q._id && q._id === selectedId} onOpen={onOpen} />
      ))}
    </div>
  );
}

function AnalysisSection({ title, children }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">{title}</h4>
      {children}
    </div>
  );
}

const TYPE_COLORS = {
  definition: 'bg-accent-soft-bg text-brand border-accent-soft-border',
  context: 'bg-surface-raised text-text-secondary border-border-default',
  data: 'bg-status-info-bg text-status-info-text border-status-info-text/25',
  quote: 'bg-status-warning-bg text-status-warning-text border-status-warning-text/25',
  anecdote: 'bg-surface-raised text-text-secondary border-border-default',
  summary: 'bg-surface-raised text-text-secondary border-border-default',
  wayforward: 'bg-accent-soft-bg text-brand border-accent-soft-border',
  balanced: 'bg-status-info-bg text-status-info-text border-status-info-text/25',
};
const TypeChip = ({ type }) =>
  type ? (
    <span className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 border ${TYPE_COLORS[type.toLowerCase()] || TYPE_COLORS.context}`}>
      {type}
    </span>
  ) : null;

function ExcerptCard({ item }) {
  return (
    <div className="p-3 bg-sunken border border-border-default rounded-xl space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <TypeChip type={item.type} />
        {item.wordCount ? <span className="text-[11px] text-text-tertiary font-semibold">{item.wordCount} words</span> : null}
      </div>
      <p className="font-reading text-sm text-text-primary leading-relaxed">{item.text}</p>
      <p className="text-[11px] text-text-tertiary font-semibold">— {item.topper || 'topper'}</p>
      {item.curatorNote ? (
        <p className="text-[11px] text-brand italic">Why we picked it: {item.curatorNote}</p>
      ) : null}
    </div>
  );
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const PRIORITY_CHIP = {
  high: 'bg-status-danger-bg text-status-danger-text border-status-danger-text/25',
  medium: 'bg-status-warning-bg text-status-warning-text border-status-warning-text/25',
  low: 'bg-surface-raised text-text-secondary border-border-default',
};

function KeywordChips({ items }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((k, i) => (
        <span key={i} className="text-[11px] font-semibold text-text-secondary bg-surface-raised border border-border-default px-2 py-0.5 rounded-full">{k}</span>
      ))}
    </div>
  );
}

const WordBadge = ({ n }) =>
  n ? <span className="text-[11px] text-text-tertiary font-semibold">{n} words</span> : null;

// Current three-block analysis: a fresh model answer, fixes for the actual copy,
// and transferable learnings.
function ModelAnswerView({ analysis }) {
  const Section = AnalysisSection;
  const ma = analysis.modelAnswer || {};
  const improvements = [...(analysis.answerImprovements || [])].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1)
  );

  return (
    <div className="space-y-5">
      <Section title={`Model Answer${ma.totalWordCount ? ` · ~${ma.totalWordCount} words` : ''}`}>
        <div className="space-y-3">
          {ma.introduction?.text && (
            <div className="p-3 bg-sunken border border-border-default rounded-xl space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-brand">Introduction</span>
                <WordBadge n={ma.introduction.wordCount} />
              </div>
              <p className="font-reading text-sm text-text-primary leading-relaxed">{ma.introduction.text}</p>
              <KeywordChips items={ma.introduction.keywords} />
            </div>
          )}

          {(ma.body || []).map((part, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-sm font-bold text-text-primary">
                <span className="text-text-tertiary">Body {i + 1} — </span>{part.part}
              </p>
              <ul className="space-y-2 mt-1">
                {(part.points || []).map((p, j) => (
                  <li key={j} className="font-reading text-sm text-text-primary leading-relaxed flex gap-1.5">
                    <span className="text-text-tertiary font-bold flex-shrink-0">•</span>
                    <span>
                      {p.text}
                      {p.tag ? <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-text-tertiary">[{p.tag}]</span> : null}
                      {p.unconventionalBecause ? (
                        <span className="block text-[11px] text-text-tertiary italic mt-0.5">Why it stands out: {p.unconventionalBecause}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {ma.wayForward?.text && (
            <div className="p-3 bg-accent-soft-bg border border-accent-soft-border rounded-xl space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-brand">Way Forward</span>
                <WordBadge n={ma.wayForward.wordCount} />
              </div>
              <p className="font-reading text-sm text-text-primary leading-relaxed">{ma.wayForward.text}</p>
              {ma.wayForward.sources?.length ? (
                <p className="text-[11px] text-text-tertiary font-semibold">Sources: {ma.wayForward.sources.join(' · ')}</p>
              ) : null}
            </div>
          )}

          {ma.conclusion?.text && (
            <div className="p-3 bg-sunken border border-border-default rounded-xl space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-brand">Conclusion</span>
                <WordBadge n={ma.conclusion.wordCount} />
              </div>
              <p className="font-reading text-sm text-text-primary leading-relaxed">{ma.conclusion.text}</p>
              {ma.conclusion.quote ? (
                <p className="text-[11px] text-brand italic border-l-2 border-brand/40 pl-2">{ma.conclusion.quote}</p>
              ) : null}
            </div>
          )}
        </div>
      </Section>

      {(diagramIsRenderable(analysis.diagram) || analysis.diagram?.howToDraw || analysis.diagram?.mermaid) && (
        <Section title={analysis.diagram.title ? `Diagram — ${analysis.diagram.title}` : 'Diagram'}>
          <div className="p-3 bg-sunken border border-border-default rounded-xl space-y-2.5">
            {diagramIsRenderable(analysis.diagram) ? (
              <div className="bg-surface border border-border-default rounded-lg p-2.5">
                <AnswerDiagram diagram={analysis.diagram} />
              </div>
            ) : null}
            {analysis.diagram.howToDraw && (
              <p className="font-reading text-sm text-text-primary leading-relaxed">{analysis.diagram.howToDraw}</p>
            )}
            <KeywordChips items={analysis.diagram.keywords} />
            {!diagramIsRenderable(analysis.diagram) && analysis.diagram.mermaid && (
              <pre className="text-[11px] bg-surface border border-border-default rounded-lg p-2 overflow-x-auto text-text-secondary whitespace-pre">
{analysis.diagram.mermaid}
              </pre>
            )}
          </div>
        </Section>
      )}

      {improvements.length > 0 && (
        <Section title="Improve the Actual Answer">
          <div className="space-y-2">
            {improvements.map((it, i) => (
              <div key={i} className="p-3 bg-sunken border border-border-default rounded-xl space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {it.priority ? (
                    <span className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 border ${PRIORITY_CHIP[it.priority] || PRIORITY_CHIP.low}`}>{it.priority}</span>
                  ) : null}
                  {it.area ? <span className="text-[11px] text-text-tertiary font-semibold uppercase tracking-wide">{it.area}</span> : null}
                </div>
                {it.observation && <p className="font-reading text-sm text-text-secondary leading-relaxed">{it.observation}</p>}
                {it.fix && <p className="font-reading text-sm text-text-primary leading-relaxed"><span className="font-bold text-brand">Fix: </span>{it.fix}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {analysis.learnings?.length > 0 && (
        <Section title="What to Learn From This Answer">
          <div className="space-y-2">
            {analysis.learnings.map((l, i) => (
              <div key={i} className="space-y-0.5">
                <p className="font-reading text-sm text-text-primary leading-relaxed flex gap-1.5">
                  <span className="text-text-tertiary font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{l.lesson}</span>
                </p>
                {(l.seenIn || l.applyElsewhere) && (
                  <p className="text-[11px] text-text-tertiary italic pl-4">
                    {l.seenIn ? `Seen in: ${l.seenIn}. ` : ''}{l.applyElsewhere ? `Use it on: ${l.applyElsewhere}.` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {analysis.keywords?.length > 0 && (
        <Section title="Keyword Bank">
          <KeywordChips items={analysis.keywords} />
        </Section>
      )}

      <p className="text-[11px] text-text-tertiary pt-2 border-t border-border-default">
        Generated {new Date(analysis.generatedAt).toLocaleDateString()} · {analysis.aiModel || 'AI'}
      </p>
    </div>
  );
}

function AnalysisView({ analysis }) {
  if (!analysis || !analysis.generatedAt) {
    return <p className="text-sm text-text-tertiary italic">AI analysis has not been generated for this question yet.</p>;
  }
  const Section = AnalysisSection;

  const hasModelAnswer = !!(
    analysis.modelAnswer?.introduction?.text ||
    analysis.modelAnswer?.body?.length ||
    analysis.answerImprovements?.length ||
    analysis.learnings?.length
  );
  if (hasModelAnswer) return <ModelAnswerView analysis={analysis} />;

  const isNew = analysis.modelSkeleton || analysis.intros?.length || analysis.bodyThemes?.length;

  if (!isNew) {
    // legacy flat analysis
    return (
      <div className="space-y-4">
        {typeof analysis.modelAnswer === 'string' && analysis.modelAnswer && (
          <Section title="Model Answer">
            <p className="font-reading text-sm text-text-primary leading-relaxed whitespace-pre-line">{analysis.modelAnswer}</p>
          </Section>
        )}
        {analysis.keywords?.length > 0 && (
          <Section title="Keywords">
            <div className="flex flex-wrap gap-1.5">
              {analysis.keywords.map((k, i) => (
                <span key={i} className="text-[11px] font-semibold text-text-secondary bg-surface-raised border border-border-default px-2 py-0.5 rounded-full">{k}</span>
              ))}
            </div>
          </Section>
        )}
        {analysis.commonStructure && (
          <Section title="How Toppers Structure It"><p className="font-reading text-sm text-text-primary leading-relaxed">{analysis.commonStructure}</p></Section>
        )}
        {analysis.whatToppersDidWell?.length > 0 && (
          <Section title="What Toppers Did Well">
            <ul className="font-reading list-disc list-inside space-y-1 text-sm text-text-primary leading-relaxed">
              {analysis.whatToppersDidWell.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </Section>
        )}
        {analysis.valueAddition?.length > 0 && (
          <Section title="Value Addition">
            <ul className="font-reading list-disc list-inside space-y-1 text-sm text-text-primary leading-relaxed">
              {analysis.valueAddition.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </Section>
        )}
        <p className="text-[11px] text-text-tertiary pt-2 border-t border-border-default">
          Generated {new Date(analysis.generatedAt).toLocaleDateString()} · {analysis.aiModel || 'AI'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {analysis.modelSkeleton && (
        <Section title="Model Skeleton">
          <p className="font-reading text-sm text-text-primary leading-relaxed whitespace-pre-line">{analysis.modelSkeleton}</p>
        </Section>
      )}

      {analysis.intros?.length > 0 && (
        <Section title={`Intro Bank (${analysis.intros.length})`}>
          <div className="space-y-2">
            {analysis.intros.map((it, i) => <ExcerptCard key={i} item={it} />)}
          </div>
        </Section>
      )}

      {analysis.bodyThemes?.length > 0 && (
        <Section title="Body — Themes">
          <div className="space-y-3">
            {analysis.bodyThemes.map((t, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-sm font-bold text-text-primary">{t.title}</p>
                {t.gloss && <p className="text-[11px] text-text-tertiary italic">{t.gloss}</p>}
                <ol className="space-y-1.5 mt-1">
                  {t.points.map((p, j) => (
                    <li key={j} className="font-reading text-sm text-text-primary leading-relaxed flex gap-1.5">
                      <span className="text-text-tertiary font-bold flex-shrink-0">{j + 1}.</span>
                      <span>
                        {p.text}
                        {p.example ? <span className="text-text-secondary"> — e.g. {p.example}</span> : null}
                        {p.toppers?.length ? (
                          <span className="text-[11px] text-text-tertiary font-semibold"> [{p.toppers.join(', ')}]</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Section>
      )}

      {analysis.conclusions?.length > 0 && (
        <Section title={`Conclusion Bank (${analysis.conclusions.length})`}>
          <div className="space-y-2">
            {analysis.conclusions.map((it, i) => <ExcerptCard key={i} item={it} />)}
          </div>
        </Section>
      )}

      {analysis.diagrams?.length > 0 && (
        <Section title="Diagrams">
          <div className="space-y-2.5">
            {analysis.diagrams.map((d, i) => (
              <div key={i} className="p-3 bg-sunken border border-border-default rounded-xl space-y-1.5">
                <p className="text-[11px] text-text-tertiary font-semibold">{d.topper || 'topper'}</p>
                {d.description && <p className="font-reading text-sm text-text-primary leading-relaxed">{d.description}</p>}
                {d.mermaid && (
                  <pre className="text-[11px] bg-surface border border-border-default rounded-lg p-2 overflow-x-auto text-text-secondary whitespace-pre">
{d.mermaid}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {analysis.keywords?.length > 0 && (
        <Section title="Keyword Bank">
          <div className="flex flex-wrap gap-1.5">
            {analysis.keywords.map((k, i) => (
              <span key={i} className="text-[11px] font-semibold text-text-secondary bg-surface-raised border border-border-default px-2 py-0.5 rounded-full">{k}</span>
            ))}
          </div>
        </Section>
      )}

      {analysis.techniques?.length > 0 && (
        <Section title="Transferable Techniques">
          <ul className="font-reading list-disc list-inside space-y-1 text-sm text-text-primary leading-relaxed">
            {analysis.techniques.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </Section>
      )}

      <p className="text-[11px] text-text-tertiary pt-2 border-t border-border-default">
        Generated {new Date(analysis.generatedAt).toLocaleDateString()} · {analysis.aiModel || 'AI'}
      </p>
    </div>
  );
}
