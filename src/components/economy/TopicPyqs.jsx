import { useState } from 'react';
import LoadingSpinner from '../LoadingSpinner';
import MatchListsView from '../../sections/quiz/MatchListsView';
import { getTopicPyqs, checkPyq } from '../../lib/economyApi';

// "PYQs on this topic" under a Master File topic card: the Economy Question Bank PYQs placed
// under this topic (by AI or an admin). Collapsed until opened, then loaded once; tap an option
// to check it — the answer comes from the server, like the Question Bank runner.

export default function TopicPyqs({ topicId, count }) {
  const [open, setOpen] = useState(false);
  const [pyqs, setPyqs] = useState(null);
  const [error, setError] = useState('');

  const toggle = () => {
    setOpen((o) => !o);
    if (!pyqs) getTopicPyqs(topicId).then((d) => setPyqs(d.pyqs)).catch((e) => setError(e.message));
  };

  return (
    <div className="px-4 sm:px-5 sm:pl-14 pb-3">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand hover:underline cursor-pointer"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true">▸</span>
        PYQs on this topic · {count}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {error && <p className="text-xs text-status-danger-text">{error}</p>}
          {!pyqs && !error && <div className="py-4 flex justify-center"><LoadingSpinner /></div>}
          {pyqs?.map((q, i) => <PyqCard key={q._id} q={q} n={i + 1} />)}
        </div>
      )}
    </div>
  );
}

function PyqCard({ q, n }) {
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);     // { correct, correctKey, whyCorrect }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (key) => {
    if (result || busy) return;
    setPicked(key);
    setBusy(true);
    setError('');
    try {
      setResult(await checkPyq(q._id, key));
    } catch (e) {
      setError(e.message);
      setPicked(null);
    } finally {
      setBusy(false);
    }
  };

  const optionCls = (key) => {
    if (!result) return picked === key ? 'border-brand bg-accent-soft-bg' : 'border-border-default hover:border-brand cursor-pointer';
    if (key === result.correctKey) return 'border-status-success-text bg-status-success-bg';
    if (key === picked) return 'border-status-danger-text bg-status-danger-bg';
    return 'border-border-default opacity-60';
  };

  return (
    <div className="rounded-xl border border-border-default bg-sunken px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-extrabold text-text-tertiary">Q{n}</span>
        {q.examSource && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent-soft-bg text-brand border border-accent-soft-border">{q.examSource}</span>}
        {q.questionType && <span className="text-[9px] font-bold uppercase tracking-wide text-text-tertiary">{q.questionType}</span>}
      </div>
      <div className="text-sm text-text-primary">
        {q.matchLists
          ? <MatchListsView stem={q.questionText} matchLists={q.matchLists} />
          : <p className="whitespace-pre-line leading-relaxed">{q.questionText}</p>}
        {q.statements?.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5 border-l-2 border-border-default">
            {q.statements.map((s, i) => <li key={i} className="text-[13px] text-text-secondary leading-relaxed pl-3 whitespace-pre-line">{s}</li>)}
          </ul>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-1.5 mt-2.5">
        {q.options.map((o) => (
          <button
            key={o.key}
            onClick={() => pick(o.key)}
            disabled={!!result || busy}
            className={`flex items-start gap-2 text-left rounded-lg border px-2.5 py-1.5 text-[13px] text-text-primary bg-surface transition-colors ${optionCls(o.key)}`}
          >
            <span className="font-extrabold text-text-tertiary">{o.key}</span>
            <span className="leading-snug">{o.text}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-status-danger-text mt-2">{error}</p>}
      {result && (
        <div className="mt-2.5">
          <p className={`text-[11px] font-extrabold uppercase tracking-widest ${result.correct ? 'text-status-success-text' : 'text-status-danger-text'}`}>
            {result.correct ? '✓ Correct' : `✗ Correct answer: ${result.correctKey}`}
          </p>
          {result.whyCorrect && <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line mt-1">{result.whyCorrect}</p>}
        </div>
      )}
    </div>
  );
}
