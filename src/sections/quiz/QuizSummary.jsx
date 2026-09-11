import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie
} from 'recharts';
import { getAttempt } from './quizApi';
import MatchListsView from './MatchListsView';

// End-of-attempt Performance Analysis for a Question Bank run. Mirrors the MCQ Test analyzer
// (sections/McqAnalyzer.jsx) in layout and colour language, but only shows panels the quiz
// actually has data for: the quiz is untimed, answered one question at a time with the answer
// revealed on Check, and its questions carry no difficulty or confidence tag. Timing here is an
// estimate from answer timestamps and is labelled as one.

const BUCKET_COLORS = {
  Weak: 'var(--color-status-danger-text)',
  Average: 'var(--color-status-warning-text)',
  Strong: 'var(--color-status-success-text)',
  'Not Attempted': 'var(--color-text-tertiary)'
};
const PIE_COLORS = {
  Correct: 'var(--color-status-success-text)',
  Wrong: 'var(--color-status-danger-text)',
  Skipped: 'var(--color-text-tertiary)'
};

const REVIEW_FILTERS = ['All', 'Correct', 'Wrong', 'Skipped'];
// A random/all run can span dozens of topics with one question each — past this many bars the
// chart is noise, so only the weakest are plotted and the rest are counted off in a note.
const TOPIC_CHART_LIMIT = 12;

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

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-surface border border-border-default rounded-2xl p-5 md:p-6">
      <h2 className="text-sm font-extrabold text-text-primary">{title}</h2>
      {subtitle
        ? <p className="text-[11px] text-text-tertiary mt-0.5 mb-4">{subtitle}</p>
        : <div className="mb-4" />}
      {children}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-sunken border border-border-default rounded-xl p-4 text-center">
      <p className={`text-xl font-extrabold ${accent || 'text-text-primary'}`}>{value}</p>
      <p className="text-[10px] text-text-tertiary font-bold uppercase mt-1">{label}</p>
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-xs text-text-secondary shadow-xl">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
    </div>
  );
};

const titleFor = (a) =>
  a.mode === 'topic' ? a.topic
  : a.mode === 'random' ? `Random test (${a.totalQuestions})`
  : 'All questions';

