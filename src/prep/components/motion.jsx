// Animated building blocks for the Interview Prep section (see lib/motion.js for the GSAP setup).
import { useRef } from 'react';
import { gsap, SplitText, useGSAP, prefersReducedMotion } from '../lib/motion';

const fmtInt = (n) => Math.round(n).toLocaleString('en-IN');

// A heading that rises in line by line (SplitText never splits letters, so Devanagari stays whole).
// SplitText labels the heading for screen readers and hides the pieces. Highlights inside it
// (<Highlight still>) are swept here, after the split, because splitting copies those elements.
export function SplitHeading({ as: Tag = 'h1', className = '', delay = 0, stagger = 0.08, children }) {
  const ref = useRef(null);
  useGSAP(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    SplitText.create(el, {
      type: 'lines,words',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) => {
        const tl = gsap.timeline({ delay });
        tl.from(self.lines, { yPercent: 110, duration: 1.1, stagger });
        const marks = el.querySelectorAll('.prep-hl');
        if (marks.length) tl.fromTo(marks, { backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%', duration: 0.9, ease: 'power2.inOut', stagger: 0.12 }, '-=0.35');
        return tl;
      }
    });
  }, { scope: ref });
  return <Tag ref={ref} className={className}>{children}</Tag>;
}

// A number that counts up when it scrolls into view. Screen readers get the final value straight away.
export function CountUp({ value, className = '', format = fmtInt, duration = 1.6 }) {
  const ref = useRef(null);
  useGSAP(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(value)) return;
    if (prefersReducedMotion()) { el.textContent = format(value); return; }
    const o = { n: 0 };
    el.textContent = format(0);
    gsap.to(o, {
      n: value,
      duration,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 96%', once: true },
      onUpdate: () => { el.textContent = format(o.n); }
    });
  }, { dependencies: [value], revertOnUpdate: true });
  return (
    <span className={className}>
      <span className="sr-only">{format(value)}</span>
      <span ref={ref} aria-hidden="true">{format(value)}</span>
    </span>
  );
}

// A phrase marked with a highlighter that sweeps across it once it is on screen.
export function Highlight({ children, tone = 'amber', delay = 0.35, low = false, still = false, className = '', style }) {
  const ref = useRef(null);
  useGSAP(() => {
    const el = ref.current;
    if (!el || still || prefersReducedMotion()) return;
    gsap.fromTo(el,
      { backgroundSize: low ? '0% 46%' : '0% 100%' },
      { backgroundSize: low ? '100% 46%' : '100% 100%', duration: 1, delay, ease: 'power2.inOut', scrollTrigger: { trigger: el, start: 'top 94%', once: true } });
  });
  const toneCls = tone === 'emerald' ? 'prep-hl-emerald' : tone === 'rose' ? 'prep-hl-rose' : '';
  return <mark ref={ref} style={style} className={`prep-hl ${toneCls} ${low ? 'prep-hl-low' : ''} ${className}`}>{children}</mark>;
}

// A ring that draws itself to `value` (0-1). Used for readiness and progress.
export function Ring({ value = 0, size = 64, stroke = 6, className = '', trackClass = 'text-border-subtle', barClass = 'text-brand', children }) {
  const ref = useRef(null);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) { gsap.set(el, { strokeDashoffset: c * (1 - v) }); return; }
    gsap.fromTo(el, { strokeDashoffset: c }, { strokeDashoffset: c * (1 - v), duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 96%', once: true } });
  }, { dependencies: [v], revertOnUpdate: true });
  return (
    <span className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className={trackClass} />
        <circle ref={ref} cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} className={barClass} />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
}
