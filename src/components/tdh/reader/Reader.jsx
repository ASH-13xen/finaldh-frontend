import { useMemo, useState } from 'react';
import { Check, X, Eye, ChevronDown, Lightbulb, BookOpenText, Target, ListChecks, CircleSlash, Sparkles, Lock, ArrowDown, RotateCcw } from 'lucide-react';
import { cn } from '../ui/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

// Student-side reading components for PYQ & TDH Research. The admin panel keeps using
// ../TdhParts so nothing here changes the admin preview.

/* ------------------------------------------------------------- reading */

// Body copy: reading font, 16–20px, ~1.75 leading. Line length follows the reader's
// Focus/Wide choice (--tdh-measure).
const READ = '[font-family:var(--tdh-read-font)] text-[length:var(--tdh-fs)] leading-[1.75]';
const MEASURE = 'max-w-[var(--tdh-measure,none)]';

/* ------------------------------------------------------------------ text */

const HAS_FIGURE = /[\d₹%]/;

/**
 * Text with the Word file's **bold** key terms. Bold terms that carry a figure (55%, ₹5 lakh,
 * 2020) get a quiet highlighter mark so numbers stand out while revising.
 */
export function Rich({ text, tone = 'default' }) {
  const parts = String(text || '').split(/\*\*(.+?)\*\*/g);
  const strong = {
    default: 'font-semibold text-text-primary',
    research: 'font-semibold text-text-primary',
    note: 'font-semibold text-amber-950 dark:text-amber-100',
  }[tone];
  return parts.map((p, i) => {
    if (!(i % 2)) return <span key={i}>{p}</span>;
    if (HAS_FIGURE.test(p) && tone !== 'note') {
      return (
        <mark key={i} className="tdh-fact rounded-[3px] bg-emerald-100/70 px-[3px] py-px font-semibold text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-100">
          {p}
        </mark>
      );
    }
    return <strong key={i} className={strong}>{p}</strong>;
  });
}

/** Distinct **bold** terms across blocks, for the quick-revision strip. */
const keyTerms = (blocks, limit = 14) => {
  const seen = new Map();
  for (const b of blocks) {
    for (const p of b.points || []) {
      for (const m of String(p).matchAll(/\*\*(.+?)\*\*/g)) {
        const t = m[1].trim();
        const k = t.toLowerCase();
        const bareFigure = /^[\s~≈<>±+\-–\d.,%₹$]*(lakh|crore|bn|mn|%)?$/i.test(t);
        if (!bareFigure && t.length > 2 && t.length < 48 && !seen.has(k)) seen.set(k, t);
      }
    }
  }
  return [...seen.values()].slice(0, limit);
};

/* -------------------------------------------------------------- question */

const NUMBERED = /^(\d+|[A-D]|[ivx]+)[.)]\s+/i;

export function TypeMark({ type }) {
  if (!type) return null;
  const dot = type === 'Conceptual' ? 'bg-violet-500' : 'bg-sky-500';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-1.5 rounded-full', dot)} />
      {type}
    </span>
  );
}

