import { useState } from 'react';
import { reportQuestion } from './quizApi';

const primaryBtn = 'text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent disabled:opacity-40 rounded-lg px-4 py-2';
const secondaryBtn = 'text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised rounded-lg px-4 py-2';

export default function ReportQuestionModal({ questionId, questionLabel, onClose }) {
  const [reason, setReason] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');

  const submit = async () => {
    setState('sending');
    setError('');
    try {
      await reportQuestion(questionId, reason.trim());
      setState('done');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-950/60"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border-default rounded-2xl w-full max-w-md p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg text-text-primary">Report a problem</h3>
        <p className="text-xs text-text-tertiary mt-1">{questionLabel}</p>

        {state === 'done' ? (
          <>
            <p className="text-sm text-text-secondary mt-4">Thanks — we'll take a look.</p>
            <div className="flex justify-end mt-5">
              <button className={primaryBtn} onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
            <textarea
              className="w-full mt-4 p-3 rounded-lg text-sm bg-surface border border-border-default text-text-primary focus:outline-none focus:border-brand"
              style={{ minHeight: 96 }}
              placeholder="What's wrong with this question? (wrong answer, typo, unclear options…)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error && <p className="text-xs text-status-danger-text mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button className={secondaryBtn} onClick={onClose}>Cancel</button>
              <button className={primaryBtn} disabled={state === 'sending' || !reason.trim()} onClick={submit}>
                {state === 'sending' ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
