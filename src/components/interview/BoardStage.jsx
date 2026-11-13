import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ASKER_LABEL } from '../../lib/interviewApi';

const SEATS = ['m1', 'm2', 'chairman', 'm3', 'm4'];

// Phones and modest laptops get a lighter picture; anything weaker than that still runs, at the lowest tier.
// eslint-disable-next-line react-refresh/only-export-components
export const pickQuality = () => {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (memory <= 2 || cores <= 2) return 'low';
  if (coarse || memory <= 4 || cores <= 4) return 'medium';
  return 'high';
};

// The 3D boardroom. All drawing happens in lib/interviewScene.js (loaded on demand); this component
// feeds it the interview's state and lays the tappable notepad spots over the picture.
//   ref.playFinale(marks, { onReveal, onDone })   ref.tell(memberId, name)   ref.setMood(memberId, mood)
//   ref.setParallax(x, y, gain)
const BoardStage = forwardRef(function BoardStage(
  { phase, active, level = 0, autoLevel = false, followUp = false, paused = false, labels, insetTop = 0, insetBottom = 0, unread = {}, padsOpen = false, onPad, onReady, onUnavailable },
  ref
) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const scene = useRef(null);
  const padEls = useRef({});
  const [ready, setReady] = useState(false);
  const cbs = useRef({ onReady, onUnavailable });
  useEffect(() => { cbs.current = { onReady, onUnavailable }; });

  useEffect(() => {
    let dead = false;
    let observer = null;
    import('../../lib/interviewScene.js')
      .then((mod) => {
        if (dead) return;
        if (!mod.webglAvailable()) throw new Error('WebGL is not available');
        const s = mod.createBoardScene(canvas.current, {
          quality: pickQuality(),
          labels,
          onFrame: (pads) => {
            for (const p of pads) {
              const el = padEls.current[p.id];
              if (!el) continue;
              el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
              el.style.visibility = p.visible ? 'visible' : 'hidden';
            }
          }
        });
        scene.current = s;
        const fit = () => { if (!wrap.current) return; const r = wrap.current.getBoundingClientRect(); s.resize(r.width, r.height); };
        fit();
        observer = new ResizeObserver(fit);
        observer.observe(wrap.current);
        setReady(true);
        cbs.current.onReady?.();
      })
      .catch(() => { if (!dead) cbs.current.onUnavailable?.(); });
    return () => {
      dead = true;
      observer?.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
    // The room is built once; the seat labels never change during an interview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scene.current?.setState({ phase, active, followUp, paused }); }, [ready, phase, active, followUp, paused]);
  useEffect(() => { scene.current?.setLevel(level, autoLevel); }, [ready, level, autoLevel]);
  useEffect(() => { scene.current?.setInsets(insetTop, insetBottom); }, [ready, insetTop, insetBottom]);
  useEffect(() => { for (const id of SEATS) scene.current?.setUnread(id, !!unread[id]); }, [ready, unread]);

  useImperativeHandle(ref, () => ({
    playFinale: (marks, handlers) => scene.current?.playFinale(marks, handlers),
    tell: (id, name) => scene.current?.tell(id, name),
    setMood: (id, mood) => scene.current?.setMood(id, mood),
    setParallax: (x, y, gain) => scene.current?.setParallax(x, y, gain),
    ready: () => !!scene.current
  }), []);

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvas} className={`block w-full h-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
      <div className="iv-vignette absolute inset-0 pointer-events-none" />
      <div className="iv-grain absolute inset-0 pointer-events-none" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white/50 text-sm flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/25 border-t-emerald-300 rounded-full animate-spin" /> Setting up the boardroom…</p>
        </div>
      )}
      {/* Tappable notepads: one spot per member, kept on top of the pad by the scene every frame. */}
      {padsOpen && ready && SEATS.map((id) => (
        <button
          key={id}
          ref={(el) => { padEls.current[id] = el; }}
          type="button"
          onClick={() => onPad?.(id)}
          style={{ visibility: 'hidden' }}
          className="iv-pad absolute left-0 top-0 -ml-6 -mt-6 w-12 h-12 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          aria-label={`Read ${ASKER_LABEL[id] || 'the member'}’s notes${unread[id] ? ' (new)' : ''}`}
          title={`${ASKER_LABEL[id] || 'Member'}’s notepad`}
        >
          {unread[id] && <><span className="absolute inset-1 rounded-full border-2 border-amber-200/80 iv-ring" /><span className="absolute right-1.5 top-1.5 w-2.5 h-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.9)]" /></>}
        </button>
      ))}
    </div>
  );
});

export default BoardStage;
