// Every board (named after its chairperson, as candidates reported) and its habits: how many interviews,
// how much came from the DAF, how hard it followed up, the question mix, favourite themes, the questions it
// reused, and how candidates found it (cordial / mixed / tougher). Official photos where UPSC publishes one,
// initials otherwise. Statistics only: nothing here speaks for the members.
import { useMemo, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Sheet from './Sheet';
import Button from './Button';
import { useReveal } from '../lib/motion';
import { useT, fmt } from '../lib/i18n';
import { photoOf, moodOf, MOOD_KINDS, MOOD_STYLE } from '../lib/boards';

const MIX_COLOR = { personal: '#0d7a56', situational: '#b45309', opinion: '#6366f1', factual: '#0ea5e9', other: '#a8a29e' };

export function BoardAvatar({ b, size = 'md' }) {
  const s = size === 'lg' ? 'w-24 h-24 text-3xl' : size === 'xl' ? 'w-28 h-28 md:w-32 md:h-32 text-4xl' : 'w-16 h-16 text-xl';
  const photo = photoOf(b.name);
  if (photo) return <img src={photo} alt="" loading="lazy" className={`${s} shrink-0 rounded-full object-cover ring-4 ring-accent-soft-border bg-sunken`} />;
  return (
    <span className={`${s} shrink-0 rounded-full flex items-center justify-center font-display font-semibold text-page bg-text-primary ring-4 ring-accent-soft-border`} aria-hidden="true">
      {b.initials}
    </span>
  );
}

export function MoodChip({ b }) {
  const { t } = useT();
  const m = moodOf(b);
  if (!m) return null;
  const st = MOOD_STYLE[m.kind];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 whitespace-nowrap" style={{ color: st.color, background: st.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} aria-hidden="true" />
      {t(`boards.mood.${m.kind}`)}
    </span>
  );
}

