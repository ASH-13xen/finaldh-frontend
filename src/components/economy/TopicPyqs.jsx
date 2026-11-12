import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import LoadingSpinner from '../LoadingSpinner';
import MatchListsView from '../../sections/quiz/MatchListsView';
import { getTopicPyqs, checkPyq } from '../../lib/economyApi';

// UPSC previous year questions for a Master File topic: the Economy Question Bank PYQs placed
// under it (by AI or an admin). The card's left-edge "PYQ" tab opens them as a popup. Indigo + gold
// so they read as the real exam, not another notes box. Tap an option to check it — the answer
// comes from the server, like the Question Bank runner.

export function PyqEdgeTab({ count, onClick }) {
  return (
    <button
      onClick={onClick}
      title={`Open the ${count} UPSC previous year question${count === 1 ? '' : 's'} on this topic`}
      className="group absolute -left-[15px] top-14 z-10 flex flex-col items-center gap-1.5 py-2.5 w-[28px] rounded-lg bg-indigo-900 text-white shadow-md shadow-indigo-900/30 ring-2 ring-surface hover:bg-indigo-700 hover:-translate-x-0.5 transition-all cursor-pointer dark:bg-indigo-600 dark:hover:bg-indigo-500"
    >
      <span className="text-[11px] font-black px-1 min-w-[18px] rounded bg-amber-400 text-indigo-950 tabular-nums leading-[18px]">{count}</span>
      <span className="text-[11px] font-extrabold tracking-[0.15em] [writing-mode:vertical-rl] rotate-180">PYQ{count === 1 ? '' : 'S'}</span>
      <span aria-hidden="true" className="text-[12px] leading-none">🎯</span>
    </button>
  );
}

export default function TopicPyqsModal({ topicId, count, title, onClose }) {
  const [pyqs, setPyqs] = useState(null);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(false);

  useEffect(() => {
    getTopicPyqs(topicId).then((d) => setPyqs(d.pyqs)).catch((e) => setError(e.message));
  }, [topicId]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-6 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Previous year questions: ${title}`}
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-3xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden bg-indigo-50 dark:bg-[#15142b] shadow-2xl ring-1 ring-indigo-900/20 transition-all duration-200 ${shown ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-6 sm:translate-y-0 sm:scale-95'}`}
      >
        <header className="flex items-start gap-3 px-4 sm:px-5 py-3.5 bg-indigo-900 dark:bg-indigo-950 text-white flex-shrink-0">
          <span aria-hidden="true" className="text-xl leading-none pt-0.5">🎯</span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-indigo-100">
              UPSC previous year question{count === 1 ? '' : 's'}
              <span className="text-[11px] font-black px-1.5 py-0.5 rounded-md bg-amber-400 text-indigo-950 tabular-nums">{count}</span>
            </p>
            <h2 className="mt-0.5 text-[17px] font-bold leading-snug">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex-shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white text-base cursor-pointer">✕</button>
        </header>
        <div className="overflow-y-auto p-3 sm:p-5 space-y-3">
          <p className="text-[12px] font-semibold text-indigo-900/70 dark:text-indigo-200/70">Tap an option to check your answer.</p>
          {error && <p className="text-xs text-status-danger-text">{error}</p>}
          {!pyqs && !error && <div className="py-8 flex justify-center"><LoadingSpinner /></div>}
          {pyqs?.length === 0 && <p className="py-6 text-center text-sm font-semibold text-text-secondary">No PYQs on this topic yet.</p>}
          {pyqs?.map((q, i) => <PyqCard key={q._id} q={q} n={i + 1} total={pyqs.length} />)}
        </div>
      </section>
    </div>,
    document.body,
  );
}

// "Consider … assets - 1. Brand recognition 2. Inventory 3. … How many of the above …?"
// → stem, numbered items, closing question. Only when the numbers run 1, 2, 3… in order.
function splitInlineList(text) {
  if (!text || text.includes('\n')) return null;
  const marks = [...text.matchAll(/(^|\s)(\d{1,2})[.)]\s+/g)];
  const seq = [];
  for (const m of marks) if (Number(m[2]) === seq.length + 1) seq.push(m);
  if (seq.length < 2) return null;
  const at = (m) => m.index + m[1].length;
  const stem = text.slice(0, at(seq[0])).trim().replace(/\s*[-–:]$/, '') + ':';
  const items = seq.map((m, i) => text.slice(at(m) + m[0].length - m[1].length, i + 1 < seq.length ? at(seq[i + 1]) : undefined).trim());
  let tail = '';
  const last = items[items.length - 1];
  const cut = last.search(/[.;]\s+(?=(Which|How|Select|Choose|What|In|Consider)\b)/);
  if (cut > 0) {
    tail = last.slice(cut + 1).trim();
    items[items.length - 1] = last.slice(0, cut).trim();
  }
  return { stem, items: items.map((s) => s.replace(/[;,]$/, '')), tail };
}

