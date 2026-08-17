import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUS_COLORS = {
  'not-visited': 'bg-surface-raised text-text-tertiary border border-border-default',
  'not-answered': 'bg-status-danger-text text-white',
  'answered': 'bg-brand text-text-on-accent',
  'marked-for-review': 'bg-status-info-text text-white',
  'answered-marked-for-review': 'bg-status-info-text text-white ring-2 ring-brand ring-offset-1 ring-offset-surface'
};

// Derives a question's status from its current local state (selection + prior marked flag)
// when the caller doesn't explicitly request one (e.g. Mark for Review).
const inferStatus = (meta) => {
  const wasMarked = meta?.status === 'marked-for-review' || meta?.status === 'answered-marked-for-review';
  return meta?.selectedOption
    ? (wasMarked ? 'answered-marked-for-review' : 'answered')
    : (wasMarked ? 'marked-for-review' : 'not-answered');
};

const CONFIDENCE_OPTIONS = [
  { tag: 'sure', label: '100% Sure' },
  { tag: 'elimination', label: 'Logical Elimination' },
  { tag: 'guess', label: 'Pure Guess' }
];

const formatTime = (totalSeconds) => {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export default function McqTestRunner({ attemptId, onSubmitted }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [serverDeadline, setServerDeadline] = useState(null);
  const [responsesMeta, setResponsesMeta] = useState({}); // order -> { status, selectedOption }
  const [currentOrder, setCurrentOrder] = useState(1);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const questionEnteredAtRef = useRef(null); // set once the attempt finishes loading, see load() below
  const autoSubmitTriggeredRef = useRef(false);

  const token = localStorage.getItem('token');

  const patchResponse = useCallback(async (order, body) => {
    try {
      await fetch(`/api/mcq/attempts/${attemptId}/responses/${order}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.error('Autosave error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // Load (or resume) the attempt
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/mcq/attempts/${attemptId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load test');

        if (data.deadlineExpired || data.status) {
          onSubmitted(attemptId);
          return;
        }

        setQuestions(data.questions || []);
        setServerDeadline(new Date(data.serverDeadline));
        const meta = {};
        (data.responses || []).forEach(r => { meta[r.order] = { status: r.status, selectedOption: r.selectedOption, confidenceTag: r.confidenceTag ?? null }; });
        setResponsesMeta(meta);
        setCurrentOrder(data.lastActiveQuestionOrder || 1);
        questionEnteredAtRef.current = Date.now();
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load test.');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const handleSubmit = useCallback(async (autoSubmit) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Flush whatever is currently selected on this question - the user may hit Submit
      // directly without ever clicking Save & Next on the last question they viewed.
      const elapsed = Math.round((Date.now() - questionEnteredAtRef.current) / 1000);
      const meta = responsesMeta[currentOrder] || { selectedOption: null, status: 'not-answered' };
      const newStatus = inferStatus(meta);
      await patchResponse(currentOrder, { deltaTimeSpentSeconds: elapsed, selectedOption: meta.selectedOption, status: newStatus, confidenceTag: meta.confidenceTag ?? null });

      await fetch(`/api/mcq/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ autoSubmit: !!autoSubmit })
      });
      onSubmitted(attemptId);
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, currentOrder, submitting, patchResponse, responsesMeta]);

  // Countdown timer - purely a display; the backend independently enforces the real deadline.
  useEffect(() => {
    if (!serverDeadline) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((serverDeadline.getTime() - Date.now()) / 1000));
      setRemainingSeconds(secs);
      if (secs <= 0 && !autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        handleSubmit(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [serverDeadline, handleSubmit]);

  // Always flushes whatever is currently selected on the question being left - regardless
  // of whether navigation happens via Save & Next, Mark for Review, the Previous button,
  // or jumping through the palette. statusOverride lets Mark for Review force its status;
  // otherwise the status is inferred from the current selection.
  const goToQuestion = async (newOrder, statusOverride) => {
    if (newOrder === currentOrder && !statusOverride) return;
    const elapsed = Math.round((Date.now() - questionEnteredAtRef.current) / 1000);

    const meta = responsesMeta[currentOrder] || { selectedOption: null, status: 'not-answered' };
    const newStatus = statusOverride || inferStatus(meta);

    setResponsesMeta(prev => ({ ...prev, [currentOrder]: { selectedOption: meta.selectedOption, status: newStatus, confidenceTag: meta.confidenceTag ?? null } }));
    await patchResponse(currentOrder, { deltaTimeSpentSeconds: elapsed, selectedOption: meta.selectedOption, status: newStatus, confidenceTag: meta.confidenceTag ?? null });

    if (newOrder !== currentOrder) {
      const target = responsesMeta[newOrder] || { status: 'not-visited', selectedOption: null };
      if (target.status === 'not-visited') {
        setResponsesMeta(prev => ({ ...prev, [newOrder]: { ...target, status: 'not-answered' } }));
      }
      patchResponse(newOrder, { isVisit: true });
      setCurrentOrder(newOrder);
    }
    questionEnteredAtRef.current = Date.now();
    setPaletteOpen(false);
  };

  const selectOption = (label) => {
    setResponsesMeta(prev => ({
      ...prev,
      [currentOrder]: { ...(prev[currentOrder] || {}), selectedOption: label }
    }));
  };

  const selectConfidence = (tag) => {
    setResponsesMeta(prev => ({
      ...prev,
      [currentOrder]: { ...(prev[currentOrder] || {}), confidenceTag: tag }
    }));
  };

  const handleSaveAndNext = () => {
    goToQuestion(Math.min(questions.length, currentOrder + 1));
  };

  const handleMarkAndNext = () => {
    const meta = responsesMeta[currentOrder] || { selectedOption: null, status: 'not-answered' };
    const newStatus = meta.selectedOption ? 'answered-marked-for-review' : 'marked-for-review';
    goToQuestion(Math.min(questions.length, currentOrder + 1), newStatus);
  };

  const handleClear = () => {
    const meta = responsesMeta[currentOrder] || { status: 'not-answered' };
    const wasMarked = meta.status === 'marked-for-review' || meta.status === 'answered-marked-for-review';
    const clearedStatus = wasMarked ? 'marked-for-review' : 'not-answered';
    setResponsesMeta(prev => ({ ...prev, [currentOrder]: { selectedOption: null, status: clearedStatus, confidenceTag: null } }));
    patchResponse(currentOrder, { selectedOption: null, status: clearedStatus, confidenceTag: null });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Loading your test..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page px-4">
        <div className="p-6 bg-status-danger-bg border border-status-danger-text/30 rounded-2xl text-status-danger-text text-sm font-semibold">{error}</div>
      </div>
    );
  }

  const currentQuestion = questions.find(q => q.order === currentOrder);
  const currentMeta = responsesMeta[currentOrder] || { selectedOption: null, status: 'not-visited' };

  const counts = { answered: 0, notAnswered: 0, marked: 0, notVisited: 0 };
  questions.forEach(q => {
    const status = (responsesMeta[q.order] || {}).status || 'not-visited';
    if (status === 'answered') counts.answered += 1;
    else if (status === 'answered-marked-for-review') { counts.answered += 1; counts.marked += 1; }
    else if (status === 'marked-for-review') counts.marked += 1;
    else if (status === 'not-answered') counts.notAnswered += 1;
    else counts.notVisited += 1;
  });

  const lowTime = remainingSeconds <= 300;

  const CountTiles = ({ dense }) => (
    <div className={`grid grid-cols-2 gap-2 font-bold ${dense ? 'text-[11px]' : 'text-[10px]'}`}>
      <div className={`bg-status-success-bg border border-status-success-text/30 text-status-success-text rounded-lg text-center ${dense ? 'px-2 py-2' : 'px-2 py-1.5'}`}>Answered: {counts.answered}</div>
      <div className={`bg-status-danger-bg border border-status-danger-text/30 text-status-danger-text rounded-lg text-center ${dense ? 'px-2 py-2' : 'px-2 py-1.5'}`}>Not Answered: {counts.notAnswered}</div>
      <div className={`bg-status-info-bg border border-status-info-text/30 text-status-info-text rounded-lg text-center ${dense ? 'px-2 py-2' : 'px-2 py-1.5'}`}>Marked: {counts.marked}</div>
      <div className={`bg-sunken border border-border-default text-text-tertiary rounded-lg text-center ${dense ? 'px-2 py-2' : 'px-2 py-1.5'}`}>Not Visited: {counts.notVisited}</div>
    </div>
  );

  const PaletteGrid = () => (
    <div className="grid grid-cols-5 gap-2 overflow-y-auto max-h-[420px] pr-1">
      {questions.map((q) => {
        const status = (responsesMeta[q.order] || {}).status || 'not-visited';
        return (
          <button
            key={q.order}
            onClick={() => goToQuestion(q.order)}
            className={`w-9 h-9 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${STATUS_COLORS[status]} ${q.order === currentOrder ? 'ring-2 ring-brand ring-offset-1 ring-offset-surface' : ''}`}
          >
            {q.order}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between bg-surface border border-border-default rounded-2xl px-5 py-3 sticky top-2 z-10 shadow-lg">
        <span className="text-xs font-bold text-text-secondary">Question {currentOrder} of {questions.length}</span>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm font-bold ${lowTime ? 'bg-status-danger-bg text-status-danger-text border border-status-danger-text/30' : 'bg-sunken text-text-primary'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {formatTime(remainingSeconds)}
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="md:hidden flex items-center justify-center w-9 h-9 bg-sunken border border-border-default text-text-secondary rounded-xl cursor-pointer"
            aria-label="Open question palette"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 lg:col-span-9 bg-surface border border-border-default rounded-2xl p-6 flex flex-col gap-6">
          {currentQuestion ? (
            <>
              <p className="text-sm text-text-primary font-semibold leading-relaxed whitespace-pre-wrap">{currentQuestion.questionText}</p>

              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((opt) => {
                  const selected = currentMeta.selectedOption === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => selectOption(opt.label)}
                      className={`text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selected
                          ? 'border-brand bg-accent-soft-bg'
                          : 'border-border-default hover:border-text-tertiary bg-sunken/60'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold ${selected ? 'border-brand bg-brand text-text-on-accent' : 'border-border-default text-text-tertiary'}`}>
                        {opt.label}
                      </span>
                      <span className="text-xs text-text-secondary leading-relaxed pt-0.5">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">How confident are you in this answer?</span>
                <div className="flex flex-wrap gap-2">
                  {CONFIDENCE_OPTIONS.map(({ tag, label }) => {
                    const active = currentMeta.confidenceTag === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => selectConfidence(tag)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all border ${
                          active
                            ? 'border-brand bg-brand text-text-on-accent'
                            : 'border-border-default bg-sunken text-text-secondary hover:border-text-tertiary'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-default">
                <button onClick={() => goToQuestion(Math.max(1, currentOrder - 1))} disabled={currentOrder <= 1} className="px-3 py-2 bg-sunken hover:bg-surface-raised disabled:opacity-40 text-text-secondary rounded-lg text-xs font-bold cursor-pointer">
                  ‹ Previous
                </button>
                <button onClick={handleClear} className="px-3 py-2 bg-sunken hover:bg-surface-raised text-text-secondary rounded-lg text-xs font-bold cursor-pointer">
                  Clear Response
                </button>
                <button onClick={handleMarkAndNext} className="px-3 py-2 bg-status-info-text hover:opacity-90 text-white rounded-lg text-xs font-bold cursor-pointer">
                  Mark for Review & Next
                </button>
                <button onClick={handleSaveAndNext} className="px-3 py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg text-xs font-bold cursor-pointer ml-auto">
                  Save & Next ›
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-tertiary">Question not found.</p>
          )}
        </div>

        <div className="hidden md:flex md:col-span-4 lg:col-span-3 bg-surface border border-border-default rounded-2xl p-5 flex-col gap-4">
          <CountTiles />
          <PaletteGrid />
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="w-full py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition shadow-sm cursor-pointer mt-auto"
          >
            Submit Test
          </button>
        </div>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden bg-page/70 backdrop-blur-sm" onClick={() => setPaletteOpen(false)}>
          <div className="bg-surface border-t border-border-default rounded-t-2xl w-full p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-text-primary">Question Palette</h3>
              <button onClick={() => setPaletteOpen(false)} className="text-text-tertiary text-xs font-bold cursor-pointer">Close</button>
            </div>
            <CountTiles dense />
            <PaletteGrid />
            <button
              onClick={() => { setPaletteOpen(false); setShowSubmitConfirm(true); }}
              className="w-full py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Submit Test
            </button>
          </div>
        </div>
      )}

      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-page/70 backdrop-blur-sm px-4">
          <div className="bg-surface border border-border-default rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <h3 className="text-base font-extrabold text-text-primary">Submit Test?</h3>
            <CountTiles dense />
            <p className="text-xs text-text-tertiary">Once submitted, you cannot resume this attempt.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowSubmitConfirm(false)} className="flex-1 py-2.5 bg-sunken hover:bg-surface-raised text-text-secondary rounded-xl text-xs font-bold cursor-pointer">
                Continue Test
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting} className="flex-1 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold cursor-pointer">
                {submitting ? 'Submitting...' : 'Yes, Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
