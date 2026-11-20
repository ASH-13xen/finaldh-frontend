// The question bank: search by meaning, one-tap collections, plain-language filters with live counts,
// browsing by DAF keyword, and each board's habits. Until the student's DAF is verified (and for visitors who
// haven't signed in) it is a preview: the server sends the most-asked questions only, the list fades out
// under a card saying how to see the rest, and search, filters and collections lead to that card.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Button from '../components/Button';
import BankCard from '../components/BankCard';
import FilterPanel from '../components/FilterPanel';
import Browse from '../components/Browse';
import Boards from '../components/Boards';
import DeepDive from '../components/DeepDive';
import Sheet from '../components/Sheet';
import { Chip } from '../components/badges';
import { SplitHeading, Highlight, CountUp } from '../components/motion';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion';
import { useT, fmt, yearsRange } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { api } from '../lib/api';
import { errorMessage } from '../../lib/interviewApi';
import { useDafCheck } from '../lib/useDafCheck';
import { PreviewEnd } from '../components/Gate';

const EXAMPLES = ['why civil services', 'net neutrality', 'cricket', 'women safety', 'artificial intelligence', 'federalism'];
const PAGE = 20;

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

const KIND_LABEL = { hobby: 'browse.kind.hobby', college: 'browse.kind.college', discipline: 'browse.kind.discipline', job: 'browse.kind.job', state: 'browse.kind.state', optional: 'browse.kind.optional' };

