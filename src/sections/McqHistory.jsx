import { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';
import Icon from '../components/mcq/Icon';
import { ActionButton, Card, EmptyState, ErrorBanner, ModeBadge } from '../components/mcq/ui';
import { mcq, errorMessage, formatDate, formatDuration } from '../lib/mcqApi';
import { displaySubjectName } from '../lib/mcqSubjects';

const TOPIC_LINE_COLORS = ['var(--color-status-warning-text)', 'var(--color-status-info-text)', 'var(--color-status-success-text)'];
const MODES = [['all', 'All attempts'], ['test', 'Tests'], ['practice', 'Practice']];

const ProgressTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-sm text-text-secondary shadow-xl max-w-64">
      <p className="font-bold text-text-primary">{row.title}</p>
      <p className="text-xs text-text-tertiary mb-1">{row.date}</p>
      {payload.map((p) => p.value != null && <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}%</p>)}
    </div>
  );
};

export default function McqHistory({ onBack, onViewAttempt }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('all');
  const [mode, setMode] = useState('all');

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await mcq('/attempts/history');
        if (!cancelled) setHistory(data.history || []);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Failed to load history.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);
  const retry = () => { setLoading(true); setError(''); setReloadKey((k) => k + 1); };

  const subjects = useMemo(() => [...new Set(history.map((h) => h.subject))].sort(), [history]);

  // Attempts oldest -> newest after filtering. The chart is always about ONE kind of thing: a single
  // subject when one is picked, otherwise per-attempt accuracy labelled by test (it used to blend every
  // test into one misleading "progress" line).
  const filtered = useMemo(
    () => history.filter((h) => (subject === 'all' || h.subject === subject) && (mode === 'all' || h.mode === mode)),
    [history, subject, mode]
  );

  const weakestTopics = useMemo(() => {
    if (subject === 'all' || filtered.length === 0) return [];
    const latest = filtered[filtered.length - 1];
    return [...latest.topicAccuracy].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3).map((t) => t.topic);
  }, [filtered, subject]);

  // Flagged / mistakes sessions mix questions from many tests, so they are listed below but not plotted:
  // a 100% on three hand-picked questions is not comparable with a full test.
  const chartData = useMemo(() => filtered.filter((h) => (h.source || 'test') === 'test').map((h, i) => {
    const row = { label: `#${i + 1}`, title: h.testTitle, date: formatDate(h.submittedAt), overall: h.accuracyPercent };
    weakestTopics.forEach((t) => { row[t] = h.topicAccuracy.find((x) => x.topic === t)?.accuracy ?? null; });
    return row;
  }), [filtered, weakestTopics]);

  // "Compared with last time": latest attempt vs the previous attempt on the SAME test
  const comparison = useMemo(() => {
    if (filtered.length < 2) return null;
    const latest = filtered[filtered.length - 1];
    const previous = [...filtered.slice(0, -1)].reverse().find((h) => h.testId && h.testId === latest.testId);
    if (!previous) return null;
    const deltas = latest.topicAccuracy
      .map((t) => { const p = previous.topicAccuracy.find((x) => x.topic === t.topic); return p ? { topic: t.topic, delta: Math.round((t.accuracy - p.accuracy) * 100) / 100 } : null; })
      .filter(Boolean)
      .sort((a, b) => b.delta - a.delta);
    return {
      title: latest.testTitle,
      accuracyDelta: Math.round((latest.accuracyPercent - previous.accuracyPercent) * 100) / 100,
      best: deltas[0], worst: deltas[deltas.length - 1]
    };
  }, [filtered]);

  const list = [...filtered].reverse();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Loading your attempt history..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-10 flex flex-col gap-6">
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-text-secondary hover:text-brand mb-3 cursor-pointer">
          <Icon name="arrowLeft" className="w-4 h-4" /> Back
        </button>
        <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">My progress</h1>
        <p className="text-base text-text-secondary mt-1">Every attempt you have finished, and how you are improving.</p>
      </div>

      {error && <ErrorBanner onRetry={retry}>{error}</ErrorBanner>}

      {!error && history.length === 0 ? (
        <EmptyState icon="chart" title="No finished attempts yet" action={<ActionButton tone="primary" icon="arrowLeft" onClick={onBack}>Find a test</ActionButton>}>
          Once you finish a test or practice session, your results and progress show up here.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <label className="flex items-center gap-2 text-sm font-bold text-text-secondary">
              Subject
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-surface border border-border-default focus:border-brand rounded-xl px-3 py-2 text-sm font-semibold text-text-primary max-w-72">
                <option value="all">All subjects</option>
                {subjects.map((s) => <option key={s} value={s}>{displaySubjectName(s)}</option>)}
              </select>
            </label>
            <div className="flex gap-2" role="tablist" aria-label="Attempt type">
              {MODES.map(([id, label]) => (
                <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`px-4 py-2 rounded-full text-sm font-bold cursor-pointer ${mode === id ? 'bg-brand text-text-on-accent' : 'bg-surface border border-border-default text-text-secondary hover:border-text-tertiary'}`}>{label}</button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="filter" title="No attempts match these filters" action={<ActionButton tone="secondary" onClick={() => { setSubject('all'); setMode('all'); }}>Clear filters</ActionButton>} />
          ) : (
            <>
              <Card
                title="Accuracy over time"
                subtitle={subject === 'all' ? 'Accuracy of each attempt, oldest to newest. Pick a subject to also see your weakest topics.' : `Accuracy in ${displaySubjectName(subject)}, plus your 3 weakest topics from the latest attempt.`}
              >
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                      <XAxis dataKey="label" stroke="var(--color-text-tertiary)" fontSize={12} />
                      <YAxis domain={[0, 100]} stroke="var(--color-text-tertiary)" fontSize={12} />
                      <Tooltip content={<ProgressTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 13 }} />
                      <Line type="monotone" dataKey="overall" name="Accuracy" stroke="var(--color-brand)" strokeWidth={3} dot={{ r: 4 }} />
                      {weakestTopics.map((t, i) => (
                        <Line key={t} type="monotone" dataKey={t} name={t} stroke={TOPIC_LINE_COLORS[i % TOPIC_LINE_COLORS.length]} strokeWidth={1.75} dot={{ r: 3 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {comparison && (
                  <div className="grid md:grid-cols-3 gap-3 mt-4 text-sm">
                    <div className="p-3.5 bg-sunken border border-border-default rounded-xl">
                      <b className="text-text-primary">Vs your previous attempt on “{comparison.title}”: </b>
                      <span className={comparison.accuracyDelta >= 0 ? 'text-status-success-text font-bold' : 'text-status-danger-text font-bold'}>{comparison.accuracyDelta >= 0 ? '+' : ''}{comparison.accuracyDelta}% accuracy</span>
                    </div>
                    {comparison.best && <div className="p-3.5 bg-status-success-bg border border-status-success-text/30 rounded-xl"><b className="text-status-success-text">Most improved: </b><span className="text-text-secondary">{comparison.best.topic} ({comparison.best.delta >= 0 ? '+' : ''}{comparison.best.delta}%)</span></div>}
                    {comparison.worst && comparison.worst !== comparison.best && <div className="p-3.5 bg-status-danger-bg border border-status-danger-text/30 rounded-xl"><b className="text-status-danger-text">Slipped most: </b><span className="text-text-secondary">{comparison.worst.topic} ({comparison.worst.delta >= 0 ? '+' : ''}{comparison.worst.delta}%)</span></div>}
                  </div>
                )}
              </Card>

              <Card title="All attempts" subtitle="Tap one to see its full results and explanations.">
                <ul className="flex flex-col gap-2.5">
                  {list.map((h) => (
                    <li key={h.attemptId}>
                      <button onClick={() => onViewAttempt(h.attemptId)} className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-sunken hover:bg-surface-raised border border-border-default hover:border-brand/60 rounded-xl text-left transition cursor-pointer">
                        <div className="min-w-0">
                          <p className="text-base font-bold text-text-primary truncate">{h.testTitle}</p>
                          <p className="text-sm text-text-tertiary mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <ModeBadge mode={h.mode} source={h.source} />
                            <span>{formatDate(h.submittedAt)}</span>
                            <span>· {displaySubjectName(h.subject)}</span>
                            {h.totalTimeSpentSeconds > 0 && <span>· {formatDuration(h.totalTimeSpentSeconds)}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-lg font-extrabold text-brand">{h.totalMarksObtained}<span className="text-sm text-text-tertiary font-semibold">/{h.totalMarks}</span></span>
                          <span className="text-sm font-bold text-text-secondary w-14 text-right">{h.accuracyPercent}%</span>
                          <Icon name="chevronRight" className="w-5 h-5 text-text-tertiary" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
