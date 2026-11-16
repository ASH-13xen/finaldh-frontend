// The 100-question guide: a hero with the branded PDF, search and type filters, and every question with what
// it tests, a structure, do's and don'ts. Admins prepare it with AI, hide questions, and publish it here;
// students only ever see the published copy.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/mcq/Icon';
import { ErrorBanner } from '../../../components/mcq/ui';
import { useToast } from '../../../components/Toast';
import { errorMessage } from '../../../lib/interviewApi';
import Button from '../Button';
import { StatusPicker, SaveToggle } from '../PrepControls';
import { gsap, useGSAP, useReveal, prefersReducedMotion } from '../../lib/motion';
import { useT, fmt, yearsRange } from '../../lib/i18n';
import { usePrep } from '../../lib/context';
import { api } from '../../lib/api';
import { BRAND, GUIDE_TYPES, noteDate } from '../../lib/notes';
import PrintView, { GuideDoc } from './Print';

function GuideItem({ e, n, open, onToggle, onHide }) {
  const { t, tn } = useT();
  const { go } = usePrep();
  const panel = useRef(null);
  useGSAP(() => {
    if (!open || !panel.current || prefersReducedMotion()) return;
    gsap.from(panel.current, { height: 0, autoAlpha: 0, duration: 0.5, ease: 'power3.out' });
  }, { dependencies: [open] });
  const g = e.guide;
  const info = { text: e.textEn || e.text, familyId: e.familyId || '', source: 'bank' };
  return (
    <li data-reveal className={`border-b border-border-subtle ${e.hidden ? 'opacity-55' : ''}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="prep-focus group w-full text-left py-6 md:py-7 flex items-start gap-4 md:gap-8 cursor-pointer">
        <span className={`prep-num font-display text-3xl md:text-5xl font-semibold leading-none w-12 md:w-20 shrink-0 transition-colors duration-300 ${open ? 'text-brand' : 'text-border-default group-hover:text-brand'}`}>{String(n).padStart(2, '0')}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-xl md:text-[1.65rem] leading-snug text-text-primary">{e.text}</span>
          <span className="mt-2 block text-sm text-text-tertiary">
            {tn('common.askedTimes', e.timesAsked)}{e.years?.length ? ` · ${t('common.years', { years: yearsRange(e.years) })}` : ''}
            {e.hidden && <span className="ml-2 font-semibold text-amber-700 dark:text-amber-300">· {t('guide.admin.hidden')}</span>}
          </span>
        </span>
        <span className={`w-11 h-11 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${open ? 'rotate-180 bg-text-primary text-page border-text-primary' : 'border-border-default text-text-secondary'}`} aria-hidden="true">
          <Icon name="chevronDown" className="w-5 h-5" />
        </span>
      </button>
      {open && g && (
        <div ref={panel} className="overflow-hidden">
          <div className="pb-9 md:pl-28 space-y-6">
            <p className="rounded-2xl bg-accent-soft-bg border border-accent-soft-border px-5 py-4 text-[17px] leading-relaxed text-text-primary">
              <span className="prep-eyebrow text-brand block mb-1.5">{t('guide.tests')}</span>{g.tests}
            </p>
            <div>
              <p className="prep-eyebrow text-text-tertiary">{t('guide.structure')}</p>
              <ol className="mt-3 grid gap-3 md:grid-cols-2">
                {g.structure.map((s, i) => (
                  <li key={i} className="prep-card px-5 py-4 flex gap-3.5">
                    <span className="prep-num w-7 h-7 rounded-full bg-text-primary text-page text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="leading-relaxed text-text-primary">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {g.dos?.length > 0 && (
                <div className="prep-card p-5 md:p-6">
                  <p className="prep-eyebrow text-brand flex items-center gap-2"><Icon name="check" className="w-4 h-4" />{t('guide.dos')}</p>
                  <ul className="mt-3 space-y-2.5">{g.dos.map((x, i) => <li key={i} className="flex gap-2.5 leading-relaxed"><Icon name="check" className="w-4 h-4 mt-1 shrink-0 text-brand" />{x}</li>)}</ul>
                </div>
              )}
              {g.donts?.length > 0 && (
                <div className="prep-card p-5 md:p-6">
                  <p className="prep-eyebrow text-rose-700 dark:text-rose-300 flex items-center gap-2"><Icon name="x" className="w-4 h-4" />{t('guide.donts')}</p>
                  <ul className="mt-3 space-y-2.5">{g.donts.map((x, i) => <li key={i} className="flex gap-2.5 leading-relaxed"><Icon name="x" className="w-4 h-4 mt-1 shrink-0 text-rose-600 dark:text-rose-300" />{x}</li>)}</ul>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button tone="primary" size="md" icon="mic" onClick={() => go({ screen: 'practice', question: e.text, key: e.key })}>{t('action.practise')}</Button>
              <StatusPicker qkey={e.key} info={info} compact />
              <SaveToggle qkey={e.key} info={info} />
              {onHide && <Button tone="ghost" size="sm" icon={e.hidden ? 'eye' : 'eyeOff'} onClick={onHide}>{e.hidden ? t('guide.admin.show') : t('guide.admin.hide')}</Button>}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function AdminBar({ adm, onPrepare, onPublish, onUnpublish, busy }) {
  const { t, lang } = useT();
  if (!adm) return null;
  const generating = adm.status === 'generating';
  const n = adm.entries?.length || 0;
  let line = t('guide.admin.empty');
  if (generating) line = adm.progress?.step === 'write' ? t('guide.admin.writing', { done: adm.progress.done, total: adm.progress.total }) : t('guide.admin.choosing');
  else if (adm.status === 'failed') line = t('guide.admin.failed', { error: adm.error || '—' });
  else if (n) line = t('guide.admin.ready', { date: noteDate(adm.generatedAt, lang), n });
  const pct = generating && adm.progress?.total ? Math.round((adm.progress.done / adm.progress.total) * 100) : null;
  return (
    <div className="mt-10 rounded-[1.5rem] border-2 border-dashed border-amber-400/70 bg-amber-50/70 dark:bg-amber-400/5 px-5 py-5 md:px-7 md:py-6">
      <p className="prep-eyebrow text-amber-800 dark:text-amber-300 flex items-center gap-2"><Icon name="lock" className="w-4 h-4" />{t('guide.admin.title')}</p>
      <p className="mt-2 text-text-primary font-semibold">{line}</p>
      <p className="mt-1 text-sm text-text-secondary">{adm.published ? t('guide.admin.live', { date: noteDate(adm.published.at, lang), n: adm.published.count }) : t('guide.admin.notLive')}</p>
      {generating && (
        <div className="mt-4 h-2.5 rounded-full bg-amber-200/60 dark:bg-amber-400/15 overflow-hidden" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full bg-amber-500 transition-[width] duration-700 ${pct === null ? 'w-1/3 animate-pulse' : ''}`} style={pct === null ? undefined : { width: `${Math.max(4, pct)}%` }} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!generating && <Button tone="ghost" size="sm" icon="sparkles" disabled={busy} onClick={onPrepare}>{n ? t('guide.admin.again') : t('guide.admin.generate')}</Button>}
        {!generating && n > 0 && <Button tone="primary" size="sm" icon="send" disabled={busy} onClick={onPublish}>{adm.published ? t('guide.admin.republish') : t('guide.admin.publish')}</Button>}
        {adm.published && <Button tone="plain" size="sm" disabled={busy} onClick={onUnpublish}>{t('guide.admin.unpublish')}</Button>}
      </div>
      {n > 0 && <p className="mt-3 text-xs text-text-tertiary">{t('guide.admin.working')}</p>}
    </div>
  );
}

