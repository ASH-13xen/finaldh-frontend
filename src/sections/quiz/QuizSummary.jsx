import { useState, useEffect } from 'react';
import { getAttempt } from './quizApi';
import MatchListsView from './MatchListsView';

const Ring = ({ percent }) => (
  <div className="relative grid place-items-center flex-none" style={{ width: 92, height: 92 }}>
    <svg width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r="40" fill="none" stroke="var(--border-default)" strokeWidth="8" />
      <circle
        cx="46" cy="46" r="40" fill="none" stroke="var(--accent)" strokeWidth="8"
        strokeDasharray={`${(percent / 100) * 251.3} 251.3`}
        strokeLinecap="round" transform="rotate(-90 46 46)"
      />
    </svg>
    <span className="absolute text-lg font-extrabold text-text-primary">{percent}%</span>
  </div>
);

const titleFor = (a) =>
  a.mode === 'topic' ? a.topic
  : a.mode === 'random' ? `Random test (${a.totalQuestions})`
  : 'All questions';

const configFor = (a) =>
  a.mode === 'topic' ? { mode: 'topic', topic: a.topic }
  : a.mode === 'random' ? { mode: 'random', size: a.totalQuestions }
  : { mode: 'all' };

export default function QuizSummary({ attemptId, onRetake, onBackToList }) {
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getAttempt(attemptId)
      .then((data) => { if (alive) setAttempt(data); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [attemptId]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <p className="text-sm text-status-danger-text mb-4">{error}</p>
        <button className="text-xs font-bold border border-border-default rounded-lg px-4 py-2" onClick={onBackToList}>Back</button>
      </div>
    );
  }
  if (!attempt) return <div className="max-w-2xl mx-auto px-4 py-16 text-sm text-text-tertiary">Loading results…</div>;

  const review = attempt.review || [];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-14">
      <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Results</span>
      <h1 className="text-2xl md:text-3xl font-display font-extrabold text-text-primary tracking-tight mt-1.5 mb-6">
        {titleFor(attempt)}
      </h1>

      <div className="bg-surface border border-border-default rounded-2xl p-5 md:p-6 flex items-center gap-5">
        <Ring percent={attempt.score ?? 0} />
        <div>
          <p className="text-lg font-bold text-text-primary">{attempt.totalCorrect} / {attempt.totalQuestions} correct</p>
          <p className="text-sm text-text-tertiary mt-1">
            {attempt.hintsUsed || 0} hint{(attempt.hintsUsed || 0) === 1 ? '' : 's'} used
          </p>
          <div className="flex gap-2 mt-4">
            <button
              className="text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg px-4 py-2"
              onClick={() => onRetake(configFor(attempt))}
            >
              {attempt.mode === 'random' ? 'New test' : 'Retake'}
            </button>
            <button
              className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised rounded-lg px-4 py-2"
              onClick={onBackToList}
            >
              Back to Quiz
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {review.map((r) => (
          <div key={r.index} className="bg-surface border border-border-default rounded-2xl p-4 md:p-5">
            <div className="flex items-start gap-3">
              <span
                className={`flex-none grid place-items-center w-8 h-8 rounded-lg text-[11px] font-extrabold ${
                  r.isCorrect
                    ? 'bg-status-success-bg text-status-success-text'
                    : 'bg-status-danger-bg text-status-danger-text'
                }`}
              >
                {r.isCorrect ? '✓' : '✗'}
              </span>
              <div className="min-w-0 text-text-primary">
                {r.matchLists
                  ? <MatchListsView stem={r.questionText} matchLists={r.matchLists} />
                  : <p className="text-sm whitespace-pre-line leading-relaxed">{r.questionText}</p>}
                <p className="text-xs text-text-tertiary mt-2">
                  Your answer: {r.selectedKey || '—'} · Correct: {r.correctKey}
                  {r.topic ? ` · ${r.topic}` : ''}
                </p>
                {r.whyCorrect && <p className="text-sm text-text-secondary mt-2 leading-relaxed">{r.whyCorrect}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