export default function Bank() {
  const { status, view, daf, go, guest, signIn } = usePrep();
  const check = useDafCheck();
  const { t, hi } = useT();
  const corpus = status.corpus || {};
  const [tab, setTab] = useState(() => (['browse', 'boards'].includes(view.tab) ? view.tab : 'questions'));
  const [q, setQ] = useState(view.q || '');
  const dq = useDebounced(q.trim());
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState('');
  const [res, setRes] = useState({ key: null, items: [], total: 0, facets: null, semantic: false, page: 1, error: null, preview: false });
  const [more, setMore] = useState(false);
  const [familyId, setFamilyId] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [kw, setKw] = useState(null);
  const list = useRef(null);

  const effSort = sort || (dq ? 'relevance' : 'asked');
  const reqKey = JSON.stringify({ dq, filters, effSort });
  const loading = res.key !== reqKey;

  useEffect(() => {
    let cancelled = false;
    api.search({ q: dq, ...filters, sort: effSort, page: 1, limit: PAGE, facets: 1 })
      .then((d) => { if (!cancelled) setRes({ key: reqKey, items: d.items, total: d.total, facets: d.facets, semantic: d.semantic, page: 1, error: null, preview: !!d.preview }); })
      .catch((err) => { if (!cancelled) setRes({ key: reqKey, items: [], total: 0, facets: null, semantic: false, page: 1, error: err, preview: false }); });
    return () => { cancelled = true; };
    // reqKey covers dq, filters and the sort
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);

  useEffect(() => {
    let cancelled = false;
    api.keywords().then((d) => { if (!cancelled) setKw(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useGSAP(() => {
    if (loading || !list.current || prefersReducedMotion()) return;
    gsap.from(list.current.querySelectorAll('[data-card]'), { y: 18, autoAlpha: 0, duration: 0.55, stagger: 0.035, clearProps: 'transform' });
  }, { dependencies: [res.key], scope: list });

  const loadMore = async () => {
    setMore(true);
    try {
      const d = await api.search({ q: dq, ...filters, sort: effSort, page: res.page + 1, limit: PAGE });
      setRes((r) => ({ ...r, items: [...r.items, ...d.items], page: r.page + 1 }));
    } catch { /* the button stays; try again */ }
    setMore(false);
  };

  // The server decides; until its first answer, go by what we know of the DAF.
  const preview = res.key ? res.preview : (guest || (!check.loading && !check.verified));
  const gate = useRef(null);
  const toGate = () => {
    setTab('questions');
    requestAnimationFrame(() => gate.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' }));
  };
  const gateKind = guest ? 'guest' : check.status === 'pending' ? 'pending' : check.status === 'rejected' ? 'rejected' : 'none';

  const setFilter = (k, v) => setFilters((f) => { const n = { ...f }; if (v) n[k] = v; else delete n[k]; return n; });
  const clearAll = () => { setFilters({}); setQ(''); setSort(''); };
  const applyCollection = (c) => { setQ(''); setFilters(c.filters); setSort(c.sort || 'asked'); setTab('questions'); };

  const homeState = daf.profile?.profile?.homeState;
  const collections = useMemo(() => [
    { key: 'top', filters: { often: 'hot' }, icon: 'flame' },
    { key: 'intro', filters: { hookType: 'intro' }, icon: 'user' },
    { key: 'why', filters: { hookType: 'motivation' }, icon: 'target' },
    { key: 'situational', filters: { qtype: 'situational' }, icon: 'compass' },
    { key: 'current', filters: { shelfLife: 'event' }, icon: 'zap' },
    { key: '2025', filters: { year: '2025' }, icon: 'calendar' },
    { key: 'hobby', filters: { hookType: 'hobby' }, icon: 'heart' },
    ...(homeState ? [{ key: 'state', filters: { label: `state:${homeState}` }, icon: 'mapPin', vars: { state: homeState } }] : [])
  ], [homeState]);

  const active = Object.entries(filters);
  const chipLabel = (k, v) => {
    if (k === 'often') return t(`bank.often.${v}`);
    if (k === 'hookType') return t(`area.${v}`);
    if (k === 'qtype') return t(`qtype.${v}`);
    if (k === 'topic') return t(`topic.${v}`);
    if (k === 'asker') return t(`bank.asker.${v}`);
    if (k === 'shelfLife') return v === 'evergreen' ? t('bank.f.relevant') : t('col.current');
    if (k === 'label') { const [kind, ...rest] = v.split(':'); return `${t(KIND_LABEL[kind] || 'bank.filters')}: ${rest.join(':')}`; }
    return v;
  };

  return (
    <div>
      {/* Search hero */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-16 pb-8">
        <p className="prep-eyebrow text-brand mb-5">{t('bank.eyebrow', { q: fmt(corpus.questions), n: fmt(corpus.transcripts), years: yearsRange(corpus.years) })}</p>
        <SplitHeading className={`font-display font-semibold text-text-primary ${hi ? 'text-[2.2rem] leading-[1.3] md:text-6xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.6rem] leading-[1.04] md:text-7xl md:leading-[1]'}`}>
          {t('bank.titleA')}<Highlight still>{t('bank.titleHl')}</Highlight>{t('bank.titleB')}
        </SplitHeading>
        <div className="mt-8 md:mt-10 relative max-w-3xl">
          <Icon name="search" className="w-6 h-6 absolute left-5 md:left-7 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            value={preview ? '' : q}
            readOnly={preview}
            onFocus={preview ? toGate : undefined}
            onChange={(e) => { setQ(e.target.value); setTab('questions'); }}
            placeholder={preview ? t(guest ? 'bank.searchLockedGuest' : 'bank.searchLocked', { n: fmt(corpus.questions) }) : t('bank.search')}
            aria-label={t('bank.search')}
            className="prep-focus w-full h-16 md:h-20 rounded-full border-2 border-border-default bg-surface pl-14 md:pl-[4.5rem] pr-14 text-lg md:text-2xl font-display text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-primary shadow-[0_18px_40px_-24px_rgba(20,17,13,0.35)] transition-colors"
          />
          {q && !preview && (
            <button type="button" onClick={() => setQ('')} aria-label={t('bank.clear')} className="prep-focus absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-text-tertiary hover:text-text-primary cursor-pointer">
              <Icon name="x" className="w-5 h-5" />
            </button>
          )}
        </div>
        {!preview && <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text-tertiary mr-1">{t('bank.try')}</span>
          {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => { setQ(e); setTab('questions'); }} className="prep-focus h-9 px-4 rounded-full border border-dashed border-border-default text-sm text-text-secondary hover:border-text-primary hover:text-text-primary cursor-pointer">{e}</button>)}
        </div>}
      </section>

      {/* Tabs */}
      <section className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1 border-b border-border-subtle">
          {['questions', 'browse', 'boards'].map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
              className={`prep-focus h-12 px-4 -mb-px border-b-2 text-[15px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${tab === k ? 'border-text-primary text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-primary'}`}>
              {t(`bank.tab.${k}`)}
            </button>
          ))}
          <button type="button" onClick={() => go({ screen: 'insights' })}
            className="prep-focus ml-auto h-12 px-4 -mb-px border-b-2 border-transparent text-[15px] font-semibold whitespace-nowrap cursor-pointer text-brand hover:text-text-primary flex items-center gap-1.5">
            <Icon name="chart" className="w-4 h-4" />{t('bank.insightsLink')}
          </button>
        </div>
      </section>

      {tab === 'browse' && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10">
          <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight">{t('browse.title')}</h2>
          <p className="mt-3 text-lg text-text-secondary max-w-2xl">{t('browse.sub')}</p>
          <div className="mt-8"><Browse keywords={kw?.keywords} onPick={preview ? toGate : (kind, label) => { setQ(''); setFilters({ label: `${kind}:${label}` }); setSort('asked'); setTab('questions'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></div>
        </section>
      )}

      {tab === 'boards' && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10">
          <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight">{t('boards.title')}</h2>
          <p className="mt-3 text-lg text-text-secondary max-w-2xl">{t('boards.sub')}</p>
          <div className="mt-8"><Boards boards={kw?.boards} onOpenQuestion={setFamilyId} onFilterBoard={preview ? toGate : (name) => { setQ(''); setFilters({ board: name }); setSort('asked'); setTab('questions'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></div>
        </section>
      )}

      {tab === 'questions' && (
        <>
          {/* Collections */}
          {!dq && !active.length && !preview && (
            <section className="pt-8">
              <p className="max-w-7xl mx-auto px-4 md:px-8 prep-eyebrow text-text-tertiary mb-3">{t('bank.collections')}</p>
              <div className="max-w-7xl mx-auto px-4 md:px-8 flex gap-3 overflow-x-auto pb-2 snap-x">
                {collections.map((c) => (
                  <button key={c.key} type="button" onClick={() => applyCollection(c)} className="prep-focus prep-card prep-card-hover snap-start shrink-0 w-56 md:w-60 text-left px-5 py-5 cursor-pointer group">
                    <Icon name={c.icon} className="w-6 h-6 text-brand" />
                    <p className="mt-4 font-display text-xl leading-snug font-semibold group-hover:text-brand transition-colors">{t(`col.${c.key}`, c.vars)}</p>
                    <p className="mt-1 text-sm text-text-tertiary">{t(`col.${c.key}.sub`, c.vars)}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={`mx-auto px-4 md:px-8 pt-8 ${preview ? 'max-w-4xl' : 'max-w-7xl lg:grid lg:grid-cols-[18rem_1fr] lg:gap-10'}`}>
            {!preview && (
              <aside className="hidden lg:block lg:sticky lg:top-40 lg:self-start lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto pr-2 -mr-2">
                <FilterPanel filters={filters} setFilter={setFilter} facets={res.facets} />
              </aside>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-text-secondary" aria-live="polite">
                  {loading ? t('bank.loading')
                    : preview ? t('bank.preview.count', { shown: fmt(res.items.length), n: fmt(corpus.questions || res.total) })
                      : <><CountUp value={res.total} duration={0.6} className="prep-num font-display text-2xl font-semibold text-text-primary mr-1.5" />{t('bank.results', { n: '' }).trim()}</>}
                </p>
                {!preview && <div className="flex items-center gap-2">
                  <Button tone="ghost" size="md" icon="sliders" className="lg:hidden" onClick={() => setSheet(true)}>{t('bank.filters')}{active.length ? ` · ${active.length}` : ''}</Button>
                  <label className="relative">
                    <span className="sr-only">Sort</span>
                    <select value={effSort} onChange={(e) => setSort(e.target.value)} className="prep-focus h-11 appearance-none rounded-full border border-border-default bg-surface pl-4 pr-10 text-sm font-semibold cursor-pointer outline-none">
                      {(dq ? ['relevance', 'asked', 'recent'] : ['asked', 'recent']).map((s) => <option key={s} value={s}>{t(`bank.sort.${s}`)}</option>)}
                    </select>
                    <Icon name="chevronDown" className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </label>
                </div>}
              </div>
              {(active.length > 0 || dq) && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {active.map(([k, v]) => (
                    <Chip key={k} active onClick={() => setFilter(k, '')}>{chipLabel(k, v)}<Icon name="x" className="w-3.5 h-3.5" /></Chip>
                  ))}
                  <button type="button" onClick={clearAll} className="prep-focus text-sm font-semibold text-brand hover:underline cursor-pointer px-2">{t('bank.clear')}</button>
                  {res.semantic && <span className="text-xs text-text-tertiary flex items-center gap-1"><Icon name="sparkles" className="w-3.5 h-3.5" />{t('bank.semantic')}</span>}
                </div>
              )}

              <div ref={list} className={`mt-6 grid gap-3 md:gap-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
                {res.error ? <p className="text-text-secondary py-10">{errorMessage(res.error)}</p>
                  : !loading && !res.items.length ? <p className="text-text-secondary py-10">{t('bank.empty')}</p>
                    : res.items.map((f) => <BankCard key={f.id} f={f} onOpen={setFamilyId} />)}
                {loading && !res.items.length && Array.from({ length: 6 }, (_, i) => <div key={i} className="iv-skeleton h-28 rounded-3xl" />)}
              </div>
              {preview && !loading && res.items.length > 0 && (
                <PreviewEnd innerRef={gate} title={t(`bank.preview.${gateKind}.title`, { n: fmt(corpus.questions || res.total) })} body={t(`bank.preview.${gateKind}.body`, { n: fmt(corpus.questions || res.total) })}>
                  {gateKind === 'guest' && <Button tone="primary" size="lg" iconRight="arrowRight" onClick={signIn}>{t('acct.signIn')}</Button>}
                  {(gateKind === 'none' || gateKind === 'rejected') && <Button tone="primary" size="lg" icon="upload" onClick={() => go({ screen: 'daf' })}>{t(gateKind === 'rejected' ? 'dv.uploadAgain' : 'dv.upload')}</Button>}
                </PreviewEnd>
              )}
              {!preview && !loading && res.items.length < res.total && (
                <div className="mt-8 text-center">
                  <Button tone="ghost" size="lg" onClick={loadMore} disabled={more}>{more ? t('bank.loading') : t('bank.more')}</Button>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {sheet && (
        <Sheet onClose={() => setSheet(false)} label={t('bank.filters')}>
          <div className="px-5 pt-4 pb-28">
            <h2 className="font-display text-3xl font-semibold">{t('bank.filters')}</h2>
            <FilterPanel filters={filters} setFilter={setFilter} facets={res.facets} />
          </div>
          <div className="sticky bottom-0 inset-x-0 bg-page/95 backdrop-blur border-t border-border-subtle px-5 py-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setFilters({})} className="prep-focus text-sm font-semibold text-text-secondary cursor-pointer">{t('bank.clear')}</button>
            <Button tone="primary" size="lg" onClick={() => setSheet(false)}>{t('bank.showResults', { n: fmt(res.total) })}</Button>
          </div>
        </Sheet>
      )}

      {familyId && <DeepDive familyId={familyId} onClose={() => setFamilyId(null)} />}
    </div>
  );
}
