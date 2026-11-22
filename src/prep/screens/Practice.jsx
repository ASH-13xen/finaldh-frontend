// Practice Studio (voice only): pick a question - any predicted one (filtered like Predicted Questions), most
// asked, a drill (short or 3 minutes) or your own - answer it aloud in up to 3 minutes, and see how it
// sounded. On-device numbers are free and unlimited; detailed feedback takes 2 credits (any answer up to 3
// minutes). Attempts are saved as numbers (never audio) for comparing and for progress.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Studio from '../components/practice/Studio';
import Report from '../components/practice/Report';
import { Chip, TierBadge } from '../components/badges';
import { SplitHeading, Highlight } from '../components/motion';
import { useT, fmt } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { api } from '../lib/api';
import { DafGate } from '../components/DafCheck';
import { useRecorder, speechRecognitionSupported } from '../lib/voice';
import { errorMessage } from '../../lib/interviewApi';
import { TIERS, groupTitle, byLikelihood } from '../lib/predicted';

// limit: the short version's seconds (0 = no timer); timed drills also come in a 3-minute version.
const DRILLS = [
  { key: 'intro', limit: 60, icon: 'user' },
  { key: 'why', limit: 90, icon: 'target' },
  { key: 'filler', limit: 60, icon: 'wave', liveFillers: true },
  { key: 'pace', limit: 0, icon: 'activity', showPace: true }
];

function Spark({ values, band, color = 'var(--prep-emerald)', label, last }) {
  const w = 220;
  const h = 56;
  const vs = values.filter((v) => v != null);
  if (vs.length < 2) return null;
  const min = Math.min(...vs, band?.[0] ?? Infinity);
  const max = Math.max(...vs, band?.[1] ?? -Infinity);
  const y = (v) => h - 6 - ((v - min) / Math.max(1e-6, max - min)) * (h - 12);
  const x = (i) => 6 + (i / (vs.length - 1)) * (w - 12);
  return (
    <div className="prep-card px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-text-tertiary">{label}</p>
        <p className="prep-num font-display text-2xl font-semibold">{last}</p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full h-14" aria-hidden="true">
        {band && <rect x="0" width={w} y={y(band[1])} height={Math.max(2, y(band[0]) - y(band[1]))} fill="rgba(52,211,153,0.14)" />}
        <polyline points={vs.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(vs.length - 1)} cy={y(vs[vs.length - 1])} r="4" fill={color} />
      </svg>
    </div>
  );
}

