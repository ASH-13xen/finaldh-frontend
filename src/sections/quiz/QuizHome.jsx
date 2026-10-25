import { useState, useEffect, useMemo, useRef } from 'react';
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

  const [panelOpen, setPanelOpen] = useState(false);
  const [topicQuery, setTopicQuery] = useState('');
  const searchRef = useRef(null);

  const filteredTopics = useMemo(() => {
    const q = topicQuery.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((t) => t.topic.toLowerCase().includes(q));
  }, [topics, topicQuery]);

  useEffect(() => {
    if (!panelOpen) return undefined;
    searchRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setPanelOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen]);

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
    <>
    {/* ---- slide-in topic picker drawer (modelled on Toppers Copy "Related PYQs") ---- */}
    {panelOpen && (
      <div
        className="fixed inset-0 top-[73px] z-30 bg-black/30"
        onClick={() => setPanelOpen(false)}
      />
    )}
    <div
      className={`fixed left-0 top-[73px] bottom-0 w-80 sm:w-96 z-40 bg-surface border-r border-border-default shadow-2xl flex flex-col transition-transform duration-300 ${
        panelOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="px-5 py-4 border-b border-border-default flex items-start justify-between flex-shrink-0">
        <div className="min-w-0">
          <h3 className="font-bold text-text-primary text-sm">Choose a topic</h3>
          <p className="text-[10px] text-text-tertiary font-medium mt-0.5 truncate">
            {topics.length} topics · {total.toLocaleString()} questions
          </p>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-sunken text-text-secondary cursor-pointer text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="px-4 py-3 border-b border-border-default flex-shrink-0">
        <input
          ref={searchRef}
          type="text"
          value={topicQuery}
          onChange={(e) => setTopicQuery(e.target.value)}
          placeholder="Search topics…"
          className="w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
        />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {filteredTopics.length === 0 && !loading && (
          <p className="px-4 py-6 text-xs text-text-tertiary">No topics match “{topicQuery}”.</p>
        )}
        {filteredTopics.map((t) => (
          <button
            key={t.topic}
            type="button"
            onClick={() => { setSelectedTopic(t.topic); setPanelOpen(false); onStart({ mode: 'topic', topic: t.topic }); }}
            className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-raised ${
              selectedTopic === t.topic ? 'bg-surface-raised font-bold text-brand' : 'text-text-secondary'
            }`}
          >
            <span className="min-w-0 truncate">{t.topic}</span>
            <span className="text-[11px] text-text-tertiary flex-shrink-0">{t.total}</span>
          </button>
        ))}
      </div>
    </div>
    {!panelOpen && !loading && !error && total > 0 && (
      <button
        onClick={() => setPanelOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-brand hover:bg-brand-hover text-text-on-accent text-[9px] font-extrabold px-2 py-4 rounded-r-xl shadow-xl cursor-pointer tracking-widest uppercase"
        style={{ writingMode: 'vertical-rl' }}
      >
        Topics
      </button>
    )}

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
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="flex-1 flex items-center justify-between gap-2 bg-surface border border-border-default rounded-lg px-3 py-2.5 text-sm text-text-primary hover:border-brand focus:outline-none focus:border-brand cursor-pointer"
              >
                <span className={selectedTopic ? 'text-text-primary font-medium truncate' : 'text-text-tertiary'}>
                  {selectedTopic || 'Choose a topic…'}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 flex-shrink-0 text-text-tertiary"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
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
    </>
  );
}
