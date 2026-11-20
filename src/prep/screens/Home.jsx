// The Interview Prep front page: what the section is, the student's DAF at a glance, the questions boards
// keep asking, the six tools, and a question of the day.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CURRENT_TOPICS_LIVE, DAF_FILL_IN_OPTION } from '../../lib/features';
import Icon from '../../components/mcq/Icon';
import DeepDive from '../components/DeepDive';
import { BoardStrip } from '../components/Boards';
import { DafCheckCard } from '../components/DafCheck';
import Button from '../components/Button';
import { SplitHeading, CountUp, Highlight } from '../components/motion';
import { gsap, useGSAP, useReveal, prefersReducedMotion } from '../lib/motion';
import { useT, fmt, yearsRange } from '../lib/i18n';
import { usePrep, SCREENS } from '../lib/context';
import { iv } from '../../lib/interviewApi';

// How often boards asked about each DAF area when a candidate listed it (CSE 2020-2025, measured from the
// Gemini-parsed transcripts). Phase 2 serves these from the API with per-item rates.
const AREA_RATES = [
  { key: 'work', pct: 93, value: 'Software developer, Bengaluru' },
  { key: 'hobby', pct: 89, value: 'Cricket, football' },
  { key: 'home', pct: 89, value: 'Chhattisgarh' },
  { key: 'education', pct: 87, value: 'B.Tech, Computer Science' },
  { key: 'optional', pct: 76, value: 'Sociology' }
];
const TYPE_TO_AREA = { work: 'work', hobby: 'hobby', eca: 'hobby', home: 'home', education: 'education', optional: 'optional' };

