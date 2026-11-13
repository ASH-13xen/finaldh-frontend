import { useEffect, useRef, useState } from 'react';
import Icon from '../mcq/Icon';

const ORDER = ['m1', 'm2', 'chairman', 'm3', 'm4'];

// A number that counts up to its target instead of jumping.
function CountUp({ value, duration = 650 }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now) => {
      const u = Math.min(1, (now - start) / duration);
      setShown(Math.round(a + (value - a) * (1 - (1 - u) ** 3)));
      if (u < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, duration]);
  return <>{shown}</>;
}

// The end of the interview: each member's mark out of 55, turned over one at a time, adding up to a
// total out of 275. In the 3D room the cards are real objects on the table and this component only adds
// the heading, the running total and the buttons; without 3D it draws the cards itself.
// onInsets reports how much of the screen the heading and the total cover, so the camera can frame
// the cards in what is left.
export default function MarksFinale({ marks, revealed, done, threeD, onReport, onSkip, onInsets }) {
  const headRef = useRef(null);
  const footRef = useRef(null);
  const byId = Object.fromEntries(marks.members.map((m) => [m.id, m]));
  const running = revealed.reduce((n, id) => n + (byId[id]?.marks || 0), 0);
  const total = done ? marks.total : running;

  useEffect(() => {
    if (!onInsets) return undefined;
    const measure = () => onInsets({ top: Math.max(0, (headRef.current?.offsetHeight || 0) - 16), bottom: Math.max(0, (footRef.current?.offsetHeight || 0) - 40) });
    const observer = new ResizeObserver(measure);
    if (headRef.current) observer.observe(headRef.current);
    if (footRef.current) observer.observe(footRef.current);
    return () => observer.disconnect();
  }, [onInsets]);

  return (
    <div className="absolute inset-0 z-[15] flex flex-col pointer-events-none">
      <div ref={headRef} className="pt-[68px] short:pt-[52px] pb-6 short:pb-3 px-4 text-center iv-rise">
        <div className="inline-block rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 px-5 py-2.5 short:py-1.5">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.28em] text-amber-200">The board’s marks</p>
          <p className="text-white/75 text-xs sm:text-sm mt-1 short:hidden">Five members, 55 marks each</p>
        </div>
      </div>

      {!threeD && (
        <div className="flex-1 flex items-center justify-center px-4 min-h-0">
          <ul className="flex flex-wrap justify-center gap-3 sm:gap-4 w-full max-w-3xl">
            {ORDER.map((id) => {
              const m = byId[id];
              if (!m) return null;
              return (
                <li key={id} className={`iv-flip w-[30%] max-w-[128px] short:max-w-[84px] aspect-[3/4] ${revealed.includes(id) ? 'is-open' : ''}`}>
                  <div className="iv-flip-inner">
                    <div className="iv-flip-face bg-[#0e3a2c] border-4 border-double border-[#c9a85c] flex items-center justify-center">
                      <span className="font-display text-[#e4c77f] text-xs sm:text-sm tracking-[0.3em] font-bold">MARKS</span>
                    </div>
                    <div className="iv-flip-face iv-flip-front bg-[#f6f0df] border-4 border-double border-[#a8843f] flex flex-col items-center justify-center text-center px-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f5a2e]">{m.label}</span>
                      <span className="font-display text-4xl sm:text-5xl short:text-3xl font-bold text-[#16211c] leading-none mt-1.5 tabular-nums">{m.marks}</span>
                      <span className="text-[11px] text-[#4c5650] mt-1.5">out of {m.outOf}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div ref={footRef} className="mt-auto pointer-events-auto bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pt-14 short:pt-10 pb-6 sm:pb-8 short:pb-3 text-center short:flex short:items-end short:justify-center short:gap-6 short:text-left">
        <p className="iv-caption short:shrink-0" aria-live="polite">
          <span className="font-display text-6xl sm:text-7xl short:text-5xl font-bold text-white tabular-nums"><CountUp value={total} /></span>
          <span className="font-display text-2xl sm:text-3xl short:text-xl text-white/55"> / {marks.outOf}</span>
        </p>
        <ul className="sr-only">
          {ORDER.filter((id) => revealed.includes(id)).map((id) => <li key={id}>{byId[id]?.label}: {byId[id]?.marks} out of {byId[id]?.outOf}</li>)}
        </ul>
        {/* Both states take the same room, so the cards do not shift when the last one turns over. */}
        <div className="min-h-[118px] short:min-h-0 short:max-w-sm">
          {done ? (
            <div className="iv-rise">
              <p className="text-xs sm:text-sm text-white/65 mt-3 short:mt-0 max-w-md mx-auto leading-relaxed">
                A practice estimate from {marks.basedOn === 1 ? 'the one answer' : `the ${marks.basedOn} answers`} the board scored today — not a prediction of your UPSC marks.
              </p>
              <button onClick={onReport} className="mt-4 short:mt-2 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-6 py-3 short:py-2 text-base short:text-sm font-bold text-white cursor-pointer shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50">
                See the full report <Icon name="arrowRight" className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button onClick={onSkip} className="mt-4 short:mt-0 text-xs font-semibold text-white/55 hover:text-white underline underline-offset-4 cursor-pointer">Skip to the report</button>
          )}
        </div>
      </div>
    </div>
  );
}
