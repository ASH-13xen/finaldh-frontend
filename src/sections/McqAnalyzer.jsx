import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, ScatterChart, Scatter, ReferenceLine
} from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';

const BUCKET_COLORS = { Weak: '#f43f5e', Average: '#f59e0b', Strong: '#10b981', 'Not Attempted': '#64748b' };
const PIE_COLORS = { Correct: '#10b981', Wrong: '#f43f5e', Unattempted: '#64748b' };
const QUADRANT_COLORS = { Mastered: '#10b981', 'Needs Speed Practice': '#f59e0b', 'Careless Mistakes': '#fb923c', 'Needs Concept Clarity': '#f43f5e' };

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-sm font-extrabold text-slate-100">{title}</h2>
      {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
      <p className={`text-xl font-extrabold ${accent || 'text-slate-100'}`}>{value}</p>
      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{label}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 shadow-xl">
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
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-950">
        <LoadingSpinner text="Crunching your performance data..." />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-950 px-4">
        <div className="p-6 bg-rose-950/20 border border-rose-900/40 rounded-2xl text-rose-400 text-sm font-semibold">{error || 'No result found.'}</div>
      </div>
    );
  }

  const { summary, topicBreakdown, weakTopics, difficultyBreakdown, timeAnalysis, quadrantAnalysis, negativeMarkingImpact, questionReview, bonusInsights } = result;

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
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">{result.testTitle} — Result</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Detailed performance analysis.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onViewHistory} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer">
            My History
          </button>
          <button onClick={onBackToTests} className="px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-xs font-bold transition cursor-pointer">
            Back to Tests
          </button>
        </div>
      </div>

      {/* 1. Summary */}
      <SectionCard title="Overall Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Score" value={`${summary.totalMarksObtained}/${summary.totalMarks}`} accent="text-accent-400" />
          <StatCard label="Accuracy" value={`${summary.accuracyPercent}%`} accent="text-emerald-400" />
          <StatCard label="Attempted" value={summary.totalCorrect + summary.totalWrong} />
          <StatCard label="Skipped" value={summary.totalUnattempted} />
        </div>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={10} />
              <YAxis type="category" dataKey="topic" width={180} stroke="#64748b" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                {topicBreakdown.map((entry) => <Cell key={entry.topic} fill={BUCKET_COLORS[entry.bucket]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {weakTopics.length > 0 ? (
          <div className="mt-4 p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl">
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wide mb-1.5">Practice more — weak topics</p>
            <div className="flex flex-wrap gap-1.5">
              {weakTopics.map(t => <span key={t} className="text-[11px] bg-slate-900 border border-rose-900/40 text-rose-300 rounded px-2 py-0.5">{t}</span>)}
            </div>
          </div>
        ) : (
          <div className="mt-4 p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400 text-xs font-semibold">
            No weak topics detected in this attempt — nice work!
          </div>
        )}
      </SectionCard>

      {/* 3. Difficulty-wise breakdown */}
      <SectionCard title="Difficulty-wise Accuracy">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={difficultyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="difficulty" stroke="#64748b" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="accuracy" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 4. Time management */}
      <SectionCard title="Time Management" subtitle={`Ideal pace: ~${Math.round(timeAnalysis.idealTimePerQuestion)}s per question.`}>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" dataKey="order" name="Question" stroke="#64748b" fontSize={10} />
              <YAxis type="number" dataKey="timeSpentSeconds" name="Seconds" stroke="#64748b" fontSize={10} />
              <ReferenceLine y={timeAnalysis.idealTimePerQuestion} stroke="#8b5cf6" strokeDasharray="4 4" label={{ value: 'Ideal', fill: '#a78bfa', fontSize: 10, position: 'right' }} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={timeAnalysis.perQuestion} fill="#64748b">
                {timeAnalysis.perQuestion.map((d) => (
                  <Cell key={d.order} fill={d.tooFast ? '#fb923c' : d.tooSlow ? '#f43f5e' : (d.isCorrect ? '#10b981' : '#64748b')} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl text-[11px]">
            <span className="font-bold text-amber-400">Rushed & wrong: </span>
            <span className="text-slate-300">{timeAnalysis.rushedWrongQuestions.length === 0 ? 'None' : timeAnalysis.rushedWrongQuestions.map(o => `Q${o}`).join(', ')}</span>
          </div>
          <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl text-[11px]">
            <span className="font-bold text-rose-400">Time sinks: </span>
            <span className="text-slate-300">{timeAnalysis.timeSinkQuestions.length === 0 ? 'None' : timeAnalysis.timeSinkQuestions.map(o => `Q${o}`).join(', ')}</span>
          </div>
        </div>
      </SectionCard>

      {/* 5. Speed vs accuracy quadrant */}
      <SectionCard title="Speed vs Accuracy by Topic" subtitle="Fast & accurate (top-left) is the goal for every topic.">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" dataKey="avgTimeSpent" name="Avg Time (s)" stroke="#64748b" fontSize={10} />
              <YAxis type="number" dataKey="accuracy" name="Accuracy %" domain={[0, 100]} stroke="#64748b" fontSize={10} />
              <ReferenceLine y={50} stroke="#475569" strokeDasharray="4 4" />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 shadow-xl">
                    <p className="font-bold">{d.topic}</p>
                    <p>Accuracy: {d.accuracy}%</p>
                    <p>Avg Time: {d.avgTimeSpent}s</p>
                    <p style={{ color: QUADRANT_COLORS[d.bucket] }}>{d.bucket}</p>
                  </div>
                );
              }} />
              <Scatter data={quadrantAnalysis} fill="#8b5cf6">
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
        <p className="text-xs text-slate-300 mb-4">
          You lost <span className="font-bold text-rose-400">{negativeMarkingImpact.marksLostToNegativeMarking} marks</span> to {negativeMarkingImpact.totalWrong} incorrect attempt(s). Skipping those instead would have given you a score of <span className="font-bold text-emerald-400">{negativeMarkingImpact.scoreIfWrongWereSkipped}</span>.
        </p>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={negMarkingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">"If Guessed Randomly" is a statistical projection of pure random guessing on skipped questions (25% chance correct with 4 options) — not a recommendation to guess.</p>
      </SectionCard>

      {/* 9. Bonus insights + coming soon */}
      <SectionCard title="Additional Insights">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-[11px] text-slate-300">
            <span className="font-bold text-slate-200">Marked-for-review follow-through: </span>
            {bonusInsights.markedFollowThrough.totalMarked === 0
              ? 'You didn\'t mark any questions for review.'
              : `${bonusInsights.markedFollowThrough.changedBeforeSubmit}/${bonusInsights.markedFollowThrough.totalMarked} marked questions were revised before submitting.`}
          </div>
          <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-[11px] text-slate-300">
            <span className="font-bold text-slate-200">Indecision flag: </span>
            {bonusInsights.indecisiveQuestions.length === 0
              ? 'No repeated answer changes leading to a wrong answer.'
              : `Q${bonusInsights.indecisiveQuestions.join(', Q')} were changed multiple times and still incorrect.`}
          </div>
        </div>
        <div className="mt-3 p-3 bg-slate-950/40 border border-dashed border-slate-700 rounded-xl text-[11px] text-slate-500 text-center">
          Compare with other aspirants (coming soon)
        </div>
      </SectionCard>

      {/* 7. Question-by-question review */}
      <SectionCard title="Question-by-Question Review">
        <div className="flex flex-wrap gap-2 mb-4">
          {['All', 'Correct', 'Wrong', 'Unattempted', 'Marked'].map(f => (
            <button
              key={f}
              onClick={() => setReviewFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${reviewFilter === f ? 'bg-accent-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {filteredReview.map((q) => (
            <div key={q.order} className={`p-4 rounded-xl border space-y-2.5 ${q.isCorrect === true ? 'border-emerald-900/40 bg-emerald-950/10' : q.isCorrect === false ? 'border-rose-900/40 bg-rose-950/10' : 'border-slate-800 bg-slate-950/30'}`}>
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                <span className="text-slate-400">Q{q.order} · {q.difficulty} · {q.timeSpentSeconds}s</span>
                <span className={q.isCorrect === true ? 'text-emerald-400' : q.isCorrect === false ? 'text-rose-400' : 'text-slate-500'}>
                  {q.isCorrect === true ? 'Correct' : q.isCorrect === false ? 'Incorrect' : 'Unattempted'} ({q.marksAwarded >= 0 ? '+' : ''}{q.marksAwarded})
                </span>
              </div>
              <p className="text-xs text-slate-200 font-semibold leading-relaxed">{q.questionText}</p>
              <div className="space-y-1.5">
                {q.options.map(opt => {
                  const isSelected = opt.label === q.selectedOption;
                  const isCorrectOpt = opt.label === q.correctOption;
                  return (
                    <div
                      key={opt.label}
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-2 ${
                        isCorrectOpt ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-300'
                        : isSelected ? 'border-rose-700/50 bg-rose-950/20 text-rose-300'
                        : 'border-slate-800 text-slate-400'
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
                <p className="text-[11px] text-slate-400 italic border-t border-slate-800 pt-2">{q.explanation}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {q.tags.map((t, i) => <span key={i} className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 rounded px-1.5 py-0.5">{t.section}</span>)}
                {q.questionType && <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 rounded px-1.5 py-0.5 capitalize">{q.questionType}</span>}
                {q.examSource && <span className="text-[9px] bg-accent-950/40 border border-accent-900/40 text-accent-400 rounded px-1.5 py-0.5">Appeared in: {q.examSource}</span>}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
