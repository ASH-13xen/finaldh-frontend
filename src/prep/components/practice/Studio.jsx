// The recording stage: the question, "hear it", an optional 10-second think, the record button, and live
// feedback while answering (time, words, filler words, a pace needle, voice level).
import { useEffect, useRef, useState } from 'react';
import Icon from '../../../components/mcq/Icon';
import { gsap, useGSAP, prefersReducedMotion } from '../../lib/motion';
import { useT } from '../../lib/i18n';
import { markTranscript } from '../../lib/voice';
import SpeakButton from '../SpeakButton';
import { stop as stopSpeaking } from '../../lib/speech';

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function PaceNeedle({ wpm }) {
  const { t } = useT();
  const v = Math.max(0, Math.min(220, wpm || 0));
  const angle = -90 + (v / 220) * 180;
  const arc = (from, to) => {
    const a = (d) => ((-180 + (d / 220) * 180) * Math.PI) / 180;
    const p = (d) => [60 + 48 * Math.cos(a(d)), 60 + 48 * Math.sin(a(d))];
    const [x1, y1] = p(from);
    const [x2, y2] = p(to);
    return `M${x1},${y1} A48,48 0 0 1 ${x2},${y2}`;
  };
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70" aria-hidden="true">
        <path d={arc(0, 220)} stroke="rgba(255,255,255,0.15)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d={arc(120, 165)} stroke="#34d399" strokeWidth="8" fill="none" strokeLinecap="round" />
        <line x1="60" y1="60" x2="60" y2="18" stroke="#fde68a" strokeWidth="3" strokeLinecap="round" style={{ transform: `rotate(${angle}deg)`, transformOrigin: '60px 60px', transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
        <circle cx="60" cy="60" r="5" fill="#fde68a" />
      </svg>
      <span className="prep-num text-sm text-white/70">{wpm ? t('m.pace.v', { n: wpm }) : '—'}</span>
    </div>
  );
}

function Level({ level, on }) {
  const bars = 28;
  return (
    <div className="flex items-center justify-center gap-[3px] h-10" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        const shape = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 1.7));
        const h = on ? Math.max(0.08, Math.min(1, level * shape * 1.3)) : 0.08;
        return <span key={i} className="w-[4px] rounded-full bg-emerald-300/80 transition-[height] duration-150" style={{ height: `${h * 100}%` }} />;
      })}
    </div>
  );
}

export default function Studio({ question, label, lang, recorder, onChange, timeLimit = 0, liveFillers = false, showPace = false }) {
  const { t } = useT();
  const { state, live, start, stop } = recorder;
  const [think, setThink] = useState(false);
  const [count, setCount] = useState(0);
  const root = useRef(null);
  const recording = state === 'recording';
  const busy = state === 'requesting' || state === 'processing';
  const wpm = recording && live.seconds > 6 && live.words > 8 ? Math.round(live.words / (live.seconds / 60)) : null;
  const fillerCount = liveFillers ? markTranscript(live.transcript, lang).filter((p) => p.kind === 'filler').length : 0;
  const left = timeLimit ? Math.max(0, Math.ceil(timeLimit - live.seconds)) : 0;

  useEffect(() => {
    if (recording && timeLimit && live.seconds >= timeLimit) stop();
  }, [recording, timeLimit, live.seconds, stop]);

  useEffect(() => {
    if (!count) return undefined;
    const id = setTimeout(() => {
      if (count === 1) { setCount(0); start({ lang }); } else setCount((c) => c - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [count, start, lang]);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from('[data-q]', { y: 24, autoAlpha: 0, duration: 0.8 });
  }, { scope: root, dependencies: [question] });

  // The question stops being read once the student starts (or counts down to) answering.
  const begin = () => { stopSpeaking(); if (think) setCount(10); else start({ lang }); };

  return (
    <section ref={root} className="relative overflow-hidden rounded-[2rem] bg-[#14110d] text-[#f3ede2] px-6 py-8 md:px-12 md:py-12 shadow-[0_30px_80px_-30px_rgba(20,17,13,0.6)]">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 60% at 50% 0%, rgba(18,155,110,0.28), transparent 70%)' }} aria-hidden="true" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="prep-eyebrow text-emerald-300">{label}</p>
          {!recording && !busy && !count && (
            <button type="button" onClick={onChange} className="prep-focus text-sm font-semibold text-white/60 hover:text-white cursor-pointer inline-flex items-center gap-1.5"><Icon name="refresh" className="w-4 h-4" />{t('pr.change')}</button>
          )}
        </div>
        <h2 data-q className="mt-5 font-display text-[1.9rem] leading-[1.2] md:text-[3rem] md:leading-[1.12] font-semibold tracking-tight max-w-4xl">{question}</h2>

        {!recording && !busy && !count && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <SpeakButton text={question} id={`studio:${question}`} variant="pill" dark label={t('pr.hear')} />
            <label className="h-11 px-4 rounded-full border border-white/20 text-white/85 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={think} onChange={(e) => setThink(e.target.checked)} className="accent-emerald-400 w-4 h-4" />
              {t('pr.think')}
            </label>
          </div>
        )}

        <div className="mt-10 md:mt-12 flex flex-col items-center gap-6">
          {count > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <span className="prep-num font-display text-7xl md:text-8xl font-semibold text-emerald-300">{count}</span>
              <span className="text-white/60">{t('pr.thinking')}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={recording ? stop : begin}
              disabled={busy}
              aria-label={recording ? t('pr.stop') : t('pr.record')}
              className="prep-focus relative w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center cursor-pointer disabled:cursor-wait"
            >
              {recording && <><span className="absolute inset-0 rounded-full bg-rose-500/40 iv-ring" /><span className="absolute inset-0 rounded-full bg-rose-500/30 iv-ring iv-ring-delay" /></>}
              <span className={`relative w-full h-full rounded-full flex items-center justify-center transition-colors ${recording ? 'bg-rose-500' : 'bg-emerald-500 hover:bg-emerald-400'} shadow-[0_18px_40px_-12px_rgba(16,185,129,0.6)]`}>
                {busy ? <span className="w-8 h-8 rounded-full border-4 border-white/40 border-t-white animate-spin" />
                  : recording ? <span className="w-9 h-9 rounded-lg bg-white" /> : <Icon name="mic" className="w-11 h-11 text-white" />}
              </span>
            </button>
          )}
          <p className="text-white/70 text-[15px] min-h-6">{busy ? t('pr.processing') : recording ? t('pr.stop') : !count ? t('pr.record') : ''}</p>

          {recording && (
            <div className="w-full max-w-2xl grid grid-cols-3 items-center gap-4">
              <div className="text-center">
                <p className="prep-num font-display text-3xl">{clock(live.seconds)}</p>
                <p className="text-xs text-white/50">{timeLimit ? t('pr.timeLeft', { s: left >= 60 ? clock(left) : `${left}s` }) : t('pr.recording')}</p>
              </div>
              <Level level={live.level} on={recording} />
              <div className="text-center">
                {showPace ? <PaceNeedle wpm={wpm} /> : (
                  <>
                    <p className="prep-num font-display text-3xl">{live.words}</p>
                    <p className="text-xs text-white/50">{liveFillers ? t('pr.liveFillers', { n: fillerCount }) : t('pr.words', { n: '' }).trim()}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
