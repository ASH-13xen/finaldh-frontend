// Predicted questions: every item in the student's DAF with the real rate at which boards asked about it,
// and the questions they are likely to face - real ones first, AI suggestions marked - by DAF item, as one
// ranked list, or as flashcards.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Button from '../components/Button';
import QuestionCard from '../components/QuestionCard';
import DeepDive from '../components/DeepDive';
import Flashcards from '../components/Flashcards';
import { TierBadge, Chip } from '../components/badges';
import { SplitHeading, CountUp, Highlight, Ring } from '../components/motion';
import { gsap, useGSAP, useReveal, prefersReducedMotion } from '../lib/motion';
import { useT, fmt, yearsRange } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { api } from '../lib/api';
import { errorMessage } from '../../lib/interviewApi';
import { DafGate } from '../components/DafCheck';
import { useDafCheck } from '../lib/useDafCheck';
import { TIERS, groupTitle, byLikelihood } from '../lib/predicted';

const TYPE_ICON = { intro: 'user', motivation: 'target', home: 'mapPin', education: 'graduation', work: 'briefcase', optional: 'book', hobby: 'heart', eca: 'award', service: 'layers', family: 'users', language: 'languages', name: 'user' };
const DONE = new Set(['practised', 'confident']);

const groupEyebrow = (t, g) => (g.isCollege ? t('area.college') : t(`area.${g.type}`));

function RateLine({ g }) {
  const { t } = useT();
  const r = g.rate;
  if (g.type === 'intro' || g.type === 'motivation') return <p className="text-[15px] text-text-secondary">{t('pred.rate.staple')}</p>;
  if (!r) return null;
  const sentence = r.scope === 'item'
    ? t('pred.rate.item', { label: r.label, pct: r.askedPct, n: fmt(r.interviews), q: r.avgQuestions })
    : t('pred.rate.area', { area: t(`area.${r.kind}`).toLowerCase(), pct: r.askedPct, q: r.avgQuestions });
  return (
    <div className="flex items-center gap-4 max-w-2xl">
      <div className="hidden sm:block w-28 h-2 rounded-full bg-sunken overflow-hidden shrink-0" aria-hidden="true">
        <div className="h-full rounded-full bg-brand" style={{ width: `${r.askedPct}%` }} />
      </div>
      <p className="text-[15px] leading-relaxed text-text-secondary">{sentence}</p>
    </div>
  );
}

