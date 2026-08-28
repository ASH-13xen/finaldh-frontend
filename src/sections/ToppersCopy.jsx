import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import PdfAnswerViewer from '../components/PdfAnswerViewer';

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

  const [activeTopicId, setActiveTopicId] = useState(null);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [activeAnswerIdx, setActiveAnswerIdx] = useState(0);

  const [pyqOpen, setPyqOpen] = useState(false);
  const [seen, setSeen] = useState(loadSeen);

  const pdfPanelRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const token = localStorage.getItem('token');
  const inAnswerView = !!activeQuestionId;

  const markSeen = useCallback((id) => {
    setSeen((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: true };
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
    setActiveTopicId(null);
    setActiveQuestionId(null);
    (async () => {
      try {
        const res = await authedFetch(`/api/toppers-copy/topics?subject=${encodeURIComponent(activeSubject)}`);
        const data = await res.json();
        const list = data.topics || [];
        setTopics(list);
        if (list.length) setExpandedTopicIds({ [list[0]._id]: true });
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

  const toggleTopic = (id) => setExpandedTopicIds((m) => ({ ...m, [id]: !m[id] }));

  const openQuestion = async (topicId, questionId) => {
    // force-refresh: analysis may have been (re)generated since this topic was cached
    await loadDetail(topicId, true);
    setActiveTopicId(topicId);
    setActiveQuestionId(questionId);
    setActiveAnswerIdx(0);
    markSeen(questionId);
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

  // PYQ drawer content: the active topic (answer view) or the first expanded one.
  const drawerTopicId = activeTopicId || Object.keys(expandedTopicIds).find((id) => expandedTopicIds[id]);
  const drawerDetail = drawerTopicId ? details[drawerTopicId] : null;
  const drawerPyqs = drawerDetail?.relatedPyqs || [];
  const drawerTopicName = topics.find((t) => t._id === drawerTopicId)?.topic || '';

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
        <p className="text-text-secondary text-sm mt-3">
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
            <h3 className="font-bold text-text-primary text-sm">Related PYQs</h3>
            <p className="text-[10px] text-text-tertiary font-medium mt-0.5 truncate">
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
          <PyqList pyqs={drawerPyqs} />
        </div>
      </div>
      {!pyqOpen && (
        <button
          onClick={() => setPyqOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-brand hover:bg-brand-hover text-text-on-accent text-[9px] font-extrabold px-2 py-4 rounded-r-xl shadow-xl cursor-pointer tracking-widest uppercase"
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
          onBack={backToBrowse}
        />
      ) : (
        <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-6">
          <h1 className="text-xl md:text-2xl font-extrabold text-text-primary tracking-tight">Toppers Copy</h1>
          <p className="text-text-secondary text-xs mt-1">
            Pick a paper, open a question — see how every topper answered it, plus an AI breakdown.
          </p>

          <div className="flex flex-wrap gap-2 mt-4 mb-6">
            {subjects.map((s) => (
              <button
                key={s.subject}
                onClick={() => setActiveSubject(s.subject)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
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

          {loadingTopics ? (
            <div className="py-16 flex justify-center"><LoadingSpinner text="Loading topics..." /></div>
          ) : topics.length === 0 ? (
            <div className="bg-surface border border-border-default rounded-2xl p-16 text-center text-text-tertiary text-sm font-medium">
              No topics published for this paper yet.
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((t, ti) => {
                const isOpen = !!expandedTopicIds[t._id];
                const detail = details[t._id];
                const questions = detail?.toppersCopy?.questions || [];
                const total = questions.length || t.questionCount || 0;
                const seenCount = questions.filter((q) => seen[q._id]).length;
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
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-0.5">
                            {t.syllabusSection}
                          </span>
                        )}
                        <h3 className="font-bold text-text-primary text-sm leading-snug">
                          <span className="text-text-tertiary mr-1.5">{ti + 1})</span>
                          {t.topic}
                          {!t.published && (
                            <span className="ml-2 text-[9px] font-bold text-status-warning-text uppercase">draft</span>
                          )}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-bold tabular-nums ${done ? 'text-brand' : 'text-text-tertiary'}`}>
                          {seenCount}/{total}
                        </span>
                        <span className={`text-text-tertiary text-xs transition-transform ${isOpen ? '' : '-rotate-90'}`}>▾</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border-default divide-y divide-border-default">
                        {loadingDetailId === t._id && !detail ? (
                          <div className="px-5 py-6"><LoadingSpinner text="Loading questions..." /></div>
                        ) : questions.length === 0 ? (
                          <p className="px-5 py-6 text-xs text-text-tertiary italic">No questions in this topic yet.</p>
                        ) : (
                          questions.map((q, qi) => {
                            const pg = firstPage(q);
                            const isSeen = !!seen[q._id];
                            return (
                              <button
                                key={q._id}
                                onClick={() => openQuestion(t._id, q._id)}
                                className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-sunken/50 transition-colors cursor-pointer group"
                              >
                                <span
                                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                                    isSeen ? 'bg-brand border-brand text-text-on-accent' : 'border-border-default text-transparent group-hover:border-brand'
                                  }`}
                                >
                                  ✓
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className={`block text-[13px] leading-relaxed font-medium ${isSeen ? 'text-text-tertiary' : 'text-text-primary'}`}>
                                    <span className="text-text-tertiary font-bold mr-1">Q{qi + 1}.</span>
                                    {q.questionText || <span className="italic text-text-tertiary">Untitled question</span>}
                                  </span>
                                  <span className="flex items-center gap-2 mt-1 flex-wrap text-[10px] font-semibold text-text-tertiary">
                                    {pg && <span className="tabular-nums">pg. {pg}</span>}
                                    <span>{q.answers?.length || 0} topper{(q.answers?.length || 0) === 1 ? '' : 's'}</span>
                                    {q.year ? <span>{q.year}</span> : null}
                                    {q.marks ? <span>{q.marks} marks</span> : null}
                                    {q.aiAnalysis ? <span className="text-brand">AI analysis</span> : null}
                                  </span>
                                </span>
                                <span className="text-text-tertiary text-xs mt-0.5 flex-shrink-0 group-hover:text-brand">→</span>
                              </button>
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

function AnswerView({
  activeTc, activeQuestion, activeAnswer, activeAnswerIdx, setActiveAnswerIdx,
  loading, pdfUrl, token, pdfPanelRef, isFullscreen, toggleFullscreen, onBack,
}) {
  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 md:px-6 py-4 h-[calc(100vh-73px)] flex flex-col">
      <button
        onClick={onBack}
        className="self-start mb-3 text-xs font-bold text-text-secondary hover:text-text-primary cursor-pointer flex items-center gap-1"
      >
        ← Back to questions
      </button>

      <div className="flex-grow flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
        {/* PDF + question header */}
        <div ref={pdfPanelRef} className="flex-grow flex flex-col min-h-0 bg-surface border border-border-default rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default bg-surface-raised flex-shrink-0">
            <p className="text-xs font-bold text-text-primary leading-snug">
              {activeQuestion?.questionText || 'Untitled question'}
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">
              {activeTc?.topic}
              {activeQuestion?.year ? ` · ${activeQuestion.year}` : ''}
              {activeQuestion?.marks ? ` · ${activeQuestion.marks} marks` : ''}
            </p>
            {activeAnswer?.curatorNote ? (
              <p className="text-[10px] text-brand italic mt-1">
                {topperLabel(activeAnswer)} — {activeAnswer.curatorNote}
              </p>
            ) : null}
          </div>
          <div className="px-4 py-2 border-b border-border-default bg-surface flex items-center gap-2 flex-shrink-0 overflow-x-auto">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex-shrink-0">Toppers</span>
            <div className="flex gap-1.5">
              {(activeQuestion?.answers || []).map((a, i) => (
                <button
                  key={i}
                  onClick={() => setActiveAnswerIdx(i)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
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
                className="ml-auto flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap bg-surface text-text-secondary border border-border-default hover:bg-surface-raised cursor-pointer"
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
              <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-xs">
                This question has no answer copy attached.
              </div>
            )}
          </div>
        </div>

        {/* AI analysis */}
        <div className="lg:w-96 flex-shrink-0 flex flex-col min-h-0 bg-surface border border-border-default rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border-default bg-surface-raised flex-shrink-0">
            <span className="text-[11px] font-bold text-text-primary uppercase tracking-wide">AI Analysis</span>
          </div>
          <div className="flex-grow overflow-y-auto p-4">
            <AnalysisView analysis={activeQuestion?.aiAnalysis} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PyqList({ pyqs }) {
  if (!pyqs.length) {
    return <p className="text-xs text-text-tertiary italic">No related previous-year questions for this topic.</p>;
  }
  const byYear = [...pyqs].sort((a, b) => (b.year || 0) - (a.year || 0));
  return (
    <div className="space-y-2.5">
      {byYear.map((q, i) => (
        <div key={i} className="p-3 bg-sunken border border-border-default rounded-xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] font-bold text-text-on-accent bg-brand px-1.5 py-0.5 rounded">{q.year}</span>
            {q.marks ? (
              <span className="text-[9px] font-bold text-text-secondary bg-surface px-1.5 py-0.5 rounded">{q.marks} marks</span>
            ) : null}
            {q.topic || q.microtheme ? (
              <span className="text-[9px] font-semibold text-text-tertiary uppercase truncate">{q.topic || q.microtheme}</span>
            ) : null}
          </div>
          <p className="text-xs text-text-primary leading-relaxed font-medium">{q.questionText}</p>
        </div>
      ))}
    </div>
  );
}

function AnalysisSection({ title, children }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">{title}</h4>
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
    <span className={`text-[8px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 border ${TYPE_COLORS[type.toLowerCase()] || TYPE_COLORS.context}`}>
      {type}
    </span>
  ) : null;

function ExcerptCard({ item }) {
  return (
    <div className="p-3 bg-sunken border border-border-default rounded-xl space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <TypeChip type={item.type} />
        {item.wordCount ? <span className="text-[9px] text-text-tertiary font-semibold">{item.wordCount} words</span> : null}
      </div>
      <p className="text-xs text-text-primary leading-relaxed">{item.text}</p>
      <p className="text-[10px] text-text-tertiary font-semibold">— {item.topper || 'topper'}</p>
      {item.curatorNote ? (
        <p className="text-[10px] text-brand italic">Why we picked it: {item.curatorNote}</p>
      ) : null}
    </div>
  );
}

function AnalysisView({ analysis }) {
  if (!analysis || !analysis.generatedAt) {
    return <p className="text-xs text-text-tertiary italic">AI analysis has not been generated for this question yet.</p>;
  }
  const Section = AnalysisSection;
  const isNew = analysis.modelSkeleton || analysis.intros?.length || analysis.bodyThemes?.length;

  if (!isNew) {
    // legacy flat analysis
    return (
      <div className="space-y-4">
        {analysis.modelAnswer && (
          <Section title="Model Answer">
            <p className="text-xs text-text-primary leading-relaxed whitespace-pre-line">{analysis.modelAnswer}</p>
          </Section>
        )}
        {analysis.keywords?.length > 0 && (
          <Section title="Keywords">
            <div className="flex flex-wrap gap-1.5">
              {analysis.keywords.map((k, i) => (
                <span key={i} className="text-[10px] font-semibold text-text-secondary bg-surface-raised border border-border-default px-2 py-0.5 rounded-full">{k}</span>
              ))}
            </div>
          </Section>
        )}
        {analysis.commonStructure && (
          <Section title="How Toppers Structure It"><p className="text-xs text-text-primary leading-relaxed">{analysis.commonStructure}</p></Section>
        )}
        {analysis.whatToppersDidWell?.length > 0 && (
          <Section title="What Toppers Did Well">
            <ul className="list-disc list-inside space-y-1 text-xs text-text-primary leading-relaxed">
              {analysis.whatToppersDidWell.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </Section>
        )}
        {analysis.valueAddition?.length > 0 && (
          <Section title="Value Addition">
            <ul className="list-disc list-inside space-y-1 text-xs text-text-primary leading-relaxed">
              {analysis.valueAddition.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </Section>
        )}
        <p className="text-[9px] text-text-tertiary pt-2 border-t border-border-default">
          Generated {new Date(analysis.generatedAt).toLocaleDateString()} · {analysis.aiModel || 'AI'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {analysis.modelSkeleton && (
        <Section title="Model Skeleton">
          <p className="text-xs text-text-primary leading-relaxed whitespace-pre-line">{analysis.modelSkeleton}</p>
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
                <p className="text-xs font-bold text-text-primary">{t.title}</p>
                {t.gloss && <p className="text-[10px] text-text-tertiary italic">{t.gloss}</p>}
                <ol className="space-y-1.5 mt-1">
                  {t.points.map((p, j) => (
                    <li key={j} className="text-xs text-text-primary leading-relaxed flex gap-1.5">
                      <span className="text-text-tertiary font-bold flex-shrink-0">{j + 1}.</span>
                      <span>
                        {p.text}
                        {p.example ? <span className="text-text-secondary"> — e.g. {p.example}</span> : null}
                        {p.toppers?.length ? (
                          <span className="text-[9px] text-text-tertiary font-semibold"> [{p.toppers.join(', ')}]</span>
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
                <p className="text-[10px] text-text-tertiary font-semibold">{d.topper || 'topper'}</p>
                {d.description && <p className="text-xs text-text-primary leading-relaxed">{d.description}</p>}
                {d.mermaid && (
                  <pre className="text-[10px] bg-surface border border-border-default rounded-lg p-2 overflow-x-auto text-text-secondary whitespace-pre">
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
              <span key={i} className="text-[10px] font-semibold text-text-secondary bg-surface-raised border border-border-default px-2 py-0.5 rounded-full">{k}</span>
            ))}
          </div>
        </Section>
      )}

      {analysis.techniques?.length > 0 && (
        <Section title="Transferable Techniques">
          <ul className="list-disc list-inside space-y-1 text-xs text-text-primary leading-relaxed">
            {analysis.techniques.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </Section>
      )}

      <p className="text-[9px] text-text-tertiary pt-2 border-t border-border-default">
        Generated {new Date(analysis.generatedAt).toLocaleDateString()} · {analysis.aiModel || 'AI'}
      </p>
    </div>
  );
}