function DafSlip({ profile }) {
  const { t } = useT();
  const root = useRef(null);
  const items = useMemo(() => (profile && !profile.empty ? profile.items || [] : []), [profile]);
  // A student's own DAF fills the slip; otherwise an example shows what the heatmap looks like.
  const rows = useMemo(() => {
    if (!items.length) return AREA_RATES.map((r) => ({ ...r, label: t(`area.${r.key}`) }));
    const byArea = new Map();
    for (const it of items) {
      const area = TYPE_TO_AREA[it.type];
      if (!area) continue;
      if (!byArea.has(area)) byArea.set(area, []);
      byArea.get(area).push(it.value || it.label);
    }
    return AREA_RATES.filter((r) => byArea.has(r.key)).map((r) => ({ ...r, label: t(`area.${r.key}`), value: byArea.get(r.key).slice(0, 3).join(', ') }));
  }, [items, t]);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline({ delay: 0.5 });
    tl.from(root.current, { rotate: -7, y: 40, autoAlpha: 0, duration: 1.1 })
      .from('[data-bar]', { scaleX: 0, transformOrigin: 'left center', stagger: 0.12, duration: 0.9, ease: 'power2.inOut' }, '-=0.5')
      .from('[data-note]', { autoAlpha: 0, y: 8, duration: 0.6 }, '-=0.3')
      .from('[data-arrow]', { drawSVG: 0, duration: 0.8, ease: 'power1.inOut' }, '<');
  // revertOnUpdate: when the student's DAF arrives the timeline runs again; without reverting first, the
  // second from() would start at the first run's hidden state and leave the card invisible.
  }, { scope: root, dependencies: [rows.length], revertOnUpdate: true });

  return (
    <div ref={root} className="relative rotate-[-1.5deg] md:rotate-[-2.5deg]">
      <div className="prep-card relative overflow-hidden px-6 pt-6 pb-7 md:px-8 md:pt-7 md:pb-8 bg-surface">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand via-amber-400 to-brand opacity-80" aria-hidden="true" />
        <div className="flex items-baseline justify-between gap-3 mb-5">
          <p className="prep-eyebrow text-text-tertiary">{items.length ? t('nav.daf') : t('home.sample')}</p>
          <p className="font-display italic text-text-tertiary text-sm">DAF</p>
        </div>
        <ul className="space-y-4">
          {rows.map((r, i) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">{r.label}</span>
                <span className="prep-num text-sm font-bold text-brand">{r.pct}%</span>
              </div>
              <p className="font-display text-lg md:text-xl text-text-primary leading-snug truncate">{r.value}</p>
              <div className="mt-1.5 h-2 rounded-full bg-sunken overflow-hidden">
                <div data-bar className="h-full rounded-full" style={{ width: `${r.pct}%`, background: i === 0 ? 'linear-gradient(90deg, var(--prep-emerald), var(--prep-emerald-bright))' : 'color-mix(in oklab, var(--prep-emerald) 55%, transparent)' }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-text-tertiary leading-relaxed">{t('home.sampleNote')}</p>
      </div>
      <div data-note className="absolute -right-2 -top-9 md:-right-10 md:-top-10 rotate-[4deg] pointer-events-none select-none" aria-hidden="true">
        <span className="prep-hand text-2xl md:text-[1.7rem] text-brand whitespace-nowrap">{t('home.boardsLove')}</span>
        <svg width="70" height="46" viewBox="0 0 70 46" className="absolute left-2 top-8 text-brand" fill="none">
          <path data-arrow d="M60 4 C 48 20, 30 30, 8 40" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path data-arrow d="M8 40 l9 -1 M8 40 l3 -8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function Stats({ corpus }) {
  const { t } = useT();
  const years = corpus.years?.length || 0;
  const items = [
    { n: corpus.transcripts, label: t('home.stat.interviews') },
    { n: corpus.questions, label: t('home.stat.questions') },
    { n: corpus.followUps, label: t('home.stat.followUps') },
    { n: years, label: t('home.stat.years') }
  ].filter((x) => Number.isFinite(x.n) && x.n > 0);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-border-default">
      {items.map((s, i) => (
        <div
          key={s.label}
          data-reveal
          className={`px-4 py-6 md:px-8 md:py-9 border-border-default ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b lg:border-b-0' : ''} ${i === 1 ? 'lg:border-r' : ''} ${i === items.length - 1 ? 'lg:border-r-0' : ''}`}
        >
          <CountUp value={s.n} className="prep-num block font-display text-4xl md:text-6xl font-semibold tracking-tight text-text-primary" />
          <span className="block mt-2 text-sm md:text-base text-text-secondary">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function Marquee({ items, onOpen }) {
  const { t } = useT();
  const track = useRef(null);
  useGSAP(() => {
    const el = track.current;
    if (!el || !items.length || prefersReducedMotion()) return;
    const tween = gsap.to(el, { xPercent: -50, duration: items.length * 4.5, ease: 'none', repeat: -1 });
    const slow = () => gsap.to(tween, { timeScale: 0.15, duration: 0.6 });
    const go = () => gsap.to(tween, { timeScale: 1, duration: 0.6 });
    el.addEventListener('pointerenter', slow);
    el.addEventListener('pointerleave', go);
    el.addEventListener('focusin', slow);
    el.addEventListener('focusout', go);
    return () => {
      el.removeEventListener('pointerenter', slow);
      el.removeEventListener('pointerleave', go);
      el.removeEventListener('focusin', slow);
      el.removeEventListener('focusout', go);
    };
  }, { dependencies: [items.length] });
  if (!items.length) return null;
  const loop = prefersReducedMotion() ? items : [...items, ...items];
  return (
    <div className={`prep-marquee ${prefersReducedMotion() ? 'overflow-x-auto' : 'overflow-hidden'} py-2`}>
      <ul ref={track} className="flex w-max gap-4 px-2">
        {loop.map((f, i) => (
          <li key={`${f.id}-${i}`} aria-hidden={i >= items.length ? 'true' : undefined}>
            <button
              type="button"
              tabIndex={i >= items.length ? -1 : 0}
              onClick={() => onOpen(f.id)}
              className="prep-focus prep-card prep-card-hover group flex items-center gap-4 w-[19rem] md:w-[23rem] px-5 py-4 text-left cursor-pointer"
            >
              <span className="prep-num shrink-0 w-14 h-14 rounded-2xl bg-accent-soft-bg border border-accent-soft-border text-brand font-display text-xl font-semibold flex items-center justify-center group-hover:scale-105 transition-transform">
                {t('home.timesShort', { n: f.timesAsked })}
              </span>
              <span className="text-[15px] leading-snug text-text-primary line-clamp-2">{f.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TILE_ART = {
  daf: (
    <div className="space-y-1.5" aria-hidden="true">
      {[78, 92, 64].map((w, i) => <div key={i} className="h-2 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand/70" style={{ width: `${w}%` }} /></div>)}
    </div>
  ),
  predictions: (
    <div className="relative h-[4.5rem]" aria-hidden="true">
      {[2, 1, 0].map((i) => (
        <div key={i} className="absolute inset-x-0 h-12 rounded-xl border border-border-default bg-surface shadow-sm flex items-center gap-3 px-3"
          style={{ top: i * 9, transform: `scale(${1 - i * 0.06}) rotate(${i === 0 ? 0 : (i === 1 ? -2 : 2.5)}deg)`, zIndex: 3 - i }}>
          {i === 0 && <>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--prep-tier-certain)' }} />
            <span className="flex-1 space-y-1.5"><span className="block h-2 w-11/12 rounded-full bg-text-primary/60" /><span className="block h-2 w-7/12 rounded-full bg-sunken" /></span>
            <span className="text-[10px] font-bold text-brand">28×</span>
          </>}
        </div>
      ))}
    </div>
  ),
  bank: (
    <div className="h-10 rounded-full border border-border-default bg-surface flex items-center gap-2 px-3" aria-hidden="true">
      <Icon name="search" className="w-4 h-4 text-text-tertiary" /><div className="h-2 w-2/3 rounded-full bg-sunken" />
    </div>
  ),
  practice: (
    <div className="flex items-end gap-1 h-10" aria-hidden="true">
      {[30, 65, 45, 90, 55, 75, 35, 80, 50, 25, 60, 40].map((h, i) => <span key={i} className="w-1.5 rounded-full bg-brand/70" style={{ height: `${h}%` }} />)}
    </div>
  ),
  notes: (
    <div className="space-y-1.5" aria-hidden="true">
      <div className="h-2.5 w-3/4 rounded bg-text-primary/70" />{[100, 92, 96, 70].map((w, i) => <div key={i} className="h-1.5 rounded bg-sunken" style={{ width: `${w}%` }} />)}
    </div>
  ),
  insights: (
    <div className="flex items-end gap-2 h-12" aria-hidden="true">
      {[40, 55, 48, 70, 62, 88].map((h, i) => <span key={i} className={`flex-1 rounded-t-md ${i === 5 ? 'bg-brand' : 'bg-brand/30'}`} style={{ height: `${h}%` }} />)}
    </div>
  )
};

function PathTiles({ corpus, go }) {
  const { t } = useT();
  const tiles = [
    { key: 'daf', span: 'md:col-span-3', desc: t(DAF_FILL_IN_OPTION ? 'home.tile.daf' : 'home.tile.dafUpload') },
    { key: 'predictions', span: 'md:col-span-3', desc: t('home.tile.predictions') },
    { key: 'bank', span: 'md:col-span-2', desc: t('home.tile.bank', { n: fmt(corpus.transcripts) }) },
    { key: 'practice', span: 'md:col-span-2', desc: t('home.tile.practice') },
    { key: 'notes', span: 'md:col-span-2', desc: t(CURRENT_TOPICS_LIVE ? 'home.tile.notes' : 'home.tile.guide') },
    { key: 'insights', span: 'md:col-span-6', desc: t('home.tile.insights') }
  ];
  return (
    <div className="grid md:grid-cols-6 gap-4 md:gap-5">
      {tiles.map((tile, i) => {
        const s = SCREENS.find((x) => x.key === tile.key);
        return (
          <button
            key={tile.key}
            type="button"
            data-reveal
            disabled={!s.ready}
            onClick={() => go({ screen: tile.key })}
            className={`prep-focus prep-card ${s.ready ? 'prep-card-hover cursor-pointer' : 'cursor-default'} group relative overflow-hidden text-left p-6 md:p-7 flex flex-col gap-5 ${tile.span}`}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="prep-num font-display text-5xl md:text-6xl font-semibold leading-none text-border-default group-hover:text-brand transition-colors duration-500">{String(i + 1).padStart(2, '0')}</span>
              {s.ready
                ? <span className="w-11 h-11 rounded-full border border-border-default flex items-center justify-center text-text-secondary group-hover:bg-text-primary group-hover:text-page group-hover:border-text-primary transition-colors duration-300"><Icon name="arrowRight" className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-500" /></span>
                : <span className="prep-eyebrow text-text-tertiary border border-border-default rounded-full px-3 py-1.5">{t('common.soon')}</span>}
            </div>
            <div className={tile.key === 'insights' ? 'md:grid md:grid-cols-[1fr_16rem] md:items-end md:gap-10' : ''}>
              <div>
                <h3 className="font-display text-2xl md:text-[1.9rem] font-semibold tracking-tight text-text-primary">{t(s.long || s.label)}</h3>
                <p className="mt-2 text-[15px] md:text-base text-text-secondary leading-relaxed max-w-md">{tile.desc}</p>
              </div>
              <div className="mt-5 md:mt-6">{TILE_ART[tile.key]}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

function QuestionOfTheDay({ list, onOpen }) {
  const { t, tn } = useT();
  const [today] = useState(() => new Date());
  const day = dayOfYear(today);
  const f = list.length ? list[day % list.length] : null;
  if (!f) return null;
  return (
    <div data-reveal className="prep-card relative overflow-hidden px-6 py-9 md:px-14 md:py-14">
      <div className="absolute right-6 md:right-12 -top-6 md:-top-10 font-display text-[11rem] md:text-[17rem] leading-none text-accent-soft-border/70 select-none pointer-events-none" aria-hidden="true">“</div>
      <div className="relative">
        <p className="prep-eyebrow text-brand">{t('home.qotd')} · {today.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</p>
        <p className="mt-5 font-display text-3xl md:text-5xl leading-[1.12] tracking-tight text-text-primary max-w-4xl">{f.text}</p>
        <p className="mt-5 text-text-secondary">{tn('common.askedTimes', f.timesAsked)}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button tone="ink" size="lg" icon="eye" onClick={() => onOpen(f.id)}>{t('home.qotdSee')}</Button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { status, go, daf } = usePrep();
  const { t, hi } = useT();
  const corpus = status.corpus || {};
  const [trends, setTrends] = useState(null);
  const [kw, setKw] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const root = useRef(null);
  const hasDaf = !!daf.profile && !daf.profile.empty;

  useEffect(() => {
    let cancelled = false;
    iv('/bank/trends').then((d) => { if (!cancelled) setTrends(d); }).catch(() => {});
    iv('/bank/keywords').then((d) => { if (!cancelled) setKw(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useReveal(root, { dependencies: [!!trends] });
  const mostAsked = trends?.mostAsked || [];

  return (
    <div ref={root}>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-16 pb-12 md:pb-20 grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] gap-12 lg:gap-14 items-center">
        <div>
          <p className="prep-eyebrow text-brand mb-5 md:mb-7">{t('home.eyebrow', { years: yearsRange(corpus.years) })}</p>
          <SplitHeading className={`font-display font-semibold text-text-primary ${hi
            ? 'text-[2.3rem] leading-[1.28] sm:text-5xl md:text-6xl lg:text-[4.1rem] lg:leading-[1.22]'
            : 'tracking-[-0.025em] text-[2.7rem] leading-[1.04] sm:text-6xl md:text-7xl lg:text-[4.9rem] lg:leading-[1]'}`}>
            {t('home.titleA')}<Highlight still>{t('home.titleHl')}</Highlight>{t('home.titleB')}
          </SplitHeading>
          <p className="mt-6 md:mt-8 text-lg md:text-xl text-text-secondary leading-relaxed max-w-xl">
            {t('home.sub', { interviews: fmt(corpus.transcripts) })}
          </p>
          <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button tone="primary" size="xl" magnetic iconRight="arrowRight" onClick={() => go({ screen: hasDaf ? 'predictions' : 'daf' })}>
              {hasDaf ? t('home.ctaPredicted') : t('home.ctaDaf')}
            </Button>
            <Button tone="ghost" size="xl" icon="search" onClick={() => go({ screen: 'bank' })}>{t('home.ctaBank', { n: fmt(corpus.questions) })}</Button>
          </div>
        </div>
        <div className="lg:pl-4">
          <DafSlip profile={daf.profile} />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8 -mt-4 mb-10"><DafCheckCard /></section>

      {/* Numbers */}
      <section className="max-w-7xl mx-auto px-4 md:px-8"><Stats corpus={corpus} /></section>

      {/* The boards, with their photos and how candidates found them */}
      {kw?.boards?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 pt-14 md:pt-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">{t('home.boards')}</h2>
              <p className="mt-2 text-text-secondary max-w-2xl">{t('home.boardsSub')}</p>
            </div>
            <Button tone="plain" size="sm" iconRight="arrowRight" onClick={() => go({ screen: 'bank', tab: 'boards' })}>{t('home.boardsAll')}</Button>
          </div>
          <BoardStrip boards={kw.boards} onOpenQuestion={setFamilyId} onSeeAll={() => go({ screen: 'bank', tab: 'boards' })} />
        </section>
      )}

      {/* Asked again and again */}
      {mostAsked.length > 0 && (
        <section className="pt-14 md:pt-20">
          <div className="max-w-7xl mx-auto px-4 md:px-8 mb-6 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">{t('home.marquee')}</h2>
            <Button tone="plain" size="sm" iconRight="arrowRight" onClick={() => go({ screen: 'bank' })}>{t('nav.bank')}</Button>
          </div>
          <Marquee items={mostAsked} onOpen={setFamilyId} />
        </section>
      )}

      {/* The six tools */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-16 md:pt-24">
        <p className="prep-eyebrow text-brand mb-3">{t('home.pathEyebrow')}</p>
        <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-tight mb-8 md:mb-12">{t('home.pathTitle')}</h2>
        <PathTiles corpus={corpus} go={go} />
      </section>

      {/* Question of the day */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-16 md:pt-24">
        <QuestionOfTheDay list={mostAsked} onOpen={setFamilyId} />
      </section>

      {familyId && <DeepDive key={familyId} familyId={familyId} onClose={() => setFamilyId(null)} />}
    </div>
  );
}
