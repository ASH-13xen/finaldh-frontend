import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  startAttempt,
  getAttemptQuestions,
  answerQuestion,
  completeAttempt
} from './quizApi';
import ReportQuestionModal from './ReportQuestionModal';
import MatchListsView from './MatchListsView';

const PAGE = 10;             // fetch questions 10 at a time
const PREFETCH_WITHIN = 3;   // prefetch the next page when this close to the end of what's loaded

// One runner for all three modes. The student picks an option, hits Check to reveal the answer
// + explanation, then moves on. A question-number palette on the side jumps between questions.
export default function QuizRunner({ subject, config, onExit, onFinished }) {
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState({});      // index -> question
  const [answers, setAnswers] = useState({});          // index -> { selectedKey, correctKey, isCorrect, whyCorrect }
  const [pending, setPending] = useState({});          // index -> tentatively selected key (before Check)
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const loadedUpTo = useRef(0);
  const fetching = useRef(false);

  const total = attempt?.totalQuestions ?? 0;

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

        const seeded = {};
        for (const r of a.responses || []) {
          seeded[r.index] = { selectedKey: r.selectedKey, correctKey: r.correctKey, isCorrect: r.isCorrect };
        }
        setAnswers(seeded);

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
  const answered = answers[current];              // set once this question has been "checked"
  // "Attempted" = an option picked, whether or not the student checked the answer.
  const attemptedCount = useMemo(
    () => new Set([...Object.keys(answers), ...Object.keys(pending)]).size,
    [answers, pending]
  );
  const allAttempted = total > 0 && attemptedCount >= total;

  // Optional: reveal the answer + explanation for the current question.
  const check = useCallback(async () => {
    const key = pending[current];
    if (!question || answered || busy || !key) return;
    setBusy(true);
    setError('');
    try {
      const res = await answerQuestion(attempt.attemptId, current, key);
      setAnswers((prev) => ({
        ...prev,
        [current]: { selectedKey: key, correctKey: res.correctKey, isCorrect: res.isCorrect, whyCorrect: res.whyCorrect }
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [pending, question, answered, busy, attempt, current]);

  // Submit every picked-but-not-yet-checked answer, then complete the attempt.
  const finish = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      for (const [idxStr, key] of Object.entries(pending)) {
        const idx = Number(idxStr);
        if (answers[idx] || !key) continue;
        try { await answerQuestion(attempt.attemptId, idx, key); } catch { /* already answered / gone — ignore */ }
      }
      await completeAttempt(attempt.attemptId);
      onFinished(attempt.attemptId);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }, [attempt, onFinished, pending, answers]);

  const go = (i) => { setCurrent(Math.max(0, Math.min(total - 1, i))); setPaletteOpen(false); };

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

  const pct = total ? (attemptedCount / total) * 100 : 0;
  const chosen = answered ? answered.selectedKey : pending[current];

  const optionClass = (key) => {
    const base = 'w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors';
    if (answered) {
      if (key === answered.correctKey) return `${base} border-status-success-text/40 bg-status-success-bg`;
      if (key === answered.selectedKey) return `${base} border-status-danger-text/40 bg-status-danger-bg`;
      return `${base} border-border-default opacity-50`;
    }
    return key === chosen
      ? `${base} border-brand bg-accent-soft-bg cursor-pointer`
      : `${base} border-border-default hover:border-brand cursor-pointer`;
  };
  const keyBadgeClass = (key) => {
    const base = 'flex-none w-6 h-6 rounded-full border grid place-items-center text-[11px] font-bold';
    if (answered && key === answered.correctKey) return `${base} border-status-success-text text-status-success-text`;
    if (answered && key === answered.selectedKey) return `${base} border-status-danger-text text-status-danger-text`;
    if (!answered && key === chosen) return `${base} border-brand bg-brand text-text-on-accent`;
    return `${base} border-border-default text-text-tertiary`;
  };

  // Palette swatch for a question index: checked -> green/red, picked-not-checked -> brand,
  // untouched -> grey.
  const paletteClass = (i) => {
    const a = answers[i];
    const base = 'w-9 h-9 rounded-lg text-xs font-bold grid place-items-center cursor-pointer border transition-all';
    const ring = i === current ? ' ring-2 ring-brand ring-offset-1 ring-offset-surface' : '';
    if (a) {
      return `${base}${ring} ` + (a.isCorrect
        ? 'bg-status-success-text text-white border-transparent'
        : 'bg-status-danger-text text-white border-transparent');
    }
    if (pending[i]) return `${base}${ring} bg-accent-soft-bg text-brand border-accent-soft-border`;
    return `${base}${ring} bg-surface-raised text-text-tertiary border-border-default`;
  };

  const Palette = () => (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-6 lg:grid-cols-5 gap-1.5 max-h-[300px] lg:max-h-[460px] overflow-y-auto pr-1">
        {Array.from({ length: total }, (_, i) => (
          <button key={i} onClick={() => go(i)} className={paletteClass(i)}>{i + 1}</button>
        ))}
      </div>
      <div className="flex flex-col gap-1 text-[10px] font-semibold text-text-tertiary">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-status-success-text inline-block" /> Checked · correct</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-status-danger-text inline-block" /> Checked · wrong</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-accent-soft-bg border border-accent-soft-border inline-block" /> Answered</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-surface-raised border border-border-default inline-block" /> Not answered</span>
      </div>
      <button
        className="w-full text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent disabled:opacity-40 rounded-lg px-4 py-2 mt-1"
        disabled={busy || attemptedCount === 0}
        onClick={finish}
      >
        {busy ? 'Finishing…' : allAttempted ? 'Finish' : `Finish (${attemptedCount}/${total})`}
      </button>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-73px)] bg-page">
      {/* Sticky progress bar */}
      <div className="sticky top-[57px] md:top-[73px] z-20 bg-page/95 backdrop-blur border-b border-border-default">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-text-tertiary mb-1.5">
            <span>Question {current + 1} of {total}</span>
            <span>{attemptedCount} / {total} answered</span>
          </div>
          <div className="h-2 bg-sunken rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <button className="text-xs text-text-tertiary hover:text-brand" onClick={onExit}>← {heading}</button>
          <button
            className="lg:hidden text-xs font-bold border border-border-default rounded-lg px-3 py-1.5 text-text-secondary"
            onClick={() => setPaletteOpen(true)}
          >
            Questions
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">
          {/* Question card */}
          <div className="bg-surface border border-border-default rounded-2xl p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
              <span className="text-[10px] font-bold text-brand bg-accent-soft-bg border border-accent-soft-border rounded px-2 py-0.5 uppercase tracking-wide">
                {attempt.mode === 'random' ? 'Test' : 'Practice'}
              </span>
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
                {question.statements?.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 border-l-2 border-border-default">
                    {question.statements.map((s, i) => (
                      <li key={i} className="text-sm text-text-secondary leading-relaxed pl-3 whitespace-pre-line">{s}</li>
                    ))}
                  </ul>
                )}
                {(question.questionType || question.examSource) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {question.questionType && (
                      <span className="text-[9px] font-bold uppercase tracking-wide bg-sunken border border-border-subtle text-text-tertiary rounded px-1.5 py-0.5">{question.questionType}</span>
                    )}
                    {question.examSource && (
                      <span className="text-[9px] font-bold bg-accent-soft-bg border border-accent-soft-border text-brand rounded px-1.5 py-0.5">{question.examSource}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {question.options.map((opt) => (
                <button
                  key={opt.key}
                  className={optionClass(opt.key)}
                  disabled={!!answered || busy}
                  onClick={() => setPending((p) => ({ ...p, [current]: opt.key }))}
                >
                  <span className={keyBadgeClass(opt.key)}>{opt.key}</span>
                  <span className="text-sm leading-snug text-text-primary">{opt.text}</span>
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-status-danger-text mt-3">{error}</p>}

            {answered && (
              <div className="mt-5 pt-5 border-t border-border-default">
                <p className={`text-xs font-extrabold uppercase tracking-widest mb-1.5 ${answered.isCorrect ? 'text-status-success-text' : 'text-status-danger-text'}`}>
                  {answered.isCorrect ? '✓ Correct' : `✗ Correct answer: ${answered.correctKey}`}
                </p>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                  {answered.whyCorrect || question.whyCorrect || 'Explanation coming soon.'}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mt-6 flex-wrap">
              <button
                className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised disabled:opacity-40 rounded-lg px-4 py-2"
                disabled={current === 0}
                onClick={() => go(current - 1)}
              >
                ← Previous
              </button>

              <div className="flex items-center gap-2 ml-auto">
                {/* Check is always optional — the student's call. */}
                {!answered && (
                  <button
                    className="text-xs font-bold border border-brand text-brand hover:bg-accent-soft-bg disabled:opacity-40 rounded-lg px-5 py-2"
                    disabled={busy || !pending[current]}
                    onClick={check}
                  >
                    {busy ? 'Checking…' : 'Check answer'}
                  </button>
                )}
                {current < total - 1 ? (
                  <button
                    className="text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg px-6 py-2"
                    onClick={() => go(current + 1)}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    className="text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent disabled:opacity-40 rounded-lg px-6 py-2"
                    disabled={busy}
                    onClick={finish}
                  >
                    Finish
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Side palette (desktop) */}
          <aside className="hidden lg:block bg-surface border border-border-default rounded-2xl p-4 sticky top-[120px]">
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-3">Answer Review</p>
            <Palette />
          </aside>
        </div>
      </div>

      {/* Palette bottom sheet (mobile) */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden bg-page/70 backdrop-blur-sm" onClick={() => setPaletteOpen(false)}>
          <div className="bg-surface border-t border-border-default rounded-t-2xl w-full p-5 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-extrabold text-text-primary">Answer Review</p>
              <button onClick={() => setPaletteOpen(false)} className="text-xs font-bold text-text-tertiary">Close</button>
            </div>
            <Palette />
          </div>
        </div>
      )}

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
