import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, ChevronDown, RotateCcw, Lock, Check, LayoutGrid, BookOpenText, Target, Sparkles } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { getOverview, getSection, answerQuestion, resetSection } from '../lib/tdhApi';
import { cn } from '../components/tdh/ui/utils';
import { Button } from '../components/tdh/ui/button';
import { Progress } from '../components/tdh/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '../components/tdh/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/tdh/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/tdh/ui/tooltip';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../components/tdh/ui/sheet';
import { PyqBody, AnswerOptions, Verdict, Research, ResearchTeaser, Practice, TypeMark, Ring } from '../components/tdh/reader/Reader';
import { useReadingFont, readerVars, useStickyTopOffset } from '../components/tdh/reader/readerPrefs';

// PYQ & TDH Research — try the PYQ, see the answer, then read the TDH Research around
// it, and answer the practice MCQs written from that research. One question per screen.

const POS_KEY = 'tdh:last';
const remember = (v) => { try { localStorage.setItem(POS_KEY, JSON.stringify(v)); } catch { /* private mode */ } };
const recall = () => { try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch { return null; } };

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Reader preferences (text size + serif/sans), remembered per browser.
const READER_KEY = 'tdh:reader';
const NAV_KEY = 'tdh:navOpen';
const READER_DEFAULT = { size: 'md', font: 'serif', width: 'wide' };
const loadReader = () => { try { return { ...READER_DEFAULT, ...JSON.parse(localStorage.getItem(READER_KEY) || '{}') }; } catch { return READER_DEFAULT; } };
const saveReader = (v) => { try { localStorage.setItem(READER_KEY, JSON.stringify(v)); } catch { /* private mode */ } };

