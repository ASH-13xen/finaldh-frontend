import { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';

const TOPIC_LINE_COLORS = ['var(--color-status-warning-text)', 'var(--color-status-info-text)', 'var(--color-status-success-text)'];

export default function McqHistory({ onBack, onViewAttempt }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/mcq/attempts/history', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load history');
        setHistory(data.history || []);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load history.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const topTopics = useMemo(() => {
    if (history.length === 0) return [];
    const latest = history[history.length - 1];
    return [...latest.topicAccuracy].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3).map(t => t.topic);
  }, [history]);

  const chartData = useMemo(() => history.map((h, idx) => {
    const row = { label: `#${idx + 1}`, date: new Date(h.submittedAt).toLocaleDateString(), overall: h.accuracyPercent };
    topTopics.forEach(topic => {
      const found = h.topicAccuracy.find(t => t.topic === topic);
      row[topic] = found ? found.accuracy : null;
    });
    return row;
  }), [history, topTopics]);

  const improvement = useMemo(() => {
    if (history.length < 2) return null;
    const prev = history[history.length - 2];
    const latest = history[history.length - 1];
    const deltas = [];
    latest.topicAccuracy.forEach(lt => {
      const pt = prev.topicAccuracy.find(t => t.topic === lt.topic);
      if (pt) deltas.push({ topic: lt.topic, delta: Math.round((lt.accuracy - pt.accuracy) * 100) / 100 });
    });
    if (deltas.length === 0) return null;
    deltas.sort((a, b) => b.delta - a.delta);
    return { most: deltas[0], least: deltas[deltas.length - 1] };
  }, [history]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Loading your attempt history..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-border-default pb-5">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-text-primary tracking-tight">My MCQ History</h1>
          <p className="text-text-tertiary text-sm mt-1 font-medium">Track your progress across all attempts.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack}>Back to Tests</Button>
      </div>

      {error && <div className="p-4 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-sm font-semibold">{error}</div>}

      {!error && history.length === 0 ? (
        <div className="bg-surface border border-border-default rounded-2xl p-16 text-center text-text-tertiary">
          You haven't completed any MCQ tests yet.
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border-default rounded-2xl p-6">
            <h2 className="text-sm font-extrabold text-text-primary mb-1">Progress Over Time</h2>
            <p className="text-[11px] text-text-tertiary mb-4">Overall accuracy, plus your 3 weakest topics from your latest attempt.</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                  <XAxis dataKey="label" stroke="var(--color-text-tertiary)" fontSize={10} />
                  <YAxis domain={[0, 100]} stroke="var(--color-text-tertiary)" fontSize={10} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-default)', borderRadius: 8, fontSize: 11, color: 'var(--color-text-primary)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="overall" name="Overall Accuracy" stroke="var(--color-brand)" strokeWidth={2.5} dot={{ r: 3 }} />
                  {topTopics.map((topic, i) => (
                    <Line key={topic} type="monotone" dataKey={topic} name={topic} stroke={TOPIC_LINE_COLORS[i % TOPIC_LINE_COLORS.length]} strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {improvement && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div className="p-3 bg-status-success-bg border border-status-success-text/30 rounded-xl text-[11px]">
                  <span className="font-bold text-status-success-text">Most Improved: </span>
                  <span className="text-text-secondary">{improvement.most.topic} ({improvement.most.delta >= 0 ? '+' : ''}{improvement.most.delta}%)</span>
                </div>
                <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-[11px]">
                  <span className="font-bold text-status-danger-text">Most Regressed: </span>
                  <span className="text-text-secondary">{improvement.least.topic} ({improvement.least.delta >= 0 ? '+' : ''}{improvement.least.delta}%)</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface border border-border-default rounded-2xl p-6">
            <h2 className="text-sm font-extrabold text-text-primary mb-4">All Attempts</h2>
            <div className="space-y-2">
              {[...history].reverse().map((h) => (
                <button
                  key={h.attemptId}
                  onClick={() => onViewAttempt(h.attemptId)}
                  className="w-full flex items-center justify-between gap-3 p-3 bg-sunken hover:bg-surface-raised border border-border-default hover:border-brand/50 rounded-xl text-left transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-primary truncate">{h.testTitle}</p>
                    <p className="text-[10px] text-text-tertiary mt-0.5">{new Date(h.submittedAt).toLocaleString()} · {h.subject}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    <span className="text-xs font-bold text-brand">{h.totalMarksObtained}/{h.totalMarks}</span>
                    <span className="text-[10px] text-text-tertiary">{h.accuracyPercent}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
