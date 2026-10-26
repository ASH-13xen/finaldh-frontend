import { useState, useEffect } from 'react';
import { listTopics } from './quizApi';

const RANDOM_SIZES = [10, 25, 50, 100];

const Card = ({ children }) => (
  <div className="bg-surface border border-border-default rounded-2xl p-5 md:p-6">{children}</div>
);

export default function QuizHome({ subject, onStart, onOpenHistory, onExitToMcq }) {
  const [topics, setTopics] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedTopic, setSelectedTopic] = useState('');
  const [size, setSize] = useState(25);

  useEffect(() => {
    let alive = true;
    listTopics(subject)
      .then((data) => {
        if (!alive) return;
        setTopics(data.topics || []);
        setTotal(data.total || 0);
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [subject]);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-14">
      {onExitToMcq && (
        <button
          className="text-xs font-semibold text-text-tertiary hover:text-brand mb-4 flex items-center gap-1"
          onClick={onExitToMcq}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="15 18 9 12 15 6" /></svg>
          MCQ Tests
        </button>
      )}

      <div className="flex items-end justify-between gap-4 border-b border-border-default pb-5">
        <div>
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Practice · Untimed</span>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-text-primary tracking-tight mt-1.5">
            {subject} — Question Bank
          </h1>
          <p className="text-sm text-text-tertiary mt-1.5 font-medium">
            {loading ? 'Loading…' : `${total.toLocaleString()} questions · ${topics.length} topics`}
          </p>
        </div>
        <button
          className="text-xs font-bold text-text-secondary border border-border-default hover:bg-surface-raised rounded-lg px-3 py-1.5"
          onClick={onOpenHistory}
        >
          History
        </button>
      </div>

      {error && <p className="mt-8 text-sm text-status-danger-text">{error}</p>}

      {!loading && !error && total === 0 && (
        <p className="mt-8 text-sm text-text-tertiary">
          No questions loaded yet. Run <code>node scripts/import_quiz_questions.mjs</code> on the backend.
        </p>
      )}

      {!loading && !error && total > 0 && (
        <div className="mt-6 grid gap-4">
          {/* Learn by topic */}
          <Card>
            <p className="font-bold text-text-primary">Learn by topic</p>
            <p className="text-sm text-text-tertiary mt-1">
              Pick a topic and work through every question in it. Answers and explanations show as you go.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <select
                className="flex-1 bg-surface border border-border-default rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
              >
                <option value="">Choose a topic…</option>
                {topics.map((t) => (
                  <option key={t.topic} value={t.topic}>{t.topic} ({t.total})</option>
                ))}
              </select>
              <button
                className="bg-brand hover:bg-brand-hover disabled:opacity-40 text-text-on-accent rounded-lg px-5 py-2.5 text-xs font-bold cursor-pointer"
                disabled={!selectedTopic}
                onClick={() => onStart({ mode: 'topic', topic: selectedTopic })}
              >
                Start
              </button>
            </div>
          </Card>

          {/* Random test */}
          <Card>
            <p className="font-bold text-text-primary">Random test</p>
            <p className="text-sm text-text-tertiary mt-1">
              Random questions from the whole pool. Answers stay hidden until you finish, then you get a score.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {RANDOM_SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-bold border cursor-pointer ${
                    size === n
                      ? 'bg-brand text-text-on-accent border-brand'
                      : 'border-border-default text-text-secondary hover:border-brand'
                  }`}
                  onClick={() => setSize(n)}
                >
                  {n} Qs
                </button>
              ))}
              <button
                className="bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg px-5 py-2 text-xs font-bold cursor-pointer ml-auto"
                onClick={() => onStart({ mode: 'random', size })}
              >
                Start test
              </button>
            </div>
          </Card>

          {/* All questions */}
          <Card>
            <p className="font-bold text-text-primary">All questions</p>
            <p className="text-sm text-text-tertiary mt-1">
              Every {subject} question in order ({total.toLocaleString()}), 10 at a time. Instant feedback, resumes where you left off.
            </p>
            <div className="flex justify-end mt-4">
              <button
                className="bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg px-5 py-2 text-xs font-bold cursor-pointer"
                onClick={() => onStart({ mode: 'all' })}
              >
                Start / Resume
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
