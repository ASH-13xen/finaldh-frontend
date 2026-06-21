import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUS_COLORS = {
  'not-visited': 'bg-slate-700 text-slate-300',
  'not-answered': 'bg-rose-600 text-white',
  'answered': 'bg-emerald-600 text-white',
  'marked-for-review': 'bg-violet-600 text-white',
  'answered-marked-for-review': 'bg-violet-600 text-white ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900'
};

// Derives a question's status from its current local state (selection + prior marked flag)
// when the caller doesn't explicitly request one (e.g. Mark for Review).
const inferStatus = (meta) => {
  const wasMarked = meta?.status === 'marked-for-review' || meta?.status === 'answered-marked-for-review';
  return meta?.selectedOption
    ? (wasMarked ? 'answered-marked-for-review' : 'answered')
    : (wasMarked ? 'marked-for-review' : 'not-answered');
};

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
        (data.responses || []).forEach(r => { meta[r.order] = { status: r.status, selectedOption: r.selectedOption }; });
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
      await patchResponse(currentOrder, { deltaTimeSpentSeconds: elapsed, selectedOption: meta.selectedOption, status: newStatus });

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

    setResponsesMeta(prev => ({ ...prev, [currentOrder]: { selectedOption: meta.selectedOption, status: newStatus } }));
    await patchResponse(currentOrder, { deltaTimeSpentSeconds: elapsed, selectedOption: meta.selectedOption, status: newStatus });

    if (newOrder !== currentOrder) {
      const target = responsesMeta[newOrder] || { status: 'not-visited', selectedOption: null };
      if (target.status === 'not-visited') {
        setResponsesMeta(prev => ({ ...prev, [newOrder]: { ...target, status: 'not-answered' } }));
      }
      patchResponse(newOrder, { isVisit: true });
      setCurrentOrder(newOrder);
    }
    questionEnteredAtRef.current = Date.now();
  };

  const selectOption = (label) => {
    setResponsesMeta(prev => ({
      ...prev,
      [currentOrder]: { ...(prev[currentOrder] || {}), selectedOption: label }
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
    setResponsesMeta(prev => ({ ...prev, [currentOrder]: { selectedOption: null, status: wasMarked ? 'marked-for-review' : 'not-answered' } }));
    patchResponse(currentOrder, { selectedOption: null, status: wasMarked ? 'marked-for-review' : 'not-answered' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-950">
        <LoadingSpinner text="Loading your test..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-950 px-4">
        <div className="p-6 bg-rose-950/20 border border-rose-900/40 rounded-2xl text-rose-400 text-sm font-semibold">{error}</div>
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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 sticky top-2 z-10 shadow-lg">
        <span className="text-xs font-bold text-slate-300">Question {currentOrder} of {questions.length}</span>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm font-bold ${lowTime ? 'bg-rose-950/40 text-rose-400 border border-rose-900/50' : 'bg-slate-800 text-slate-100'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {formatTime(remainingSeconds)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6">
          {currentQuestion ? (
            <>
              <p className="text-sm text-slate-100 font-semibold leading-relaxed whitespace-pre-wrap">{currentQuestion.questionText}</p>

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
                          ? 'border-accent-500 bg-accent-950/30'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold ${selected ? 'border-accent-500 bg-accent-600 text-white' : 'border-slate-600 text-slate-400'}`}>
                        {opt.label}
                      </span>
                      <span className="text-xs text-slate-200 leading-relaxed pt-0.5">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                <button onClick={() => goToQuestion(Math.max(1, currentOrder - 1))} disabled={currentOrder <= 1} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg text-xs font-bold cursor-pointer">
                  ‹ Previous
                </button>
                <button onClick={handleClear} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold cursor-pointer">
                  Clear Response
                </button>
                <button onClick={handleMarkAndNext} className="px-3 py-2 bg-violet-700 hover:bg-violet-600 text-white rounded-lg text-xs font-bold cursor-pointer">
                  Mark for Review & Next
                </button>
                <button onClick={handleSaveAndNext} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer ml-auto">
                  Save & Next ›
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Question not found.</p>
          )}
        </div>

        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
            <div className="bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 rounded-lg px-2 py-1.5 text-center">Answered: {counts.answered}</div>
            <div className="bg-rose-950/30 border border-rose-900/40 text-rose-400 rounded-lg px-2 py-1.5 text-center">Not Answered: {counts.notAnswered}</div>
            <div className="bg-violet-950/30 border border-violet-900/40 text-violet-400 rounded-lg px-2 py-1.5 text-center">Marked: {counts.marked}</div>
            <div className="bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-2 py-1.5 text-center">Not Visited: {counts.notVisited}</div>
          </div>

          <div className="grid grid-cols-5 gap-2 overflow-y-auto max-h-[420px] pr-1">
            {questions.map((q) => {
              const status = (responsesMeta[q.order] || {}).status || 'not-visited';
              return (
                <button
                  key={q.order}
                  onClick={() => goToQuestion(q.order)}
                  className={`w-9 h-9 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${STATUS_COLORS[status]} ${q.order === currentOrder ? 'ring-2 ring-accent-400 ring-offset-1 ring-offset-slate-900' : ''}`}
                >
                  {q.order}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="w-full py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer mt-auto"
          >
            Submit Test
          </button>
        </div>
      </div>

      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <h3 className="text-base font-extrabold text-slate-100">Submit Test?</h3>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
              <div className="bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 rounded-lg px-2 py-2 text-center">Answered: {counts.answered}</div>
              <div className="bg-rose-950/30 border border-rose-900/40 text-rose-400 rounded-lg px-2 py-2 text-center">Not Answered: {counts.notAnswered}</div>
              <div className="bg-violet-950/30 border border-violet-900/40 text-violet-400 rounded-lg px-2 py-2 text-center">Marked: {counts.marked}</div>
              <div className="bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-2 py-2 text-center">Not Visited: {counts.notVisited}</div>
            </div>
            <p className="text-xs text-slate-400">Once submitted, you cannot resume this attempt.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowSubmitConfirm(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer">
                Continue Test
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting} className="flex-1 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-accent-900 text-white rounded-xl text-xs font-bold cursor-pointer">
                {submitting ? 'Submitting...' : 'Yes, Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