export default function TdhResearch() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null); // { setId, section, index? }
  useReadingFont();

  const load = useCallback(() => getOverview().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (open) {
    return (
      <SectionView
        key={`${open.setId}-${open.section}`}
        setId={open.setId}
        number={open.section}
        startIndex={open.index || 0}
        onBack={() => { setOpen(null); load(); }}
        onOpenSection={(section) => setOpen({ setId: open.setId, section })}
      />
    );
  }

  if (!data && !error) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;
  const last = recall();

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 overflow-x-clip">
      <header className="relative overflow-hidden rounded-2xl border border-teal-900/10 bg-surface px-6 pb-7 pt-8 shadow-[0_1px_2px_rgba(15,60,55,0.04),0_18px_44px_-30px_rgba(15,90,80,0.35)] sm:px-10 sm:pb-9 sm:pt-10 dark:border-teal-300/10">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-400" />
        <div className="max-w-3xl space-y-3.5">
          <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700 ring-1 ring-teal-700/15 dark:bg-teal-950/50 dark:text-teal-300">
            <Sparkles className="size-3.5" /> The Dark Horse · Exclusive
          </p>
          <h1 className="font-display text-[36px] sm:text-[48px] font-semibold leading-[1.05] tracking-[-0.02em] text-text-primary">
            PYQ &amp; <span className="text-teal-700 dark:text-teal-300">TDH Research</span>
          </h1>
          <p className="text-[16px] leading-7 text-text-secondary sm:text-[17px]">
            Every previous-year question opens up into TDH Research — the facts, figures and
            concepts around it that the next paper can ask — with a practice question built from it.
          </p>
        </div>
        <ol className="mt-7 grid gap-2.5 sm:grid-cols-3">
          {[
            [Target, 'Attempt the PYQ', 'Answer or skip — the key is revealed.'],
            [BookOpenText, 'Read the TDH Research', 'Topics, insights and key terms around it.', true],
            [Check, 'Practice from it', 'A fresh MCQ written from the research.'],
          ].map(([Icon, title, sub, star], i) => (
            <li key={title} className={cn('flex items-start gap-3 rounded-xl border px-4 py-3.5', star ? 'border-teal-600/40 bg-teal-50 dark:border-teal-400/40 dark:bg-teal-950/40' : 'border-border-default bg-surface')}>
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', star ? 'bg-teal-700 text-white' : 'bg-sunken text-text-secondary')}><Icon className="size-4" /></span>
              <span className="min-w-0">
                <span className={cn('block text-[14.5px] font-semibold', star ? 'text-teal-900 dark:text-teal-100' : 'text-text-primary')}>{i + 1}. {title}</span>
                <span className="block text-[12.5px] leading-5 text-text-tertiary">{sub}</span>
              </span>
            </li>
          ))}
        </ol>
      </header>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      {data?.sets.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-default p-12 text-center text-text-tertiary">Nothing here yet — check back soon.</div>
      )}

      {data?.sets.map((s) => {
        const resume = last && last.setId === s._id && s.sections.find((x) => x.number === last.section);
        return (
          <section key={s._id} className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 font-display text-[24px] font-semibold tracking-[-0.01em] text-text-primary">
                  {s.title}
                  {!s.isPublished && <span className="rounded-[4px] bg-amber-100 px-1.5 py-0.5 font-sans text-[10.5px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Draft</span>}
                </h2>
                <p className="mt-1 text-[14px] text-text-tertiary">
                  {s.subject}
                  <span className="mx-2 text-border-default">/</span>{s.total} PYQs
                  <span className="mx-2 text-border-default">/</span>{s.done} attempted
                  {s.done ? <><span className="mx-2 text-border-default">/</span><span className="text-text-secondary font-medium">{pct(s.correct, s.done)}% accuracy</span></> : null}
                </p>
              </div>
              {resume && (
                <Button onClick={() => setOpen({ setId: s._id, section: last.section, index: last.index })} className="max-w-full">
                  <span className="truncate">Continue · {resume.title}</span>
                  <ArrowRight />
                </Button>
              )}
            </div>
            <Progress value={pct(s.done, s.total)} aria-label="Set progress" />

            <ol className="overflow-hidden rounded-xl border border-border-default bg-surface divide-y divide-border-default">
              {s.sections.map((sec) => {
                const p = pct(sec.done, sec.total);
                return (
                  <li key={sec.number}>
                    <button
                      onClick={() => setOpen({ setId: s._id, section: sec.number })}
                      className="group grid w-full cursor-pointer grid-cols-[2rem_1fr_auto_auto] items-center gap-x-3 px-4 py-4 text-left transition-colors hover:bg-surface-raised sm:grid-cols-[2.75rem_1fr_auto_auto] sm:gap-x-5 sm:px-6 sm:py-5"
                    >
                      <span className="font-display text-[18px] tabular-nums text-text-tertiary group-hover:text-brand">{String(sec.number).padStart(2, '0')}</span>
                      <span className="min-w-0">
                        <span className="block text-[15.5px] font-semibold leading-snug text-text-primary group-hover:text-brand sm:text-[16.5px]">{sec.title}</span>
                        <span className="mt-1 block text-[12.5px] text-text-tertiary">
                          {sec.total} PYQs · {sec.conceptual} conceptual{sec.done ? ` · ${pct(sec.correct, sec.done)}% accuracy` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-2.5">
                        <span className="hidden text-right text-[12px] font-medium tabular-nums text-text-tertiary sm:block">
                          {sec.done === sec.total && sec.total ? <span className="text-brand">Completed</span> : sec.done ? `${sec.done} of ${sec.total}` : 'Start'}
                        </span>
                        <span className="relative grid place-items-center">
                          <Ring value={p} done={sec.done === sec.total && sec.total > 0} />
                          {sec.done === sec.total && sec.total > 0 && <Check className="absolute size-3.5 text-brand" strokeWidth={3} />}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'Not attempted' },
  { key: 'wrong', label: 'Got wrong' },
  { key: 'Factual', label: 'Factual' },
  { key: 'Conceptual', label: 'Conceptual' },
];

const matches = (q, f) => {
  if (f === 'todo') return !q.attempt;
  if (f === 'wrong') return !!q.attempt && !q.attempt.correct;
  if (f === 'Factual' || f === 'Conceptual') return q.type === f;
  return true;
};

// Navigator states: answered right / wrong, answer viewed without picking, not attempted.
const navState = (x) => (!x.attempt ? 'todo' : !x.attempt.picked ? 'seen' : x.attempt.correct ? 'right' : 'wrong');
const NAV = {
  current: { label: 'Current', cell: 'bg-brand border-brand text-text-on-accent font-semibold shadow-[0_1px_3px_rgba(13,122,86,0.35)]', swatch: 'bg-brand border-brand' },
  right: { label: 'Correct', cell: 'bg-emerald-50 border-emerald-600/20 text-emerald-800 hover:border-emerald-600/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-400/20', swatch: 'bg-emerald-50 border-emerald-600/30 dark:bg-emerald-950/40' },
  wrong: { label: 'Incorrect', cell: 'bg-rose-50 border-rose-600/20 text-rose-700 hover:border-rose-600/50 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-400/20', swatch: 'bg-rose-50 border-rose-600/30 dark:bg-rose-950/40' },
  seen: { label: 'Viewed', cell: 'bg-sunken border-transparent text-text-secondary hover:border-border-default', swatch: 'bg-sunken border-border-default' },
  todo: { label: 'Not attempted', cell: 'bg-surface border-border-default text-text-tertiary hover:border-brand/60 hover:text-brand', swatch: 'bg-surface border-border-default' },
};

function SectionView({ setId, number, startIndex, onBack, onOpenSection }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [currentId, setCurrentId] = useState(null);
  const [busy, setBusy] = useState(false);
  // Question grid: open by default on desktop, folded on phones; the student's choice is remembered.
  const [navOpen, setNavOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(NAV_KEY);
      if (saved !== null) return saved === '1';
    } catch { /* private mode */ }
    return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  });
  // The question navigator lives in a slide-out drawer on every screen size, so the page
  // keeps two areas: the PYQ and its TDH Research side by side.
  const topOffset = useStickyTopOffset();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleNav = (open) => {
    setNavOpen(open);
    try { localStorage.setItem(NAV_KEY, open ? '1' : '0'); } catch { /* private mode */ }
  };
  const [reader, setReader] = useState(loadReader);
  const updateReader = (patch) => setReader((r) => { const next = { ...r, ...patch }; saveReader(next); return next; });

  useEffect(() => {
    getSection(setId, number).then((d) => {
      setData(d);
      setCurrentId(d.questions[Math.min(startIndex, d.questions.length - 1)]?._id || null);
    }).catch((e) => setError(e.message));
  }, [setId, number, startIndex]);

  const list = useMemo(() => (data ? data.questions.filter((q) => matches(q, filter) || q._id === currentId) : []), [data, filter, currentId]);
  const idx = Math.max(0, list.findIndex((q) => q._id === currentId));
  const q = list[idx];
  const fullIndex = data ? data.questions.findIndex((x) => x._id === q?._id) : 0;

  useEffect(() => {
    if (q) remember({ setId, section: number, index: fullIndex });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [q?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((d) => {
    const next = list[idx + d];
    if (next) setCurrentId(next._id);
  }, [list, idx]);

  const pick = useCallback(async (key) => {
    if (!q || q.attempt || busy) return;
    setBusy(true);
    try {
      const r = await answerQuestion(q._id, key);
      setData((d) => ({ ...d, questions: d.questions.map((x) => (x._id === q._id ? { ...x, attempt: r.attempt, reveal: r.reveal } : x)) }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [q, busy]);

  // ← → to move, a–d to answer.
  useEffect(() => {
    const onKey = (e) => {
      if (drawerOpen || e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (/^[a-d]$/i.test(e.key) && q && !q.attempt) pick(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, pick, q, drawerOpen]);

  if (error && !data) return <div className="max-w-3xl mx-auto px-4 py-10"><p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p></div>;
  if (!data) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  const total = data.questions.length;
  const done = data.questions.filter((x) => x.attempt).length;
  const correct = data.questions.filter((x) => x.attempt?.correct).length;
  const wrong = data.questions.filter((x) => x.attempt?.picked && !x.attempt.correct).length;
  const nextSection = data.sections.find((s) => s.number > number);

  const applyFilter = (key) => {
    if (!key) return; // ToggleGroup sends '' when the active item is clicked again
    setFilter(key);
    const first = data.questions.find((x) => matches(x, key));
    if (first && !matches(q, key)) setCurrentId(first._id);
  };

  const restart = async () => {
    if (!window.confirm('Clear your answers in this section and start again?')) return;
    await resetSection(setId, number);
    setData((d) => ({ ...d, questions: d.questions.map((x) => ({ ...x, attempt: null, reveal: undefined })) }));
    setCurrentId(data.questions[0]?._id);
    setFilter('all');
  };

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, data.questions.filter((x) => matches(x, f.key)).length]));

  // One panel, two homes: the desktop sidebar and the phone drawer.
  const renderPanel = (inDrawer) => (
    <div className={cn(
      'bg-surface',
      inDrawer
        ? 'flex-1 overflow-y-auto [scrollbar-width:thin]'
        : 'rounded-xl border border-border-default shadow-[0_1px_2px_rgba(31,26,20,0.04)] max-h-[calc(100vh-var(--tdh-top,0px)-2rem)] overflow-y-auto [scrollbar-width:thin]',
    )}>
      <div className={cn('flex items-center justify-between gap-2 border-b border-border-default px-4 sm:px-5', inDrawer ? 'py-3.5 pr-12' : 'py-2')}>
        {inDrawer ? (
          <div>
            <SheetTitle>Questions</SheetTitle>
            <SheetDescription>{data.section.title}</SheetDescription>
          </div>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">Navigator</span>
        )}
      </div>
          {/* progress */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-text-primary">
                <span className="font-display text-[28px] font-semibold leading-none tabular-nums">{q ? fullIndex + 1 : '–'}</span>
                <span className="ml-1 text-[14px] text-text-tertiary tabular-nums">of {total}</span>
              </p>
              <span className="text-[12px] font-medium text-text-tertiary">Question</span>
            </div>
            <div className="space-y-2">
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="Questions attempted" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                <div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${pct(correct, total)}%` }} />
                <div className="h-full bg-rose-400/80 transition-[width] duration-500" style={{ width: `${pct(wrong, total)}%` }} />
                <div className="h-full bg-text-tertiary/30 transition-[width] duration-500" style={{ width: `${pct(done - correct - wrong, total)}%` }} />
              </div>
              <dl className="grid grid-cols-3 divide-x divide-border-default text-center">
                <div className="pr-2">
                  <dd className="text-[16px] font-semibold tabular-nums text-text-primary">{done}<span className="text-[12px] font-normal text-text-tertiary">/{total}</span></dd>
                  <dt className="text-[11.5px] text-text-tertiary">Attempted</dt>
                </div>
                <div className="px-2">
                  <dd className="text-[16px] font-semibold tabular-nums text-text-primary">{correct}</dd>
                  <dt className="text-[11.5px] text-text-tertiary">Correct</dt>
                </div>
                <div className="pl-2">
                  <dd className={cn('text-[16px] font-semibold tabular-nums', done ? 'text-brand' : 'text-text-tertiary')}>{done ? `${pct(correct, done)}%` : '—'}</dd>
                  <dt className="text-[11.5px] text-text-tertiary">Accuracy</dt>
                </div>
              </dl>
            </div>
          </div>

          {/* filters */}
          <div className="border-t border-border-default px-2 py-2 sm:px-3">
            <ToggleGroup type="single" value={filter} onValueChange={applyFilter} aria-label="Filter questions" className="flex-wrap gap-1 lg:flex-col lg:gap-0.5">
              {FILTERS.map((f) => (
                <ToggleGroupItem
                  key={f.key}
                  value={f.key}
                  className="group rounded-md px-2.5 py-1.5 hover:bg-sunken data-[state=on]:bg-accent-soft-bg lg:w-full lg:justify-between"
                >
                  <span>{f.label}</span>
                  <span className="text-[12px] tabular-nums text-text-tertiary group-data-[state=on]:text-brand">{counts[f.key]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* navigator */}
          <Collapsible open={inDrawer || navOpen} onOpenChange={toggleNav} className="border-t border-border-default">
            <CollapsibleTrigger className={cn('flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-semibold text-text-secondary hover:bg-surface-raised hover:text-text-primary sm:px-5', inDrawer && 'hidden')}>
              <LayoutGrid className="size-4" /> Questions
              <span className="text-[12px] font-normal tabular-nums text-text-tertiary">{done}/{total} done</span>
              <ChevronDown className={cn('ml-auto size-4 text-text-tertiary transition-transform', navOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 sm:px-5 space-y-4">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5 lg:grid-cols-6">
                  {data.questions.map((x, i) => {
                    const isCurrent = x._id === currentId;
                    const state = navState(x);
                    const hidden = !matches(x, filter) && !isCurrent;
                    return (
                      <Tooltip key={x._id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => { setCurrentId(x._id); if (inDrawer) setDrawerOpen(false); }}
                            aria-label={`Question ${i + 1}, ${NAV[state].label}`}
                            aria-current={isCurrent ? 'true' : undefined}
                            className={cn(
                              'aspect-square w-full min-w-0 cursor-pointer rounded-md border text-[12px] font-medium tabular-nums transition-colors',
                              NAV[isCurrent ? 'current' : state].cell,
                              hidden && 'opacity-30',
                            )}
                          >
                            {i + 1}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Q{i + 1} · {NAV[state].label}{x.type ? ` · ${x.type}` : ''}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px] text-text-tertiary sm:flex sm:flex-wrap sm:gap-x-4 lg:grid">
                  {['current', 'right', 'wrong', 'seen', 'todo'].map((k) => (
                    <li key={k} className="inline-flex items-center gap-1.5">
                      <span className={cn('size-2.5 rounded-[3px] border', NAV[k].swatch)} />
                      {NAV[k].label}
                    </li>
                  ))}
                </ul>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* jump links — only once the answer (and its reading) is open */}
          {q?.reveal && (
            <nav aria-label="On this question" className="border-t border-border-default px-4 py-3 sm:px-5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">On this question</p>
              {[
                { id: 'tdh-sec-research', label: 'TDH Research', icon: BookOpenText, show: q.reveal.research.length > 0 || q.reveal.note.length > 0 },
                { id: 'tdh-sec-practice', label: `Practice (${q.reveal.practice.length})`, icon: Target, show: q.reveal.practice.length > 0 },
              ].filter((x) => x.show).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    const go2 = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    if (inDrawer) { setDrawerOpen(false); setTimeout(go2, 220); } else go2();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 text-[13px] font-medium text-text-secondary hover:bg-sunken hover:text-text-primary"
                >
                  <Icon className="size-3.5 text-text-tertiary" /> {label}
                </button>
              ))}
            </nav>
          )}

          {/* reading preferences */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border-default px-4 py-3 sm:px-5">
            <span className="text-[12px] font-medium text-text-tertiary">Reading</span>
            <div className="flex items-center gap-2">
              <ToggleGroup type="single" value={reader.font} onValueChange={(v) => v && updateReader({ font: v })} aria-label="Reading font" className="rounded-md border border-border-default p-0.5">
                <ToggleGroupItem value="serif" aria-label="Serif" className="rounded-[5px] px-2 py-0.5 text-[13px] [font-family:Literata,Georgia,serif] data-[state=on]:bg-sunken data-[state=on]:text-text-primary">Ag</ToggleGroupItem>
                <ToggleGroupItem value="sans" aria-label="Sans-serif" className="rounded-[5px] px-2 py-0.5 text-[13px] data-[state=on]:bg-sunken data-[state=on]:text-text-primary">Ag</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup type="single" value={reader.size} onValueChange={(v) => v && updateReader({ size: v })} aria-label="Text size" className="items-baseline rounded-md border border-border-default p-0.5">
                {[['sm', 'text-[11px]', 'Small text'], ['md', 'text-[13.5px]', 'Medium text'], ['lg', 'text-[16px]', 'Large text']].map(([v, cls, label]) => (
                  <ToggleGroupItem key={v} value={v} aria-label={label} className={cn('rounded-[5px] px-1.5 py-0.5 font-semibold leading-none data-[state=on]:bg-sunken data-[state=on]:text-text-primary', cls)}>A</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-[12px] font-medium text-text-tertiary">Line width</span>
              <ToggleGroup type="single" value={reader.width} onValueChange={(v) => v && updateReader({ width: v })} aria-label="Line width" className="rounded-md border border-border-default p-0.5">
                {[['focus', 'Focus'], ['wide', 'Wide']].map(([v, label]) => (
                  <ToggleGroupItem key={v} value={v} className="rounded-[5px] px-2 py-0.5 text-[12px] data-[state=on]:bg-sunken data-[state=on]:text-text-primary">{label}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          {done > 0 && (
            <div className="border-t border-border-default px-2 py-1.5">
              <Button variant="ghost" size="sm" onClick={restart} className="w-full justify-start text-text-tertiary hover:text-rose-600">
                <RotateCcw /> Start this section again
              </Button>
            </div>
          )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={250}>
      <div style={{ ...readerVars(reader), '--tdh-top': `${topOffset}px` }} className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8 sm:pt-8 overflow-x-clip">
        {/* heading */}
        <header className="mb-6 sm:mb-8 space-y-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2.5 text-text-tertiary">
            <ArrowLeft /> All sections
          </Button>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-text-tertiary">
              {data.set.title}<span className="mx-2 text-border-default">/</span>
              <span className="text-brand font-semibold">Section {number}</span>
            </p>
            <h1 className="mt-1 font-display text-[26px] sm:text-[32px] font-semibold leading-tight tracking-[-0.015em] text-text-primary">{data.section.title}</h1>
          </div>
        </header>

        {/* slim bar: position, progress, prev/next and the question drawer */}
        <div className="sticky z-20 -mx-4 mb-6 border-y border-border-default bg-page/90 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ top: 'var(--tdh-top, 0px)' }}>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)} className="bg-surface">
              <LayoutGrid /> Questions
            </Button>
            <span className="text-[13.5px] font-semibold tabular-nums text-text-primary">
              Q {q ? fullIndex + 1 : '–'}<span className="font-normal text-text-tertiary"> / {total}</span>
            </span>
            <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
              <div className="flex h-1.5 w-full max-w-md overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="Questions attempted" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                <div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${pct(correct, total)}%` }} />
                <div className="h-full bg-rose-400/80 transition-[width] duration-500" style={{ width: `${pct(wrong, total)}%` }} />
                <div className="h-full bg-text-tertiary/30 transition-[width] duration-500" style={{ width: `${pct(done - correct - wrong, total)}%` }} />
              </div>
              <span className="shrink-0 text-[12.5px] tabular-nums text-text-tertiary">
                {done} done{done ? ` · ${pct(correct, done)}% correct` : ''}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" size="icon" disabled={idx <= 0} onClick={() => go(-1)} aria-label="Previous question" className="size-8"><ArrowLeft /></Button>
              <Button variant="ghost" size="icon" disabled={idx >= list.length - 1} onClick={() => go(1)} aria-label="Next question" className="size-8"><ArrowRight /></Button>
            </div>
          </div>
        </div>

        <main className="min-w-0">
            {error && <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

            {q ? <QuestionView key={q._id} q={q} position={fullIndex + 1} total={total} busy={busy} onPick={pick} /> : (
              <p className="rounded-xl border border-dashed border-border-default py-16 text-center text-text-tertiary">No questions match this filter.</p>
            )}

            {/* pager */}
            <nav className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-6 pb-10">
              <Button variant="outline" disabled={idx <= 0} onClick={() => go(-1)}>
                <ArrowLeft /> Previous
              </Button>
              <span className="hidden md:block text-[12px] text-text-tertiary">
                <kbd className="rounded border border-border-default bg-surface px-1.5 py-0.5 font-sans text-[11px]">A–D</kbd> answer
                <span className="mx-2">·</span>
                <kbd className="inline-flex items-center gap-0.5 rounded border border-border-default bg-surface px-1 py-0.5 align-middle"><ArrowLeft className="size-3" /><ArrowRight className="size-3" /></kbd> move
              </span>
              {idx < list.length - 1 ? (
                <Button onClick={() => go(1)}>Next question <ArrowRight /></Button>
              ) : nextSection ? (
                <Button onClick={() => onOpenSection(nextSection.number)} className="max-w-full">
                  <span className="truncate">Next section: {nextSection.title}</span> <ArrowRight />
                </Button>
              ) : (
                <Button onClick={onBack}><Check /> Finish</Button>
              )}
            </nav>
        </main>

        {/* question navigator: slide-out drawer on every screen */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent>{renderPanel(true)}</SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}

function QuestionView({ q, position, total, busy, onPick }) {
  const r = q.reveal;
  const picked = q.attempt?.picked || '';
  const answerText = r && q.options.find((o) => o.key === r.answer)?.text;

  return (
    <div className="space-y-10">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] xl:gap-8">
      {/* the PYQ — stays in view while the research beside it is read */}
      <article className="overflow-hidden rounded-xl lg:sticky lg:top-[calc(var(--tdh-top,0px)+4.5rem)] lg:max-h-[calc(100vh-var(--tdh-top,0px)-5.5rem)] lg:overflow-y-auto lg:[scrollbar-width:thin] border border-border-default bg-surface shadow-[0_1px_2px_rgba(31,26,20,0.04),0_12px_32px_-20px_rgba(31,26,20,0.12)]">
        <div className="p-5 sm:p-8">
          <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-tertiary">
            <span className="font-semibold text-text-primary">Question {position}<span className="font-normal text-text-tertiary"> / {total}</span></span>
            {(q.examSource || q.year) && <><span className="text-border-default">|</span><span className="font-medium text-text-secondary">{q.examSource || q.year}</span></>}
            {q.type && <><span className="text-border-default">|</span><TypeMark type={q.type} /></>}
            {q.hasResearch && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-teal-800 ring-1 ring-teal-700/15 dark:bg-teal-950/50 dark:text-teal-200">
                <BookOpenText className="size-3.5" /> TDH Research inside
              </span>
            )}
          </p>
          <PyqBody text={q.questionText} lines={q.lines} />
          <div className="mt-8">
            <AnswerOptions options={q.options} picked={picked} answer={r?.answer || ''} onPick={onPick} disabled={busy} />
          </div>
          {!q.attempt && (
            <div className="mt-5 flex justify-end">
              <Button variant="link" size="sm" onClick={() => onPick('')} disabled={busy} className="text-[13px] text-text-tertiary hover:text-brand">
                Skip and show answer
              </Button>
            </div>
          )}
        </div>
        {r && (
          <Verdict
            picked={picked} correct={q.attempt.correct} answer={r.answer} answerText={answerText}
            onResearch={r.research.length || r.note.length ? () => document.getElementById('tdh-sec-research')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined}
          />
        )}
      </article>

      {r && (r.research.length > 0 || r.note.length > 0) ? (
        <Research blocks={r.research} note={r.note} practiceCount={r.practice.length} />
      ) : !r && q.hasResearch ? (
        <ResearchTeaser teaser={q.teaser} onSkip={() => onPick('')} busy={busy} />
      ) : (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-default py-16 text-[13px] text-text-tertiary">
          {r ? 'No TDH Research for this question yet.' : <><Lock className="size-3.5" /> Answer to unlock the practice question.</>}
        </p>
      )}
      </div>

      {r && <Practice items={r.practice} />}
    </div>
  );
}