function Building({ corpus }) {
  const { t } = useT();
  const steps = [t('pred.building1', { n: fmt(corpus?.transcripts || 0) }), t('pred.building2'), t('pred.building3')];
  const root = useRef(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
    gsap.utils.toArray('[data-step]', root.current).forEach((el, i) => {
      tl.fromTo(el, { autoAlpha: 0.25 }, { autoAlpha: 1, duration: 0.5 }, i * 1.3)
        .fromTo(el.querySelector('[data-bar]'), { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left', duration: 1.2, ease: 'power1.inOut' }, i * 1.3);
    });
  }, { scope: root });
  return (
    <div ref={root} className="max-w-xl mx-auto py-16 md:py-24 space-y-6" role="status" aria-live="polite">
      {steps.map((s) => (
        <div key={s} data-step>
          <p className="font-display text-xl md:text-2xl">{s}</p>
          <div className="mt-2 h-1.5 rounded-full bg-sunken overflow-hidden"><div data-bar className="h-full bg-brand" /></div>
        </div>
      ))}
    </div>
  );
}

function HowWePredict({ corpus }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="prep-card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="prep-focus w-full flex items-center justify-between gap-4 px-5 md:px-7 py-4 text-left cursor-pointer">
        <span className="flex items-center gap-3 font-semibold"><Icon name="info" className="w-5 h-5 text-brand" />{t('pred.howTitle')}</span>
        <Icon name="chevronDown" className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="px-5 md:px-7 pb-6 grid md:grid-cols-3 gap-4">
          {[t('pred.how1', { n: fmt(corpus?.transcripts || 0), years: yearsRange(corpus?.years) }), t('pred.how2'), t('pred.how3')].map((s, i) => (
            <li key={i} className="rounded-2xl bg-sunken/60 p-4">
              <span className="prep-num font-display text-3xl text-brand">{i + 1}</span>
              <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">{s}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Predicted questions open once an admin has verified the student's DAF; until then the screen shows where
// the verification stands (the server refuses them too).
export default function Predictions() {
  const { status } = usePrep();
  const { t, hi } = useT();
  const check = useDafCheck();
  if (check.verified) return <PredictedQuestions />;
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-16 pb-16">
      <p className="prep-eyebrow text-brand mb-5">{t('pred.eyebrow', { n: fmt(status?.corpus?.transcripts || 0) })}</p>
      <SplitHeading className={`font-display font-semibold text-text-primary ${hi ? 'text-[2.2rem] leading-[1.3] md:text-6xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.6rem] leading-[1.04] md:text-7xl md:leading-[1]'}`}>
        {t('pred.titleA')}<Highlight still>{t('pred.titleHl')}</Highlight>
      </SplitHeading>
      <DafGate />
    </section>
  );
}

function PredictedQuestions() {
  const { go, prep, daf, status } = usePrep();
  const { t, lang, hi } = useT();
  // Predictions belong to a language and a DAF; a response for an older pair is ignored.
  const reqKey = `${lang}|${(daf.profile?.items || []).map((i) => i.key).join(',')}`;
  const [res, setRes] = useState({ key: null, data: null, error: null });
  const data = res.key === reqKey ? res.data : null;
  const error = res.key === reqKey ? res.error : null;
  const [view, setView] = useState('items');
  const [tier, setTier] = useState('all');
  const [onlyReal, setOnlyReal] = useState(false);
  const [familyId, setFamilyId] = useState(null);
  const root = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.predictions(lang)
      .then((d) => { if (!cancelled) setRes({ key: reqKey, data: d, error: null }); })
      .catch((err) => { if (!cancelled) setRes({ key: reqKey, data: null, error: err }); });
    return () => { cancelled = true; };
  }, [reqKey, lang]);


  const keep = (p) => (tier === 'all' || p.tier === tier) && (!onlyReal || p.source !== 'new');
  const groups = useMemo(() => (data?.groups || []).map((g) => ({ ...g, shown: g.predictions.filter(keep) })).filter((g) => g.shown.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, tier, onlyReal]);
  const all = useMemo(() => (data?.groups || []).flatMap((g) => g.predictions.map((p) => ({ ...p, itemLabel: groupTitle(t, g) }))), [data, t]);
  const ranked = useMemo(() => {
    return all.filter(keep).sort(byLikelihood);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, tier, onlyReal]);
  const done = all.filter((p) => DONE.has(prep.items.get(p.key)?.status)).length;

  useReveal(root, { dependencies: [view, groups.length, ranked.length, !!data] });

  if (error?.data?.needsProfile) {
    return (
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-20 text-center">
        <Icon name="fileText" className="w-12 h-12 mx-auto text-brand" />
        <h1 className="mt-6 font-display text-4xl md:text-5xl font-semibold tracking-tight">{t('pred.needDetails')}</h1>
        <p className="mt-4 text-lg text-text-secondary">{t('pred.needDetailsSub')}</p>
        <Button tone="primary" size="xl" iconRight="arrowRight" magnetic className="mt-8" onClick={() => go({ screen: 'daf' })}>{t('daf.needDetails.cta')}</Button>
      </section>
    );
  }
  if (error) return <p className="max-w-3xl mx-auto px-4 py-20 text-center text-text-secondary">{errorMessage(error)}</p>;

  const scrollTo = (key) => document.getElementById(`grp-${key}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });

  return (
    <div ref={root}>
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-16 pb-8">
        <p className="prep-eyebrow text-brand mb-5">{t('pred.eyebrow', { n: fmt(data?.corpus?.transcripts || 0) })}</p>
        <SplitHeading className={`font-display font-semibold text-text-primary ${hi ? 'text-[2.2rem] leading-[1.3] md:text-6xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.6rem] leading-[1.04] md:text-7xl md:leading-[1]'}`}>
          {t('pred.titleA')}<Highlight still>{t('pred.titleHl')}</Highlight>
        </SplitHeading>
        {data && <p className="mt-6 text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl">{t('pred.sub', { q: fmt(data.summary?.questions || all.length) })}</p>}
      </section>

      {!data ? <Building corpus={status.corpus} /> : (
        <>
          {/* Summary: tiers and readiness */}
          <section className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {TIERS.map((k) => (
                <button key={k} type="button" data-reveal onClick={() => setTier(tier === k ? 'all' : k)} aria-pressed={tier === k}
                  className={`prep-focus prep-card prep-card-hover text-left px-5 py-5 md:px-6 md:py-6 cursor-pointer ${tier === k ? 'ring-2 ring-text-primary' : ''}`}>
                  <TierBadge tier={k} size="sm" />
                  <CountUp value={data.summary?.[k] || 0} className="prep-num block mt-4 font-display text-4xl md:text-5xl font-semibold" />
                  <span className="block mt-1 text-sm text-text-tertiary leading-snug">{t(`tier.${k}.about`)}</span>
                </button>
              ))}
              <div data-reveal className="prep-card px-5 py-5 md:px-6 md:py-6 flex items-center gap-4">
                <Ring value={all.length ? done / all.length : 0} size={78} stroke={7}>
                  <span className="prep-num font-display text-lg font-semibold">{all.length ? Math.round((done / all.length) * 100) : 0}%</span>
                </Ring>
                <span className="text-sm text-text-secondary leading-snug">{t('pred.readinessOf', { a: fmt(done), b: fmt(all.length) })}</span>
              </div>
            </div>
          </section>

          {/* Controls */}
          <section className="max-w-7xl mx-auto px-4 md:px-8 pt-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {[['items', 'grid'], ['ranked', 'list'], ['cards', 'layers']].map(([v, icon]) => (
                <Chip key={v} active={view === v} onClick={() => setView(v)}><Icon name={icon} className="w-4 h-4" />{t(`pred.view.${v}`)}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip active={onlyReal} onClick={() => setOnlyReal((o) => !o)}><Icon name="check" className="w-4 h-4" />{t('pred.onlyReal')}</Chip>
              <Button tone="ghost" size="md" icon="edit" onClick={() => go({ screen: 'daf' })}>{t('pred.editDaf')}</Button>
            </div>
          </section>
          {!data.aiUsed && <p className="max-w-7xl mx-auto px-4 md:px-8 pt-3 text-sm text-text-tertiary">{t('pred.noAi')}</p>}

          {/* Views */}
          <section className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
            {view === 'cards' && <Flashcards cards={ranked} />}

            {view === 'ranked' && (
              <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
                {ranked.length ? ranked.map((p) => <QuestionCard key={`${p.id}-${p.key}`} p={p} itemLabel={p.itemLabel} onOpen={setFamilyId} />) : <p className="text-text-secondary py-10">{t('pred.empty')}</p>}
              </div>
            )}

            {view === 'items' && (
              <div className="lg:grid lg:grid-cols-[17rem_1fr] lg:gap-10">
                {/* The DAF items: a sticky rail on desktop, a strip of chips on phones */}
                <nav aria-label={t('pred.items')} className="lg:sticky lg:top-40 lg:self-start mb-6 lg:mb-0">
                  <p className="hidden lg:block prep-eyebrow text-text-tertiary mb-3">{t('pred.items')}</p>
                  <ul className="flex lg:flex-col gap-2 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1">
                    {groups.map((g) => {
                      const doneHere = g.predictions.filter((p) => DONE.has(prep.items.get(p.key)?.status)).length;
                      return (
                        <li key={g.key} className="shrink-0">
                          <button type="button" onClick={() => scrollTo(g.key)} className="prep-focus w-full flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface hover:border-text-primary px-3.5 py-2.5 text-left transition-colors cursor-pointer">
                            <Icon name={TYPE_ICON[g.type] || 'info'} className="w-4 h-4 shrink-0 text-brand" />
                            <span className="text-sm font-semibold truncate max-w-[11rem]">{groupTitle(t, g)}</span>
                            <span className="ml-auto prep-num text-xs text-text-tertiary">{doneHere}/{g.predictions.length}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
                <div className="space-y-14 md:space-y-20 min-w-0">
                  {groups.length ? groups.map((g) => (
                    <div key={g.key} id={`grp-${g.key}`} className="scroll-mt-40">
                      <div className="mb-6">
                        {groupEyebrow(t, g) !== groupTitle(t, g) && <p className="prep-eyebrow text-brand flex items-center gap-2"><Icon name={TYPE_ICON[g.type] || 'info'} className="w-4 h-4" />{groupEyebrow(t, g)}</p>}
                        <h2 className="mt-3 font-display text-3xl md:text-[2.6rem] md:leading-[1.1] font-semibold tracking-tight">{groupTitle(t, g)}</h2>
                        <div className="mt-3"><RateLine g={g} /></div>
                      </div>
                      <div className="grid xl:grid-cols-2 gap-4 md:gap-5">
                        {g.shown.map((p) => <QuestionCard key={p.id} p={p} onOpen={setFamilyId} />)}
                      </div>
                    </div>
                  )) : <p className="text-text-secondary py-10">{t('pred.empty')}</p>}
                </div>
              </div>
            )}
          </section>

          {/* Asked to almost everyone */}
          {data.general?.length > 0 && view !== 'cards' && (
            <section className="max-w-7xl mx-auto px-4 md:px-8 pt-20">
              <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight">{t('pred.general')}</h2>
              <p className="mt-2 text-text-secondary">{t('pred.generalSub')}</p>
              <ul className="mt-6 grid md:grid-cols-2 gap-3">
                {data.general.map((f) => (
                  <li key={f.id} data-reveal>
                    <button type="button" onClick={() => setFamilyId(f.id)} className="prep-focus w-full text-left prep-card prep-card-hover px-5 py-4 flex items-center gap-4 cursor-pointer">
                      <span className="prep-num shrink-0 w-14 h-14 rounded-2xl bg-accent-soft-bg text-brand font-display text-xl font-semibold flex items-center justify-center">{f.timesAsked}×</span>
                      <span className="text-[16px] leading-snug">{f.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="max-w-7xl mx-auto px-4 md:px-8 pt-16"><HowWePredict corpus={data.corpus} /></section>
        </>
      )}

      {familyId && <DeepDive familyId={familyId} onClose={() => setFamilyId(null)} />}
    </div>
  );
}
