// Motion for the Interview Prep section. GSAP and its plugins are registered once here; every effect
// checks prefersReducedMotion() and simply shows the final state when the reader asked for less motion.
// Only transforms, opacity and background-size are animated, so phones stay smooth.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Flip } from 'gsap/Flip';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, Flip, DrawSVGPlugin, CustomEase, useGSAP);
CustomEase.create('prep', 'M0,0 C0.16,1 0.3,1 1,1');
gsap.defaults({ ease: 'prep', duration: 0.8 });

export { gsap, ScrollTrigger, SplitText, Flip, useGSAP };

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Children marked data-reveal rise into view in small batches as the reader scrolls.
export function useReveal(scope, { selector = '[data-reveal]', y = 26, stagger = 0.07, dependencies = [] } = {}) {
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const els = gsap.utils.toArray(selector, scope.current);
    if (!els.length) return;
    gsap.set(els, { autoAlpha: 0, y });
    ScrollTrigger.batch(els, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, stagger, overwrite: true, duration: 0.9 })
    });
  }, { scope, dependencies, revertOnUpdate: true });
}

// A button or card that leans toward the pointer (mouse only; touch and reduced motion get nothing).
export function useMagnetic(ref, { strength = 0.28, enabled = true } = {}) {
  useGSAP(() => {
    const el = ref.current;
    if (!enabled || !el || prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    const move = (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => { xTo(0); yTo(0); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, { scope: ref });
}
