// What an answer sounded like: score tiles (green good / amber okay / rose work on it), the answer as a
// waveform with long pauses marked, the transcript with fillers and hedges highlighted, a replay, and AI
// feedback on tone on request.
import { useMemo } from 'react';
import Icon from '../../../components/mcq/Icon';
import Button from '../Button';
import { useT } from '../../lib/i18n';
import { markTranscript } from '../../lib/voice';

const TONE = { good: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-400/10', ok: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-400/10', work: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-400/10' };
const band = (score) => (score == null ? null : score >= 7.5 ? 'good' : score >= 5 ? 'ok' : 'work');

function Tile({ label, value, unit, verdict, level }) {
  return (
    <div className="prep-card px-5 py-5">
      <p className="text-sm font-semibold text-text-tertiary">{label}</p>
      <p className="mt-2 prep-num font-display text-4xl font-semibold leading-none">{value ?? '—'}<span className="text-base text-text-tertiary font-sans font-semibold ml-1">{unit}</span></p>
      {verdict && <p className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${TONE[level] || 'text-text-secondary bg-sunken'}`}>{verdict}</p>}
    </div>
  );
}

function Waveform({ frames, pauses }) {
  const { t } = useT();
  const bars = useMemo(() => {
    const n = 140;
    if (!frames?.length) return [];
    const per = Math.max(1, Math.floor(frames.length / n));
    const out = [];
    let max = 0;
    for (let i = 0; i < frames.length; i += per) {
      let m = 0;
      for (let j = i; j < Math.min(frames.length, i + per); j++) m = Math.max(m, frames[j].rms);
      out.push(m);
      max = Math.max(max, m);
    }
    return out.map((v) => (max ? v / max : 0));
  }, [frames]);
  const duration = frames?.length ? frames[frames.length - 1].t : 1;
  return (
    <div className="prep-card px-5 py-5">
      <p className="prep-eyebrow text-text-tertiary mb-4">{t('pr.waveform')}</p>
      <div className="relative h-28">
        {pauses.filter((p) => p.len >= 2).map((p, i) => (
          <div key={i} className="absolute inset-y-0 rounded-lg bg-rose-400/15 border-x border-rose-400/40" style={{ left: `${(p.start / duration) * 100}%`, width: `${(p.len / duration) * 100}%` }}>
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap text-[10px] font-bold text-rose-600 dark:text-rose-300">{p.len.toFixed(1)}s</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-center gap-[2px]">
          {bars.map((v, i) => <span key={i} className="flex-1 rounded-full bg-brand/70" style={{ height: `${Math.max(3, v * 100)}%` }} />)}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-text-tertiary prep-num">
        <span>0:00</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400/30 border border-rose-400/50" />{t('pr.longPause')}</span>
        <span>{Math.floor(duration / 60)}:{String(Math.round(duration % 60)).padStart(2, '0')}</span>
      </div>
    </div>
  );
}

function Marked({ text, lang }) {
  const parts = markTranscript(text, lang);
  return (
    <p className="text-[17px] leading-[1.85] text-text-primary">
      {parts.map((p, i) => (p.kind === 'filler'
        ? <mark key={i} className="rounded px-1 bg-amber-200/80 dark:bg-amber-400/30 text-inherit">{p.text}</mark>
        : p.kind === 'hedge'
          ? <span key={i} className="underline decoration-rose-400 decoration-2 underline-offset-4">{p.text}</span>
          : <span key={i}>{p.text}</span>))}
    </p>
  );
}

function AiPanel({ ai, lang }) {
  const { t } = useT();
  const a = ai.analysis;
  return (
    <div className="prep-card overflow-hidden">
      <div className="px-5 md:px-7 py-5 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-2xl font-semibold flex items-center gap-2"><Icon name="sparkles" className="w-5 h-5 text-brand" />{t('ai.title')}</p>
        {a.tone?.label && <span className="rounded-full bg-text-primary text-page px-3.5 py-1.5 text-sm font-semibold">{t('ai.tone')}: {t(`tone.${a.tone.label}`) !== `tone.${a.tone.label}` ? t(`tone.${a.tone.label}`) : a.tone.label}</span>}
      </div>
      <div className="px-5 md:px-7 py-6 space-y-7">
        {a.tone?.note && <p className="text-lg leading-relaxed">{a.tone.note}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[['m.confidence', a.scores.confidence], ['m.fluency', a.scores.fluency], ['ai.clarity', a.scores.clarity], ['ai.contentScore', a.scores.content]].map(([k, v]) => (
            <div key={k} className={`rounded-2xl px-4 py-3 ${TONE[band(v)]}`}>
              <p className="text-xs font-bold opacity-80">{t(k)}</p>
              <p className="prep-num font-display text-3xl font-semibold">{v}<span className="text-sm opacity-60">{t('m.outOf')}</span></p>
            </div>
          ))}
        </div>
        {a.tips?.length > 0 && (
          <div>
            <p className="prep-eyebrow text-text-tertiary mb-3">{t('ai.tips')}</p>
            <ol className="grid md:grid-cols-3 gap-3">
              {a.tips.map((tip, i) => (
                <li key={i} className="rounded-2xl border border-border-default p-4">
                  <span className="prep-num font-display text-2xl text-brand">{i + 1}</span>
                  <p className="mt-1 text-[15px] leading-relaxed">{tip}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
        {a.contentNote && (
          <div>
            <p className="prep-eyebrow text-text-tertiary mb-2">{t('ai.content')}</p>
            <p className="text-[15px] leading-relaxed text-text-secondary">{a.contentNote}</p>
          </div>
        )}
        {a.transcript && (
          <div>
            <p className="prep-eyebrow text-text-tertiary mb-3">{t('ai.verbatim')}</p>
            <div className="rounded-2xl bg-sunken/60 p-4"><Marked text={a.transcript} lang={lang} /></div>
            {a.fillers?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{a.fillers.map((f) => <span key={f.word} className="rounded-full bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300 px-3 py-1 text-sm font-semibold">“{f.word}” × {f.count}</span>)}</div>}
          </div>
        )}
        <p className="text-xs text-text-tertiary flex items-center gap-1.5"><Icon name="lock" className="w-3.5 h-3.5" />{t('ai.privacy')}</p>
      </div>
    </div>
  );
}

export default function Report({ result, lang, ai, aiLeft, aiPerDay, onAi, onAgain, onNext, onPractised, practised }) {
  const { t } = useT();
  const m = result.metrics;
  const s = result.scores;
  const paceVerdict = m.wpm == null ? t('m.pace.none') : m.wpm < 120 ? t('m.pace.slow') : m.wpm > 165 ? t('m.pace.fast') : t('m.pace.good');
  const paceLevel = m.wpm == null ? null : m.wpm >= 120 && m.wpm <= 165 ? 'good' : m.wpm >= 100 && m.wpm <= 185 ? 'ok' : 'work';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{t('pr.report')}</h2>
          <p className="mt-1 text-sm text-text-tertiary">{t('pr.estimate')}</p>
        </div>
        {result.url && <audio controls src={result.url} className="h-11 max-w-full" aria-label={t('pr.replay')} />}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <Tile label={t('m.pace')} value={m.wpm} unit={m.wpm ? 'wpm' : ''} verdict={paceVerdict} level={paceLevel} />
        <Tile label={t('m.fluency')} value={s.fluency} unit={t('m.outOf')} verdict={null} level={band(s.fluency)} />
        <Tile label={t('m.confidence')} value={s.confidence} unit={t('m.outOf')} verdict={null} level={band(s.confidence)} />
        <Tile label={t('m.fillers')} value={m.fillersPerMin} unit="" verdict={t('m.fillers.v', { n: m.fillersPerMin })} level={m.fillersPerMin <= 2 ? 'good' : m.fillersPerMin <= 5 ? 'ok' : 'work'} />
        <Tile label={t('m.pauses')} value={m.longPauses} unit="" verdict={t('m.pauses.v')} level={m.longPauses === 0 ? 'good' : m.longPauses <= 2 ? 'ok' : 'work'} />
        <Tile label={t('m.start')} value={m.startDelaySec} unit="s" verdict={t('m.start.v', { n: m.startDelaySec })} level={m.startDelaySec <= 3 ? 'good' : m.startDelaySec <= 6 ? 'ok' : 'work'} />
      </div>
      {(m.pitchVariation != null || m.trailingOff) && (
        <div className="flex flex-wrap gap-2">
          {m.pitchVariation != null && <span className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${m.pitchVariation < 0.06 ? TONE.ok : TONE.good}`}>{t('m.pitch')}: {m.pitchVariation < 0.06 ? t('m.pitch.flat') : t('m.pitch.good')}</span>}
          {m.trailingOff && <span className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${TONE.ok}`}>{t('m.trailing')}</span>}
        </div>
      )}
      <Waveform frames={result.frames} pauses={result.pauseList || []} />
      {result.transcript && (
        <div className="prep-card px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="prep-eyebrow text-text-tertiary">{t('pr.transcript')}</p>
            <span className="flex items-center gap-3 text-xs text-text-tertiary">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200" />{t('pr.legend.filler')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-rose-400" />{t('pr.legend.hedge')}</span>
            </span>
          </div>
          <Marked text={result.transcript} lang={lang} />
          <p className="mt-3 text-xs text-text-tertiary">{t('pr.transcriptNote')}</p>
        </div>
      )}

      {ai?.analysis ? <AiPanel ai={ai} lang={lang} /> : (
        <div className="prep-card px-5 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold flex items-center gap-2"><Icon name="sparkles" className="w-5 h-5 text-brand" />{t('ai.get')}</p>
            <p className="mt-1 text-sm text-text-tertiary">{aiLeft > 0 ? t('ai.left', { n: aiLeft, total: aiPerDay }) : t('ai.none')}</p>
            {ai?.error && <p className="mt-1 text-sm text-status-danger-text">{ai.error}</p>}
          </div>
          <Button tone="primary" size="lg" icon="sparkles" onClick={onAi} disabled={aiLeft <= 0 || ai?.loading}>{ai?.loading ? t('ai.loading') : t('ai.get')}</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <Button tone="ink" size="lg" icon="refresh" onClick={onAgain}>{t('pr.again')}</Button>
        <Button tone="ghost" size="lg" iconRight="arrowRight" onClick={onNext}>{t('pr.next')}</Button>
        {onPractised && <Button tone={practised ? 'soft' : 'ghost'} size="lg" icon="check" onClick={onPractised} disabled={practised}>{practised ? t('pr.marked') : t('pr.markPractised')}</Button>}
      </div>
    </div>
  );
}

