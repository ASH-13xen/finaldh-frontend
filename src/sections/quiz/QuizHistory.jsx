import { useState, useEffect } from 'react';
import { listAttempts } from './quizApi';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function QuizHistory({ subject, onBack, onOpenAttempt }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listAttempts(subject)
      .then((data) => { if (alive) setAttempts(data.attempts || []); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [subject]);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-14">
      <div className="flex items-end justify-between gap-4 border-b border-border-default pb-5">
        <div>
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Your Attempts</span>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-text-primary tracking-tight mt-1.5">
            {subject} — History
          </h1>
        </div>
        <button
          className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised rounded-lg px-3 py-1.5"
          onClick={onBack}
        >
          Back
        </button>
      </div>

      {loading && <p className="mt-10 text-sm text-text-tertiary">Loading…</p>}
      {error && <p className="mt-10 text-sm text-status-danger-text">{error}</p>}
      {!loading && !error && attempts.length === 0 && (
        <p className="mt-10 text-sm text-text-tertiary">No attempts yet.</p>
      )}

      <div className="mt-6 grid gap-3">
        {attempts.map((a) => (
          <button
            key={a.id}
            className={`bg-surface border border-border-default rounded-2xl flex items-center justify-between gap-4 p-4 text-left ${
              a.status === 'completed' ? 'hover:border-brand cursor-pointer' : 'cursor-default'
            }`}
            disabled={a.status !== 'completed'}
            onClick={() => a.status === 'completed' && onOpenAttempt(a.id)}
          >
            <div className="min-w-0">
              <p className="font-bold text-text-primary truncate">{a.label || 'Quiz'}</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                {a.status === 'completed'
                  ? fmtDate(a.completedAt)
                  : `In progress · ${a.answeredCount}/${a.totalQuestions}`}
              </p>
            </div>
            <div className="flex-none text-right">
              {a.status === 'completed' ? (
                <>
                  <p className="font-extrabold text-text-primary">{a.score}%</p>
                  <p className="text-xs text-text-tertiary">{a.totalCorrect}/{a.totalQuestions}</p>
                </>
              ) : (
                <span className="text-[10px] font-bold text-brand bg-accent-soft-bg border border-accent-soft-border rounded-full px-2.5 py-0.5 uppercase">
                  Resume
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