export default function Practice() {
  const { view, go, prep, daf, credits, refreshCredits, openCredits } = usePrep();
  const { t, tn, lang, hi } = useT();
  const recorder = useRecorder();
  const { state, result, error } = recorder;
  const [src, setSrc] = useState('predicted');
  const [pick, setPick] = useState(() => (view.question ? { text: view.question, key: view.key || '', label: t('pr.src.predicted') } : null));
  const [own, setOwn] = useState('');
  const [groups, setGroups] = useState(null); // predictions by DAF item
  const [tier, setTier] = useState('all');
  const [onlyReal, setOnlyReal] = useState(false);
  const [item, setItem] = useState('all');
  const [drillLen, setDrillLen] = useState('short');
  const [asked, setAsked] = useState(null);
  const [history, setHistory] = useState({ attempts: [] });
  const aiLeft = credits?.admin ? Infinity : (credits?.total ?? 0);
  // Detailed feedback works on answers up to 3 minutes and takes 2 credits (the server says how many for short
  // and long answers). Every answer can run 3 minutes; short drills have their own timers.
  const feedbackMaxSec = credits?.feedbackMaxSeconds ?? 180;
  const answerSec = result?.metrics?.durationSec || 0;
  const feedbackNeeds = answerSec > (credits?.feedbackShortSeconds ?? 90) ? (credits?.feedbackLongCredits ?? 2) : (credits?.feedbackCredits ?? 2);
  const [ai, setAi] = useState(null);
  const savedFor = useRef(null);
  const hasDaf = !!daf.profile && !daf.profile.empty;

  useEffect(() => {
    let cancelled = false;
    if (hasDaf) api.predictions(lang).then((d) => { if (!cancelled) setGroups(d.groups || []); }).catch(() => { if (!cancelled) setGroups([]); });
    api.trends().then((d) => { if (!cancelled) setAsked(d.mostAsked || []); }).catch(() => { if (!cancelled) setAsked([]); });
    return () => { cancelled = true; };
  }, [lang, hasDaf]);

  const loadHistory = useCallback(() => {
    api.attempts().then((d) => { if (d?.attempts) setHistory((h) => ({ ...h, ...d })); }).catch(() => {});
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Save each finished answer once (numbers only).
  useEffect(() => {
    if (state !== 'done' || !result || result.silent || savedFor.current === result) return;
    savedFor.current = result;
    api.saveAttempt({ questionKey: pick?.key || '', question: pick?.text || '', lang, metrics: result.metrics, scores: result.scores })
      .then(loadHistory).catch(() => {});
  }, [state, result, pick, lang, loadHistory]);

  // Every predicted question, with the same filters as Predicted Questions.
  const predicted = useMemo(() => (groups || [])
    .filter((g) => item === 'all' || g.key === item)
    .flatMap((g) => g.predictions.map((p) => ({ ...p, itemLabel: groupTitle(t, g) })))
    .filter((p) => (tier === 'all' || p.tier === tier) && (!onlyReal || p.source !== 'new'))
    .sort(byLikelihood), [groups, item, tier, onlyReal, t]);

  const drill = pick?.drill ? DRILLS.find((d) => d.key === pick.drill) : null;
  const timeLimit = drill ? (drill.limit ? (pick.long ? feedbackMaxSec : drill.limit) : 0) : feedbackMaxSec;
  const stageRef = useRef(null);
  const toStage = () => setTimeout(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  const choose = (p) => { recorder.reset(); setAi(null); setPick(p); toStage(); };

  const getAi = async () => {
    if (!result?.blob) return;
    if ((result.metrics?.durationSec || 0) > feedbackMaxSec) return;
    if (aiLeft < feedbackNeeds) { openCredits(); return; }
    setAi({ loading: true });
    try {
      const d = await api.analyzeAnswer(result.blob, { question: pick?.text || '', lang, device: result.metrics });
      setAi({ analysis: d.analysis });
      refreshCredits();
    } catch (err) {
      if (err?.status === 402) { setAi(null); openCredits(); return; }
      setAi({ error: errorMessage(err) });
    }
  };

  const sameQuestion = useMemo(() => (pick ? history.attempts.filter((a) => (pick.key && a.questionKey === pick.key) || a.question === pick.text) : []), [history, pick]);
  const recent = useMemo(() => [...history.attempts].reverse().slice(-20), [history]);
  const practised = pick?.key ? ['practised', 'confident'].includes(prep.items.get(pick.key)?.status) : false;

  const titleCls = `font-display font-semibold text-text-primary ${hi ? 'text-[2.2rem] leading-[1.3] md:text-6xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.6rem] leading-[1.04] md:text-7xl md:leading-[1]'}`;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-16">
      <p className="prep-eyebrow text-brand mb-5">{t('pr.eyebrow')}</p>
      <SplitHeading className={titleCls}>{t('pr.titleA')}<Highlight still>{t('pr.titleHl')}</Highlight></SplitHeading>
      <p className="mt-6 text-lg md:text-xl text-text-secondary leading-relaxed max-w-3xl">{t('pr.sub', { n: credits?.freeTotal || 15 })}</p>
      <p className="mt-3 text-sm text-text-tertiary flex gap-2"><Icon name="lock" className="w-4 h-4 mt-0.5 shrink-0" />{t('pr.privacy')}</p>

      <DafGate>

      {/* Question picker */}
      {!pick && (
        <section className="mt-10">
          <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{t('pr.pick')}</h2>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {['predicted', 'asked', 'drills', 'own'].map((k) => <Chip key={k} active={src === k} onClick={() => setSrc(k)}>{t(`pr.src.${k}`)}</Chip>)}
          </div>
          <div className="mt-6">
            {src === 'predicted' && (!hasDaf ? (
              <button type="button" onClick={() => go({ screen: 'daf' })} className="prep-focus prep-card prep-card-hover w-full text-left px-6 py-6 cursor-pointer flex items-center justify-between gap-4">
                <span className="text-lg">{t('pr.needDetails')}</span><Icon name="arrowRight" className="w-5 h-5 text-brand" />
              </button>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {['all', ...TIERS].map((k) => <Chip key={k} active={tier === k} onClick={() => setTier(k)}>{k === 'all' ? t('pr.filter.all') : t(`tier.${k}`)}</Chip>)}
                  <Chip active={onlyReal} onClick={() => setOnlyReal((o) => !o)}><Icon name="check" className="w-4 h-4" />{t('pred.onlyReal')}</Chip>
                  {groups?.length > 1 && (
                    <label className="relative inline-flex">
                      <span className="sr-only">{t('pr.filter.item')}</span>
                      <select value={item} onChange={(e) => setItem(e.target.value)}
                        className="prep-focus h-10 max-w-[15rem] rounded-full border border-border-default bg-surface pl-4 pr-9 text-sm font-semibold text-text-primary appearance-none cursor-pointer truncate">
                        <option value="all">{t('pr.filter.allItems')}</option>
                        {groups.map((g) => <option key={g.key} value={g.key}>{groupTitle(t, g)}</option>)}
                      </select>
                      <Icon name="chevronDown" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary" />
                    </label>
                  )}
                </div>
                {groups && <p className="mt-3 text-sm text-text-tertiary">{tn('pr.count', predicted.length, { n: fmt(predicted.length) })}</p>}
                <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {predicted.map((p) => {
                    const done = ['practised', 'confident'].includes(prep.items.get(p.key)?.status);
                    return (
                      <li key={`${p.id}-${p.key}`}><button type="button" onClick={() => choose({ text: p.question, key: p.key, label: t('pr.src.predicted') })} className="prep-focus prep-card prep-card-hover w-full h-full text-left px-5 py-4 cursor-pointer flex flex-col gap-2.5">
                        <span className="flex items-center gap-2 min-w-0">
                          <TierBadge tier={p.tier} size="sm" />
                          <span className="text-xs text-text-tertiary truncate">{p.itemLabel}</span>
                          {done && <span className="ml-auto shrink-0 text-brand" title={t('pr.marked')}><Icon name="check" className="w-4 h-4" /></span>}
                        </span>
                        <span className="font-display text-lg leading-snug">{p.question}</span>
                      </button></li>
                    );
                  })}
                  {!groups && Array.from({ length: 4 }, (_, i) => <li key={i} className="iv-skeleton h-24 rounded-3xl" />)}
                  {groups && !predicted.length && <li className="text-text-secondary py-6">{t('pred.empty')}</li>}
                </ul>
              </>
            ))}
            {src === 'asked' && (
              <ul className="grid md:grid-cols-2 gap-3">
                {(asked || []).map((f) => (
                  <li key={f.id}><button type="button" onClick={() => choose({ text: f.text, key: f.key || '', label: t('pr.src.asked') })} className="prep-focus prep-card prep-card-hover w-full h-full text-left px-5 py-4 cursor-pointer flex items-start gap-3">
                    <span className="prep-num shrink-0 text-sm font-bold text-brand">{f.timesAsked}×</span><span className="font-display text-lg leading-snug">{f.text}</span>
                  </button></li>
                ))}
              </ul>
            )}
            {src === 'drills' && (
              <>
                <div className="flex items-center gap-2" role="group" aria-label={t('drill.len')}>
                  {['short', 'long'].map((k) => <Chip key={k} active={drillLen === k} onClick={() => setDrillLen(k)}><Icon name="clock" className="w-4 h-4" />{t(`drill.len.${k}`)}</Chip>)}
                </div>
                <ul className="mt-4 grid md:grid-cols-2 gap-4">
                  {DRILLS.map((d) => {
                    // The 3-minute version of a timed drill (the pace trainer has no timer either way).
                    const long = drillLen === 'long' && d.limit > 0;
                    const name = t(long ? `drill.${d.key}.long` : `drill.${d.key}`);
                    return (
                      <li key={d.key}><button type="button" onClick={() => choose({ text: t(`drill.${d.key}.q`), key: '', label: name, drill: d.key, long })} className="prep-focus prep-card prep-card-hover group w-full h-full text-left px-6 py-6 cursor-pointer">
                        <Icon name={d.icon} className="w-7 h-7 text-brand" />
                        <p className="mt-4 font-display text-2xl font-semibold group-hover:text-brand transition-colors">{name}</p>
                        <p className="mt-1 text-text-secondary">{t(long ? `drill.${d.key}.long.sub` : `drill.${d.key}.sub`)}</p>
                      </button></li>
                    );
                  })}
                </ul>
              </>
            )}
            {src === 'own' && (
              <form onSubmit={(e) => { e.preventDefault(); if (own.trim()) choose({ text: own.trim(), key: '', label: t('pr.src.own') }); }} className="flex flex-col sm:flex-row gap-3">
                <input value={own} onChange={(e) => setOwn(e.target.value)} maxLength={300} placeholder={t('pr.ownPlaceholder')} aria-label={t('pr.ownPlaceholder')}
                  className="prep-focus flex-1 h-14 rounded-full border border-border-default bg-surface px-6 text-[17px] outline-none focus:border-text-primary" />
                <button type="submit" disabled={!own.trim()} className="prep-focus h-14 px-7 rounded-full bg-text-primary text-page font-semibold disabled:opacity-40 cursor-pointer">{t('pr.use')}</button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* Stage, then the report */}
      {pick && (
        <section ref={stageRef} className="mt-10 space-y-8 scroll-mt-40">
          <Studio
            key={pick.text}
            question={pick.text}
            label={pick.label}
            lang={lang}
            recorder={recorder}
            onChange={() => { recorder.reset(); setAi(null); setPick(null); }}
            timeLimit={timeLimit}
            liveFillers={!!drill?.liveFillers}
            showPace={!!drill?.showPace}
          />
          {error && <p className="prep-card px-5 py-4 text-status-danger-text">{t(`pr.err.${error}`)}</p>}
          {state === 'done' && result && !speechRecognitionSupported() && <p className="text-sm text-text-tertiary">{t('pr.noSR')}</p>}
          {state === 'done' && result?.silent && <p className="prep-card px-5 py-4 text-status-danger-text">{t('pr.silent')}</p>}
          {state === 'done' && result && !result.silent && (
            <Report
              result={result}
              lang={lang}
              ai={ai}
              aiLeft={aiLeft}
              aiNeeds={feedbackNeeds}
              aiTooLong={answerSec > feedbackMaxSec}
              onAi={getAi}
              onAgain={() => { recorder.reset(); setAi(null); toStage(); }}
              onNext={() => { recorder.reset(); setAi(null); setPick(null); }}
              onPractised={pick.key ? () => prep.update(pick.key, { status: 'practised' }, { text: pick.text, source: 'past' }) : null}
              practised={practised}
            />
          )}

          {sameQuestion.length > 1 && (
            <div className="prep-card overflow-x-auto">
              <p className="px-5 pt-5 prep-eyebrow text-text-tertiary">{t('pr.compare')}</p>
              <table className="w-full text-left text-sm mt-3 min-w-[34rem]">
                <thead><tr className="text-text-tertiary"><th className="px-5 py-2 font-semibold"></th><th className="px-3 py-2 font-semibold">{t('m.pace')}</th><th className="px-3 py-2 font-semibold">{t('m.fillers')}</th><th className="px-3 py-2 font-semibold">{t('m.pauses')}</th><th className="px-3 py-2 font-semibold">{t('m.fluency')}</th><th className="px-3 py-2 font-semibold">{t('m.confidence')}</th></tr></thead>
                <tbody>
                  {[...sameQuestion].reverse().map((a, i) => (
                    <tr key={a.id} className="border-t border-border-subtle">
                      <td className="px-5 py-3 font-semibold">{t('pr.attempt', { n: i + 1 })} <span className="text-text-tertiary font-normal">· {new Date(a.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></td>
                      <td className="px-3 py-3 prep-num">{a.metrics?.wpm ?? '—'}</td>
                      <td className="px-3 py-3 prep-num">{a.metrics?.fillersPerMin ?? '—'}</td>
                      <td className="px-3 py-3 prep-num">{a.metrics?.longPauses ?? '—'}</td>
                      <td className="px-3 py-3 prep-num">{a.scores?.fluency ?? '—'}</td>
                      <td className="px-3 py-3 prep-num">{a.scores?.confidence ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Progress */}
      <section className="mt-16">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{t('pr.progress')}</h2>
        {recent.length >= 2 ? (
          <>
            <p className="mt-1 text-sm text-text-tertiary">{t('pr.progressSub', { n: fmt(recent.length) })}</p>
            <div className="mt-5 grid md:grid-cols-3 gap-3 md:gap-4">
              <Spark label={t('m.pace')} values={recent.map((a) => a.metrics?.wpm)} band={[120, 165]} last={recent[recent.length - 1].metrics?.wpm ?? '—'} />
              <Spark label={t('m.fillers')} values={recent.map((a) => a.metrics?.fillersPerMin)} color="#d97706" last={recent[recent.length - 1].metrics?.fillersPerMin ?? '—'} />
              <Spark label={t('m.confidence')} values={recent.map((a) => a.scores?.confidence)} last={recent[recent.length - 1].scores?.confidence ?? '—'} />
            </div>
          </>
        ) : <p className="mt-2 text-text-tertiary">{t('pr.noProgress')}</p>}
      </section>
      </DafGate>
    </div>
  );
}
