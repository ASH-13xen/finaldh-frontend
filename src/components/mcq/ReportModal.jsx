import { useState } from 'react';
import { mcq, errorMessage } from '../../lib/mcqApi';
import { useToast } from '../Toast';
import { ActionButton, Modal } from './ui';

const REASONS = [
  { id: 'wrong-answer', label: 'The marked answer is wrong', hint: 'You think a different option is correct' },
  { id: 'wrong-question', label: 'The question is wrong or unclear', hint: 'Missing information, two right answers, bad wording' },
  { id: 'typo', label: 'Typo or formatting problem', hint: 'Spelling mistake, broken text, missing option' },
  { id: 'wrong-explanation', label: 'The explanation is wrong or missing', hint: 'The reasoning does not match the answer' },
  { id: 'other', label: 'Something else', hint: 'Tell us in your own words' }
];

// Report a question. Works during a live test too: the student can describe the problem without the
// answer key ever being revealed to them.
export default function ReportModal({ question, attemptId, onClose, onSubmitted }) {
  const toast = useToast();
  const [reason, setReason] = useState('wrong-answer');
  const [suggestedOption, setSuggestedOption] = useState('');
  const [suggestedExplanation, setSuggestedExplanation] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSending(true);
    setError('');
    try {
      await mcq(`/questions/${question._id}/report`, {
        method: 'POST',
        body: { reason, suggestedOption: reason === 'wrong-answer' ? suggestedOption || null : null, suggestedExplanation, comment, attemptId }
      });
      toast.success('Thanks! Your report was sent to the team. We will check this question.');
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  };

  return (
    <Modal
      title={`Report Question ${question.order}`}
      onClose={onClose}
      footer={
        <>
          <ActionButton tone="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" icon="send" onClick={submit} disabled={sending}>{sending ? 'Sending…' : 'Send report'}</ActionButton>
        </>
      }
    >
      <p className="text-sm text-text-tertiary leading-relaxed mb-4 line-clamp-2">“{question.questionText}”</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-text-primary mb-2">What is wrong?</legend>
        {REASONS.map((r) => (
          <label key={r.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${reason === r.id ? 'border-brand bg-accent-soft-bg' : 'border-border-default hover:border-text-tertiary'}`}>
            <input type="radio" name="report-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="mt-1 accent-brand" />
            <span>
              <span className="block text-sm font-semibold text-text-primary">{r.label}</span>
              <span className="block text-xs text-text-tertiary">{r.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {reason === 'wrong-answer' && (
        <div className="mt-5 rounded-xl bg-sunken border border-border-subtle p-4">
          <p className="text-sm font-bold text-text-primary mb-2">Which option do you think is correct? <span className="font-normal text-text-tertiary">(optional)</span></p>
          <div className="flex gap-2" role="radiogroup" aria-label="Suggested correct option">
            {['A', 'B', 'C', 'D'].map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={suggestedOption === o}
                onClick={() => setSuggestedOption(suggestedOption === o ? '' : o)}
                className={`w-12 h-12 rounded-xl border text-base font-extrabold cursor-pointer transition-all ${suggestedOption === o ? 'border-brand bg-brand text-text-on-accent' : 'border-border-default bg-surface text-text-secondary hover:border-text-tertiary'}`}
              >
                {o}
              </button>
            ))}
          </div>
          <label className="block text-sm font-bold text-text-primary mt-4 mb-1.5" htmlFor="report-expl">Why? <span className="font-normal text-text-tertiary">(a short explanation helps us verify quickly)</span></label>
          <textarea
            id="report-expl"
            value={suggestedExplanation}
            onChange={(e) => setSuggestedExplanation(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full bg-surface border border-border-default focus:border-brand rounded-xl px-4 py-3 text-sm text-text-primary"
            placeholder="e.g. Article 21 covers this, not Article 19…"
          />
        </div>
      )}

      <label className="block text-sm font-bold text-text-primary mt-5 mb-1.5" htmlFor="report-comment">Anything else we should know? <span className="font-normal text-text-tertiary">(optional)</span></label>
      <textarea
        id="report-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={1000}
        className="w-full bg-surface border border-border-default focus:border-brand rounded-xl px-4 py-3 text-sm text-text-primary"
      />

      {error && <p className="mt-3 text-sm font-semibold text-status-danger-text" role="alert">{error}</p>}
      <p className="text-xs text-text-tertiary mt-4 mb-2">You can report while a test is running — the answer stays hidden until you submit.</p>
    </Modal>
  );
}