function MoodBar({ b }) {
  const { t } = useT();
  const m = moodOf(b);
  if (!m) return <p className="text-sm text-text-tertiary">{t('boards.moodFew')}</p>;
  const parts = [['cordial', m.cordial, '#0d7a56'], ['neutral', m.neutral, '#a8a29e'], ['tough', m.tough, '#b91c1c']];
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-sunken" role="img" aria-label={parts.map(([k, v]) => `${t(`boards.moodPart.${k}`)} ${v}%`).join(', ')}>
        {parts.map(([k, v, c]) => <span key={k} style={{ width: `${v}%`, background: c }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map(([k, v, c]) => <span key={k} className="flex items-center gap-1.5 text-xs text-text-tertiary"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{t(`boards.moodPart.${k}`)} {v}%</span>)}
      </div>
      <p className="mt-1.5 text-xs text-text-tertiary">{t('boards.moodN', { n: fmt(m.n) })}</p>
    </div>
  );
}

function MixBar({ qtypes }) {
  const { t } = useT();
  const entries = Object.entries(qtypes || {}).filter(([, v]) => v > 0);
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-sunken" role="img" aria-label={entries.map(([k, v]) => `${t(`qtype.${k}`)} ${v}%`).join(', ')}>
        {entries.map(([k, v]) => <span key={k} style={{ width: `${v}%`, background: MIX_COLOR[k] || '#a8a29e' }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {entries.map(([k, v]) => <span key={k} className="flex items-center gap-1.5 text-xs text-text-tertiary"><span className="w-2 h-2 rounded-full" style={{ background: MIX_COLOR[k] || '#a8a29e' }} />{t(`qtype.${k}`)} {v}%</span>)}
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="prep-num font-display text-2xl md:text-3xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-text-tertiary leading-snug">{label}</p>
    </div>
  );
}

export function BoardSheet({ b, onClose, onOpenQuestion, onFilterBoard }) {
  const { t } = useT();
  return (
    <Sheet onClose={onClose} label={b.name}>
      <div className="px-5 md:px-10 pt-6 md:pt-10 pb-10 pr-16">
        <div className="flex items-center gap-5">
          <BoardAvatar b={b} size="lg" />
          <div className="min-w-0">
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{b.name}</h2>
            <p className="mt-1 text-text-tertiary">{t('boards.interviews', { n: fmt(b.interviews) })}</p>
            <div className="mt-2"><MoodChip b={b} /></div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 rounded-3xl border border-border-subtle bg-surface p-5">
          <Stat value={`${b.dafPct}%`} label={t('boards.daf')} />
          <Stat value={`${b.followUpPct}%`} label={t('boards.followUps')} />
          <Stat value={b.avgQuestions} label={t('boards.avgQ')} />
        </div>
        <h3 className="mt-8 prep-eyebrow text-text-tertiary">{t('boards.mood')}</h3>
        <div className="mt-3"><MoodBar b={b} /></div>
        <h3 className="mt-8 prep-eyebrow text-text-tertiary">{t('boards.mix')}</h3>
        <div className="mt-3"><MixBar qtypes={b.qtypes} /></div>
        {b.topics?.length > 0 && (
          <>
            <h3 className="mt-8 prep-eyebrow text-text-tertiary">{t('boards.topics')}</h3>
            <div className="mt-3 flex flex-wrap gap-2">{b.topics.map((x) => <span key={x.topic} className="rounded-full border border-border-default px-3 py-1.5 text-sm font-semibold text-text-secondary">{t(`topic.${x.topic}`)} · {x.pct}%</span>)}</div>
          </>
        )}
        {b.openers?.length > 0 && (
          <>
            <h3 className="mt-8 prep-eyebrow text-text-tertiary">{t('boards.openers')}</h3>
            <ul className="mt-3 grid gap-2">{b.openers.map((f) => <li key={f.id}><button type="button" onClick={() => onOpenQuestion(f.id)} className="prep-focus w-full text-left rounded-2xl border border-border-subtle bg-surface hover:border-text-primary px-4 py-3 text-[15px] cursor-pointer">{f.text}</button></li>)}</ul>
          </>
        )}
        {b.favourites?.length > 0 && (
          <>
            <h3 className="mt-8 prep-eyebrow text-text-tertiary">{t('boards.favourites')}</h3>
            <ul className="mt-3 grid gap-2">{b.favourites.map((f) => (
              <li key={f.id}><button type="button" onClick={() => onOpenQuestion(f.id)} className="prep-focus w-full text-left rounded-2xl border border-border-subtle bg-surface hover:border-text-primary px-4 py-3 flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-[15px] leading-snug">{f.text}</span><span className="prep-num shrink-0 text-xs font-bold text-text-tertiary">{f.timesAsked}×</span>
              </button></li>
            ))}</ul>
          </>
        )}
        {onFilterBoard && <Button tone="ink" size="lg" iconRight="arrowRight" className="mt-8" onClick={() => onFilterBoard(b.name)}>{t('boards.seeAll')}</Button>}
        <p className="mt-8 text-xs text-text-tertiary leading-relaxed">{t('boards.photoCredit')}</p>
      </div>
    </Sheet>
  );
}

export default function Boards({ boards, onOpenQuestion, onFilterBoard }) {
  const { t } = useT();
  const [open, setOpen] = useState(null);
  const [mood, setMood] = useState('all');
  const root = useRef(null);
  const counts = useMemo(() => Object.fromEntries(MOOD_KINDS.map((k) => [k, (boards || []).filter((b) => moodOf(b)?.kind === k).length])), [boards]);
  const shown = useMemo(() => (boards || []).filter((b) => mood === 'all' || moodOf(b)?.kind === mood), [boards, mood]);
  useReveal(root, { dependencies: [shown.length] });
  if (!boards) return <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="iv-skeleton h-56 rounded-3xl" />)}</div>;
  return (
    <div ref={root}>
      <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label={t('boards.mood')}>
        <span className="text-sm font-semibold text-text-secondary mr-1">{t('boards.mood')}:</span>
        {['all', ...MOOD_KINDS].map((k) => (
          <button key={k} type="button" onClick={() => setMood(k)} aria-pressed={mood === k}
            className={`prep-focus h-10 px-4 rounded-full text-sm font-semibold border flex items-center gap-2 transition-colors cursor-pointer ${mood === k ? 'bg-text-primary text-page border-text-primary' : 'border-border-default text-text-secondary hover:border-text-primary hover:text-text-primary'}`}>
            {k !== 'all' && <span className="w-2 h-2 rounded-full" style={{ background: MOOD_STYLE[k].color }} aria-hidden="true" />}
            {t(k === 'all' ? 'boards.mood.all' : `boards.mood.${k}`)}
            {k !== 'all' && <span className="prep-num text-xs opacity-60">{counts[k]}</span>}
          </button>
        ))}
      </div>
      <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {shown.map((b) => (
          <li key={b.name} data-reveal>
            <button type="button" onClick={() => setOpen(b)} className="prep-focus prep-card prep-card-hover group w-full h-full text-left p-6 cursor-pointer">
              <div className="flex items-center gap-4">
                <BoardAvatar b={b} />
                <div className="min-w-0">
                  <p className="font-display text-xl md:text-2xl font-semibold tracking-tight truncate group-hover:text-brand transition-colors">{b.name}</p>
                  <p className="text-sm text-text-tertiary">{t('boards.interviews', { n: fmt(b.interviews) })}</p>
                  <div className="mt-1.5"><MoodChip b={b} /></div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <Stat value={`${b.dafPct}%`} label={t('boards.daf')} />
                <Stat value={`${b.followUpPct}%`} label={t('boards.followUps')} />
                <Stat value={b.avgQuestions} label={t('boards.avgQ')} />
              </div>
              <div className="mt-6"><MixBar qtypes={b.qtypes} /></div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">{t('action.deepDive')} <Icon name="arrowRight" className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-text-tertiary leading-relaxed">{t('boards.note')} {t('boards.photoCredit')}</p>
      {open && <BoardSheet b={open} onClose={() => setOpen(null)} onOpenQuestion={onOpenQuestion} onFilterBoard={(name) => { setOpen(null); onFilterBoard(name); }} />}
    </div>
  );
}

// The Home screen's strip: every board as a photo card with its mood; opens the same board sheet.
export function BoardStrip({ boards, onOpenQuestion, onSeeAll }) {
  const { t } = useT();
  const [open, setOpen] = useState(null);
  if (!boards?.length) return null;
  return (
    <>
      <ul className="-mx-4 px-4 md:-mx-8 md:px-8 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 [scrollbar-width:thin]">
        {boards.map((b) => (
          <li key={b.name} className="snap-start shrink-0">
            <button type="button" onClick={() => setOpen(b)} className="prep-focus prep-card prep-card-hover group w-[15rem] md:w-[16.5rem] h-full text-left p-5 flex flex-col items-center text-center cursor-pointer">
              <BoardAvatar b={b} size="xl" />
              <p className="mt-4 font-display text-xl font-semibold tracking-tight group-hover:text-brand transition-colors">{b.name}</p>
              <p className="mt-0.5 text-sm text-text-tertiary">{t('boards.interviews', { n: fmt(b.interviews) })}</p>
              <div className="mt-2.5 min-h-7"><MoodChip b={b} /></div>
              <p className="mt-3 text-xs text-text-secondary">{t('boards.stripStats', { daf: b.dafPct, follow: b.followUpPct })}</p>
            </button>
          </li>
        ))}
        <li className="snap-start shrink-0">
          <button type="button" onClick={onSeeAll} className="prep-focus prep-card prep-card-hover w-[12rem] h-full p-5 flex flex-col items-center justify-center gap-3 text-brand font-semibold cursor-pointer">
            <span className="w-14 h-14 rounded-full bg-accent-soft-bg flex items-center justify-center"><Icon name="arrowRight" className="w-6 h-6" /></span>
            {t('home.boardsAll')}
          </button>
        </li>
      </ul>
      <p className="mt-3 text-xs text-text-tertiary">{t('boards.photoCredit')}</p>
      {open && <BoardSheet b={open} onClose={() => setOpen(null)} onOpenQuestion={(id) => { setOpen(null); onOpenQuestion(id); }} />}
    </>
  );
}
