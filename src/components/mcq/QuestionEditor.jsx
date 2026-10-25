import { useState } from 'react';
import { mcq, errorMessage, formatDate } from '../../lib/mcqApi';
import { useToast } from '../Toast';
import { ActionButton, Modal } from './ui';

const inputCls = 'w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-sm font-semibold transition-all';
const labelCls = 'block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-1.5';

// Admin: edit an existing question (text, options, answer key, explanation...). Changing the correct
// answer re-scores every past attempt that contained the question (unchecked = leave old scores alone).
export default function QuestionEditor({ testId, question, marksDefault, onClose, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState(question.questionText);
  const [options, setOptions] = useState(() => ['A', 'B', 'C', 'D'].map((l) => question.options.find((o) => o.label === l)?.text || ''));
  const [correct, setCorrect] = useState(question.correctOption);
  const [explanation, setExplanation] = useState(question.explanation || '');
  const [difficulty, setDifficulty] = useState(question.difficulty || 'Medium');
  const [marks, setMarks] = useState(question.marks ?? '');
  const [tags, setTags] = useState((question.rawTags && question.rawTags.length ? question.rawTags : question.tags?.map((t) => t.title || t.section) || []).join('; '));
  const [examSource, setExamSource] = useState(question.examSource || '');
  const [questionType, setQuestionType] = useState(question.questionType || 'conceptual');
  const [active, setActive] = useState(question.isActive !== false);
  const [rescore, setRescore] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const answerChanged = correct !== question.correctOption;

  const save = async () => {
    if (!text.trim()) return setError('Question text is required.');
    if (options.some((o) => !o.trim())) return setError('All 4 options are required.');
    setSaving(true);
    setError('');
    try {
      const res = await mcq(`/admin/tests/${testId}/questions/${question._id}`, {
        method: 'PATCH',
        body: {
          questionText: text.trim(),
          options: ['A', 'B', 'C', 'D'].map((label, i) => ({ label, text: options[i].trim() })),
          correctOption: correct,
          explanation: explanation.trim(),
          difficulty,
          marks: marks === '' ? null : Number(marks),
          tags,
          examSource: examSource.trim(),
          questionType,
          isActive: active,
          rescore
        }
      });
      toast.success(res.answerChanged
        ? `Answer key updated.${res.rescoredAttempts ? ` ${res.rescoredAttempts} attempt(s) re-scored.` : ''}`
        : 'Question saved.');
      onSaved(res.question);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const history = question.answerHistory || [];

  return (
    <Modal
      title={`Edit question ${question.order}`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <ActionButton tone="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" icon="save" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</ActionButton>
        </>
      }
    >
      <div className="space-y-4 pb-4">
        <div>
          <label className={labelCls} htmlFor="qe-text">Question</label>
          <textarea id="qe-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} className={inputCls} />
        </div>

        <div>
          <p className={labelCls}>Options — select the radio next to the correct one</p>
          <div className="grid md:grid-cols-2 gap-3">
            {['A', 'B', 'C', 'D'].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                  <input type="radio" name="qe-correct" checked={correct === label} onChange={() => setCorrect(label)} className="w-4 h-4 accent-brand cursor-pointer" />
                  <span className="text-sm font-bold text-text-secondary w-4">{label}</span>
                </label>
                <input value={options[i]} onChange={(e) => setOptions((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))} className={inputCls} aria-label={`Option ${label}`} />
              </div>
            ))}
          </div>
          {answerChanged && (
            <label className="mt-3 flex items-start gap-2.5 bg-status-warning-bg border border-status-warning-text/30 rounded-xl px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={rescore} onChange={(e) => setRescore(e.target.checked)} className="w-4 h-4 mt-0.5 accent-brand cursor-pointer" />
              <span className="text-sm text-text-secondary leading-snug">
                <b className="text-status-warning-text">You are changing the correct answer ({question.correctOption} → {correct}).</b> Re-score every past attempt that contains this question, so students see the corrected answer and their totals, accuracy and ranks update. Untick to leave old scores as they were.
              </span>
            </label>
          )}
        </div>

        <div>
          <label className={labelCls} htmlFor="qe-expl">Explanation</label>
          <textarea id="qe-expl" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} className={inputCls} />
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className={labelCls} htmlFor="qe-diff">Difficulty</label>
            <select id="qe-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}><option>Easy</option><option>Medium</option><option>Hard</option></select>
          </div>
          <div>
            <label className={labelCls} htmlFor="qe-marks">Marks (override)</label>
            <input id="qe-marks" type="number" step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder={`Default: ${marksDefault}`} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="qe-type">Type</label>
            <select id="qe-type" value={questionType} onChange={(e) => setQuestionType(e.target.value)} className={inputCls}><option value="conceptual">Conceptual</option><option value="factual">Factual</option></select>
          </div>
          <div>
            <label className={labelCls} htmlFor="qe-source">Appeared in</label>
            <input id="qe-source" value={examSource} onChange={(e) => setExamSource(e.target.value)} placeholder="UPSC IES 2023" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="qe-tags">Tags (semicolon separated)</label>
          <input id="qe-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-brand cursor-pointer" />
          <span className="text-sm font-semibold text-text-secondary">Active <span className="font-normal text-text-tertiary">(untick to retire it: hidden from new attempts, kept for students' history)</span></span>
        </label>

        {history.length > 0 && (
          <div className="rounded-xl bg-sunken border border-border-subtle px-4 py-3">
            <p className={labelCls}>Answer-key history</p>
            <ul className="space-y-1 text-sm text-text-secondary">
              {history.slice().reverse().map((h, i) => (
                <li key={i}>{formatDate(h.changedAt)}: {h.fromOption ? `${h.fromOption} → ${h.toOption}` : 'explanation updated'}{h.explanationChanged && h.fromOption !== h.toOption ? ' + explanation' : ''}{h.note ? ` (${h.note})` : ''}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm font-semibold text-status-danger-text" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
