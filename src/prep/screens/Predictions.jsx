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
import { useT, fmt } from '../lib/i18n';
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
      <SplitHeading className={`font-display font-semibold text-text-primary ${hi ? 'text-[1.9rem] leading-[1.3] md:text-5xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.1rem] leading-[1.1] md:text-5xl md:leading-[1.06]'}`}>
        {t('pred.titleA')}<Highlight still>{t('pred.titleHl')}</Highlight>
      </SplitHeading>
      <DafGate />
    </section>
  );
}

// The DAF-topics panel's open / closed state, kept in this browser (a convenience; it may be unavailable).
const RAIL_PREF = 'prep.pred.railOpen';
const readRail = () => { try { return localStorage.getItem(RAIL_PREF) !== '0'; } catch { return true; } };
const writeRail = (v) => { try { localStorage.setItem(RAIL_PREF, v ? '1' : '0'); } catch { /* storage blocked */ } };

// One DAF topic in the side panel / drawer.
function TopicButton({ g, compact, active, done, onClick }) {
  const { t } = useT();
  const title = groupTitle(t, g);
  return (
    <button type="button" onClick={onClick} title={compact ? title : undefined} aria-label={compact ? title : undefined} aria-current={active ? 'true' : undefined}
      className={`prep-focus w-full flex items-center rounded-2xl border text-left transition-colors cursor-pointer ${active ? 'border-text-primary bg-sunken' : 'border-border-subtle bg-surface hover:border-text-primary'} ${compact ? 'h-10 justify-center' : 'gap-3 px-3.5 py-2.5'}`}>
      <Icon name={TYPE_ICON[g.type] || 'info'} className="w-4 h-4 shrink-0 text-brand" />
      {!compact && (
        <>
          <span className="text-sm font-semibold truncate min-w-0">{title}</span>
          <span className="ml-auto prep-num text-xs text-text-tertiary shrink-0">{done}/{g.predictions.length}</span>
        </>
      )}
    </button>
  );
}