/** Stem + statements/pairs. Pairs ("1. A - B") become a two-column table. */
export function PyqBody({ text, lines = [], compact = false }) {
  const numbered = lines.filter((l) => NUMBERED.test(l));
  const rest = lines.filter((l) => !NUMBERED.test(l));
  const pairs = /pairs?/i.test(text) && numbered.length >= 2 && numbered.every((l) => / [-–—:] /.test(l));
  const header = text.match(/\(([^()]+?)\s[-–—]\s([^()]+?)\)\s*:?\s*$/);
  const stem = header ? text.slice(0, header.index).replace(/\s+$/, '') + ':' : text;

  return (
    <div className={cn('min-w-0 break-words text-text-primary [font-family:var(--tdh-read-font)]', compact ? 'space-y-3 text-[length:calc(var(--tdh-fs)-2px)] leading-[1.65]' : 'space-y-5 text-[length:calc(var(--tdh-fs)+1px)] leading-[1.7]')}>
      <p className={cn(MEASURE, compact ? 'font-medium' : 'font-medium')}>{pairs ? stem : text}</p>

      {pairs ? (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-[0.92em]">
            {header && (
              <thead>
                <tr className="border-b border-text-primary/15">
                  <th className="w-10 py-2 pr-2 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">#</th>
                  <th className="py-2 pr-4 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">{header[1]}</th>
                  <th className="py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">{header[2]}</th>
                </tr>
              </thead>
            )}
            <tbody>
              {numbered.map((l) => {
                const [, num] = l.match(NUMBERED);
                const body = l.replace(NUMBERED, '');
                const cut = body.search(/ [-–—:] /);
                return (
                  <tr key={l} className="border-b border-border-subtle last:border-b-0 align-top">
                    <td className="py-2.5 pr-2 tabular-nums text-text-tertiary">{num}</td>
                    <td className="py-2.5 pr-4 font-medium">{body.slice(0, cut)}</td>
                    <td className="py-2.5 text-text-secondary">{body.slice(cut + 3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : numbered.length > 0 && (
        <ol className={cn('border-l-2 border-border-default', compact ? 'space-y-1.5 pl-3.5' : 'space-y-2.5 pl-5')}>
          {numbered.map((l) => {
            const [, num] = l.match(NUMBERED);
            return (
              <li key={l} className="flex gap-3">
                <span className="w-5 shrink-0 tabular-nums text-text-tertiary">{num}.</span>
                <span className="min-w-0">{l.replace(NUMBERED, '')}</span>
              </li>
            );
          })}
        </ol>
      )}

      {rest.map((l) => <p key={l} className={cn(MEASURE, 'font-medium')}>{l}</p>)}
    </div>
  );
}

/** Answer options. Once `answer` is known, the right one and a wrong pick are tinted. */
export function AnswerOptions({ options, picked, answer, onPick, disabled, compact = false }) {
  const done = !!answer;
  // Short options ("Only one", "1 and 2") sit two to a row on wide screens.
  const short = !compact && options.every((o) => String(o.text || '').length <= 48);
  return (
    <div role="radiogroup" className={cn('grid', compact ? 'gap-1.5' : 'gap-2.5', short && 'md:grid-cols-2')}>
      {options.map((o) => {
        const isAnswer = done && o.key === answer;
        const isWrongPick = done && o.key === picked && picked !== answer;
        const muted = done && !isAnswer && !isWrongPick;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.key === picked}
            disabled={disabled || done}
            onClick={() => onPick?.(o.key)}
            className={cn(
              'group flex w-full min-w-0 items-start gap-3.5 rounded-lg border text-left transition-colors',
              compact ? 'px-3 py-2 text-[length:calc(var(--tdh-fs)-3px)]' : 'px-4 py-3 text-[length:calc(var(--tdh-fs)-1.5px)]',
              !done && 'cursor-pointer border-border-default bg-surface hover:border-brand/60 hover:bg-accent-soft-bg/60',
              isAnswer && 'border-emerald-600/25 bg-emerald-50/80 dark:border-emerald-400/25 dark:bg-emerald-950/30',
              isWrongPick && 'border-rose-600/20 bg-rose-50/80 dark:border-rose-400/25 dark:bg-rose-950/30',
              muted && 'border-border-subtle bg-surface text-text-tertiary',
            )}
          >
            <span
              className={cn(
                'mt-px grid size-6 shrink-0 place-items-center rounded-md border text-[12px] font-semibold uppercase transition-colors',
                !done && 'border-border-default text-text-secondary group-hover:border-brand group-hover:bg-brand group-hover:text-text-on-accent',
                isAnswer && 'border-emerald-600 bg-emerald-600 text-white',
                isWrongPick && 'border-rose-500 bg-rose-500 text-white',
                muted && 'border-border-subtle text-text-tertiary',
              )}
            >
              {isAnswer ? <Check className="size-3.5" strokeWidth={3} /> : isWrongPick ? <X className="size-3.5" strokeWidth={3} /> : o.key}
            </span>
            <span className={cn('min-w-0 flex-1 leading-relaxed', !muted && 'text-text-primary')}>{o.text}</span>
            {isAnswer && !compact && !short && <span className="hidden shrink-0 pt-0.5 text-[12px] font-medium text-emerald-700 sm:inline dark:text-emerald-300">Correct answer</span>}
            {isWrongPick && !compact && !short && <span className="hidden shrink-0 pt-0.5 text-[12px] font-medium text-rose-600 sm:inline dark:text-rose-300">Your answer</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Result strip at the foot of the question card. */
export function Verdict({ picked, correct, answer, answerText, onResearch }) {
  const kind = !picked ? 'seen' : correct ? 'right' : 'wrong';
  const Icon = { seen: Eye, right: Check, wrong: X }[kind];
  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-3 border-t px-5 py-4 sm:px-8',
        kind === 'right' && 'border-emerald-600/15 bg-emerald-50/60 dark:bg-emerald-950/20',
        kind === 'wrong' && 'border-rose-600/15 bg-rose-50/60 dark:bg-rose-950/20',
        kind === 'seen' && 'border-border-default bg-surface-raised',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full',
          kind === 'right' && 'bg-emerald-600 text-white',
          kind === 'wrong' && 'bg-rose-500 text-white',
          kind === 'seen' && 'bg-sunken text-text-secondary',
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.75} />
      </span>
      <div className="min-w-0 text-[14.5px] leading-6">
        <p className={cn('font-semibold', kind === 'right' ? 'text-emerald-800 dark:text-emerald-300' : kind === 'wrong' ? 'text-rose-700 dark:text-rose-300' : 'text-text-primary')}>
          {kind === 'right' ? 'Correct' : kind === 'wrong' ? `Incorrect — you chose (${picked})` : 'Answer revealed'}
        </p>
        <p className="text-text-secondary">
          Answer <span className="font-semibold text-text-primary">({answer})</span> {answerText}
        </p>
      </div>
      {onResearch && (
        <button
          type="button"
          onClick={onResearch}
          className="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-2 self-center rounded-lg bg-teal-800 lg:hidden px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          Read the TDH Research <ArrowDown className="size-4 lg:hidden" />
        </button>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- explanation */

const ELIMINATION = /why not|other|incorrect|exclude|is not|isn't|false|odd one|fail|wrong|not the/i;

function Points({ points, tone, marker = 'dot' }) {
  return (
    <ul className={cn('space-y-3', MEASURE)}>
      {points.map((p, j) => (
        <li key={j} className={cn('flex gap-3 text-text-primary/85', READ)}>
          {marker === 'x' ? (
            <CircleSlash className="mt-[0.5em] size-3.5 shrink-0 text-rose-400" strokeWidth={2.25} />
          ) : (
            <span className={cn('mt-[0.8em] size-[5px] shrink-0 rounded-full', tone === 'research' ? 'bg-teal-600/70' : 'bg-text-tertiary/60')} />
          )}
          <span className="min-w-0"><Rich text={p} tone={tone} /></span>
        </li>
      ))}
    </ul>
  );
}

function Eyebrow({ icon: Icon, children, className }) {
  return (
    <p className={cn('flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.16em]', className)}>
      {Icon && <Icon className="size-3.5" strokeWidth={2.25} />}
      {children}
    </p>
  );
}

export function Explanation({ title, blocks }) {
  if (!blocks.length) return null;
  return (
    <section id="tdh-sec-expl" aria-labelledby="tdh-expl" className="scroll-mt-[calc(var(--tdh-top,0px)+1.5rem)] space-y-7">
      <header className="space-y-2">
        <Eyebrow icon={ListChecks} className="text-brand">Explanation</Eyebrow>
        {title && <h2 id="tdh-expl" className="font-display text-[26px] sm:text-[30px] font-semibold leading-[1.2] tracking-[-0.01em] text-text-primary">{title}</h2>}
      </header>
      <div className="space-y-8">
        {blocks.map((b, i) => {
          const elim = ELIMINATION.test(b.heading || '');
          return (
            <div key={i} className="grid gap-3 sm:grid-cols-[2.25rem_1fr]">
              <span className="hidden pt-1 font-display text-[15px] tabular-nums text-text-tertiary sm:block">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 space-y-3">
                {b.heading && (
                  <h3 className="flex flex-wrap items-center gap-2 text-[length:calc(var(--tdh-fs)+0.5px)] font-semibold leading-snug text-text-primary">
                    {b.heading}
                    {elim && <span className="rounded-[4px] bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">Elimination</span>}
                  </h3>
                )}
                <Points points={b.points} marker={elim ? 'x' : 'dot'} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- TDH research */

// TDH Research is the product's signature content, so it gets its own branded panel:
// a deep-teal masthead, numbered research cards and an "insight" note, instead of
// plain text on the page background.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function ResearchBlock({ block, index }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/blk relative overflow-hidden rounded-xl border border-teal-900/10 bg-surface shadow-[0_1px_2px_rgba(15,60,55,0.05)] transition-shadow hover:shadow-[0_6px_24px_-12px_rgba(15,90,80,0.35)] dark:border-teal-300/10"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-teal-500 to-teal-700" />
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-4 py-4 pl-6 pr-5 text-left sm:pl-7">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 font-display text-[15px] font-semibold tabular-nums text-teal-800 ring-1 ring-teal-700/10 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-300/15">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1 font-display text-[length:calc(var(--tdh-fs)+3px)] font-semibold leading-snug text-text-primary group-hover:text-teal-800 dark:group-hover:text-teal-200">
          {block.heading || 'Research'}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-text-tertiary transition-transform duration-200', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-6 pl-6 pr-5 sm:pl-[4.75rem] sm:pr-8">
        <Points points={block.points} tone="research" />
      </CollapsibleContent>
    </Collapsible>
  );
}

function Masthead({ counts, compact = false }) {
  // Light header: a teal accent strip and teal title on the panel's own surface.
  return (
    <div className="relative border-b border-teal-900/10 bg-surface px-5 pb-5 pt-6 sm:px-7 dark:border-teal-300/10">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-400" />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-700/15 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-300/20">
            <BookOpenText className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
              <Sparkles className="size-3" strokeWidth={2.25} /> The Dark Horse · Exclusive
            </p>
            <h2 id="tdh-research" className={cn('font-display font-semibold leading-tight tracking-[-0.015em] text-teal-950 dark:text-teal-50', compact ? 'text-[24px] sm:text-[26px]' : 'text-[26px] xl:text-[30px]')}>
              TDH Research
            </h2>
          </div>
        </div>
        {counts && (
          <dl className="flex shrink-0 flex-wrap gap-1.5">
            {counts.filter(([n]) => n > 0).map(([n, label]) => (
              <div key={label} className="inline-flex items-baseline gap-1.5 rounded-full bg-teal-50 px-3 py-1 ring-1 ring-teal-700/10 dark:bg-teal-950/50 dark:ring-teal-300/15">
                <dd className="text-[14px] font-semibold tabular-nums text-teal-900 dark:text-teal-100">{n}</dd>
                <dt className="text-[12px] font-medium text-teal-800/70 dark:text-teal-200/70">{label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
      <p className="mt-3 text-[14.5px] leading-relaxed text-text-secondary">
        Beyond the question — the facts, figures and concepts around this PYQ that the next paper can ask.
      </p>
    </div>
  );
}

export function Research({ blocks, note, practiceCount = 0 }) {
  const terms = useMemo(() => keyTerms([...blocks, { points: note }]), [blocks, note]);
  if (!blocks.length && !note.length) return null;
  return (
    <section
      id="tdh-sec-research"
      aria-labelledby="tdh-research"
      className="scroll-mt-[calc(var(--tdh-top,0px)+1.5rem)] overflow-hidden rounded-2xl border border-teal-900/15 bg-teal-50/40 shadow-[0_2px_4px_rgba(15,60,55,0.04),0_24px_60px_-30px_rgba(15,90,80,0.45)] dark:border-teal-300/15 dark:bg-teal-950/15"
    >
      <Masthead counts={[[blocks.length, blocks.length === 1 ? 'topic' : 'topics'], [note.length, note.length === 1 ? 'insight' : 'insights'], [practiceCount, 'practice']]} />

      <div className="space-y-6 p-4 sm:p-6 xl:p-8">
        {blocks.length > 0 && (
          <div className="space-y-3.5">
            {blocks.map((b, i) => <ResearchBlock key={i} block={b} index={i} />)}
          </div>
        )}

        {note.length > 0 && (
          <aside className="relative overflow-hidden rounded-xl border border-amber-300/50 bg-gradient-to-br from-amber-50 to-orange-50/60 px-6 py-5 sm:px-8 sm:py-6 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-orange-950/20">
            <Eyebrow icon={Lightbulb} className="mb-3.5 text-amber-800 dark:text-amber-300">TDH Insight · beyond the syllabus line</Eyebrow>
            <ul className={cn('space-y-3', MEASURE)}>
              {note.map((p, i) => (
                <li key={i} className={cn('flex gap-3 text-amber-950/85 dark:text-amber-50/85', READ, 'text-[length:calc(var(--tdh-fs)-1px)]')}>
                  <span className="mt-[0.8em] size-[5px] shrink-0 rounded-full bg-amber-500" />
                  <span className="min-w-0"><Rich text={p} tone="note" /></span>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {terms.length > 2 && (
          <div className="rounded-xl border border-teal-900/10 bg-surface px-6 py-5 sm:px-8 dark:border-teal-300/10">
            <Eyebrow icon={ListChecks} className="mb-3 text-teal-800 dark:text-teal-300">Quick revision · key terms</Eyebrow>
            <ul className="flex flex-wrap gap-2 text-[13.5px]">
              {terms.map((t) => (
                <li key={t} className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-900 ring-1 ring-teal-700/15 dark:bg-teal-950/50 dark:text-teal-100 dark:ring-teal-300/15">{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/** Before the answer: a locked preview so students see TDH Research is coming. */
export function ResearchTeaser({ teaser, onSkip, busy }) {
  const t = teaser || {};
  const bits = [
    t.research ? plural(t.research, 'research topic') : null,
    t.note ? plural(t.note, 'insight') : null,
    t.practice ? plural(t.practice, 'practice question') : null,
  ].filter(Boolean);
  return (
    <section aria-label="TDH Research (locked)" className="overflow-hidden rounded-2xl border border-teal-900/15 shadow-[0_24px_60px_-34px_rgba(15,90,80,0.45)] dark:border-teal-300/15">
      <Masthead compact />
      <div className="relative bg-teal-50/40 p-4 sm:p-8 dark:bg-teal-950/15">
        {/* placeholder cards, blurred */}
        <div aria-hidden className="space-y-3 blur-[3px] select-none">
          {[0.62, 0.48, 0.55].map((w, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-teal-900/10 bg-surface px-6 py-4">
              <span className="size-9 rounded-lg bg-teal-100 dark:bg-teal-900/50" />
              <span className="h-3.5 rounded-full bg-teal-900/15 dark:bg-teal-100/15" style={{ width: `${w * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 grid place-items-center p-4">
          <div className="max-w-md rounded-xl border border-teal-900/10 bg-surface/95 px-6 py-5 text-center shadow-lg backdrop-blur dark:border-teal-300/15">
            <span className="mx-auto mb-2.5 grid size-9 place-items-center rounded-full bg-teal-700 text-white"><Lock className="size-4" /></span>
            <p className="font-display text-[18px] font-semibold text-text-primary">Answer the PYQ to unlock</p>
            <p className="mt-1 text-[14px] leading-6 text-text-secondary">
              {bits.length ? <>{bits.join(' · ')} waiting for you.</> : 'The TDH Research for this question is waiting for you.'}
            </p>
            {onSkip && (
              <button type="button" onClick={onSkip} disabled={busy} className="mt-3 cursor-pointer text-[13px] font-semibold text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-300">
                Skip the question and read it now →
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- practice */

const TYPE_CHIP = {
  Conceptual: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-300/20',
  Factual: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-300/20',
};

/** The options for a practice MCQ: big tap targets, one column beside the question on wide screens. */
function PracticeOptions({ options, picked, answer, onPick, beside }) {
  const done = !!picked;
  // Short options: two to a row on tablets, one column beside the question on laptops.
  // Sentence-long options: one column on phones and tablets, two to a row under the question on laptops.
  return (
    <div role="radiogroup" aria-label="Options" className={cn('grid gap-2.5', beside ? 'sm:grid-cols-2 lg:grid-cols-1' : 'lg:grid-cols-2')}>
      {options.map((o) => {
        const isAnswer = done && o.key === answer;
        const isWrongPick = done && o.key === picked && picked !== answer;
        const muted = done && !isAnswer && !isWrongPick;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.key === picked}
            disabled={done}
            onClick={() => onPick(o.key)}
            className={cn(
              'group flex min-h-12 w-full min-w-0 items-center gap-3.5 rounded-xl border-2 px-4 py-3 text-left text-[length:calc(var(--tdh-fs)-2px)] leading-snug transition-all duration-150',
              !done && 'cursor-pointer border-border-default bg-surface hover:-translate-y-px hover:border-teal-600/50 hover:bg-teal-50/50 hover:shadow-sm active:translate-y-0 dark:hover:bg-teal-950/30',
              isAnswer && 'border-emerald-500 bg-emerald-50 dark:border-emerald-400/60 dark:bg-emerald-950/30',
              isWrongPick && 'border-rose-400 bg-rose-50 dark:border-rose-400/50 dark:bg-rose-950/30',
              muted && 'border-border-subtle bg-surface opacity-60',
            )}
          >
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-bold uppercase transition-colors',
                !done && 'bg-sunken text-text-secondary group-hover:bg-teal-700 group-hover:text-white',
                isAnswer && 'bg-emerald-600 text-white',
                isWrongPick && 'bg-rose-500 text-white',
                muted && 'bg-sunken text-text-tertiary',
              )}
            >
              {isAnswer ? <Check className="size-4" strokeWidth={3} /> : isWrongPick ? <X className="size-4" strokeWidth={3} /> : o.key}
            </span>
            <span className={cn('min-w-0 flex-1 font-medium', muted ? 'text-text-tertiary' : 'text-text-primary')}>{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function PracticeCard({ p, index, total }) {
  const [picked, setPicked] = useState('');
  const right = picked && picked === p.answer;
  // Short options ("1 and 2 only") sit beside the question on laptops; sentence-long ones go under it.
  const beside = p.options.every((o) => String(o.text || '').length <= 48);
  return (
    <article className="overflow-hidden rounded-2xl border border-border-default bg-surface shadow-[0_1px_2px_rgba(31,26,20,0.04),0_16px_40px_-28px_rgba(15,90,80,0.35)]">
      {/* header */}
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle bg-teal-50/40 px-5 py-4 sm:px-7 dark:bg-teal-950/15">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-400" />
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white shadow-sm dark:bg-teal-600">
          <Target className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
            Test yourself{total > 1 && <> · {index + 1} of {total}</>}
          </p>
          <h2 id={index === 0 ? 'tdh-practice' : undefined} className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text-primary sm:text-[22px]">
            Practice from TDH Research
          </h2>
        </div>
        {p.type && (
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ring-1', TYPE_CHIP[p.type] || TYPE_CHIP.Factual)}>
            <span className={cn('size-1.5 rounded-full', p.type === 'Conceptual' ? 'bg-violet-500' : 'bg-sky-500')} />
            {p.type}
          </span>
        )}
      </div>

      {/* question | options — side by side on laptops when the options are short, else stacked */}
      <div className={cn('grid gap-6 p-5 sm:p-7', beside && 'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10')}>
        <div className="min-w-0">
          <PyqBody text={p.questionText} lines={p.statements} compact />
        </div>
        <div className={cn('min-w-0 space-y-3', beside && 'lg:border-l lg:border-border-subtle lg:pl-10')}>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            {picked ? 'Your answer' : 'Choose one'}
          </p>
          <PracticeOptions options={p.options} picked={picked} answer={p.answer} onPick={setPicked} beside={beside} />
        </div>
      </div>

      {/* result */}
      {picked && (
        <div
          role="status"
          className={cn(
            'flex flex-col gap-4 border-t px-5 py-5 sm:flex-row sm:items-start sm:px-7',
            right ? 'border-emerald-600/15 bg-emerald-50/70 dark:bg-emerald-950/20' : 'border-rose-600/15 bg-rose-50/70 dark:bg-rose-950/20',
          )}
        >
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-white', right ? 'bg-emerald-600' : 'bg-rose-500')}>
            {right ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={3} />}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className={cn('font-display text-[18px] font-semibold leading-snug', right ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
              {right ? 'Correct — well done!' : <>Not quite — the answer is ({p.answer}).</>}
            </p>
            {p.why && (
              <p className={cn('text-text-secondary', READ, 'text-[length:calc(var(--tdh-fs)-2px)] leading-[1.65]', MEASURE)}>
                <span className="font-semibold text-text-primary">Why: </span>{p.why}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPicked('')}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 self-stretch rounded-lg border border-border-default bg-surface px-4 text-[13.5px] font-semibold text-text-primary transition-colors hover:border-teal-600/50 hover:text-teal-800 sm:self-center dark:hover:text-teal-200"
          >
            <RotateCcw className="size-4" /> Try again
          </button>
        </div>
      )}
    </article>
  );
}

export function Practice({ items }) {
  if (!items.length) return null;
  return (
    <section id="tdh-sec-practice" aria-labelledby="tdh-practice" className="scroll-mt-[calc(var(--tdh-top,0px)+1.5rem)] space-y-5">
      {items.map((p, i) => <PracticeCard key={p._id} p={p} index={i} total={items.length} />)}
    </section>
  );
}

/** Small progress ring (landing list). */
export function Ring({ value, size = 30, done = false }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className="stroke-sunken" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" strokeLinecap="round"
        className={cn('transition-[stroke-dashoffset] duration-700', done ? 'stroke-brand' : 'stroke-brand/80')}
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)}
        style={{ opacity: value ? 1 : 0 }}
      />
    </svg>
  );
}