function NumberedList({ items }) {
  return (
    <ol className="my-2 space-y-1 pl-1">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2.5 text-[14.5px] font-medium text-text-primary leading-relaxed">
          <span className="text-indigo-700 dark:text-indigo-300 font-extrabold tabular-nums w-4 flex-shrink-0 text-right">{i + 1}.</span>
          <span className="min-w-0 whitespace-pre-line">{s.replace(/^\s*\d{1,2}[.)]\s*/, '')}</span>
        </li>
      ))}
    </ol>
  );
}

function PyqCard({ q, n, total }) {
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
    if (!result) {
      return picked === key
        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/15'
        : 'border-border-default hover:border-indigo-500 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 cursor-pointer';
    }
    if (key === result.correctKey) return 'border-status-success-text bg-status-success-bg';
    if (key === picked) return 'border-status-danger-text bg-status-danger-bg';
    return 'border-border-default opacity-55';
  };
  const keyCls = (key) => {
    if (result && key === result.correctKey) return 'bg-status-success-text text-white border-status-success-text';
    if (result && key === picked) return 'bg-status-danger-text text-white border-status-danger-text';
    if (!result && picked === key) return 'bg-indigo-600 text-white border-indigo-600';
    return 'bg-surface text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-400/40';
  };

  const inline = !q.matchLists && !q.statements?.length ? splitInlineList(q.questionText) : null;
  // The bank often keeps the closing "How many of the above…?" as the last statement.
  let statements = q.statements || [];
  let closing = '';
  const last = statements[statements.length - 1] || '';
  if (statements.length > 1 && !/^\s*\d{1,2}[.)]/.test(last) && (/\?\s*$/.test(last) || /^(How many|Which|Select|Choose|What)\b/i.test(last.trim()))) {
    closing = last.trim();
    statements = statements.slice(0, -1);
  }
  const shortOptions = q.options.every((o) => (o.text || '').length <= 45);

  return (
    <article className="rounded-xl border border-indigo-100 dark:border-indigo-400/20 bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(30,27,75,0.06)]">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {total > 1 && <span className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300">Q{n}</span>}
        {q.examSource && (
          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-400 text-indigo-950 tracking-wide">{q.examSource}</span>
        )}
        {q.questionType && <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{q.questionType}</span>}
      </div>

      <div className="text-[15px] font-semibold text-text-primary leading-relaxed">
        {q.matchLists ? (
          <MatchListsView stem={q.questionText} matchLists={q.matchLists} />
        ) : inline ? (
          <>
            <p>{inline.stem}</p>
            <NumberedList items={inline.items} />
            {inline.tail && <p>{inline.tail}</p>}
          </>
        ) : (
          <p className="whitespace-pre-line">{q.questionText}</p>
        )}
        {statements.length > 0 && <NumberedList items={statements} />}
        {closing && <p>{closing}</p>}
      </div>

      <div className={`grid gap-2 mt-3 ${shortOptions ? 'sm:grid-cols-2' : ''}`}>
        {q.options.map((o) => (
          <button
            key={o.key}
            onClick={() => pick(o.key)}
            disabled={!!result || busy}
            className={`flex items-center gap-2.5 text-left rounded-lg border-2 px-2.5 py-2 text-[14px] font-medium text-text-primary bg-surface transition-colors ${optionCls(o.key)}`}
          >
            <span className={`w-6 h-6 flex-shrink-0 rounded-full border flex items-center justify-center text-[12px] font-extrabold ${keyCls(o.key)}`}>{o.key}</span>
            <span className="leading-snug">{o.text}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-status-danger-text mt-2">{error}</p>}
      {result && (
        <div className={`mt-3 rounded-lg px-3.5 py-2.5 border-l-4 ${result.correct ? 'bg-status-success-bg border-l-status-success-text' : 'bg-status-danger-bg border-l-status-danger-text'}`}>
          <p className={`text-[13px] font-extrabold ${result.correct ? 'text-status-success-text' : 'text-status-danger-text'}`}>
            {result.correct ? '✓ Correct!' : `✗ Not quite — the answer is ${result.correctKey}`}
          </p>
          {result.whyCorrect && <p className="text-[13.5px] text-text-primary leading-relaxed whitespace-pre-line mt-1">{result.whyCorrect}</p>}
        </div>
      )}
    </article>
  );
}
