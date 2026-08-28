import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  startAttempt,
  getAttemptQuestions,
  answerQuestion,
  fetchHint,
  completeAttempt
} from './quizApi';
import ReportQuestionModal from './ReportQuestionModal';
import MatchListsView from './MatchListsView';

const PAGE = 10;             // fetch questions 10 at a time
const PREFETCH_WITHIN = 3;   // prefetch the next page when this close to the end of what's loaded

// One runner for all three modes. `revealMode` (from the attempt) decides behaviour:
//   immediate -> answering locks the grid, shows correct/wrong + the "why correct" note
//   end       -> answering just records and auto-advances; nothing is revealed until submit
export default function QuizRunner({ subject, config, onExit, onFinished }) {
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState({});      // index -> question
  const [answers, setAnswers] = useState({});          // index -> { selectedKey, correctKey?, isCorrect?, whyCorrect? }
  const [hints, setHints] = useState({});              // index -> hint string
  const [hintsLeft, setHintsLeft] = useState(3);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const loadedUpTo = useRef(0);
  const fetching = useRef(false);

  const total = attempt?.totalQuestions ?? 0;
  const revealMode = attempt?.revealMode ?? 'immediate';
  const isImmediate = revealMode === 'immediate';

  const fetchPage = useCallback(async (from, attemptId) => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const data = await getAttemptQuestions(attemptId, from, PAGE);
      if (from === 0 && (!data.questions || data.questions.length === 0)) {
        setError('Could not load this quiz — please go back and start it again.');
        return;
      }
      setQuestions((prev) => {
        const next = { ...prev };
        for (const q of data.questions) next[q.index] = q;
        return next;
      });
      loadedUpTo.current = Math.max(loadedUpTo.current, from + (data.questions?.length || 0));
    } catch (err) {
      setError(err.message);
    } finally {
      fetching.current = false;
    }
  }, []);

  // Boot: start/resume the attempt, load the first page, jump to the first unanswered question.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await startAttempt({ subject, ...config });
        if (!alive) return;
        setAttempt(a);
        setHintsLeft(a.hintsLeft ?? 3);

        const seededAnswers = {};
        for (const r of a.responses || []) {
          seededAnswers[r.index] = { selectedKey: r.selectedKey, correctKey: r.correctKey, isCorrect: r.isCorrect };
        }
        setAnswers(seededAnswers);

        const start = Math.min(a.nextIndex ?? 0, Math.max(0, (a.totalQuestions ?? 1) - 1));
        setCurrent(start);
        const pageFrom = Math.floor(start / PAGE) * PAGE;
        await fetchPage(pageFrom, a.attemptId);
        if (pageFrom > 0) await fetchPage(Math.max(0, pageFrom - PAGE), a.attemptId);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [subject, config, fetchPage]);

  // Prefetch pages around the current question.
  useEffect(() => {
    if (!attempt) return;
    if (loadedUpTo.current < total && current >= loadedUpTo.current - PREFETCH_WITHIN) {
      fetchPage(loadedUpTo.current, attempt.attemptId);
    }
    if (!questions[current]) {
      fetchPage(Math.floor(current / PAGE) * PAGE, attempt.attemptId);
    }
  }, [current, attempt, total, questions, fetchPage]);

  const question = questions[current];
  const answered = answers[current];
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const allAnswered = total > 0 && answeredCount >= total;

  const submitAnswer = useCallback(async (key) => {
    if (!question || answered || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await answerQuestion(attempt.attemptId, current, key);
      setAnswers((prev) => ({
        ...prev,
        [current]: isImmediate
          ? { selectedKey: key, correctKey: res.correctKey, isCorrect: res.isCorrect, whyCorrect: res.whyCorrect }
          : { selectedKey: key }
      }));
      if (res.hintsLeft != null) setHintsLeft(res.hintsLeft);
      if (!isImmediate && current < total - 1) setCurrent((i) => i + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [question, answered, busy, attempt, current, isImmediate, total]);

  const revealHint = useCallback(async () => {
    if (!question || answered || hints[current] || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetchHint(attempt.attemptId, current);
      setHints((prev) => ({ ...prev, [current]: res.hint }));
      if (res.hintsLeft != null) setHintsLeft(res.hintsLeft);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [question, answered, hints, busy, attempt, current]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      await completeAttempt(attempt.attemptId);
      onFinished(attempt.attemptId);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }, [attempt, onFinished]);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-sm text-text-tertiary">Loading quiz…</div>;
  }
  if (error && !question) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-sm text-status-danger-text mb-4">{error}</p>
        <button className="text-xs font-bold border border-border-default rounded-lg px-4 py-2" onClick={onExit}>Back</button>
      </div>
    );
  }
  if (!question) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-sm text-text-tertiary">Loading question…</div>;
  }

  const heading =
    attempt.mode === 'topic' ? config.topic
    : attempt.mode === 'random' ? `Random test (${total})`
    : `${subject} — all questions`;

  const pct = total ? (answeredCount / total) * 100 : 0;

  const optionClass = (key) => {
    const base = 'w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors';
    if (!answered) return `${base} border-border-default hover:border-brand cursor-pointer`;
    if (isImmediate) {
      if (key === answered.correctKey) return `${base} border-status-success-text/40 bg-status-success-bg`;
      if (key === answered.selectedKey) return `${base} border-status-danger-text/40 bg-status-danger-bg`;
      return `${base} border-border-default opacity-50`;
    }
    return key === answered.selectedKey
      ? `${base} border-brand bg-accent-soft-bg`
      : `${base} border-border-default opacity-50`;
  };
  const keyBadgeClass = (key) => {
    const base = 'flex-none w-6 h-6 rounded-full border grid place-items-center text-[11px] font-bold';
    if (answered && isImmediate && key === answered.correctKey) return `${base} border-status-success-text text-status-success-text`;
    if (answered && isImmediate && key === answered.selectedKey) return `${base} border-status-danger-text text-status-danger-text`;
    if (answered && !isImmediate && key === answered.selectedKey) return `${base} border-brand bg-brand text-text-on-accent`;
    return `${base} border-border-default text-text-tertiary`;
  };

  return (
    <div className="min-h-[calc(100vh-73px)] bg-page">
      {/* Sticky progress bar at the top */}
      <div className="sticky top-[57px] md:top-[73px] z-20 bg-page/95 backdrop-blur border-b border-border-default">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-text-tertiary mb-1.5">
            <span>Question {current + 1} of {total}</span>
            <span>{answeredCount} / {total} answered</span>
          </div>
          <div className="h-2 bg-sunken rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <button className="text-xs text-text-tertiary hover:text-brand mb-3" onClick={onExit}>
          ← {heading}
        </button>

        <div className="bg-surface border border-border-default rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-brand bg-accent-soft-bg border border-accent-soft-border rounded px-2 py-0.5 uppercase tracking-wide">
                {isImmediate ? 'Practice' : 'Test'}
              </span>
              <span className="text-[11px] font-semibold text-text-tertiary">💡 Hints left: {hintsLeft}</span>
            </div>
            <button className="text-xs font-bold text-text-tertiary hover:text-status-danger-text" onClick={() => setReportOpen(true)}>
              ⚑ Report
            </button>
          </div>

          <div className="flex gap-3 mb-5">
            <span className="flex-none grid place-items-center w-9 h-9 rounded-lg bg-brand text-text-on-accent text-xs font-extrabold">
              Q{current + 1}
            </span>
            <div className="pt-1 min-w-0 flex-1 text-text-primary">
              {question.matchLists
                ? <MatchListsView stem={question.questionText} matchLists={question.matchLists} />
                : <p className="whitespace-pre-line leading-relaxed">{question.questionText}</p>}
            </div>
          </div>

          {hints[current] && !answered && (
            <p className="text-sm text-text-secondary mb-4 px-3 py-2 rounded-lg bg-status-warning-bg border border-status-warning-text/20">
              <strong className="text-status-warning-text">Hint:</strong> {hints[current]}
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {question.options.map((opt) => (
              <button
                key={opt.key}
                className={optionClass(opt.key)}
                disabled={!!answered || busy}
                onClick={() => submitAnswer(opt.key)}
              >
                <span className={keyBadgeClass(opt.key)}>{opt.key}</span>
                <span className="text-sm leading-snug text-text-primary">{opt.text}</span>
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-status-danger-text mt-3">{error}</p>}

          {answered && isImmediate && (
            <div className="mt-5 pt-5 border-t border-border-default">
              <p className={`text-xs font-extrabold uppercase tracking-widest mb-1.5 ${answered.isCorrect ? 'text-status-success-text' : 'text-status-danger-text'}`}>
                {answered.isCorrect ? '✓ Correct' : `✗ Correct answer: ${answered.correctKey}`}
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                {answered.whyCorrect || 'Explanation coming soon.'}
              </p>
            </div>
          )}

          {answered && !isImmediate && (
            <p className="text-xs text-text-tertiary mt-4">Answer recorded — results at the end.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-5">
          <button
            className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised disabled:opacity-40 rounded-lg px-4 py-2"
            disabled={current === 0}
            onClick={() => setCurrent((i) => i - 1)}
          >
            ← Previous
          </button>

          {!answered && (
            <button
              className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised disabled:opacity-40 rounded-lg px-4 py-2"
              disabled={busy || hintsLeft === 0 || !!hints[current]}
              onClick={revealHint}
            >
              💡 Use Hint ({hintsLeft})
            </button>
          )}

          {current < total - 1 ? (
            <button
              className="text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg px-5 py-2"
              onClick={() => setCurrent((i) => i + 1)}
            >
              Next →
            </button>
          ) : (
            <button
              className="text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent disabled:opacity-40 rounded-lg px-5 py-2"
              disabled={!allAnswered || busy}
              onClick={finish}
            >
              {isImmediate ? 'Finish' : 'Submit test'}
            </button>
          )}
        </div>

        {!allAnswered && current === total - 1 && (
          <p className="text-xs text-center text-text-tertiary mt-3">
            Answer every question to finish ({answeredCount}/{total} done).
          </p>
        )}
      </div>

      {reportOpen && (
        <ReportQuestionModal
          onClose={() => setReportOpen(false)}
          questionLabel={`${heading} · Q${current + 1}`}
          questionId={question.id}
        />
      )}
    </div>
  );
}