export default function GuideView() {
  const { t, lang, hi } = useT();
  const { user } = usePrep();
  const toast = useToast();
  const admin = !!user?.isAdmin;
  const [res, setRes] = useState({ key: null, data: null, error: null });
  const [adm, setAdm] = useState(null);
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [open, setOpen] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef(null);
  const reqKey = `${lang}:${tick}`;

  useEffect(() => {
    let cancelled = false;
    api.guide(lang)
      .then((d) => { if (!cancelled) setRes({ key: reqKey, data: d, error: null }); })
      .catch((err) => { if (!cancelled) setRes({ key: reqKey, data: null, error: err }); });
    return () => { cancelled = true; };
  }, [lang, reqKey]);

  // Admins see the working copy, refreshed every few seconds while it is being prepared.
  const generating = adm?.status === 'generating';
  useEffect(() => {
    if (!admin) return undefined;
    let cancelled = false;
    const load = () => api.admin.guide().then((d) => { if (!cancelled) setAdm(d.guide); }).catch(() => {});
    load();
    const id = generating ? setInterval(load, 4000) : null;
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [admin, generating, tick]);

  const working = useMemo(() => {
    if (!admin || !adm?.entries?.length) return null;
    return adm.entries
      .map((e) => ({ key: e.key, text: (hi && e.textHi) || e.text, textEn: e.text, qtype: e.qtype, timesAsked: e.timesAsked, years: e.years, familyId: e.familyIds?.[0] || '', hidden: e.hidden, guide: (hi && e.hi) || e.en }))
      .filter((e) => e.guide);
  }, [admin, adm, hi]);
  const entries = useMemo(() => working || (res.data?.status === 'published' ? res.data.entries : []), [working, res.data]);
  const corpus = working ? adm?.corpus : res.data?.corpus;
  const visible = useMemo(() => entries.filter((e) => !e.hidden), [entries]);
  const rank = useMemo(() => new Map(entries.map((e, i) => [e.key, i + 1])), [entries]);
  const types = useMemo(() => GUIDE_TYPES.filter((ty) => entries.some((e) => e.qtype === ty)), [entries]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => (type === 'all' || e.qtype === type) && (!needle || e.text.toLowerCase().includes(needle) || (e.textEn || '').toLowerCase().includes(needle)));
  }, [entries, q, type]);

  const loading = res.key !== reqKey && !res.data;
  useReveal(root, { dependencies: [entries.length, type, q === ''] });

  const act = async (fn, done) => {
    setBusy(true);
    try {
      const d = await fn();
      if (d?.guide) setAdm(d.guide);
      if (done) toast.success(done);
      setTick((k) => k + 1);
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setBusy(false);
    }
  };
  const prepare = () => { if (window.confirm(t('guide.admin.confirm'))) act(() => api.admin.generateGuide()); };
  const publish = () => act(() => api.admin.updateGuide({ publish: true }), t('nt.admin.published.toast'));
  const unpublish = () => act(() => api.admin.updateGuide({ publish: false }));
  const toggleHidden = (e) => act(() => api.admin.updateGuide({ entries: [{ key: e.key, hidden: !e.hidden }] }));

  const title = t('guide.title', { n: fmt(visible.length || 100) });

  return (
    <div ref={root}>
      {admin && <AdminBar adm={adm} busy={busy} onPrepare={prepare} onPublish={publish} onUnpublish={unpublish} />}

      {loading && <div className="mt-10 h-72 rounded-[2rem] bg-sunken animate-pulse" aria-busy="true" />}
      {!loading && res.error && !working && <div className="mt-10"><ErrorBanner onRetry={() => setTick((k) => k + 1)}>{errorMessage(res.error, t('common.error'))}</ErrorBanner></div>}

      {!loading && !res.error && !entries.length && (
        <div data-reveal className="mt-10 prep-card px-7 py-14 md:py-20 text-center">
          <Icon name="book" className="w-12 h-12 mx-auto text-brand" />
          <p className="mt-5 font-display text-3xl md:text-4xl text-text-primary">{t('guide.none')}</p>
          <p className="mt-3 text-text-secondary max-w-xl mx-auto">{t('guide.sub')}</p>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <section data-reveal className="mt-10 relative overflow-hidden rounded-[2rem] bg-[#14110d] text-[#f3ede2] px-6 py-10 md:px-14 md:py-16">
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(55% 80% at 100% 0%, rgba(18,155,110,0.42), transparent 70%), radial-gradient(45% 60% at 0% 100%, rgba(242,179,61,0.16), transparent 70%)' }} aria-hidden="true" />
            <span className="absolute -right-4 md:right-6 -bottom-10 md:-bottom-16 prep-num font-display font-semibold leading-none text-[10rem] md:text-[17rem] text-emerald-300/10 select-none pointer-events-none" aria-hidden="true">{visible.length}</span>
            <div className="relative max-w-3xl">
              <p className="prep-eyebrow text-emerald-300">{t('nt.tab.guide')}</p>
              <h2 className={`mt-4 font-display font-semibold ${hi ? 'text-3xl md:text-5xl leading-[1.3]' : 'text-4xl md:text-6xl leading-[1.02] tracking-tight'}`}>{title}</h2>
              <p className="mt-5 text-lg md:text-xl text-white/75 leading-relaxed">{t('guide.sub')}</p>
              {corpus?.interviews > 0 && <p className="mt-3 text-sm text-white/55">{t('guide.built', { n: fmt(corpus.interviews), years: yearsRange(corpus.years || []) })}</p>}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button tone="primary" size="xl" icon="download" magnetic onClick={() => setPrinting(true)}>{t('guide.download')}</Button>
                <span className="text-sm text-white/60">{BRAND} · PDF</span>
              </div>
            </div>
          </section>

          <div className="mt-10 flex flex-col md:flex-row md:items-center gap-4">
            <label className="relative flex-1">
              <span className="sr-only">{t('guide.search')}</span>
              <Icon name="search" className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('guide.search')} className="prep-focus w-full h-14 rounded-full border border-border-default bg-surface pl-14 pr-5 text-base outline-none focus:border-text-primary" />
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('guide.structure')}>
              {['all', ...types].map((ty) => (
                <button key={ty} type="button" onClick={() => setType(ty)} aria-pressed={type === ty}
                  className={`prep-focus h-11 px-4 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${type === ty ? 'bg-text-primary text-page border-text-primary' : 'border-border-default text-text-secondary hover:border-text-primary hover:text-text-primary'}`}>
                  {t(`guide.type.${ty}`)}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0
            ? <p className="mt-10 text-lg text-text-secondary">{t('guide.empty')}</p>
            : (
              <ol className="mt-6 border-t border-border-subtle">
                {shown.map((e) => (
                  <GuideItem key={e.key} e={e} n={rank.get(e.key)} open={open === e.key} onToggle={() => setOpen((o) => (o === e.key ? null : e.key))} onHide={working ? () => toggleHidden(e) : null} />
                ))}
              </ol>
            )}
        </>
      )}

      {printing && (
        <PrintView title={title} fileName={`${BRAND} - ${title}`} onClose={() => setPrinting(false)}>
          <GuideDoc entries={visible} corpus={corpus} />
        </PrintView>
      )}
    </div>
  );
}
