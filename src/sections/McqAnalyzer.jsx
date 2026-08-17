import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, ScatterChart, Scatter, ReferenceLine
} from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';

const BUCKET_COLORS = { Weak: 'var(--color-status-danger-text)', Average: 'var(--color-status-warning-text)', Strong: 'var(--color-status-success-text)', 'Not Attempted': 'var(--color-text-tertiary)' };
const PIE_COLORS = { Correct: 'var(--color-status-success-text)', Wrong: 'var(--color-status-danger-text)', Unattempted: 'var(--color-text-tertiary)' };
const QUADRANT_COLORS = { Mastered: 'var(--color-status-success-text)', 'Needs Speed Practice': 'var(--color-status-warning-text)', 'Careless Mistakes': 'var(--color-brand)', 'Needs Concept Clarity': 'var(--color-status-danger-text)' };

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-surface border border-border-default rounded-2xl p-6">
      <h2 className="text-sm font-extrabold text-text-primary">{title}</h2>
      {subtitle && <p className="text-[11px] text-text-tertiary mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-xs text-text-secondary shadow-xl">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function McqAnalyzer({ attemptId, onBackToTests, onViewHistory }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewFilter, setReviewFilter] = useState('All');

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/mcq/attempts/${attemptId}/result`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load result');
        setResult(data);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load result.');
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Crunching your performance data..." />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page px-4">
        <div className="p-6 bg-status-danger-bg border border-status-danger-text/30 rounded-2xl text-status-danger-text text-sm font-semibold">{error || 'No result found.'}</div>
      </div>
    );
  }

  const { summary, topicBreakdown, weakTopics, difficultyBreakdown, questionTypeBreakdown, timeAnalysis, timeSlotBreakdown, quadrantAnalysis, negativeMarkingImpact, questionReview, bonusInsights, confidenceBreakdown, confidenceImpact, decisionIntelligenceIndex, narrativeInsights, personalizedInsights, rank } = result;

  const hasConfidenceData = confidenceBreakdown && (confidenceBreakdown.sure.total + confidenceBreakdown.elimination.total + confidenceBreakdown.guess.total) > 0;
  const hasTimeSlotData = timeSlotBreakdown && timeSlotBreakdown.some(s => s.attempted + s.unattempted > 0);

  const pieData = [
    { name: 'Correct', value: summary.totalCorrect },
    { name: 'Wrong', value: summary.totalWrong },
    { name: 'Unattempted', value: summary.totalUnattempted }
  ];

  const negMarkingData = [
    { name: 'Actual Score', value: negativeMarkingImpact.actualScore },
    { name: 'If Wrong Skipped', value: negativeMarkingImpact.scoreIfWrongWereSkipped },
    { name: 'If Guessed Randomly', value: negativeMarkingImpact.expectedIfUnattemptedWereGuessedRandomly }
  ];

  const filteredReview = questionReview.filter(q => {
    if (reviewFilter === 'All') return true;
    if (reviewFilter === 'Correct') return q.isCorrect === true;
    if (reviewFilter === 'Wrong') return q.isCorrect === false;
    if (reviewFilter === 'Unattempted') return q.selectedOption === null;
    if (reviewFilter === 'Marked') return q.status === 'marked-for-review' || q.status === 'answered-marked-for-review';
    return true;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-border-default pb-5">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-text-primary tracking-tight">{result.testTitle} — Result</h1>
          <p className="text-text-tertiary text-sm mt-1 font-medium">Detailed performance analysis.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onViewHistory}>My History</Button>
          <Button variant="primary" size="sm" onClick={onBackToTests}>Back to Tests</Button>
        </div>
      </div>

      {/* 1. Summary */}
      <SectionCard title="Overall Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Score" value={`${summary.totalMarksObtained}/${summary.totalMarks}`} accent="text-brand" />
          <StatCard label="Accuracy" value={`${summary.accuracyPercent}%`} accent="text-status-success-text" />
          <StatCard label="Attempted" value={summary.totalCorrect + summary.totalWrong} />
          <StatCard label="Skipped" value={summary.totalUnattempted} />
        </div>
        {narrativeInsights?.attemptProfileNote && (
          <p className="text-[11px] text-text-secondary bg-sunken border border-border-default rounded-xl p-3 mb-4">{narrativeInsights.attemptProfileNote}</p>
        )}
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {pieData.map((entry) => <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 text-[11px] font-semibold">
          {pieData.map(d => (
            <span key={d.name} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PIE_COLORS[d.name] }} />
              {d.name}: {d.value}
            </span>
          ))}
        </div>
      </SectionCard>

      {/* 2. Topic-wise breakdown */}
      <SectionCard title="Topic-wise Accuracy" subtitle="Weak topics need more practice — sorted weakest first.">
        <div style={{ height: Math.max(200, topicBreakdown.length * 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topicBreakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke="var(--color-text-tertiary)" fontSize={10} />
              <YAxis type="category" dataKey="topic" width={180} stroke="var(--color-text-tertiary)" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                {topicBreakdown.map((entry) => <Cell key={entry.topic} fill={BUCKET_COLORS[entry.bucket]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {weakTopics.length > 0 ? (
          <div className="mt-4 p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl">
            <p className="text-[10px] font-bold text-status-danger-text uppercase tracking-wide mb-1.5">Practice more — weak topics</p>
            <div className="flex flex-wrap gap-1.5">
              {weakTopics.map(t => <span key={t} className="text-[11px] bg-surface border border-status-danger-text/30 text-status-danger-text rounded px-2 py-0.5">{t}</span>)}
            </div>
          </div>
        ) : (
          <div className="mt-4 p-3 bg-status-success-bg border border-status-success-text/30 rounded-xl text-status-success-text text-xs font-semibold">
            No weak topics detected in this attempt — nice work!
          </div>
        )}
      </SectionCard>

      {/* 3. Difficulty-wise breakdown */}
      <SectionCard title="Difficulty-wise Accuracy">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={difficultyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="difficulty" stroke="var(--color-text-tertiary)" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="var(--color-text-tertiary)" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="accuracy" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 3b. Question type breakdown (conceptual vs factual) */}
      {questionTypeBreakdown && questionTypeBreakdown.length > 0 && (
        <SectionCard title="Conceptual vs Factual Mastery" subtitle="Does understanding-based reasoning or recall-based knowledge need more work?">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={questionTypeBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="questionType" stroke="var(--color-text-tertiary)" fontSize={11} className="capitalize" />
                <YAxis domain={[0, 100]} stroke="var(--color-text-tertiary)" fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="accuracy" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {questionTypeBreakdown.map(qt => (
              <div key={qt.questionType} className="text-[11px] text-text-secondary bg-sunken border border-border-default rounded-xl p-2.5 text-center capitalize">
                <span className="font-bold text-text-primary">{qt.questionType}: </span>
                {qt.correct}/{qt.attempted} correct{qt.unattempted > 0 ? `, ${qt.unattempted} skipped` : ''}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* 4. Time management */}
      <SectionCard title="Time Management" subtitle={`Ideal pace: ~${Math.round(timeAnalysis.idealTimePerQuestion)}s per question.`}>
        {narrativeInsights?.timePressureNote && (
          <p className="text-[11px] text-text-secondary bg-sunken border border-border-default rounded-xl p-3 mb-4">{narrativeInsights.timePressureNote}</p>
        )}
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis type="number" dataKey="order" name="Question" stroke="var(--color-text-tertiary)" fontSize={10} />
              <YAxis type="number" dataKey="timeSpentSeconds" name="Seconds" stroke="var(--color-text-tertiary)" fontSize={10} />
              <ReferenceLine y={timeAnalysis.idealTimePerQuestion} stroke="var(--color-brand)" strokeDasharray="4 4" label={{ value: 'Ideal', fill: 'var(--color-brand)', fontSize: 10, position: 'right' }} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={timeAnalysis.perQuestion} fill="var(--color-text-tertiary)">
                {timeAnalysis.perQuestion.map((d) => (
                  <Cell key={d.order} fill={d.tooFast ? 'var(--color-status-warning-text)' : d.tooSlow ? 'var(--color-status-danger-text)' : (d.isCorrect ? 'var(--color-status-success-text)' : 'var(--color-text-tertiary)')} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="p-3 bg-status-warning-bg border border-status-warning-text/30 rounded-xl text-[11px]">
            <span className="font-bold text-status-warning-text">Rushed & wrong: </span>
            <span className="text-text-secondary">{timeAnalysis.rushedWrongQuestions.length === 0 ? 'None' : timeAnalysis.rushedWrongQuestions.map(o => `Q${o}`).join(', ')}</span>
          </div>
          <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-[11px]">
            <span className="font-bold text-status-danger-text">Time sinks: </span>
            <span className="text-text-secondary">{timeAnalysis.timeSinkQuestions.length === 0 ? 'None' : timeAnalysis.timeSinkQuestions.map(o => `Q${o}`).join(', ')}</span>
          </div>
        </div>
      </SectionCard>

      {/* 4b. Time-slot / fatigue breakdown */}
      {hasTimeSlotData && (
        <SectionCard title="Performance Over Time" subtitle="Accuracy across the four quarters of your exam window — spot fatigue or a slow start.">
          {narrativeInsights?.fatigueNote && (
            <p className="text-[11px] text-text-secondary bg-sunken border border-border-default rounded-xl p-3 mb-4">{narrativeInsights.fatigueNote}</p>
          )}
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSlotBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="slot" stroke="var(--color-text-tertiary)" fontSize={9} />
                <YAxis domain={[0, 100]} stroke="var(--color-text-tertiary)" fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="accuracy" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* 5. Speed vs accuracy quadrant */}
      <SectionCard title="Speed vs Accuracy by Topic" subtitle="Fast & accurate (top-left) is the goal for every topic.">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis type="number" dataKey="avgTimeSpent" name="Avg Time (s)" stroke="var(--color-text-tertiary)" fontSize={10} />
              <YAxis type="number" dataKey="accuracy" name="Accuracy %" domain={[0, 100]} stroke="var(--color-text-tertiary)" fontSize={10} />
              <ReferenceLine y={50} stroke="var(--color-border-default)" strokeDasharray="4 4" />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-xs text-text-secondary shadow-xl">
                    <p className="font-bold">{d.topic}</p>
                    <p>Accuracy: {d.accuracy}%</p>
                    <p>Avg Time: {d.avgTimeSpent}s</p>
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
        <div className="flex flex-wrap gap-3 mt-3 text-[10px] font-semibold">
          {Object.entries(QUADRANT_COLORS).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />{label}</span>
          ))}
        </div>
      </SectionCard>

      {/* 6. Negative marking impact */}
      <SectionCard title="Negative Marking Impact">
        <p className="text-xs text-text-secondary mb-4">
          You lost <span className="font-bold text-status-danger-text">{negativeMarkingImpact.marksLostToNegativeMarking} marks</span> to {negativeMarkingImpact.totalWrong} incorrect attempt(s). Skipping those instead would have given you a score of <span className="font-bold text-status-success-text">{negativeMarkingImpact.scoreIfWrongWereSkipped}</span>.
        </p>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={negMarkingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--color-text-tertiary)" fontSize={10} />
              <YAxis stroke="var(--color-text-tertiary)" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-text-tertiary mt-2">"If Guessed Randomly" is a statistical projection of pure random guessing on skipped questions (25% chance correct with 4 options) — not a recommendation to guess.</p>
      </SectionCard>

      {/* Decision Confidence */}
      <SectionCard title="Decision Confidence" subtitle="How your self-rated confidence lined up with actual correctness.">
        {hasConfidenceData ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard label="100% Sure" value={`${confidenceBreakdown.sure.correct}/${confidenceBreakdown.sure.total}`} accent="text-status-success-text" />
              <StatCard label="Logical Elimination" value={`${confidenceBreakdown.elimination.correct}/${confidenceBreakdown.elimination.total}`} accent="text-status-info-text" />
              <StatCard label="Pure Guess" value={`${confidenceBreakdown.guess.correct}/${confidenceBreakdown.guess.total}`} accent="text-status-warning-text" />
            </div>
            {confidenceImpact && confidenceImpact.elimination.count > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                {['sure', 'elimination', 'guess'].map(tag => confidenceImpact[tag].count > 0 && (
                  <div key={tag} className="text-[10px] text-text-tertiary text-center">
                    vs. random guessing: <span className={confidenceImpact[tag].marksGainedVsRandomGuessing >= 0 ? 'text-status-success-text font-bold' : 'text-status-danger-text font-bold'}>
                      {confidenceImpact[tag].marksGainedVsRandomGuessing >= 0 ? '+' : ''}{confidenceImpact[tag].marksGainedVsRandomGuessing} marks
                    </span>
                  </div>
                ))}
              </div>
            )}
            {narrativeInsights?.confidenceInsight && (
              <p className="text-[11px] text-text-secondary bg-sunken border border-border-default rounded-xl p-3 mt-4">{narrativeInsights.confidenceInsight}</p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-text-tertiary">No confidence ratings were recorded for this attempt.</p>
        )}
      </SectionCard>

      {/* Decision Intelligence Index */}
      <SectionCard title="Decision Intelligence Index" subtitle="A calibration score for how well your confidence and risk-taking matched reality.">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0 text-center">
            <p className="text-4xl font-extrabold text-brand">{decisionIntelligenceIndex.score}</p>
            <p className="text-[10px] text-text-tertiary font-bold uppercase mt-1">out of 100</p>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">{decisionIntelligenceIndex.insight}</p>
        </div>
      </SectionCard>

      {/* Personalized insights (compound topic x confidence x time signals) */}
      {personalizedInsights && personalizedInsights.length > 0 && (
        <SectionCard title="Personalized Insights" subtitle="Specific, actionable call-outs generated from this attempt.">
          <ul className="space-y-2">
            {personalizedInsights.map((insight, i) => (
              <li key={i} className="text-xs text-text-secondary bg-sunken border border-border-default rounded-xl p-3 flex gap-2">
                <span className="text-brand font-bold">→</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* 9. Bonus insights + rank */}
      <SectionCard title="Additional Insights">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-sunken border border-border-default rounded-xl text-[11px] text-text-secondary">
            <span className="font-bold text-text-primary">Marked-for-review follow-through: </span>
            {bonusInsights.markedFollowThrough.totalMarked === 0
              ? 'You didn\'t mark any questions for review.'
              : `${bonusInsights.markedFollowThrough.changedBeforeSubmit}/${bonusInsights.markedFollowThrough.totalMarked} marked questions were revised before submitting.`}
          </div>
          <div className="p-3 bg-sunken border border-border-default rounded-xl text-[11px] text-text-secondary">
            <span className="font-bold text-text-primary">Indecision flag: </span>
            {bonusInsights.indecisiveQuestions.length === 0
              ? 'No repeated answer changes leading to a wrong answer.'
              : `Q${bonusInsights.indecisiveQuestions.join(', Q')} were changed multiple times and still incorrect.`}
          </div>
        </div>
        <div className="mt-3 p-3 bg-accent-soft-bg border border-accent-soft-border rounded-xl text-[11px] text-center">
          {rank?.value ? (
            <span className="text-text-primary font-semibold">
              Rank <span className="font-extrabold text-brand">{rank.value}</span> of {rank.totalParticipants} · <span className="font-extrabold text-brand">{rank.percentile}th</span> percentile
            </span>
          ) : (
            <span className="text-text-tertiary">Not enough data yet — be the first to set a benchmark on this test!</span>
          )}
        </div>
      </SectionCard>

      {/* 7. Question-by-question review */}
      <SectionCard title="Question-by-Question Review">
        <div className="flex flex-wrap gap-2 mb-4">
          {['All', 'Correct', 'Wrong', 'Unattempted', 'Marked'].map(f => (
            <button
              key={f}
              onClick={() => setReviewFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${reviewFilter === f ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary hover:bg-surface-raised'}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {filteredReview.map((q) => (
            <div key={q.order} className={`p-4 rounded-xl border space-y-2.5 ${q.isCorrect === true ? 'border-status-success-text/30 bg-status-success-bg' : q.isCorrect === false ? 'border-status-danger-text/30 bg-status-danger-bg' : 'border-border-default bg-sunken/60'}`}>
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                <span className="text-text-tertiary">Q{q.order} · {q.difficulty} · {q.timeSpentSeconds}s</span>
                <span className={q.isCorrect === true ? 'text-status-success-text' : q.isCorrect === false ? 'text-status-danger-text' : 'text-text-tertiary'}>
                  {q.isCorrect === true ? 'Correct' : q.isCorrect === false ? 'Incorrect' : 'Unattempted'} ({q.marksAwarded >= 0 ? '+' : ''}{q.marksAwarded})
                </span>
              </div>
              <p className="text-xs text-text-primary font-semibold leading-relaxed">{q.questionText}</p>
              <div className="space-y-1.5">
                {q.options.map(opt => {
                  const isSelected = opt.label === q.selectedOption;
                  const isCorrectOpt = opt.label === q.correctOption;
                  return (
                    <div
                      key={opt.label}
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-2 ${
                        isCorrectOpt ? 'border-status-success-text/40 bg-status-success-bg text-status-success-text'
                        : isSelected ? 'border-status-danger-text/40 bg-status-danger-bg text-status-danger-text'
                        : 'border-border-default text-text-tertiary'
                      }`}
                    >
                      <span className="font-bold">{opt.label}.</span> {opt.text}
                      {isCorrectOpt && <span className="ml-auto text-[9px] font-bold uppercase">Correct</span>}
                      {isSelected && !isCorrectOpt && <span className="ml-auto text-[9px] font-bold uppercase">Your Answer</span>}
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <p className="text-[11px] text-text-tertiary italic border-t border-border-default pt-2">{q.explanation}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {q.tags.map((t, i) => <span key={i} className="text-[9px] bg-sunken border border-border-subtle text-text-tertiary rounded px-1.5 py-0.5">{t.section}</span>)}
                {q.questionType && <span className="text-[9px] bg-sunken border border-border-subtle text-text-tertiary rounded px-1.5 py-0.5 capitalize">{q.questionType}</span>}
                {q.examSource && <span className="text-[9px] bg-accent-soft-bg border border-accent-soft-border text-brand rounded px-1.5 py-0.5">Appeared in: {q.examSource}</span>}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