const configFor = (a) =>
  a.mode === 'topic' ? { mode: 'topic', topic: a.topic }
  : a.mode === 'random' ? { mode: 'random', size: a.totalQuestions }
  : { mode: 'all' };

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s} sec` : `${s} sec`;
};

const outcomeOf = (r) => (r.selectedKey == null ? 'Skipped' : r.isCorrect ? 'Correct' : 'Wrong');

export default function QuizSummary({ attemptId, onRetake, onBackToList }) {
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState('');
  const [reviewFilter, setReviewFilter] = useState('All');
  const [selectedIndex, setSelectedIndex] = useState(null);

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
  const analysis = attempt.analysis || null;
  const summary = analysis?.summary;
  const pace = analysis?.pace;

  const pieData = summary
    ? [
        { name: 'Correct', value: summary.totalCorrect },
        { name: 'Wrong', value: summary.totalWrong },
        { name: 'Skipped', value: summary.totalUnattempted }
      ].filter((d) => d.value > 0)
    : [];

  const topicBreakdown = analysis?.topicBreakdown || [];
  const questionTypeBreakdown = analysis?.questionTypeBreakdown || [];
  const weakTopics = analysis?.weakTopics || [];
  const minTopicSample = analysis?.minTopicSample ?? 3;

  // Only topics the student actually attempted can carry an accuracy figure.
  const scoredTopics = topicBreakdown.filter((t) => t.attempted > 0);
  const chartTopics = scoredTopics.slice(0, TOPIC_CHART_LIMIT);
  const hiddenTopicCount = scoredTopics.length - chartTopics.length;
  const hasJudgeableTopic = scoredTopics.some((t) => t.attempted >= minTopicSample);

  const filteredReview = review.filter((r) => reviewFilter === 'All' || outcomeOf(r) === reviewFilter);
  const activeQ = filteredReview.find((r) => r.index === selectedIndex) || filteredReview[0] || null;

  const swatchFor = (r) =>
    r.selectedKey == null ? 'bg-surface-raised text-text-tertiary border-border-default'
    : r.isCorrect ? 'bg-status-success-text text-white border-transparent'
    : 'bg-status-danger-text text-white border-transparent';

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-default pb-5">
        <div>
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Results</span>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-text-primary tracking-tight mt-1.5">
            {titleFor(attempt)}
          </h1>
          <p className="text-text-tertiary text-sm mt-1 font-medium">Performance analysis for this attempt.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg px-4 py-2 cursor-pointer"
            onClick={() => onRetake(configFor(attempt))}
          >
            {attempt.mode === 'random' ? 'New test' : 'Retake'}
          </button>
          <button
            className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised rounded-lg px-4 py-2 cursor-pointer"
            onClick={onBackToList}
          >
            Back to Quiz
          </button>
        </div>
      </div>

      {/* 1. Score summary */}
      <SectionCard title="Score Summary">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <Ring percent={attempt.score ?? summary?.scorePercent ?? 0} />
          <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Correct" value={summary ? summary.totalCorrect : attempt.totalCorrect} accent="text-status-success-text" />
            <StatCard label="Wrong" value={summary ? summary.totalWrong : '—'} accent="text-status-danger-text" />
            <StatCard label="Skipped" value={summary ? summary.totalUnattempted : '—'} />
            <StatCard label="Accuracy" value={summary ? `${summary.accuracyPercent}%` : '—'} accent="text-brand" />
          </div>
        </div>
        {summary && (
          <p className="text-[11px] text-text-secondary bg-sunken border border-border-default rounded-xl p-3 mt-4">
            You answered <span className="font-bold text-text-primary">{summary.totalAttempted} of {summary.totalQuestions}</span> questions
            and got <span className="font-bold text-text-primary">{summary.totalCorrect}</span> right —
            {' '}{summary.scorePercent}% of the full set, {summary.accuracyPercent}% of what you attempted.
          </p>
        )}
        {pieData.length > 0 && (
          <>
            <div className="h-[200px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center flex-wrap gap-4 text-[11px] font-semibold">
              {pieData.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PIE_COLORS[d.name] }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* 2. Pace — estimated, since the quiz has no timer */}
      {pace && (
        <SectionCard title="Pace" subtitle="Estimated from the time between your answers. Long breaks are excluded, so this reflects active practice only.">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Active time" value={formatDuration(pace.activeSeconds)} />
            <StatCard label="Avg / question" value={`${pace.avgSecondsPerQuestion} sec`} accent="text-brand" />
            <StatCard label="Questions measured" value={`${pace.measuredQuestions} / ${pace.answeredQuestions}`} />
          </div>
          {pace.measuredQuestions < pace.answeredQuestions && (
            <p className="text-[11px] text-text-tertiary mt-3">
              {pace.answeredQuestions - pace.measuredQuestions} question(s) had a long break before them and were left out of this average.
            </p>
          )}
        </SectionCard>
      )}

      {/* 3. Topic-wise accuracy */}
      {scoredTopics.length > 0 && (
        <SectionCard
          title="Topic-wise Accuracy"
          subtitle={scoredTopics.length > 1
            ? 'Sorted weakest first. Accuracy counts only the questions you attempted.'
            : 'Accuracy counts only the questions you attempted.'}
        >
          {scoredTopics.length > 1 ? (
            <>
              <div style={{ height: Math.max(180, chartTopics.length * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartTopics} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--color-text-tertiary)" fontSize={10} />
                    <YAxis type="category" dataKey="topic" width={160} stroke="var(--color-text-tertiary)" fontSize={10} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                      {chartTopics.map((entry) => <Cell key={entry.topic} fill={BUCKET_COLORS[entry.bucket]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {hiddenTopicCount > 0 && (
                <p className="text-[11px] text-text-tertiary mt-2">
                  Showing the {TOPIC_CHART_LIMIT} weakest topics · {hiddenTopicCount} more scored higher.
                </p>
              )}
            </>
          ) : (
            <div className="bg-sunken border border-border-default rounded-xl p-4 text-center">
              <p className="text-xl font-extrabold" style={{ color: BUCKET_COLORS[scoredTopics[0].bucket] }}>
                {scoredTopics[0].accuracy}%
              </p>
              <p className="text-[11px] text-text-tertiary mt-1">
                {scoredTopics[0].topic} — {scoredTopics[0].correct}/{scoredTopics[0].attempted} correct
              </p>
            </div>
          )}

          {weakTopics.length > 0 ? (
            <div className="mt-4 p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl">
              <p className="text-[10px] font-bold text-status-danger-text uppercase tracking-wide mb-1.5">Practice more — weak topics</p>
              <div className="flex flex-wrap gap-1.5">
                {weakTopics.map((t) => (
                  <span key={t} className="text-[11px] bg-surface border border-status-danger-text/30 text-status-danger-text rounded px-2 py-0.5">{t}</span>
                ))}
              </div>
            </div>
          ) : hasJudgeableTopic ? (
            <div className="mt-4 p-3 bg-status-success-bg border border-status-success-text/30 rounded-xl text-status-success-text text-xs font-semibold">
              No weak topics in this attempt — nice work!
            </div>
          ) : (
            <div className="mt-4 p-3 bg-sunken border border-border-default rounded-xl text-[11px] text-text-secondary">
              This set spread {scoredTopics.length} topics thinly, so no topic has the {minTopicSample} answers needed
              to call it weak. Run a topic-wise test to get a reliable read on one.
            </div>
          )}
        </SectionCard>
      )}

      {/* 4. Conceptual vs factual */}
      {questionTypeBreakdown.length > 0 && (
        <SectionCard title="Conceptual vs Factual" subtitle="Is reasoning or plain recall costing you more marks?">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={questionTypeBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="questionType" stroke="var(--color-text-tertiary)" fontSize={11} className="capitalize" />
                <YAxis domain={[0, 100]} stroke="var(--color-text-tertiary)" fontSize={10} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="accuracy" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {questionTypeBreakdown.map((qt) => (
              <div key={qt.questionType} className="text-[11px] text-text-secondary bg-sunken border border-border-default rounded-xl p-2.5 text-center capitalize">
                <span className="font-bold text-text-primary">{qt.questionType}: </span>
                {qt.correct}/{qt.attempted} correct{qt.unattempted > 0 ? `, ${qt.unattempted} skipped` : ''}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* 5. Answer review — palette left, detail right */}
      <SectionCard title="Answer Review" subtitle="Pick a question number to see the correct answer and why.">
        <div className="flex flex-wrap gap-2 mb-4">
          {REVIEW_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => { setReviewFilter(f); setSelectedIndex(null); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${reviewFilter === f ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary hover:bg-surface-raised'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {filteredReview.length === 0 ? (
          <p className="text-[11px] text-text-tertiary">No questions match this filter.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5">
            <div className="md:w-[196px]">
              <div className="grid grid-cols-6 md:grid-cols-5 gap-1.5 max-h-[240px] md:max-h-[520px] overflow-y-auto pr-1">
                {filteredReview.map((r) => (
                  <button
                    key={r.index}
                    onClick={() => setSelectedIndex(r.index)}
                    className={`w-9 h-9 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer border transition-all ${swatchFor(r)} ${activeQ?.index === r.index ? 'ring-2 ring-brand ring-offset-1 ring-offset-surface' : ''}`}
                  >
                    {r.index + 1}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1 mt-3 text-[10px] font-semibold text-text-tertiary">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-status-success-text inline-block" /> Correct</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-status-danger-text inline-block" /> Wrong</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-surface-raised border border-border-default inline-block" /> Skipped</span>
              </div>
            </div>

            {activeQ && (
              <div className={`p-4 rounded-xl border space-y-3 ${
                activeQ.selectedKey == null ? 'border-border-default bg-sunken/60'
                : activeQ.isCorrect ? 'border-status-success-text/30 bg-status-success-bg'
                : 'border-status-danger-text/30 bg-status-danger-bg'
              }`}>
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                  <span className="text-text-tertiary">Q{activeQ.index + 1}{activeQ.topic ? ` · ${activeQ.topic}` : ''}</span>
                  <span className={
                    activeQ.selectedKey == null ? 'text-text-tertiary'
                    : activeQ.isCorrect ? 'text-status-success-text'
                    : 'text-status-danger-text'
                  }>
                    {outcomeOf(activeQ)}
                  </span>
                </div>

                <div className="text-xs text-text-primary font-semibold leading-relaxed">
                  {activeQ.matchLists
                    ? <MatchListsView stem={activeQ.questionText} matchLists={activeQ.matchLists} />
                    : <p className="whitespace-pre-wrap">{activeQ.questionText}</p>}
                </div>

                {activeQ.statements?.length > 0 && (
                  <ul className="flex flex-col gap-1 pl-1 border-l-2 border-border-default">
                    {activeQ.statements.map((s, i) => (
                      <li key={i} className="text-[11px] text-text-secondary leading-relaxed pl-3 whitespace-pre-wrap">{s}</li>
                    ))}
                  </ul>
                )}

                <div className="space-y-1.5">
                  {activeQ.options.map((opt) => {
                    const isSelected = opt.key === activeQ.selectedKey;
                    const isCorrectOpt = opt.key === activeQ.correctKey;
                    return (
                      <div
                        key={opt.key}
                        className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-2 ${
                          isCorrectOpt ? 'border-status-success-text/40 bg-status-success-bg text-status-success-text'
                          : isSelected ? 'border-status-danger-text/40 bg-status-danger-bg text-status-danger-text'
                          : 'border-border-default text-text-tertiary'
                        }`}
                      >
                        <span className="font-bold">{opt.key}.</span> {opt.text}
                        {isCorrectOpt && <span className="ml-auto text-[9px] font-bold uppercase flex-none">Correct</span>}
                        {isSelected && !isCorrectOpt && <span className="ml-auto text-[9px] font-bold uppercase flex-none">Your answer</span>}
                      </div>
                    );
                  })}
                </div>

                {activeQ.whyCorrect && (
                  <div className="border-t border-border-default pt-2.5">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wide mb-1">Why</p>
                    <p className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap">{activeQ.whyCorrect}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {activeQ.questionType && <span className="text-[9px] bg-sunken border border-border-subtle text-text-tertiary rounded px-1.5 py-0.5 capitalize">{activeQ.questionType}</span>}
                  {activeQ.examSource && <span className="text-[9px] bg-accent-soft-bg border border-accent-soft-border text-brand rounded px-1.5 py-0.5">Appeared in: {activeQ.examSource}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
