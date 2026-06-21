import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function McqTestList({ subject, onSelectTest, onBack }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTests = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/mcq/tests?subject=${encodeURIComponent(subject)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load tests');
        setTests(data.tests || []);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load tests.');
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
  }, [subject]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-950">
        <LoadingSpinner text="Loading tests..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">{subject}</h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Choose a test to begin.</p>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex-shrink-0"
        >
          Back to Subjects
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-sm font-semibold">{error}</div>
      )}

      {!error && tests.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-500">
          No tests available for this subject yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tests.map((test) => (
          <div
            key={test._id}
            onClick={() => onSelectTest(test)}
            className="bg-slate-900/50 border border-slate-800 hover:border-accent-500 rounded-2xl p-6 flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="space-y-3">
              <h3 className="font-bold text-slate-100 text-sm group-hover:text-accent-400 transition-colors leading-relaxed">
                {test.title}
              </h3>
              {test.description && (
                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{test.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5 text-[9px] font-bold uppercase">
                <span className="bg-slate-800 text-slate-300 rounded px-2 py-0.5">{test.durationMinutes} min</span>
                <span className="bg-slate-800 text-slate-300 rounded px-2 py-0.5">{test.questionCount} Qs</span>
                <span className="bg-slate-800 text-slate-300 rounded px-2 py-0.5">{test.totalMarks} marks</span>
                {test.negativeMarkingRatio > 0 && (
                  <span className="bg-rose-950/40 text-rose-400 border border-rose-900/40 rounded px-2 py-0.5">-{test.negativeMarkingRatio}</span>
                )}
              </div>
              {test.lastAttempt && (
                <div className="pt-1 text-[10px] text-accent-400 font-semibold">
                  Last attempt: {test.lastAttempt.score}/{test.totalMarks} ({test.lastAttempt.accuracyPercent}% accuracy)
                </div>
              )}
            </div>
            <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">{test.lastAttempt ? 'Retake' : 'Start'}</span>
              <span className="text-xs font-bold text-accent-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Open
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
