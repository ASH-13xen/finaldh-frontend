// Every board (named after its chairperson, as candidates reported) and its habits: how many interviews,
// how much came from the DAF, how hard it followed up, the question mix, favourite themes and the
// questions it reused. Statistics only, with monograms rather than photos.
import { useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Sheet from './Sheet';
import Button from './Button';
import { useReveal } from '../lib/motion';
import { useT, fmt, yearsRange } from '../lib/i18n';

const MIX_COLOR = { personal: '#0d7a56', situational: '#b45309', opinion: '#6366f1', factual: '#0ea5e9', other: '#a8a29e' };

function Monogram({ b, size = 'md' }) {
  const s = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl';
  return (
    <span className={`${s} shrink-0 rounded-full flex items-center justify-center font-display font-semibold text-page bg-text-primary ring-4 ring-accent-soft-border`} aria-hidden="true">
      {b.initials}
    </span>
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

function BoardSheet({ b, onClose, onOpenQuestion, onFilterBoard }) {
  const { t } = useT();
  return (
    <Sheet onClose={onClose} label={b.name}>
      <div className="px-5 md:px-10 pt-6 md:pt-10 pb-10 pr-16">
        <div className="flex items-center gap-5">
          <Monogram b={b} size="lg" />
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{b.name}</h2>
            <p className="mt-1 text-text-tertiary">{t('boards.interviews', { n: fmt(b.interviews) })} · CSE {yearsRange(b.years)}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 rounded-3xl border border-border-subtle bg-surface p-5">
          <Stat value={`${b.dafPct}%`} label={t('boards.daf')} />
          <Stat value={`${b.followUpPct}%`} label={t('boards.followUps')} />
          <Stat value={b.avgQuestions} label={t('boards.avgQ')} />
        </div>
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
        <Button tone="ink" size="lg" iconRight="arrowRight" className="mt-8" onClick={() => onFilterBoard(b.name)}>{t('boards.seeAll')}</Button>
      </div>
    </Sheet>
  );
}

export default function Boards({ boards, onOpenQuestion, onFilterBoard }) {
  const { t } = useT();
  const [open, setOpen] = useState(null);
  const root = useRef(null);
  useReveal(root, { dependencies: [boards?.length || 0] });
  if (!boards) return <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="iv-skeleton h-56 rounded-3xl" />)}</div>;
  return (
    <div ref={root}>
      <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {boards.map((b) => (
          <li key={b.name} data-reveal>
            <button type="button" onClick={() => setOpen(b)} className="prep-focus prep-card prep-card-hover group w-full h-full text-left p-6 cursor-pointer">
              <div className="flex items-center gap-4">
                <Monogram b={b} />
                <div className="min-w-0">
                  <p className="font-display text-xl md:text-2xl font-semibold tracking-tight truncate group-hover:text-brand transition-colors">{b.name}</p>
                  <p className="text-sm text-text-tertiary">{t('boards.interviews', { n: fmt(b.interviews) })} · CSE {yearsRange(b.years)}</p>
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
      <p className="mt-8 text-xs text-text-tertiary">{t('boards.note')}</p>
      {open && <BoardSheet b={open} onClose={() => setOpen(null)} onOpenQuestion={onOpenQuestion} onFilterBoard={(name) => { setOpen(null); onFilterBoard(name); }} />}
    </div>
  );
}
