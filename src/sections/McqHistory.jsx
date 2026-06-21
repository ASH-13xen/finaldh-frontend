import { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';

const TOPIC_LINE_COLORS = ['#f59e0b', '#ec4899', '#22d3ee'];

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
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-950">
        <LoadingSpinner text="Loading your attempt history..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">My MCQ History</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Track your progress across all attempts.</p>
        </div>
        <button onClick={onBack} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer">
          Back to Tests
        </button>
      </div>

      {error && <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-sm font-semibold">{error}</div>}

      {!error && history.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-500">
          You haven't completed any MCQ tests yet.
        </div>
      ) : (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-extrabold text-slate-100 mb-1">Progress Over Time</h2>
            <p className="text-[11px] text-slate-500 mb-4">Overall accuracy, plus your 3 weakest topics from your latest attempt.</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={10} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="overall" name="Overall Accuracy" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
                  {topTopics.map((topic, i) => (
                    <Line key={topic} type="monotone" dataKey={topic} name={topic} stroke={TOPIC_LINE_COLORS[i % TOPIC_LINE_COLORS.length]} strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {improvement && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-[11px]">
                  <span className="font-bold text-emerald-400">Most Improved: </span>
                  <span className="text-slate-300">{improvement.most.topic} ({improvement.most.delta >= 0 ? '+' : ''}{improvement.most.delta}%)</span>
                </div>
                <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl text-[11px]">
                  <span className="font-bold text-rose-400">Most Regressed: </span>
                  <span className="text-slate-300">{improvement.least.topic} ({improvement.least.delta >= 0 ? '+' : ''}{improvement.least.delta}%)</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-extrabold text-slate-100 mb-4">All Attempts</h2>
            <div className="space-y-2">
              {[...history].reverse().map((h) => (
                <button
                  key={h.attemptId}
                  onClick={() => onViewAttempt(h.attemptId)}
                  className="w-full flex items-center justify-between gap-3 p-3 bg-slate-950/40 hover:bg-slate-950/70 border border-slate-800 hover:border-accent-600/50 rounded-xl text-left transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-100 truncate">{h.testTitle}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{new Date(h.submittedAt).toLocaleString()} · {h.subject}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    <span className="text-xs font-bold text-accent-400">{h.totalMarksObtained}/{h.totalMarks}</span>
                    <span className="text-[10px] text-slate-400">{h.accuracyPercent}%</span>
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
