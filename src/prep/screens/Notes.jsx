// Notes: current topics a board may raise (each with likely questions and model answers, and a PDF), and the
// guide to the 100 questions boards ask most. Topics that touch the student's DAF are marked "for you".
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { ErrorBanner } from '../../components/mcq/ui';
import { errorMessage } from '../../lib/interviewApi';
import Button from '../components/Button';
import { SplitHeading, Highlight } from '../components/motion';
import NoteCard from '../components/notes/NoteCard';
import NoteReader from '../components/notes/NoteReader';
import GuideView from '../components/notes/GuideView';
import AdminDesk from '../components/notes/AdminDesk';
import { gsap, useGSAP, useReveal, prefersReducedMotion } from '../lib/motion';
import { useT } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { api } from '../lib/api';
import { toneOf } from '../lib/notes';

function Topics() {
  const { t, lang } = useT();
  const { go, user } = usePrep();
  const [res, setRes] = useState({ key: null, data: null, error: null });
  const [tick, setTick] = useState(0);
  const [cat, setCat] = useState('all');
  const root = useRef(null);
  const reqKey = `${lang}:${tick}`;

  useEffect(() => {
    let cancelled = false;
    api.notes(lang)
      .then((d) => { if (!cancelled) setRes({ key: reqKey, data: d, error: null }); })
      .catch((err) => { if (!cancelled) setRes({ key: reqKey, data: null, error: err }); });
    return () => { cancelled = true; };
  }, [lang, reqKey]);

  const notes = useMemo(() => res.data?.notes || [], [res.data]);
  const forYou = useMemo(() => notes.filter((n) => n.forYou), [notes]);
  const cats = useMemo(() => [...new Set(notes.map((n) => n.category).filter(Boolean))], [notes]);
  const shown = cat === 'all' ? notes : notes.filter((n) => n.category === cat);
  const loading = !res.data && !res.error;
  const open = (slug) => go({ screen: 'notes', note: slug });
  useReveal(root, { dependencies: [notes.length, cat] });

  return (
    <div ref={root}>
      {user?.isAdmin && <AdminDesk onChanged={() => setTick((k) => k + 1)} />}

      {loading && (
        <div className="mt-10 grid md:grid-cols-2 gap-5" aria-busy="true">
          <div className="md:col-span-2 h-72 rounded-[1.75rem] bg-sunken animate-pulse" />
          <div className="h-56 rounded-[1.75rem] bg-sunken animate-pulse" />
          <div className="h-56 rounded-[1.75rem] bg-sunken animate-pulse" />
        </div>
      )}
      {res.error && <div className="mt-10"><ErrorBanner onRetry={() => setTick((k) => k + 1)}>{errorMessage(res.error, t('common.error'))}</ErrorBanner></div>}

      {res.data && !notes.length && (
        <div data-reveal className="mt-10 prep-card px-7 py-14 md:py-20 flex flex-col items-center text-center">
          <div className="w-40 space-y-2" aria-hidden="true">
            <div className="h-3 w-3/4 rounded bg-text-primary/70" />
            {[100, 92, 96, 70].map((w, i) => <div key={i} className="h-2 rounded bg-sunken" style={{ width: `${w}%` }} />)}
          </div>
          <p className="mt-8 font-display text-2xl md:text-3xl text-text-primary max-w-xl">{t('nt.none')}</p>
          <Button className="mt-8" tone="ghost" size="lg" icon="book" onClick={() => go({ screen: 'notes', tab: 'guide' }, { replace: true })}>{t('nt.tab.guide')}</Button>
        </div>
      )}

      {notes.length > 0 && (
        <>
          {forYou.length > 0 && (
            <section className="mt-12">
              <div data-reveal className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight flex items-center gap-3"><Icon name="star" className="w-7 h-7 text-brand" />{t('nt.forYou')}</h2>
                  <p className="mt-2 text-text-secondary">{t('nt.forYouSub')}</p>
                </div>
              </div>
              <div className="mt-6 -mx-4 px-4 md:mx-0 md:px-0 flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-2">
                {forYou.slice(0, 6).map((n) => (
                  <div key={n.slug} className="snap-start shrink-0 w-[85%] sm:w-[60%] md:w-auto">
                    <NoteCard note={n} onOpen={open} className="ring-2 ring-brand/30" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {!res.data.hasDaf && (
            <div data-reveal className="mt-10 rounded-[1.5rem] border border-accent-soft-border bg-accent-soft-bg px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <Icon name="fileText" className="w-7 h-7 text-brand shrink-0" />
              <p className="flex-1 text-text-primary">{t('nt.addDaf')}</p>
              <Button tone="primary" size="md" iconRight="arrowRight" onClick={() => go({ screen: 'daf' })}>{t('nav.daf')}</Button>
            </div>
          )}

          <div className="mt-12 flex flex-wrap items-center gap-2" role="group">
            {['all', ...cats].map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
                className={`prep-focus h-11 px-4 rounded-full text-sm font-semibold border flex items-center gap-2 transition-colors cursor-pointer ${cat === c ? 'bg-text-primary text-page border-text-primary' : 'border-border-default text-text-secondary hover:border-text-primary hover:text-text-primary'}`}>
                {c !== 'all' && <span className="w-2 h-2 rounded-full" style={{ background: toneOf(c) }} aria-hidden="true" />}
                {c === 'all' ? t('nt.all') : t(`cat.${c}`)}
                <span className="prep-num text-xs opacity-60">{c === 'all' ? notes.length : notes.filter((n) => n.category === c).length}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {shown.map((n, i) => (
              <div key={n.slug} className={i === 0 && cat === 'all' ? 'md:col-span-2 lg:col-span-3' : ''}>
                <NoteCard note={n} onOpen={open} big={i === 0 && cat === 'all'} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Tabs({ tab }) {
  const { t } = useT();
  const { go } = usePrep();
  const bar = useRef(null);
  const pill = useRef(null);
  // The dark pill slides to the chosen tab.
  useGSAP(() => {
    const target = bar.current?.querySelector(`[data-tab="${tab}"]`);
    if (!target || !pill.current) return;
    const to = { x: target.offsetLeft, width: target.offsetWidth };
    if (prefersReducedMotion()) gsap.set(pill.current, to);
    else gsap.to(pill.current, { ...to, duration: 0.55, ease: 'prep' });
  }, { dependencies: [tab, t] });
  return (
    <div ref={bar} role="tablist" className="relative mt-10 inline-flex p-1.5 rounded-full border border-border-default bg-surface max-w-full overflow-x-auto">
      <span ref={pill} className="absolute top-1.5 bottom-1.5 left-0 rounded-full bg-text-primary" aria-hidden="true" />
      {['topics', 'guide'].map((k) => (
        <button key={k} type="button" role="tab" data-tab={k} aria-selected={tab === k}
          onClick={() => go({ screen: 'notes', tab: k }, { replace: true })}
          className={`prep-focus relative z-[1] h-12 px-5 md:px-7 rounded-full font-semibold whitespace-nowrap transition-colors duration-300 cursor-pointer flex items-center gap-2 ${tab === k ? 'text-page' : 'text-text-secondary hover:text-text-primary'}`}>
          <Icon name={k === 'topics' ? 'notepad' : 'award'} className="w-5 h-5" />
          {t(k === 'topics' ? 'nt.tab.topics' : 'nt.tab.guide')}
        </button>
      ))}
    </div>
  );
}

export default function Notes() {
  const { view } = usePrep();
  const { t, hi } = useT();
  if (view.note) return <NoteReader slug={view.note} />;
  const tab = view.tab === 'guide' ? 'guide' : 'topics';
  const titleCls = `font-display font-semibold text-text-primary ${hi ? 'text-[2.2rem] leading-[1.3] md:text-6xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.6rem] leading-[1.04] md:text-7xl md:leading-[1]'}`;
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-16">
      <p className="prep-eyebrow text-brand mb-5">{t('nt.eyebrow')}</p>
      <SplitHeading className={titleCls}>{t('nt.titleA')}<Highlight still>{t('nt.titleHl')}</Highlight></SplitHeading>
      <p className="mt-6 text-lg md:text-xl text-text-secondary max-w-3xl">{t('nt.sub')}</p>
      <Tabs tab={tab} />
      {tab === 'topics' ? <Topics /> : <GuideView />}
    </div>
  );
}
