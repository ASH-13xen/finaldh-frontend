import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, ScatterChart, Scatter, ReferenceLine
} from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';
import Icon from '../components/mcq/Icon';
import ReportModal from '../components/mcq/ReportModal';
import { ActionButton, Card, Chip, ErrorBanner, ModeBadge, ToolButton } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import { mcq, errorMessage, formatDuration, formatDate } from '../lib/mcqApi';

const BUCKET_COLORS = { Weak: 'var(--color-status-danger-text)', Average: 'var(--color-status-warning-text)', Strong: 'var(--color-status-success-text)', 'Not Attempted': 'var(--color-text-tertiary)' };
const PIE_COLORS = { Correct: 'var(--color-status-success-text)', Wrong: 'var(--color-status-danger-text)', Skipped: 'var(--color-text-tertiary)' };
const QUADRANT_COLORS = { Mastered: 'var(--color-status-success-text)', 'Needs Speed Practice': 'var(--color-status-warning-text)', 'Careless Mistakes': 'var(--color-brand)', 'Needs Concept Clarity': 'var(--color-status-danger-text)' };

const axisProps = { stroke: 'var(--color-text-tertiary)', fontSize: 12 };

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-sm text-text-secondary shadow-xl">
      {label !== undefined && <p className="font-bold mb-1">{label}</p>}
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
    </div>
  );
};

