// My DAF: add it (upload a PDF/photo that AI reads for the student to check, or a seven-step form), then see
// it the way a board reads it - each line highlighted as deeply as boards dig into it.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Button from '../components/Button';
import DafForm from '../components/DafForm';
import { SplitHeading, Highlight } from '../components/motion';
import { gsap, useGSAP, useReveal, prefersReducedMotion } from '../lib/motion';
import { useT, fmt } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { api } from '../lib/api';
import { EMPTY_DAF } from '../lib/india';
import { errorMessage } from '../../lib/interviewApi';
import { useToast } from '../../components/Toast';

const SPECIFIC = new Set(['hobby', 'eca', 'education', 'work']);
const strength = (pct) => (pct >= 88 ? 0.62 : pct >= 78 ? 0.44 : pct >= 65 ? 0.3 : 0.18);

function Heatmap({ items, groups, go }) {
  const { t } = useT();
  const root = useRef(null);
  useReveal(root, { dependencies: [items.length, !!groups] });
  const byKey = new Map((groups || []).map((g) => [g.key, g]));
  const rows = items
    .filter((it) => !['intro', 'motivation'].includes(it.type))
    .map((it) => ({ it, g: byKey.get(it.key) }))
    .map((r) => ({ ...r, pct: r.g?.rate?.askedPct ?? null }));
  const topKey = rows.filter((r) => r.pct != null).sort((a, b) => b.pct - a.pct)[0]?.it.key;
  return (
    <div ref={root} className="relative prep-card overflow-hidden">
      <div className="px-5 md:px-10 py-4 border-b border-border-default bg-sunken/60 flex flex-wrap items-center justify-between gap-3">
        <p className="prep-eyebrow text-text-secondary">{t('heat.form')}</p>
        <p className="text-xs text-text-tertiary flex items-center gap-2">
          <span className="inline-block w-10 h-3 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(250,204,21,0.15), rgba(250,204,21,0.65))' }} aria-hidden="true" />
          {t('heat.legend')}
        </p>
      </div>
      <ul className="px-5 md:px-10">
        {rows.map(({ it, g, pct }) => {
          const rare = g?.rate?.scope === 'area' && SPECIFIC.has(it.type);
          const area = g?.isCollege || it.isCollege ? t('area.college') : t(`area.${it.type}`);
          const shown = it.type === 'work' ? it.label : it.value || it.label;
          return (
            <li key={it.key} data-reveal className="relative grid grid-cols-[1fr_auto] items-start gap-4 md:gap-8 py-5 md:py-6 border-b border-dashed border-border-default last:border-b-0">
              <div className="min-w-0">
                <p className="prep-eyebrow text-text-tertiary">{area}</p>
                <p className="mt-2 font-display text-[1.35rem] md:text-[1.75rem] leading-snug">
                  {pct != null
                    ? <Highlight style={{ '--prep-hl-amber': `rgba(250, 204, 21, ${strength(pct)})` }}>{shown}</Highlight>
                    : shown}
                </p>
                {rare && <p className="mt-2 text-sm text-text-tertiary flex gap-1.5"><Icon name="info" className="w-4 h-4 mt-0.5 shrink-0" />{t('heat.rare')}</p>}
                {it.key === topKey && (
                  <span className="hidden md:block absolute left-[55%] top-3 rotate-[-4deg] prep-hand text-2xl text-brand pointer-events-none" aria-hidden="true">← {t('heat.dig')}</span>
                )}
              </div>
              <div className="text-right shrink-0">
                {pct != null ? (
                  <>
                    <p className="prep-num font-display text-3xl md:text-4xl font-semibold leading-none">{pct}<span className="text-lg text-text-tertiary">%</span></p>
                    {g?.rate?.avgQuestions ? <p className="mt-1 text-xs text-text-tertiary">{t('heat.questions', { q: g.rate.avgQuestions })}</p> : null}
                  </>
                ) : groups ? <p className="text-sm text-text-tertiary">—</p> : <span className="iv-skeleton block w-14 h-8 rounded-lg" />}
                {g?.predictions?.length > 0 && (
                  <button type="button" onClick={() => go({ screen: 'predictions' })} className="prep-focus mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline cursor-pointer">
                    {t('pred.questionsN', { n: g.predictions.length })} <Icon name="arrowRight" className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Reading() {
  const { t } = useT();
  const root = useRef(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo('[data-scan]', { yPercent: 0 }, { yPercent: 1700, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true });
    gsap.from('[data-line]', { scaleX: 0, transformOrigin: 'left', stagger: { each: 0.15, repeat: -1, repeatDelay: 1.2 }, duration: 0.6 });
  }, { scope: root });
  return (
    <div ref={root} className="max-w-md mx-auto py-16 text-center" role="status" aria-live="polite">
      <div className="relative mx-auto w-56 h-72 prep-card overflow-hidden px-6 py-7 text-left">
        {[90, 70, 85, 55, 80, 65, 75, 50, 88].map((w, i) => <div key={i} data-line className="h-2.5 rounded-full bg-sunken mb-4" style={{ width: `${w}%` }} />)}
        <div data-scan className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-brand/0 via-brand/40 to-brand/0" aria-hidden="true" />
      </div>
      <p className="mt-8 font-display text-2xl">{t('daf.reading')}</p>
      <p className="mt-2 text-text-secondary">{t('daf.readingSub')}</p>
    </div>
  );
}

function Start({ onFile, onFill, n }) {
  const { t } = useT();
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const pick = (files) => { const f = files?.[0]; if (f) onFile(f); };
  return (
    <div className="grid md:grid-cols-[1.2fr_1fr] gap-4 md:gap-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
        className={`prep-card relative overflow-hidden p-6 md:p-10 flex flex-col transition-colors ${over ? 'ring-2 ring-brand bg-accent-soft-bg' : ''}`}
      >
        <span className="w-14 h-14 rounded-2xl bg-brand text-text-on-accent flex items-center justify-center"><Icon name="upload" className="w-7 h-7" /></span>
        <h2 className="mt-6 font-display text-3xl md:text-4xl font-semibold tracking-tight">{t('daf.upload')}</h2>
        <p className="mt-2 text-lg text-text-secondary">{t('daf.uploadSub')}</p>
        <button type="button" onClick={() => input.current?.click()}
          className="prep-focus mt-8 flex-1 min-h-40 rounded-3xl border-2 border-dashed border-border-default hover:border-brand flex flex-col items-center justify-center gap-2 px-4 py-8 text-center cursor-pointer transition-colors">
          <Icon name="fileText" className="w-9 h-9 text-text-tertiary" />
          <span className="font-semibold text-text-primary">{t('daf.uploadDrop')}</span>
          <span className="text-sm text-text-tertiary">{t('daf.uploadTypes')}</span>
        </button>
        <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/heic" className="sr-only" onChange={(e) => pick(e.target.files)} />
        <p className="mt-5 text-sm text-text-tertiary flex gap-2"><Icon name="lock" className="w-4 h-4 mt-0.5 shrink-0" />{t('daf.uploadPrivacy')}</p>
      </div>
      <button type="button" onClick={onFill} className="prep-focus prep-card prep-card-hover group text-left p-6 md:p-10 flex flex-col cursor-pointer">
        <span className="w-14 h-14 rounded-2xl bg-text-primary text-page flex items-center justify-center"><Icon name="edit" className="w-7 h-7" /></span>
        <h2 className="mt-6 font-display text-3xl md:text-4xl font-semibold tracking-tight">{t('daf.fill')}</h2>
        <p className="mt-2 text-lg text-text-secondary">{t('daf.fillSub')}</p>
        <div className="mt-auto pt-10 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < 2 ? 'bg-brand' : 'bg-border-default'}`} />)}
        </div>
        <span className="mt-6 inline-flex items-center gap-2 font-semibold text-brand">{t('daf.startSub', { n: fmt(n) })} <Icon name="arrowRight" className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>
      </button>
    </div>
  );
}

export default function Daf() {
  const { status, daf, go } = usePrep();
  const { t, lang, hi } = useT();
  const toast = useToast();
  const profile = daf.profile;
  const hasDaf = !!profile && !profile.empty;
  const [mode, setMode] = useState(null); // null = decide from the DAF; 'start' | 'reading' | 'review' | 'form'
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [keywords, setKeywords] = useState(null);
  const [groups, setGroups] = useState(null);
  const view = mode || (hasDaf ? 'view' : 'start');

  useEffect(() => {
    let cancelled = false;
    api.keywords().then((d) => { if (!cancelled) setKeywords(d.keywords); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // The heatmap's rates come with the predictions (cached after the first build).
  useEffect(() => {
    if (view !== 'view') return undefined;
    let cancelled = false;
    api.predictions(lang).then((d) => { if (!cancelled) setGroups(d.groups); }).catch(() => { if (!cancelled) setGroups([]); });
    return () => { cancelled = true; };
  }, [view, lang, profile]);

  const current = useMemo(() => ({ ...EMPTY_DAF, ...(profile?.profile || {}) }), [profile]);

  const onFile = async (file) => {
    setMode('reading');
    try {
      const d = await api.extractDaf(file);
      setDraft({ fields: { ...EMPTY_DAF, ...d.fields }, unsure: d.unsure || [] });
      setMode('review');
    } catch (err) {
      toast.error(errorMessage(err));
      setMode(err?.data?.aiUnavailable ? 'form' : 'start');
      if (err?.data?.aiUnavailable) setDraft({ fields: current, unsure: [] });
    }
  };

  const save = async (fields) => {
    setSaving(true);
    try {
      await api.saveProfile(fields);
      toast.success(t('daf.saved'));
      daf.refresh();
      setGroups(null);
      setMode(null);
      setDraft(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!window.confirm(t('daf.deleteConfirm'))) return;
    try {
      await api.deleteProfile();
      daf.refresh();
      setMode('start');
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const titleCls = `font-display font-semibold text-text-primary ${hi ? 'text-[2.2rem] leading-[1.3] md:text-6xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.6rem] leading-[1.04] md:text-7xl md:leading-[1]'}`;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-16">
      {view === 'view' && (
        <>
          <p className="prep-eyebrow text-brand mb-5">{t('daf.eyebrow')}</p>
          <SplitHeading className={titleCls}>{t('daf.titleA')}<Highlight still>{t('daf.titleHl')}</Highlight></SplitHeading>
          <p className="mt-6 text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl">{t('daf.sub')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button tone="primary" size="lg" magnetic iconRight="arrowRight" onClick={() => go({ screen: 'predictions' })}>{t('daf.toPredictions')}</Button>
            <Button tone="ghost" size="lg" icon="edit" onClick={() => { setDraft({ fields: current, unsure: [] }); setMode('form'); }}>{t('daf.edit')}</Button>
            <Button tone="ghost" size="lg" icon="upload" onClick={() => setMode('start')}>{t('daf.reupload')}</Button>
          </div>
          <div className="mt-12"><Heatmap items={profile.items || []} groups={groups} go={go} /></div>
          <div className="mt-8 text-right">
            <Button tone="plain" size="sm" icon="trash" onClick={remove}>{t('daf.delete')}</Button>
          </div>
        </>
      )}

      {view === 'start' && (
        <>
          <p className="prep-eyebrow text-brand mb-5">{t('daf.eyebrow')}</p>
          <SplitHeading className={titleCls}>{t('daf.startTitle')}</SplitHeading>
          <p className="mt-6 text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl">{t('daf.startSub', { n: fmt(status.corpus?.transcripts || 0) })}</p>
          <div className="mt-10"><Start onFile={onFile} onFill={() => { setDraft({ fields: current, unsure: [] }); setMode('form'); }} n={status.corpus?.transcripts || 0} /></div>
          {hasDaf && <Button tone="plain" size="md" icon="arrowLeft" className="mt-6" onClick={() => setMode(null)}>{t('common.back')}</Button>}
        </>
      )}

      {view === 'reading' && <Reading />}

      {view === 'review' && draft && (
        <>
          <p className="prep-eyebrow text-brand mb-5">{t('daf.eyebrow')}</p>
          <h1 className={titleCls}>{t('daf.reviewTitle')}</h1>
          <p className="mt-6 text-lg text-text-secondary max-w-2xl">{t('daf.reviewSub')}</p>
          <div className="mt-10">
            <DafForm mode="review" initial={draft.fields} unsure={draft.unsure} keywords={keywords} services={status.services} saving={saving} onSave={save} onCancel={() => setMode(null)} />
          </div>
        </>
      )}

      {view === 'form' && draft && (
        <DafForm mode="steps" initial={draft.fields} keywords={keywords} services={status.services} saving={saving} onSave={save} onCancel={() => setMode(null)} />
      )}
    </div>
  );
}