function PredictedQuestions() {
  const { go, prep, daf, status } = usePrep();
  const { t, tn, lang, hi } = useT();
  // Predictions belong to a language and a DAF; a response for an older pair is ignored.
  const reqKey = `${lang}|${(daf.profile?.items || []).map((i) => i.key).join(',')}`;
  const [res, setRes] = useState({ key: null, data: null, error: null });
  const data = res.key === reqKey ? res.data : null;
  const error = res.key === reqKey ? res.error : null;
  const [view, setView] = useState('items');
  const [tier, setTier] = useState('all');
  const [onlyReal, setOnlyReal] = useState(false);
  const [familyId, setFamilyId] = useState(null);
  const [railOpen, setRailOpen] = useState(readRail);
  const [drawer, setDrawer] = useState(false);
  const [openGroups, setOpenGroups] = useState(null); // null = only the first topic open
  const [active, setActive] = useState(null);
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
  const hasFollowUps = all.some((p) => p.followUps?.length);
  const isOpen = (key) => (openGroups ? openGroups.has(key) : key === groups[0]?.key);
  const doneIn = (g) => g.predictions.filter((p) => DONE.has(prep.items.get(p.key)?.status)).length;

  useReveal(root, { dependencies: [view, groups.length, ranked.length, !!data, openGroups] });

  // The topic being read, highlighted in the side panel.
  useEffect(() => {
    if (view !== 'items' || !groups.length || typeof IntersectionObserver === 'undefined') return undefined;
    const seen = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.dataset.group, e.isIntersecting ? e.boundingClientRect.top : null));
      const visible = [...seen.entries()].filter(([, top]) => top !== null).sort((a, b) => a[1] - b[1]);
      if (visible.length) setActive(visible[0][0]);
    }, { rootMargin: '-30% 0px -55% 0px' });
    root.current?.querySelectorAll('[data-group]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [view, groups, openGroups]);

  // Esc closes the phone drawer.
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

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

  const toggleRail = () => setRailOpen((o) => { writeRail(!o); return !o; });
  const setOpen = (key, value) => setOpenGroups((cur) => {
    const next = new Set(cur || (groups[0] ? [groups[0].key] : []));
    if (value) next.add(key); else next.delete(key);
    return next;
  });
  // A topic from the panel: opened, then scrolled to.
  const goTo = (key) => {
    setOpen(key, true);
    setDrawer(false);
    setTimeout(() => document.getElementById(`grp-${key}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }), 60);
  };
  const allOpen = groups.length > 0 && groups.every((g) => isOpen(g.key));

  return (
    <div ref={root}>
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-16 pb-8">
        <p className="prep-eyebrow text-brand mb-5">{t('pred.eyebrow', { n: fmt(data?.corpus?.transcripts || 0) })}</p>
        <SplitHeading className={`font-display font-semibold text-text-primary ${hi ? 'text-[1.9rem] leading-[1.3] md:text-5xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.1rem] leading-[1.1] md:text-5xl md:leading-[1.06]'}`}>
          {t('pred.titleA')}<Highlight still>{t('pred.titleHl')}</Highlight>
        </SplitHeading>
        {data && <p className="mt-6 text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl">{t('pred.sub', { q: fmt(data.summary?.questions || all.length) })}</p>}
        {data && hasFollowUps && (
          // The follow-ups are one of the most useful parts, and easy to miss: said up front.
          <p className="mt-4 max-w-2xl flex items-start gap-2.5 rounded-2xl border border-accent-soft-border bg-accent-soft-bg px-4 py-3 text-[15px] text-text-primary leading-relaxed" data-tour="pred-followhint">
            <Icon name="message" className="w-5 h-5 mt-0.5 shrink-0 text-brand" />
            <span>{t('pred.followHint')}</span>
          </p>
        )}
      </section>

      {!data ? <Building corpus={status.corpus} /> : (
        <>
          {/* Summary: tiers and readiness */}
          <section className="max-w-7xl mx-auto px-4 md:px-8" data-tour="pred-tiers">
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
            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1" data-tour="pred-views">
              {[['items', 'grid'], ['ranked', 'list'], ['cards', 'layers']].map(([v, icon]) => (
                <Chip key={v} active={view === v} onClick={() => setView(v)}><Icon name={icon} className="w-4 h-4" />{t(`pred.view.${v}`)}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {view === 'items' && groups.length > 1 && (
                <Chip active={false} onClick={() => setOpenGroups(allOpen ? new Set() : new Set(groups.map((g) => g.key)))}>
                  <Icon name={allOpen ? 'minimize' : 'maximize'} className="w-4 h-4" />{t(allOpen ? 'pred.closeAll' : 'pred.openAll')}
                </Chip>
              )}
              <Chip active={onlyReal} onClick={() => setOnlyReal((o) => !o)}><Icon name="check" className="w-4 h-4" />{t('pred.onlyReal')}</Chip>
              <Button tone="ghost" size="md" icon="edit" onClick={() => go({ screen: 'daf' })}>{t('pred.editDaf')}</Button>
            </div>
          </section>
          {!data.aiUsed && <p className="max-w-7xl mx-auto px-4 md:px-8 pt-3 text-sm text-text-tertiary">{t('pred.noAi')}</p>}

          {/* Views */}
          <section className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
            {view === 'cards' && <Flashcards cards={ranked} />}

            {view === 'ranked' && (
              <div className="grid lg:grid-cols-2 gap-4 md:gap-5 items-start">
                {ranked.length ? ranked.map((p) => <QuestionCard key={`${p.id}-${p.key}`} p={p} itemLabel={p.itemLabel} onOpen={setFamilyId} collapsible />) : <p className="text-text-secondary py-10">{t('pred.empty')}</p>}
              </div>
            )}

            {view === 'items' && (
              <div className={`lg:grid lg:gap-8 ${railOpen ? 'lg:grid-cols-[17rem_1fr]' : 'lg:grid-cols-[2.75rem_1fr]'}`}>
                {/* The DAF topics: a side panel on the left that folds to a strip of icons (more room for the
                    questions); on phones, a drawer from the left. */}
                <nav aria-label={t('pred.items')} data-tour="pred-rail" className="hidden lg:flex lg:flex-col lg:sticky lg:top-40 lg:self-start lg:max-h-[calc(100vh-11rem)]">
                  <div className={`mb-3 flex items-center ${railOpen ? 'justify-between' : 'justify-center'}`}>
                    {railOpen && <p className="prep-eyebrow text-text-tertiary">{t('pred.items')}</p>}
                    <button type="button" onClick={toggleRail} aria-expanded={railOpen} title={t(railOpen ? 'pred.rail.hide' : 'pred.rail.show')} aria-label={t(railOpen ? 'pred.rail.hide' : 'pred.rail.show')}
                      className="prep-focus w-9 h-9 rounded-full border border-border-default bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-primary cursor-pointer">
                      <Icon name={railOpen ? 'chevronLeft' : 'chevronRight'} className="w-4 h-4" />
                    </button>
                  </div>
                  <ul className="flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden min-h-0 flex-1 [scrollbar-width:thin] pr-1">
                    {groups.map((g) => (
                      <li key={g.key}><TopicButton g={g} compact={!railOpen} active={active === g.key} done={doneIn(g)} onClick={() => goTo(g.key)} /></li>
                    ))}
                  </ul>
                </nav>

                <div className="min-w-0">
                  {groups.length ? groups.map((g) => {
                    const open = isOpen(g.key);
                    const title = groupTitle(t, g);
                    const eyebrow = groupEyebrow(t, g);
                    return (
                      <section key={g.key} id={`grp-${g.key}`} data-group={g.key} className="scroll-mt-40 border-b border-border-subtle first:border-t">
                        <button type="button" onClick={() => setOpen(g.key, !open)} aria-expanded={open} data-tour="pred-topic"
                          className="prep-focus w-full text-left py-5 md:py-6 flex items-start gap-4 cursor-pointer group">
                          <span className="mt-0.5 w-11 h-11 rounded-2xl bg-accent-soft-bg text-brand flex items-center justify-center shrink-0"><Icon name={TYPE_ICON[g.type] || 'info'} className="w-5 h-5" /></span>
                          <span className="flex-1 min-w-0">
                            {eyebrow !== title && <span className="block prep-eyebrow text-brand">{eyebrow}</span>}
                            <span className="block mt-1 font-display text-2xl md:text-[2rem] md:leading-[1.15] font-semibold tracking-tight group-hover:text-brand transition-colors">{title}</span>
                            <span className="block mt-1.5 text-sm text-text-tertiary">
                              {tn('pred.group.count', g.shown.length, { n: fmt(g.shown.length) })} · {t('pred.group.done', { a: fmt(doneIn(g)), b: fmt(g.predictions.length) })}
                              {g.rate?.askedPct > 0 && g.type !== 'intro' && g.type !== 'motivation' ? ` · ${t('pred.group.asked', { pct: g.rate.askedPct })}` : ''}
                            </span>
                          </span>
                          <Icon name="chevronDown" className={`w-6 h-6 mt-2.5 shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                          <div className="pb-10 md:pb-12">
                            <div className="mb-5"><RateLine g={g} /></div>
                            <div className="grid xl:grid-cols-2 gap-4 md:gap-5 items-start">
                              {g.shown.map((p) => <QuestionCard key={p.id} p={p} onOpen={setFamilyId} collapsible />)}
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  }) : <p className="text-text-secondary py-10">{t('pred.empty')}</p>}
                </div>
              </div>
            )}
          </section>

          {/* Phones: the topics open from a button on the left, above the bottom bar. */}
          {view === 'items' && groups.length > 0 && (
            <button type="button" onClick={() => setDrawer(true)} aria-haspopup="dialog" data-tour="pred-rail-phone"
              className="prep-focus lg:hidden fixed left-4 z-30 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] inline-flex items-center gap-2 rounded-full bg-text-primary text-page px-4 h-11 text-sm font-bold shadow-[var(--prep-shadow-lift)] cursor-pointer">
              <Icon name="list" className="w-4 h-4" />{t('pred.items')}
            </button>
          )}
          {drawer && (
            <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('pred.items')}>
              <button type="button" className="absolute inset-0 bg-black/40 cursor-default" aria-label={t('common.close')} onClick={() => setDrawer(false)} />
              <div className="absolute inset-y-0 left-0 w-[84vw] max-w-sm bg-page border-r border-border-default shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-4 h-16 border-b border-border-subtle shrink-0">
                  <p className="font-display text-xl font-semibold">{t('pred.items')}</p>
                  <button type="button" onClick={() => setDrawer(false)} className="prep-focus w-10 h-10 rounded-full flex items-center justify-center hover:bg-sunken cursor-pointer" aria-label={t('common.close')}><Icon name="x" className="w-5 h-5" /></button>
                </div>
                <ul className="flex-1 overflow-y-auto p-3 space-y-1.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  {groups.map((g) => <li key={g.key}><TopicButton g={g} active={active === g.key} done={doneIn(g)} onClick={() => goTo(g.key)} /></li>)}
                </ul>
              </div>
            </div>
          )}

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

        </>
      )}

      {familyId && <DeepDive familyId={familyId} onClose={() => setFamilyId(null)} />}
    </div>
  );
}
