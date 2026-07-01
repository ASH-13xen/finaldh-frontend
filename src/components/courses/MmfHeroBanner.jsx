import { useEffect, useRef } from 'react';
import { MMF_FEATURES } from './courseHelpers';
import { gsap, prefersReducedMotion } from '../../lib/gsapSetup';

export default function MmfHeroBanner({ course, status, pendingRequest, onPurchase, onTelegramNotify, onSeeSample, features, badge, subtitle }) {
  const resolvedFeatures = features || MMF_FEATURES;
  const resolvedBadge = badge || 'Most Popular';
  const resolvedSubtitle = subtitle || 'Everything you need for GS Mains, compiled into one master file.';
  const bannerRef = useRef(null);

  useEffect(() => {
    if (!bannerRef.current || prefersReducedMotion()) return;
    // fromTo (not from) — see CategorizedCourseGrid's useGridReveal: gsap.from() would
    // capture an already-zeroed current opacity as its end-state if this effect ever
    // re-runs (e.g. StrictMode dev double-invoke), animating 0 -> 0 with no visible effect.
    const tween = gsap.fromTo(
      bannerRef.current,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: bannerRef.current,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      },
    );
    return () => tween.kill();
  }, []);

  return (
    <div ref={bannerRef} className="mb-10 md:mb-14">
      <div className="bg-gradient-to-br from-accent-soft-bg via-surface to-surface-raised border border-accent-soft-border rounded-2xl p-5 md:p-10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand to-transparent"></div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] md:text-xs font-sans font-extrabold text-brand bg-accent-soft-bg border border-accent-soft-border rounded-full px-3 py-1 uppercase tracking-wider mb-3">
              {resolvedBadge}
            </span>
            <h2 className="font-display font-semibold text-2xl md:text-4xl text-text-primary tracking-tight mb-1.5 leading-tight">
              {course.name}
            </h2>
            <p className="text-text-secondary text-xs md:text-sm font-medium mb-3">
              {resolvedSubtitle}
            </p>

            {course.sampleFileUrl && (
              <button
                type="button"
                onClick={() => onSeeSample(course)}
                className="mb-5 text-[11px] md:text-xs font-sans font-bold text-brand hover:text-brand-hover underline-offset-2 hover:underline cursor-pointer flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                See Sample
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {resolvedFeatures.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12" /></svg>
                  <span className="text-[11px] md:text-xs text-text-secondary font-medium leading-relaxed">
                    {point}
                  </span>
                </div>
              ))}
            </div>

            {course.discountLimitTag && (
              <div className="flex items-center gap-1 bg-status-warning-bg border border-status-warning-text/25 rounded px-2 py-1 text-[9px] font-sans font-bold text-status-warning-text w-fit tracking-wide animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                Discount valid only for first 50 students!
              </div>
            )}
          </div>

          <div className="lg:w-64 flex flex-col items-center lg:items-end gap-4 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-border-default">
            <div className="text-center lg:text-right">
              <span className="text-[9px] font-sans font-bold text-text-tertiary uppercase tracking-wider block mb-1">
                Price
              </span>
              {course.useDiscount ? (
                <div className="flex items-baseline gap-2 justify-center lg:justify-end">
                  <span className="text-4xl md:text-5xl font-sans font-extrabold text-brand tabular-nums leading-none">
                    &#8377;{course.discountedPrice}
                  </span>
                  <span className="text-sm text-text-tertiary line-through tabular-nums">
                    &#8377;{course.price}
                  </span>
                </div>
              ) : (
                <span className="text-4xl md:text-5xl font-sans font-extrabold text-text-primary tabular-nums leading-none">
                  &#8377;{course.price}
                </span>
              )}
            </div>

            {status.type === 'purchased' ? (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-status-success-bg border border-status-success-text/25 text-status-success-text rounded-xl text-xs font-sans font-bold shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12" /></svg>
                Purchased
              </div>
            ) : status.type === 'pending' ? (
              <div className="w-full flex flex-col items-center lg:items-end gap-2">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-status-warning-bg border border-status-warning-text/25 text-status-warning-text rounded-xl text-xs font-sans font-bold animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  Pending Verification
                </div>
                {pendingRequest && pendingRequest.telegramNotificationCount < 2 && (
                  <button
                    onClick={(e) => onTelegramNotify(pendingRequest, course, e)}
                    className="w-full px-3 py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-[10px] font-sans font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    Notify Admin on Telegram
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => onPurchase(course)}
                className="w-full lg:w-auto px-6 py-3 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-sm font-sans font-bold transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
                {status.type === 'guest' ? 'Sign In to Purchase' : status.type === 'rejected' ? 'Retry Purchase' : 'Purchase Now'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
