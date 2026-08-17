import { useState } from 'react';
import Button from '../components/Button';

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
      <div className="flex items-center justify-between border-b border-border-default pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-extrabold text-text-primary tracking-tight">{test.title}</h1>
          <p className="text-text-tertiary text-sm mt-1 font-medium">Read the instructions carefully before you begin.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack}>Back</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-border-default rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-text-primary">{test.durationMinutes}</p>
          <p className="text-[10px] text-text-tertiary font-bold uppercase mt-0.5">Minutes</p>
        </div>
        <div className="bg-surface border border-border-default rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-text-primary">{test.questionCount}</p>
          <p className="text-[10px] text-text-tertiary font-bold uppercase mt-0.5">Questions</p>
        </div>
        <div className="bg-surface border border-border-default rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-text-primary">{test.totalMarks}</p>
          <p className="text-[10px] text-text-tertiary font-bold uppercase mt-0.5">Total Marks</p>
        </div>
        <div className="bg-surface border border-border-default rounded-xl p-4 text-center">
          <p className="text-lg font-extrabold text-status-danger-text">-{test.negativeMarkingRatio}</p>
          <p className="text-[10px] text-text-tertiary font-bold uppercase mt-0.5">Per Wrong Answer</p>
        </div>
      </div>

      <div className="bg-surface border border-border-default rounded-2xl p-6">
        <h2 className="text-sm font-extrabold text-text-primary mb-4">Instructions</h2>
        <ul className="space-y-2.5">
          {instructions.map((line, idx) => (
            <li key={idx} className="text-xs text-text-secondary leading-relaxed flex gap-2.5">
              <span className="text-brand font-bold flex-shrink-0">{idx + 1}.</span>
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-5 pt-5 border-t border-border-default">
          <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">Palette Legend</h3>
          <div className="flex flex-wrap gap-3 text-[10px] text-text-tertiary">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-surface-raised border border-border-default inline-block" /> Not Visited</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-status-danger-text inline-block" /> Not Answered</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand inline-block" /> Answered</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-status-info-text inline-block" /> Marked for Review</span>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2.5 bg-surface border border-border-default rounded-xl p-4 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-4 h-4 accent-brand cursor-pointer" />
        <span className="text-xs text-text-secondary font-semibold">I have read and understood the instructions above.</span>
      </label>

      {error && <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>}

      <Button variant="primary" fullWidth disabled={!agreed || starting} onClick={handleStart}>
        {starting ? 'Starting...' : 'I am ready to begin'}
      </Button>
    </div>
  );
}
