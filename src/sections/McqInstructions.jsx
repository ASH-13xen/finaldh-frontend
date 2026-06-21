import { useState } from 'react';

const DEFAULT_INSTRUCTIONS = [
  'The test contains multiple-choice questions, each with exactly 4 options.',
  'A countdown timer is displayed at the top. The test auto-submits when time runs out.',
  'Use "Save & Next" to record your answer and move on, "Mark for Review & Next" to flag a question without answering (or after answering), and "Clear Response" to remove your selected answer.',
  'The question palette on the side shows your progress: not visited, not answered, answered, and marked for review.',
  'You may navigate to any question at any time using the palette.',
  'Once submitted, a detailed performance analysis will be shown — you cannot resume the test after submitting.'
];

export default function McqInstructions({ test, onStart, onBack }) {
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const instructions = test.instructions?.length > 0 ? test.instructions : DEFAULT_INSTRUCTIONS;

  const handleStart = async () => {
    setStarting(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mcq/tests/${test._id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start test');
      onStart(data.attemptId);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to start test.');
      setStarting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-100 tracking-tight">{test.title}</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Read the instructions carefully before you begin.</p>
        </div>
        <button onClick={onBack} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex-shrink-0">
          Back
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-slate-100">{test.durationMinutes}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Minutes</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-slate-100">{test.questionCount}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Questions</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-slate-100">{test.totalMarks}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Total Marks</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-rose-400">-{test.negativeMarkingRatio}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Per Wrong Answer</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-extrabold text-slate-100 mb-4">Instructions</h2>
        <ul className="space-y-2.5">
          {instructions.map((line, idx) => (
            <li key={idx} className="text-xs text-slate-300 leading-relaxed flex gap-2.5">
              <span className="text-accent-400 font-bold flex-shrink-0">{idx + 1}.</span>
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-5 pt-5 border-t border-slate-800">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Palette Legend</h3>
          <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-700 inline-block" /> Not Visited</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-600 inline-block" /> Not Answered</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Answered</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-600 inline-block" /> Marked for Review</span>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-4 h-4 accent-accent-600 cursor-pointer" />
        <span className="text-xs text-slate-300 font-semibold">I have read and understood the instructions above.</span>
      </label>

      {error && <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs font-semibold">{error}</div>}

      <button
        onClick={handleStart}
        disabled={!agreed || starting}
        className="w-full py-3 bg-accent-600 hover:bg-accent-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-sm font-bold transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
      >
        {starting ? 'Starting...' : 'I am ready to begin'}
      </button>
    </div>
  );
}
