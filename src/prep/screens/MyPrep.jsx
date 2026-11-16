// My Prep: the interview countdown, readiness, a day-by-day plan built from the DAF (tasks tick themselves
// as the student prepares), saved questions, answer notes and practice so far.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Button from '../components/Button';
import DeepDive from '../components/DeepDive';
import { SplitHeading, Highlight, Ring, CountUp } from '../components/motion';
import { useReveal } from '../lib/motion';
import { useT, fmt } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { STATUSES } from '../lib/usePrepStore';
import { api } from '../lib/api';

const DONE = new Set(['practised', 'confident']);
const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

const groupTitle = (t, g) => {
  if (g.type === 'intro' || g.type === 'motivation') return t(`area.${g.type}`);
  if (g.type === 'education' && !g.isCollege) return g.label;
  if (g.type === 'work') return g.label;
  return g.value || g.label;
};

// Tasks: every DAF item (staples first, then the ones boards ask about most), with practice and revision
// woven in; two tasks a day, the last days kept for revision.
const buildPlan = (t, groups, prepItems, attempts, days) => {
  const ordered = [...groups].sort((a, b) => {
    const staple = (g) => (g.type === 'intro' ? 0 : g.type === 'motivation' ? 1 : 2);
    return staple(a) - staple(b) || (b.rate?.askedPct || 0) - (a.rate?.askedPct || 0);
  });
  const doneShare = (g) => (g.predictions.length ? g.predictions.filter((p) => DONE.has(prepItems.get(p.key)?.status)).length / g.predictions.length : 0);
  const spoke = attempts.length;
  const introDone = attempts.some((a) => /tell us about yourself|अपने बारे में बताइए/i.test(a.question || ''));
  const tasks = [];
  ordered.forEach((g, i) => {
    tasks.push({ id: g.key, label: t('me.task.group', { label: groupTitle(t, g) }), done: doneShare(g) >= 0.8, screen: 'predictions' });
    if (i === 0) tasks.push({ id: 'intro', label: t('me.task.intro'), done: introDone, screen: 'practice' });
    if (i % 3 === 2) tasks.push({ id: `practice-${i}`, label: t('me.task.practice'), done: spoke >= 3 * Math.ceil((i + 1) / 3), screen: 'practice' });
  });
  tasks.push({ id: 'notes', label: t('me.task.notes'), done: false, screen: 'notes' });
  const perDay = Math.max(1, Math.ceil(tasks.length / Math.max(1, days - 2)));
  const plan = [];
  for (let d = 0; d < days; d++) {
    const slice = tasks.slice(d * perDay, d * perDay + perDay);
    plan.push(slice.length ? slice : [
      { id: `revise-${d}`, label: t('me.task.revise'), done: false, screen: 'me' },
      { id: `speak-${d}`, label: t('me.task.practice'), done: false, screen: 'practice' }
    ]);
  }
  return plan;
};

