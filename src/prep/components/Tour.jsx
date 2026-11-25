// Guided tours of Abhivyakti's tabs (content in lib/tours.js). Each tab's tour opens by itself the first time a
// student opens that tab - once per account (kept on the server, so not again on a refresh or another device;
// visitors who aren't signed in: once per browser) - and the "How it works" button replays it any time.
// A tour points at the real parts of the screen with Next, Back and Skip; on phones its card sits at the bottom.
// It never opens over another popup, waits for the tab to be ready (a locked or loading tab doesn't use it up),
// skips steps whose part isn't on this student's screen, and finishing or skipping both count as seen.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../components/mcq/Icon';
import { TOURS, TOUR_START, startTour, hasTour } from '../lib/tours';
import { api } from '../lib/api';
import { prefersReducedMotion } from '../lib/motion';
import { useT } from '../lib/i18n';


const localKey = (who) => `prep.toursSeen.${who}`;
const readLocal = (who) => {
  try { const v = JSON.parse(localStorage.getItem(localKey(who)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const writeLocal = (who, list) => { try { localStorage.setItem(localKey(who), JSON.stringify(list)); } catch { /* storage blocked */ } };

const find = (target) => (target ? document.querySelector(`[data-tour="${target}"]`) : null);
const shown = (el) => !!el && el.getClientRects().length > 0;
const otherPopupOpen = () => !!document.querySelector('[role="dialog"][aria-modal="true"]:not([data-tour-card])');

// "How it works": replays the tour of the tab on screen.
export function TourButton({ screen }) {
  const { t } = useT();
  if (!hasTour(screen)) return null;
  return (
    <button type="button" onClick={startTour} data-tour="tour-button" title={t('tour.how')} aria-label={t('tour.how')}
      className="prep-focus h-10 px-2.5 md:px-3.5 rounded-full border border-border-default bg-surface flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-text-primary cursor-pointer shrink-0">
      <Icon name="help" className="w-[18px] h-[18px]" /><span className="hidden md:inline">{t('tour.how')}</span>
    </button>
  );
}

export default function TourHost({ screen, user }) {
  const { t } = useT();
  const who = user ? String(user.id || user._id || user.email || 'user') : 'guest';
  // Visitors: what this browser has seen; students: loaded from their account below. (PrepFlow gives each
  // account its own TourHost, so this starts fresh when someone signs in.)
  const [seen, setSeen] = useState(() => (user ? null : new Set(readLocal(who))));
  const [run, setRun] = useState(null); // { tab, steps, i }
  const [rect, setRect] = useState(null); // { key, top, left, width, height } of the current step's part
  const screenRef = useRef(screen);
  const nextRef = useRef(null);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // What this student has seen: on their account (and this browser, in case saving it failed).
  useEffect(() => {
    let cancelled = false;
    if (!user) return undefined;
    const local = readLocal(who);
    api.tours()
      .then((d) => { if (!cancelled) setSeen(new Set([...(d?.seen || []), ...local])); })
      .catch(() => { if (!cancelled) setSeen(new Set(local)); });
    return () => { cancelled = true; };
  }, [who, user]);

  const markSeen = useCallback((tab) => {
    setSeen((cur) => {
      const next = new Set(cur || []);
      next.add(tab);
      writeLocal(who, [...next]);
      return next;
    });
    if (user) api.tourSeen(tab).catch(() => {});
  }, [who, user]);

  const start = useCallback((tab) => {
    const tour = TOURS[tab];
    if (!tour) return;
    const steps = tour.steps.filter((s) => !s.target || shown(find(s.target)));
    if (steps.length) setRun({ tab, steps, i: 0 });
  }, []);

  // Opens by itself, once, when the tab is ready and nothing else is open.
  useEffect(() => {
    const tour = TOURS[screen];
    if (!seen || run || !tour || seen.has(screen)) return undefined;
    let timer = null;
    const began = Date.now();
    const poll = setInterval(() => {
      if (Date.now() - began > 20000) { clearInterval(poll); return; }
      if (otherPopupOpen() || !shown(find(tour.ready))) return;
      clearInterval(poll);
      timer = setTimeout(() => { if (screenRef.current === screen && !otherPopupOpen()) start(screen); }, 700);
    }, 400);
    return () => { clearInterval(poll); clearTimeout(timer); };
  }, [screen, seen, run, start]);

  // "How it works".
  useEffect(() => {
    const onStart = () => start(screenRef.current);
    window.addEventListener(TOUR_START, onStart);
    return () => window.removeEventListener(TOUR_START, onStart);
  }, [start]);

  // Leaving the tab ends its tour (it opens again next time, as it wasn't finished).
  useEffect(() => {
    if (!run || run.tab === screen) return undefined;
    const id = setTimeout(() => setRun(null), 0);
    return () => clearTimeout(id);
  }, [screen, run]);

  const active = run && run.tab === screen ? run : null;
  const step = active ? active.steps[active.i] : null;
  const stepKey = active ? `${active.tab}:${active.i}` : '';
  const last = active ? active.i === active.steps.length - 1 : false;
  const finish = useCallback(() => { if (run) markSeen(run.tab); setRun(null); }, [run, markSeen]);
  const next = useCallback(() => { if (!run) return; if (last) finish(); else setRun({ ...run, i: run.i + 1 }); }, [run, last, finish]);
  const back = useCallback(() => { if (run && run.i > 0) setRun({ ...run, i: run.i - 1 }); }, [run]);

  // The part of the screen this step is about: scrolled into view and followed while the page moves.
  useEffect(() => {
    if (!step) return undefined;
    const el = find(step.target);
    if (!shown(el)) return undefined; // a card on its own
    const reduce = prefersReducedMotion();
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el.isConnected) { setRect(null); return; }
        const r = el.getBoundingClientRect();
        setRect({ key: stepKey, top: r.top, left: r.left, width: r.width, height: r.height });
      });
    };
    measure();
    const settle = setTimeout(measure, reduce ? 0 : 420);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(settle); cancelAnimationFrame(raf); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [step, stepKey]);

  // Keyboard: arrows move, Esc closes (counts as seen). The Next button takes focus on each step.
  useEffect(() => {
    if (!active) return undefined;
    nextRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(); } else if (e.key === 'ArrowRight') { e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish, next, back]);

  if (!active || !step) return null;
  const box = rect && rect.key === stepKey ? rect : null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const phone = vw < 640;
  const W = 380;
  let cardStyle;
  if (phone) cardStyle = { left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 5.25rem)' };
  else if (!box) cardStyle = { left: '50%', top: '50%', width: 420, transform: 'translate(-50%, -50%)' };
  else {
    const left = Math.min(Math.max(16, box.left), vw - W - 16);
    const below = box.top + box.height + 14;
    if (below + 230 < vh) cardStyle = { left, top: below, width: W };
    else if (box.top - 14 > 250) cardStyle = { left, bottom: vh - box.top + 14, width: W };
    else cardStyle = { right: 24, bottom: 24, width: W };
  }
  const hole = box && {
    top: Math.max(box.top - 8, 4),
    left: Math.max(box.left - 8, 4),
    width: Math.min(box.width + 16, vw - 8),
    height: Math.min(box.height + 16, vh - 8)
  };

  return createPortal(
    <div className="fixed inset-0 z-[70]" aria-hidden="false">
      {/* The page is dimmed, with a window around the part being explained; clicks don't reach the page. */}
      {hole
        ? <div className="absolute rounded-2xl ring-2 ring-white/90 pointer-events-none transition-all duration-200" style={{ ...hole, boxShadow: '0 0 0 9999px rgba(12, 20, 16, 0.58)' }} />
        : <div className="absolute inset-0 bg-[rgba(12,20,16,0.58)]" />}
      <div role="dialog" aria-modal="true" aria-labelledby="prep-tour-title" aria-describedby="prep-tour-body" data-tour-card
        className="fixed rounded-2xl bg-surface border border-border-default shadow-[var(--prep-shadow-lift)] p-5 text-text-primary" style={cardStyle}>
        <p className="text-xs font-bold uppercase tracking-wider text-brand">{t('tour.step', { a: active.i + 1, b: active.steps.length })}</p>
        <h2 id="prep-tour-title" className="mt-1 font-display text-xl font-semibold leading-snug">{step.title}</h2>
        <p id="prep-tour-body" className="mt-1.5 text-[15px] text-text-secondary leading-relaxed">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          {!last && <button type="button" onClick={finish} className="prep-focus text-sm font-semibold text-text-tertiary hover:text-text-primary cursor-pointer px-1 py-2">{t('tour.skip')}</button>}
          <span className="flex-1" />
          {active.i > 0 && <button type="button" onClick={back} className="prep-focus h-10 px-4 rounded-full border border-border-default text-sm font-semibold hover:border-text-primary cursor-pointer">{t('tour.back')}</button>}
          <button ref={nextRef} type="button" onClick={next} className="prep-focus h-10 px-5 rounded-full bg-text-primary text-page text-sm font-bold cursor-pointer">{t(last ? 'tour.done' : 'tour.next')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
