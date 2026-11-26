import { useState } from 'react';

// Shared pieces of PYQ & TDH Research (student page + admin preview).

/** Text with the Word file's bold key terms ("**…**"). */
export function Rich({ text, strongClass = 'font-semibold text-text-primary' }) {
  const parts = String(text || '').split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 ? <strong key={i} className={strongClass}>{p}</strong> : <span key={i}>{p}</span>));
}

const TYPE_STYLE = {
  Factual: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  Conceptual: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
};

export function TypeChip({ type }) {
  if (!type) return null;
  return <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${TYPE_STYLE[type] || ''}`}>{type}</span>;
}

const NUMBERED = /^(\d+|[A-D]|[ivx]+)[.)]\s+/i;

/**
 * The PYQ body: stem, then its lines. "Consider the following pairs" with "1. A - B" lines turns
 * into a two-column table (header from "(Economic activity - Sector)" when the stem has one).
 */
export function QuestionBody({ text, lines = [], size = 'base' }) {
  const numbered = lines.filter((l) => NUMBERED.test(l));
  const rest = lines.filter((l) => !NUMBERED.test(l));
  const pairs = /pairs?/i.test(text) && numbered.length >= 2 && numbered.every((l) => / [-–—:] /.test(l));
  const header = text.match(/\(([^()]+?)\s[-–—]\s([^()]+?)\)\s*:?\s*$/);
  const textCls = size === 'sm' ? 'text-sm leading-6' : 'text-[15.5px] sm:text-base leading-7';

  return (
    <div className={`space-y-3 text-text-primary ${textCls}`}>
      <p className="font-medium">{text}</p>
      {pairs ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border border-border-default rounded-xl overflow-hidden text-[0.95em]">
            {header && (
              <thead className="bg-sunken text-text-secondary text-xs uppercase tracking-wide">
                <tr><th className="px-3 py-2 w-8" /><th className="px-3 py-2">{header[1]}</th><th className="px-3 py-2">{header[2]}</th></tr>
              </thead>
            )}
            <tbody className="divide-y divide-border-default">
              {numbered.map((l) => {
                const [, num] = l.match(NUMBERED);
                const body = l.replace(NUMBERED, '');
                const cut = body.search(/ [-–—:] /);
                return (
                  <tr key={l}>
                    <td className="px-3 py-2 font-bold text-text-tertiary tabular-nums">{num}.</td>
                    <td className="px-3 py-2">{body.slice(0, cut)}</td>
                    <td className="px-3 py-2">{body.slice(cut + 3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : numbered.length > 0 && (
        <ol className="space-y-1.5 bg-sunken/60 border border-border-default rounded-xl px-4 py-3">
          {numbered.map((l) => {
            const [, num] = l.match(NUMBERED);
            return (
              <li key={l} className="flex gap-2.5">
                <span className="font-bold text-text-tertiary tabular-nums">{num}.</span>
                <span>{l.replace(NUMBERED, '')}</span>
              </li>
            );
          })}
        </ol>
      )}
      {rest.map((l) => <p key={l} className="font-medium">{l}</p>)}
    </div>
  );
}

/** Option buttons. `picked`/`answer` set → coloured result. */
export function Options({ options, picked, answer, onPick, disabled, size = 'base' }) {
  const done = !!answer;
  return (
    <div className="grid gap-2">
      {options.map((o) => {
        const isAnswer = done && o.key === answer;
        const isWrongPick = done && o.key === picked && picked !== answer;
        const cls = isAnswer
          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
          : isWrongPick
            ? 'border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
            : done
              ? 'border-border-default bg-surface text-text-secondary opacity-80'
              : 'border-border-default bg-surface hover:border-brand hover:bg-accent-soft-bg text-text-primary cursor-pointer';
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled || done}
            onClick={() => onPick?.(o.key)}
            className={`flex items-start gap-3 w-full text-left border-2 rounded-xl px-3.5 py-2.5 transition-colors ${size === 'sm' ? 'text-sm' : 'text-[15px]'} ${cls}`}
          >
            <span className={`shrink-0 w-6 h-6 rounded-full grid place-items-center text-xs font-extrabold border ${isAnswer ? 'bg-emerald-600 border-emerald-600 text-white' : isWrongPick ? 'bg-rose-500 border-rose-500 text-white' : 'border-border-default text-text-tertiary'}`}>
              {isAnswer ? '✓' : isWrongPick ? '✕' : o.key}
            </span>
            <span className="pt-0.5">{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Headed bullet blocks (explanation / TDH Research). */
export function Blocks({ blocks, tone = 'neutral' }) {
  const head = tone === 'research' ? 'text-teal-800 dark:text-teal-300' : 'text-violet-800 dark:text-violet-300';
  const dot = tone === 'research' ? 'bg-teal-500' : 'bg-violet-500';
  const strong = tone === 'research' ? 'font-semibold text-teal-900 dark:text-teal-200' : 'font-semibold text-text-primary';
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => (
        <div key={i}>
          {b.heading && <h4 className={`font-display text-[17px] font-semibold mb-2 ${head}`}>{b.heading}</h4>}
          <ul className="space-y-2">
            {b.points.map((p, j) => (
              <li key={j} className="flex gap-3 text-[15px] leading-7 text-text-secondary">
                <span className={`shrink-0 mt-[11px] w-1.5 h-1.5 rounded-full ${dot}`} />
                <span><Rich text={p} strongClass={strong} /></span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function NoteBox({ note }) {
  if (!note?.length) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3.5">
      <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">💡 Additional note</p>
      <ul className="space-y-2">
        {note.map((p, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-7 text-amber-950/90 dark:text-amber-100/90">
            <span className="shrink-0 mt-[11px] w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span><Rich text={p} strongClass="font-semibold text-amber-950 dark:text-amber-100" /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One practice MCQ the student answers on the spot. */
export function PracticeMcq({ p, index }) {
  const [picked, setPicked] = useState('');
  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-extrabold text-text-tertiary">Practice {index + 1}</span>
        <TypeChip type={p.type} />
      </div>
      <QuestionBody text={p.questionText} lines={p.statements} size="sm" />
      <Options options={p.options} picked={picked} answer={picked ? p.answer : ''} onPick={setPicked} size="sm" />
      {picked && (
        <p className={`text-sm leading-6 rounded-xl px-3 py-2 ${picked === p.answer ? 'bg-status-success-bg text-status-success-text' : 'bg-status-danger-bg text-status-danger-text'}`}>
          <strong>{picked === p.answer ? 'Correct.' : `Answer: (${p.answer}).`}</strong> {p.why}
        </p>
      )}
    </div>
  );
}