function StatCard({ label, value, sub, tone }) {
  const color = { good: 'text-status-success-text', bad: 'text-status-danger-text', brand: 'text-brand', muted: 'text-text-tertiary' }[tone] || 'text-text-primary';
  return (
    <div className="bg-sunken border border-border-default rounded-xl p-4">
      <p className={`text-2xl md:text-3xl font-extrabold leading-none ${color}`}>{value}</p>
      <p className="text-sm text-text-secondary font-semibold mt-2">{label}</p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

function Note({ children }) {
  return <p className="text-sm text-text-secondary bg-sunken border border-border-default rounded-xl p-3.5 mb-4 leading-relaxed">{children}</p>;
}

// Collapsible section used for the analytics area
function Disclosure({ title, subtitle, open, onToggle, children, id }) {
  return (
    <section id={id} className="bg-surface border border-border-default rounded-2xl">
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left cursor-pointer">
        <span>
          <span className="block text-lg font-extrabold text-text-primary">{title}</span>
          {subtitle && <span className="block text-sm text-text-tertiary mt-0.5">{subtitle}</span>}
        </span>
        <Icon name="chevronDown" className={`w-6 h-6 text-text-tertiary transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 md:px-6 pb-6 flex flex-col gap-5 border-t border-border-default pt-5">{children}</div>}
    </section>
  );
}

function ReviewCard({ q, flagged, onFlag, onReport }) {
  const status = q.isCorrect === true ? 'correct' : q.isCorrect === false ? 'wrong' : 'skipped';
  const [showExplanation, setShowExplanation] = useState(status !== 'correct'); // open by default where there is something to learn
  const frame = { correct: 'border-status-success-text/40', wrong: 'border-status-danger-text/40', skipped: 'border-border-default' }[status];

  return (
    <article className={`bg-surface border-2 rounded-2xl p-5 flex flex-col gap-4 ${frame}`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold text-text-primary">Question {q.order}</span>
          {status === 'correct' && <Chip tone="success"><Icon name="check" className="w-3 h-3" /> Correct +{q.marksAwarded}</Chip>}
          {status === 'wrong' && <Chip tone="danger"><Icon name="x" className="w-3 h-3" /> Wrong {q.marksAwarded}</Chip>}
          {status === 'skipped' && <Chip>Skipped</Chip>}
          <Chip>{q.difficulty}</Chip>
          <Chip><Icon name="clock" className="w-3 h-3" /> {formatDuration(q.timeSpentSeconds)}</Chip>
        </div>
        <div className="flex gap-2">
          <ToolButton icon="bookmark" label={flagged ? 'Flagged' : 'Flag'} active={flagged} onClick={onFlag} hint="Save to your Flagged list to practise again later" />
          <ToolButton icon="alert" label={q.reported ? 'Reported' : 'Report'} active={q.reported} activeTone="danger" onClick={onReport} hint="Tell us if this question or answer is wrong" />
        </div>
      </header>

      <p className="text-base md:text-lg font-semibold text-text-primary leading-relaxed whitespace-pre-wrap">{q.questionText}</p>

      <div className="flex flex-col gap-2">
        {q.options.map((opt) => {
          const isCorrect = opt.label === q.correctOption;
          const isPick = opt.label === q.selectedOption;
          let cls = 'border-border-default text-text-secondary';
          if (isCorrect) cls = 'border-status-success-text/60 bg-status-success-bg text-text-primary';
          else if (isPick) cls = 'border-status-danger-text/60 bg-status-danger-bg text-text-primary';
          return (
            <div key={opt.label} className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-base leading-relaxed ${cls}`}>
              <span className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-extrabold ${isCorrect ? 'bg-status-success-text border-status-success-text text-white' : isPick ? 'bg-status-danger-text border-status-danger-text text-white' : 'border-border-default text-text-tertiary'}`}>{opt.label}</span>
              <span className="flex-1 pt-0.5">{opt.text}</span>
              {isCorrect && <span className="text-xs font-extrabold uppercase text-status-success-text pt-1">Correct answer</span>}
              {isPick && !isCorrect && <span className="text-xs font-extrabold uppercase text-status-danger-text pt-1">Your answer</span>}
            </div>
          );
        })}
      </div>

      <div>
        <button onClick={() => setShowExplanation((v) => !v)} aria-expanded={showExplanation} className="flex items-center gap-1.5 text-sm font-bold text-brand cursor-pointer">
          <Icon name="chevronDown" className={`w-4 h-4 transition-transform ${showExplanation ? 'rotate-180' : ''}`} />
          {showExplanation ? 'Hide explanation' : 'Show explanation'}
        </button>
        {showExplanation && (
          <div className="mt-2.5 rounded-xl bg-sunken border border-border-default px-5 py-4">
            <p className="text-base text-text-secondary leading-relaxed whitespace-pre-wrap">{q.explanation || 'No explanation has been added for this question yet.'}</p>
          </div>
        )}
      </div>

      {(q.tags.length > 0 || q.examSource || q.questionType) && (
        <div className="flex flex-wrap gap-1.5">
          {q.tags.map((t, i) => <Chip key={i}>{t.section}</Chip>)}
          {q.questionType && <Chip className="capitalize">{q.questionType}</Chip>}
          {q.examSource && <Chip tone="brand">Appeared in: {q.examSource}</Chip>}
        </div>
      )}
    </article>
  );
}

export default function McqAnalyzer({ attemptId, onBack, onViewHistory, onPracticeMistakes, onOpenFlagged }) {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewFilter, setReviewFilter] = useState('All');
  const [analyticsOpen, setAnalyticsOpen] = useState({});
  const [flagOverrides, setFlagOverrides] = useState({});
  const [reportTarget, setReportTarget] = useState(null);
  const [reportedIds, setReportedIds] = useState(() => new Set());
  const reviewRef = useRef(null);

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await mcq(`/attempts/${attemptId}/result`);
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Failed to load result.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId, reloadKey]);
  const retry = () => { setLoading(true); setError(''); setReloadKey((k) => k + 1); };

  const review = useMemo(() => (result?.questionReview || []).map((q) => ({
    ...q,
    flagged: flagOverrides[q.questionId] ?? q.flagged,
    reported: q.reported || reportedIds.has(q.questionId)
  })), [result, flagOverrides, reportedIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Crunching your performance data..." />
      </div>
    );
  }
  if (error || !result) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 flex flex-col gap-4">
        <ErrorBanner onRetry={retry}>{error || 'No result found.'}</ErrorBanner>
        <ActionButton tone="secondary" icon="arrowLeft" onClick={onBack}>Back to tests</ActionButton>
      </div>
    );
  }

  const {
    summary, topicBreakdown, weakTopics, difficultyBreakdown, questionTypeBreakdown, timeAnalysis, timeSlotBreakdown,
    quadrantAnalysis, negativeMarkingImpact, bonusInsights, confidenceBreakdown, confidenceImpact,
    decisionIntelligenceIndex, narrativeInsights, personalizedInsights, rank, mode, source, isRanked, attempts
  } = result;

  const practice = mode === 'practice';
  const attempted = summary.totalCorrect + summary.totalWrong;
  const total = review.length;
  const hasConfidenceData = confidenceBreakdown && (confidenceBreakdown.sure.total + confidenceBreakdown.elimination.total + confidenceBreakdown.guess.total) > 0;
  const hasTimeSlotData = timeSlotBreakdown && timeSlotBreakdown.some((s) => s.attempted + s.unattempted > 0);

  const verdict = attempted === 0
    ? { text: 'You did not answer any questions in this attempt.', tone: 'muted' }
    : summary.accuracyPercent >= 75 ? { text: 'Excellent work — you are strong here.', tone: 'good' }
      : summary.accuracyPercent >= 50 ? { text: 'A solid start — a little more practice will lift this.', tone: 'brand' }
        : { text: 'This topic needs more work — the review below shows exactly where.', tone: 'bad' };

  const pieData = [
    { name: 'Correct', value: summary.totalCorrect },
    { name: 'Wrong', value: summary.totalWrong },
    { name: 'Skipped', value: summary.totalUnattempted }
  ];
  const negMarkingData = [
    { name: 'Your score', value: negativeMarkingImpact.actualScore },
    { name: 'If wrong skipped', value: negativeMarkingImpact.scoreIfWrongWereSkipped },
    { name: 'If skipped guessed', value: negativeMarkingImpact.expectedIfUnattemptedWereGuessedRandomly }
  ];

  const FILTERS = [
    ['All', total],
    ['Wrong', review.filter((q) => q.isCorrect === false).length],
    ['Correct', review.filter((q) => q.isCorrect === true).length],
    ['Skipped', review.filter((q) => q.selectedOption === null).length],
    ['Marked', review.filter((q) => q.status === 'marked-for-review' || q.status === 'answered-marked-for-review').length],
    ['Flagged', review.filter((q) => q.flagged).length]
  ];
  const filteredReview = review.filter((q) => {
    if (reviewFilter === 'Wrong') return q.isCorrect === false;
    if (reviewFilter === 'Correct') return q.isCorrect === true;
    if (reviewFilter === 'Skipped') return q.selectedOption === null;
    if (reviewFilter === 'Marked') return q.status === 'marked-for-review' || q.status === 'answered-marked-for-review';
    if (reviewFilter === 'Flagged') return q.flagged;
    return true;
  });

  const showMistakes = () => {
    setReviewFilter('Wrong');
    reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleFlag = async (q) => {
    const was = q.flagged;
    setFlagOverrides((prev) => ({ ...prev, [q.questionId]: !was }));
    try {
      await mcq(`/flags/${q.questionId}`, { method: was ? 'DELETE' : 'PUT', body: was ? undefined : {} });
      toast.success(was ? 'Removed from your Flagged list.' : 'Saved to your Flagged list.', 2200);
    } catch (err) {
      setFlagOverrides((prev) => ({ ...prev, [q.questionId]: was }));
      toast.error(errorMessage(err));
    }
  };

  const toggleSection = (key) => setAnalyticsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const allOpen = ['topics', 'time', 'decisions', 'more'].every((k) => analyticsOpen[k]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-10 flex flex-col gap-6">
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-text-secondary hover:text-brand mb-3 cursor-pointer">
          <Icon name="arrowLeft" className="w-4 h-4" /> Back to tests
        </button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2"><ModeBadge mode={mode} source={source} /> {result.submittedAt && <span className="text-sm text-text-tertiary">{formatDate(result.submittedAt)}</span>}</div>
            <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">{result.testTitle}</h1>
            <p className="text-base text-text-secondary mt-1">Your results</p>
          </div>
          <ActionButton tone="secondary" icon="chart" onClick={onViewHistory}>My progress</ActionButton>
        </div>
      </div>

      {/* 1. Scorecard */}
      <Card>
        <div className="grid lg:grid-cols-[1fr_220px] gap-6 items-center">
          <div>
            <p className={`text-base font-bold mb-4 ${{ good: 'text-status-success-text', bad: 'text-status-danger-text', brand: 'text-brand', muted: 'text-text-tertiary' }[verdict.tone]}`}>{verdict.text}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Score" value={`${summary.totalMarksObtained}/${summary.totalMarks}`} tone="brand" />
              <StatCard label="Accuracy" value={`${summary.accuracyPercent}%`} sub={`${summary.totalCorrect} of ${attempted} attempted`} tone={summary.accuracyPercent >= 50 ? 'good' : 'bad'} />
              <StatCard label="Time taken" value={formatDuration(summary.totalTimeSpentSeconds)} sub={practice ? 'no time limit' : `of ${summary.durationMinutes} min`} />
              {isRanked && rank?.value ? (
                <StatCard label="Your rank" value={`#${rank.value}`} sub={`of ${rank.totalParticipants} · ahead of ${Math.round(rank.percentile)}%`} tone="brand" />
              ) : (
                <StatCard label="Skipped" value={summary.totalUnattempted} sub={practice ? 'practice is not ranked' : 'left blank'} />
              )}
            </div>
          </div>
          <div className="h-[200px]" aria-label={`${summary.totalCorrect} correct, ${summary.totalWrong} wrong, ${summary.totalUnattempted} skipped`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                  {pieData.map((e) => <Cell key={e.name} fill={PIE_COLORS[e.name]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-sm font-semibold mt-2">
          {pieData.map((d) => (
            <span key={d.name} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[d.name] }} />{d.name}: {d.value}</span>
          ))}
        </div>
      </Card>

      {/* 2. What to do next */}
      <Card title="What to do next" subtitle="The quickest ways to turn this result into improvement.">
        {weakTopics.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-bold text-status-danger-text mb-2">Topics to revise</p>
            <div className="flex flex-wrap gap-1.5">{weakTopics.map((t) => <Chip key={t} tone="danger">{t}</Chip>)}</div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {summary.totalWrong > 0 && <ActionButton tone="primary" icon="eye" onClick={showMistakes}>Review my {summary.totalWrong} mistake{summary.totalWrong !== 1 ? 's' : ''}</ActionButton>}
          {summary.totalWrong > 0 && <ActionButton tone="soft" icon="refresh" onClick={() => onPracticeMistakes(attemptId)} hint="Practise just the questions you got wrong — this does not use an attempt">Practise my mistakes</ActionButton>}
          <ActionButton tone="secondary" icon="bookmark" onClick={onOpenFlagged}>My flagged questions</ActionButton>
          <ActionButton tone="secondary" icon="layers" onClick={onBack}>Back to tests</ActionButton>
        </div>
        {attempts && (
          <p className="text-sm text-text-tertiary mt-4 leading-relaxed">
            {attempts.remaining > 0
              ? <>You have <b className="text-text-primary">{attempts.remaining} attempt{attempts.remaining !== 1 ? 's' : ''} left</b> on this test — use {attempts.remaining > 1 ? 'them' : 'it'} for Practice mode to learn from these mistakes, or Test mode to measure your progress.</>
              : <>You have used all attempts on this test. Keep revising with your explanations, flagged questions and mistakes practice — they are unlimited.</>}
          </p>
        )}
      </Card>

      {/* 3. Question review */}
      <section ref={reviewRef} className="flex flex-col gap-4 scroll-mt-32" aria-label="Question review">
        <div>
          <h2 className="text-xl font-display font-extrabold text-text-primary">Question-by-question review</h2>
          <p className="text-sm text-text-tertiary mt-0.5">Read every explanation — this is where most of the learning happens. Flag anything you want to practise again.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Review filter">
          {FILTERS.map(([f, n]) => (
            <button
              key={f}
              role="tab"
              aria-selected={reviewFilter === f}
              onClick={() => setReviewFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-bold cursor-pointer transition-all ${reviewFilter === f ? 'bg-brand text-text-on-accent' : 'bg-surface border border-border-default text-text-secondary hover:border-text-tertiary'}`}
            >
              {f} <span className="opacity-70">({n})</span>
            </button>
          ))}
        </div>
        {filteredReview.length === 0 ? (
          <div className="bg-surface border border-dashed border-border-default rounded-2xl py-12 text-center text-text-tertiary text-base">No questions in this view.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredReview.map((q) => (
              <ReviewCard key={q.order} q={q} flagged={q.flagged} onFlag={() => toggleFlag(q)} onReport={() => setReportTarget(q)} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Detailed analytics, tucked away so the page above stays simple */}
      <div className="flex items-center justify-between gap-3 mt-2">
        <div>
          <h2 className="text-xl font-display font-extrabold text-text-primary">Detailed analytics</h2>
          <p className="text-sm text-text-tertiary mt-0.5">Charts and insights for going deeper. Open only what you need.</p>
        </div>
        <ActionButton tone="ghost" size="sm" onClick={() => setAnalyticsOpen(allOpen ? {} : { topics: true, time: true, decisions: true, more: true })}>{allOpen ? 'Collapse all' : 'Expand all'}</ActionButton>
      </div>

      <Disclosure id="topics" title="Topics & difficulty" subtitle="Which subjects you are strong in, and how you handle easy vs hard questions." open={!!analyticsOpen.topics} onToggle={() => toggleSection('topics')}>
        <Card title="Topic-wise accuracy" subtitle="Weakest topics first. Red bars are where extra practice pays off most.">
          <div style={{ height: Math.max(220, topicBreakdown.length * 44) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicBreakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} {...axisProps} />
                <YAxis type="category" dataKey="topic" width={170} {...axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="accuracy" name="Accuracy %" radius={[0, 4, 4, 0]}>
                  {topicBreakdown.map((e) => <Cell key={e.topic} fill={BUCKET_COLORS[e.bucket]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Difficulty-wise accuracy" subtitle="Do you slip on easy questions, or struggle only with hard ones?">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="difficulty" {...axisProps} />
                <YAxis domain={[0, 100]} {...axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="accuracy" name="Accuracy %" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        {questionTypeBreakdown && questionTypeBreakdown.length > 0 && (
          <Card title="Conceptual vs factual" subtitle="Is understanding or memorised recall the bigger gap?">
            <div className="grid grid-cols-2 gap-3">
              {questionTypeBreakdown.map((qt) => (
                <StatCard key={qt.questionType} label={`${qt.questionType[0].toUpperCase()}${qt.questionType.slice(1)}`} value={qt.accuracy === null ? '—' : `${qt.accuracy}%`} sub={`${qt.correct}/${qt.attempted} correct${qt.unattempted ? `, ${qt.unattempted} skipped` : ''}`} />
              ))}
            </div>
          </Card>
        )}
      </Disclosure>

      <Disclosure id="time" title="Time & pace" subtitle="Where your time went, and whether speed affected accuracy." open={!!analyticsOpen.time} onToggle={() => toggleSection('time')}>
        <Card title="Time per question" subtitle={`Ideal pace is about ${Math.round(timeAnalysis.idealTimePerQuestion)}s per question. Amber = rushed and wrong, red = spent far too long.`}>
          {narrativeInsights?.timePressureNote && <Note>{narrativeInsights.timePressureNote}</Note>}
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis type="number" dataKey="order" name="Question" {...axisProps} />
                <YAxis type="number" dataKey="timeSpentSeconds" name="Seconds" {...axisProps} />
                <ReferenceLine y={timeAnalysis.idealTimePerQuestion} stroke="var(--color-brand)" strokeDasharray="4 4" label={{ value: 'Ideal', fill: 'var(--color-brand)', fontSize: 12, position: 'right' }} />
                <Tooltip content={<ChartTooltip />} />
                <Scatter data={timeAnalysis.perQuestion} fill="var(--color-text-tertiary)">
                  {timeAnalysis.perQuestion.map((d) => (
                    <Cell key={d.order} fill={d.tooFast ? 'var(--color-status-warning-text)' : d.tooSlow ? 'var(--color-status-danger-text)' : (d.isCorrect ? 'var(--color-status-success-text)' : 'var(--color-text-tertiary)')} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="grid md:grid-cols-2 gap-3 mt-4 text-sm">
            <div className="p-3.5 bg-status-warning-bg border border-status-warning-text/30 rounded-xl"><b className="text-status-warning-text">Rushed &amp; wrong: </b><span className="text-text-secondary">{timeAnalysis.rushedWrongQuestions.length === 0 ? 'None' : timeAnalysis.rushedWrongQuestions.map((o) => `Q${o}`).join(', ')}</span></div>
            <div className="p-3.5 bg-status-danger-bg border border-status-danger-text/30 rounded-xl"><b className="text-status-danger-text">Time sinks: </b><span className="text-text-secondary">{timeAnalysis.timeSinkQuestions.length === 0 ? 'None' : timeAnalysis.timeSinkQuestions.map((o) => `Q${o}`).join(', ')}</span></div>
          </div>
        </Card>
        {hasTimeSlotData && (
          <Card title="Performance over time" subtitle="Accuracy across the four quarters of the exam — spot fatigue or a slow start.">
            {narrativeInsights?.fatigueNote && <Note>{narrativeInsights.fatigueNote}</Note>}
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSlotBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                  <XAxis dataKey="slot" {...axisProps} />
                  <YAxis domain={[0, 100]} {...axisProps} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="accuracy" name="Accuracy %" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        <Card title="Speed vs accuracy by topic" subtitle="Fast and accurate (top-left) is the goal for every topic.">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis type="number" dataKey="avgTimeSpent" name="Avg time (s)" {...axisProps} />
                <YAxis type="number" dataKey="accuracy" name="Accuracy %" domain={[0, 100]} {...axisProps} />
                <ReferenceLine y={50} stroke="var(--color-border-default)" strokeDasharray="4 4" />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-sm text-text-secondary shadow-xl">
                      <p className="font-bold">{d.topic}</p>
                      <p>Accuracy: {d.accuracy}%</p>
                      <p>Avg time: {d.avgTimeSpent}s</p>
                      <p style={{ color: QUADRANT_COLORS[d.bucket] }}>{d.bucket}</p>
                    </div>
                  );
                }} />
                <Scatter data={quadrantAnalysis} fill="var(--color-brand)">
                  {quadrantAnalysis.map((d) => <Cell key={d.topic} fill={QUADRANT_COLORS[d.bucket]} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs font-semibold">
            {Object.entries(QUADRANT_COLORS).map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: color }} />{label}</span>
            ))}
          </div>
        </Card>
      </Disclosure>

      <Disclosure id="decisions" title="Decisions & risk" subtitle="Negative marking, and how well your confidence matched reality." open={!!analyticsOpen.decisions} onToggle={() => toggleSection('decisions')}>
        <Card title="Negative marking impact" subtitle="What wrong answers cost you.">
          <p className="text-base text-text-secondary mb-4 leading-relaxed">
            You lost <b className="text-status-danger-text">{negativeMarkingImpact.marksLostToNegativeMarking} marks</b> to {negativeMarkingImpact.totalWrong} wrong answer(s). Skipping those instead would have scored <b className="text-status-success-text">{negativeMarkingImpact.scoreIfWrongWereSkipped}</b>.
          </p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={negMarkingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Marks" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-text-tertiary mt-2">“If skipped guessed” is a statistical projection of random guessing (25% chance with 4 options) — not a recommendation to guess.</p>
        </Card>

        <Card title="Decision confidence" subtitle="How your self-rated confidence lined up with what was actually correct.">
          {hasConfidenceData ? (
            <>
              <div className="grid md:grid-cols-3 gap-3">
                <StatCard label="100% sure" value={`${confidenceBreakdown.sure.correct}/${confidenceBreakdown.sure.total}`} tone="good" />
                <StatCard label="Eliminated options" value={`${confidenceBreakdown.elimination.correct}/${confidenceBreakdown.elimination.total}`} />
                <StatCard label="Just a guess" value={`${confidenceBreakdown.guess.correct}/${confidenceBreakdown.guess.total}`} />
              </div>
              {confidenceImpact && confidenceImpact.elimination.count > 0 && (
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  {['sure', 'elimination', 'guess'].map((tag) => confidenceImpact[tag].count > 0 && (
                    <p key={tag} className="text-xs text-text-tertiary text-center">vs random guessing: <b className={confidenceImpact[tag].marksGainedVsRandomGuessing >= 0 ? 'text-status-success-text' : 'text-status-danger-text'}>{confidenceImpact[tag].marksGainedVsRandomGuessing >= 0 ? '+' : ''}{confidenceImpact[tag].marksGainedVsRandomGuessing} marks</b></p>
                  ))}
                </div>
              )}
              {narrativeInsights?.confidenceInsight && <div className="mt-4"><Note>{narrativeInsights.confidenceInsight}</Note></div>}
            </>
          ) : (
            <p className="text-sm text-text-tertiary">You did not rate your confidence on any question in this attempt. Try the “How sure are you?” buttons next time.</p>
          )}
        </Card>

        <Card title="Decision Intelligence Index" subtitle="A calibration score for how well your confidence and risk-taking matched reality.">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="text-center shrink-0">
              <p className="text-5xl font-extrabold text-brand">{decisionIntelligenceIndex.score}</p>
              <p className="text-xs text-text-tertiary font-bold uppercase mt-1">out of 100</p>
            </div>
            <p className="text-base text-text-secondary leading-relaxed">{decisionIntelligenceIndex.insight}</p>
          </div>
        </Card>
      </Disclosure>

      <Disclosure id="more" title="Personal insights" subtitle="Specific call-outs generated from this attempt." open={!!analyticsOpen.more} onToggle={() => toggleSection('more')}>
        {personalizedInsights && personalizedInsights.length > 0 && (
          <ul className="space-y-2">
            {personalizedInsights.map((insight, i) => (
              <li key={i} className="text-base text-text-secondary bg-sunken border border-border-default rounded-xl p-3.5 flex gap-2.5"><span className="text-brand font-bold">→</span><span>{insight}</span></li>
            ))}
          </ul>
        )}
        <div className="grid md:grid-cols-2 gap-3 text-sm text-text-secondary">
          <div className="p-4 bg-sunken border border-border-default rounded-xl">
            <b className="text-text-primary">Marked-for-review follow-through: </b>
            {bonusInsights.markedFollowThrough.totalMarked === 0 ? 'You did not mark any questions for review.' : `${bonusInsights.markedFollowThrough.changedBeforeSubmit}/${bonusInsights.markedFollowThrough.totalMarked} marked questions were revised before submitting.`}
          </div>
          <div className="p-4 bg-sunken border border-border-default rounded-xl">
            <b className="text-text-primary">Changing your mind: </b>
            {bonusInsights.indecisiveQuestions.length === 0 ? 'No repeated answer changes that ended up wrong.' : `Q${bonusInsights.indecisiveQuestions.join(', Q')} were changed several times and still ended up wrong.`}
          </div>
        </div>
        {narrativeInsights?.attemptProfileNote && <Note>{narrativeInsights.attemptProfileNote}</Note>}
      </Disclosure>

      {reportTarget && (
        <ReportModal
          question={{ _id: reportTarget.questionId, order: reportTarget.order, questionText: reportTarget.questionText }}
          attemptId={attemptId}
          onClose={() => setReportTarget(null)}
          onSubmitted={() => setReportedIds((prev) => new Set(prev).add(reportTarget.questionId))}
        />
      )}
    </div>
  );
}
