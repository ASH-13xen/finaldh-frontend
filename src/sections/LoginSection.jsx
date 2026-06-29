import { useEffect, useRef } from 'react';
import { gsap, SplitText, prefersReducedMotion } from '../lib/gsapSetup';

export default function LoginSection({ error, googleButtonRef }) {
  const headlineRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline();
    let split;
    if (headlineRef.current) {
      split = new SplitText(headlineRef.current, { type: 'words' });
      gsap.set(split.words, { opacity: 0, y: 14 });
      tl.to(split.words, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power2.out' });
    }
    if (cardRef.current) {
      // fromTo (not from) — React StrictMode's dev-only double-invoke runs this effect
      // twice; gsap.from() would capture the card's already-zeroed current opacity (left
      // by the first, unkilled timeline) as its end-state, animating 0 -> 0 visibly static.
      tl.fromTo(cardRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, '-=0.15');
    }
    return () => {
      split?.revert();
      tl.kill();
    };
  }, []);

  return (
    <div className="min-h-screen bg-page text-text-primary flex flex-col lg:flex-row">
      {/* Left: editorial brand moment */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-16 lg:py-0 relative overflow-hidden">
        <span aria-hidden="true" className="hidden lg:block font-display absolute -top-10 -left-4 text-[14rem] leading-none text-brand/6 select-none pointer-events-none">&ldquo;</span>
        <div className="max-w-lg relative">
          <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-brand block mb-4">The Dark Horse UPSC</span>
          <h1 ref={headlineRef} className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-text-primary">
            Prepare with precision.
          </h1>
          <p className="mt-6 text-sm sm:text-base text-text-secondary font-medium max-w-md leading-relaxed">
            Topic-wise study guides, previous-year questions, and progress tracking — built around one goal: clearing the UPSC Civil Services Examination.
          </p>
        </div>
      </div>

      {/* Right: sign-in card */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 lg:py-0 bg-surface-raised lg:border-l border-border-default">
        <div ref={cardRef} className="w-full max-w-md bg-surface border border-border-default rounded-2xl p-8 shadow-xl flex flex-col">
          <div className="flex items-center justify-center w-12 h-12 bg-accent-soft-bg border border-accent-soft-border text-brand rounded-xl mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>

          <h2 className="font-display font-semibold text-2xl text-text-primary leading-snug">Sign In</h2>
          <p className="text-sm text-text-secondary mt-2 font-medium">Welcome back. Authenticate securely with your Google account to access the gateway.</p>

          {error && (
            <div className="mt-5 p-3.5 bg-status-danger-bg border border-status-danger-text/30 text-status-danger-text text-xs font-medium rounded-xl flex items-start gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
            </div>
          )}

          <div className="my-7">
            <div ref={googleButtonRef} className="w-full min-h-[44px] flex justify-center animate-pulse"></div>
          </div>

          <div className="border-t border-border-default pt-5 flex items-center justify-center text-[11px] font-sans font-semibold text-text-tertiary uppercase tracking-widest gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Secured Session
          </div>
        </div>
      </div>
    </div>
  );
}