export default function MyPrep() {
  const { prep, daf, go } = usePrep();
  const { t, lang, hi } = useT();
  const [groups, setGroups] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [familyId, setFamilyId] = useState(null);
  const [dateDraft, setDateDraft] = useState('');
  const [today] = useState(() => startOfDay(new Date()));
  const root = useRef(null);
  const hasDaf = !!daf.profile && !daf.profile.empty;

  useEffect(() => {
    let cancelled = false;
    if (hasDaf) api.predictions(lang).then((d) => { if (!cancelled) setGroups(d.groups); }).catch(() => { if (!cancelled) setGroups([]); });
    api.attempts().then((d) => { if (!cancelled && d?.attempts) setAttempts(d.attempts); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lang, hasDaf]);

  const date = prep.interviewDate ? startOfDay(prep.interviewDate) : null;
  const daysLeft = date ? Math.round((date - today) / DAY) : null;
  const planDays = Math.max(5, Math.min(21, daysLeft && daysLeft > 0 ? daysLeft : 14));

  const predicted = useMemo(() => (groups || []).flatMap((g) => g.predictions), [groups]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const p of predicted) c[prep.items.get(p.key)?.status || 'todo'] += 1;
    return c;
  }, [predicted, prep.items]);
  const done = counts.practised + counts.confident;
  const plan = useMemo(() => (groups ? buildPlan(t, groups, prep.items, attempts, planDays) : []), [t, groups, prep.items, attempts, planDays]);
  const saved = useMemo(() => [...prep.items.values()].filter((i) => i.saved).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), [prep.items]);
  const noted = useMemo(() => [...prep.items.values()].filter((i) => i.note).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), [prep.items]);
  const last = attempts[0];

  useReveal(root, { dependencies: [!!groups, saved.length, noted.length] });

  const titleCls = `font-display font-semibold text-text-primary ${hi ? 'text-[2.2rem] leading-[1.3] md:text-6xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.6rem] leading-[1.04] md:text-7xl md:leading-[1]'}`;

  return (
    <div ref={root} className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-16">
      <p className="prep-eyebrow text-brand mb-5">{t('me.eyebrow')}</p>
      <SplitHeading className={titleCls}>{t('me.titleA')}<Highlight still>{t('me.titleHl')}</Highlight></SplitHeading>

      {/* Countdown and readiness */}
      <section className="mt-10 grid md:grid-cols-2 gap-4 md:gap-5">
        <div data-reveal className="relative overflow-hidden rounded-[1.75rem] shadow-[var(--prep-shadow)] px-6 py-7 md:px-8 md:py-8 bg-[#14110d] text-[#f3ede2]">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 70% at 100% 0%, rgba(18,155,110,0.35), transparent 70%)' }} aria-hidden="true" />
          <div className="relative">
            <p className="prep-eyebrow text-emerald-300">{t('me.when')}</p>
            {date && daysLeft > 0 && (
              <>
                <p className="mt-4 flex items-baseline gap-3"><CountUp value={daysLeft} className="prep-num font-display text-7xl md:text-8xl font-semibold" /><span className="text-white/70 text-lg">{t('me.daysLeft')}</span></p>
                <p className="mt-2 text-white/60">{date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </>
            )}
            {date && daysLeft === 0 && <p className="mt-4 font-display text-3xl">{t('me.today')}</p>}
            {date && daysLeft < 0 && <p className="mt-4 text-white/80">{t('me.past')}</p>}
            {!date && <p className="mt-4 text-white/80 text-lg">{t('me.noDate')}</p>}
            <form className="mt-6 flex flex-wrap items-center gap-3" onSubmit={(e) => { e.preventDefault(); if (dateDraft) prep.setDate(dateDraft); }}>
              <input type="date" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} aria-label={t('me.when')}
                className="prep-focus h-12 rounded-full bg-white/10 border border-white/20 px-4 text-white [color-scheme:dark] outline-none focus:border-white" />
              <button type="submit" disabled={!dateDraft} className="prep-focus h-12 px-5 rounded-full bg-emerald-500 text-white font-semibold disabled:opacity-40 cursor-pointer">{date ? t('me.change') : t('me.setDate')}</button>
            </form>
          </div>
        </div>

        <div data-reveal className="prep-card px-6 py-7 md:px-8 md:py-8">
          <p className="prep-eyebrow text-text-tertiary">{t('me.readiness')}</p>
          <div className="mt-4 flex items-center gap-6">
            <Ring value={predicted.length ? done / predicted.length : 0} size={120} stroke={10}>
              <span className="prep-num font-display text-3xl font-semibold">{predicted.length ? Math.round((done / predicted.length) * 100) : 0}%</span>
            </Ring>
            <p className="text-text-secondary leading-relaxed">{t('me.readinessSub', { a: fmt(done), b: fmt(predicted.length) })}</p>
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-text-tertiary mb-2">{t('me.byStatus')}</p>
            <div className="flex h-3 rounded-full overflow-hidden bg-sunken">
              {STATUSES.map((s, i) => counts[s] > 0 && <span key={s} style={{ width: `${(counts[s] / Math.max(1, predicted.length)) * 100}%`, background: ['#d6cdbd', '#f2b33d', '#34d399', '#0d7a56'][i] }} title={`${t(`status.${s}`)}: ${counts[s]}`} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
              {STATUSES.map((s, i) => <span key={s} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: ['#d6cdbd', '#f2b33d', '#34d399', '#0d7a56'][i] }} />{t(`status.${s}`)} {counts[s]}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* Study plan */}
      <section className="mt-16">
        <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{t('me.plan')}</h2>
        {!hasDaf ? (
          <button type="button" onClick={() => go({ screen: 'daf' })} className="prep-focus mt-5 prep-card prep-card-hover w-full text-left px-6 py-6 cursor-pointer flex items-center justify-between gap-4">
            <span className="text-lg">{t('me.planNoDaf')}</span><Icon name="arrowRight" className="w-5 h-5 text-brand" />
          </button>
        ) : (
          <>
            <p className="mt-2 text-text-secondary">{t('me.planSub', { n: planDays })}</p>
            <ol className="mt-8 relative space-y-4 before:absolute before:left-[1.35rem] before:top-3 before:bottom-3 before:w-px before:bg-border-default">
              {plan.map((tasks, d) => {
                const dayDate = new Date(today.getTime() + d * DAY);
                const isToday = d === 0;
                const allDone = tasks.every((x) => x.done);
                return (
                  <li key={d} data-reveal className="relative pl-14">
                    <span className={`absolute left-0 top-1 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 ${allDone ? 'bg-brand border-brand text-text-on-accent' : isToday ? 'bg-text-primary border-text-primary text-page' : 'bg-surface border-border-default text-text-secondary'}`}>
                      {allDone ? <Icon name="check" className="w-5 h-5" /> : d + 1}
                    </span>
                    <div className="prep-card px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-semibold">{t('me.day', { n: d + 1 })}</span>
                        <span className="text-sm text-text-tertiary">· {dayDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        {isToday && <span className="rounded-full bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 text-xs font-bold">{t('me.todayChip')}</span>}
                      </div>
                      <ul className="space-y-2">
                        {tasks.map((task) => (
                          <li key={task.id} className="flex items-center justify-between gap-3">
                            <span className={`flex items-center gap-2.5 text-[15px] ${task.done ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${task.done ? 'bg-brand border-brand text-white' : 'border-border-default'}`}>{task.done && <Icon name="check" className="w-3.5 h-3.5" />}</span>
                              {task.label}
                            </span>
                            {!task.done && task.screen !== 'me' && <button type="button" onClick={() => go({ screen: task.screen })} className="prep-focus shrink-0 text-sm font-semibold text-brand hover:underline cursor-pointer">{t('me.open')}</button>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      {/* Saved questions and notes */}
      <section className="mt-16 grid lg:grid-cols-2 gap-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2"><Icon name="bookmark" className="w-6 h-6 text-amber-500" />{t('me.saved')}</h2>
          {saved.length ? (
            <ul className="mt-5 space-y-2">
              {saved.slice(0, 30).map((i) => (
                <li key={i.key} data-reveal>
                  <button type="button" disabled={!i.familyId} onClick={() => i.familyId && setFamilyId(i.familyId)} className="prep-focus w-full text-left prep-card prep-card-hover px-5 py-4 flex items-center justify-between gap-3 cursor-pointer disabled:cursor-default">
                    <span className="text-[15px] leading-snug">{i.text}</span>
                    <span className={`shrink-0 text-xs font-bold ${DONE.has(i.status) ? 'text-brand' : 'text-text-tertiary'}`}>{t(`status.${i.status || 'todo'}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-text-tertiary">{t('me.savedNone')}</p>}
        </div>
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2"><Icon name="edit" className="w-6 h-6 text-brand" />{t('me.notes')}</h2>
          {noted.length ? (
            <ul className="mt-5 space-y-3">
              {noted.slice(0, 20).map((i) => (
                <li key={i.key} data-reveal className="prep-card px-5 py-4">
                  <p className="font-display text-lg leading-snug">{i.text}</p>
                  <p className="mt-2 text-[15px] text-text-secondary whitespace-pre-line line-clamp-4">{i.note}</p>
                  {i.familyId && <button type="button" onClick={() => setFamilyId(i.familyId)} className="prep-focus mt-2 text-sm font-semibold text-brand hover:underline cursor-pointer">{t('action.deepDive')}</button>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-text-tertiary">{t('me.notesNone')}</p>}
        </div>
      </section>

      {/* Practice so far */}
      <section className="mt-16">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{t('me.practice')}</h2>
        {attempts.length ? (
          <div data-reveal className="mt-5 prep-card px-6 py-6 flex flex-wrap items-center gap-8">
            <div><p className="prep-num font-display text-4xl font-semibold">{fmt(attempts.length)}</p><p className="text-sm text-text-tertiary">{t('me.attempts', { n: '' }).trim()}</p></div>
            <div><p className="prep-num font-display text-4xl font-semibold">{last?.metrics?.wpm ?? '—'}</p><p className="text-sm text-text-tertiary">{t('me.lastPace')}</p></div>
            <div><p className="prep-num font-display text-4xl font-semibold">{last?.scores?.confidence ?? '—'}</p><p className="text-sm text-text-tertiary">{t('me.lastConfidence')}</p></div>
            <Button tone="ink" size="lg" icon="mic" className="ml-auto" onClick={() => go({ screen: 'practice' })}>{t('me.toPractice')}</Button>
          </div>
        ) : (
          <div className="mt-5 prep-card px-6 py-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-text-secondary">{t('me.practiceNone')}</p>
            <Button tone="primary" size="lg" icon="mic" onClick={() => go({ screen: 'practice' })}>{t('me.toPractice')}</Button>
          </div>
        )}
      </section>

      {familyId && <DeepDive familyId={familyId} onClose={() => setFamilyId(null)} />}
    </div>
  );
}
