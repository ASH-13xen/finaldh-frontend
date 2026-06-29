import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '../../lib/gsapSetup';

export default function ComboOffersSection({ comboOffers, getComboStatus, onSelectCombo }) {
  const gridRef = useRef(null);

  useEffect(() => {
    if (!gridRef.current || prefersReducedMotion()) return;
    const cards = gridRef.current.children;
    // fromTo (not from) — see CategorizedCourseGrid's useGridReveal: this effect can
    // re-run more than once (StrictMode dev double-invoke, dependency changes), and
    // gsap.from() would capture an already-zeroed current opacity as its end-state,
    // animating 0 -> 0 with no visible effect.
    const tween = gsap.fromTo(
      cards,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      },
    );
    return () => tween.kill();
  }, [comboOffers.length]);

  return (
    <div className="mb-10 md:mb-14">
      <div className="mb-5">
        <h2 className="text-base md:text-xl font-display font-semibold text-text-primary tracking-tight flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 md:w-5 md:h-5 text-brand">
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
            <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
            <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
          </svg>
          Bundle &amp; Save
        </h2>
        <p className="text-text-secondary text-xs md:text-sm mt-1 font-medium">
          Buy multiple papers together at a flat discounted price instead of purchasing them one by one.
        </p>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {comboOffers.map((combo) => {
          const comboStatus = getComboStatus(combo);
          const sortedEligiblePrices = [...combo.eligibleCourses]
            .map((c) => c.price || 0)
            .sort((a, b) => b - a);
          const estimatedIndividualTotal =
            sortedEligiblePrices.slice(0, combo.pickCount).reduce((sum, p) => sum + p, 0) +
            combo.requiredCourses.reduce((sum, c) => sum + (c.price || 0), 0);
          const savings = estimatedIndividualTotal - combo.price;

          return (
            <div
              key={combo._id}
              className="bg-gradient-to-br from-accent-soft-bg to-surface border border-accent-soft-border hover:border-brand/50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
            >
              <div className="space-y-2.5 md:space-y-3">
                <span className="text-[8px] md:text-[9px] font-sans font-extrabold text-brand bg-accent-soft-bg border border-accent-soft-border rounded px-1.5 py-0.5 uppercase tracking-wider w-fit block">
                  Bundle Offer
                </span>

                <h3 className="text-xs md:text-base font-sans font-bold text-text-primary leading-relaxed">
                  {combo.label}
                </h3>

                <div className="space-y-2 text-[10px] md:text-xs">
                  <div>
                    <span className="text-text-tertiary font-semibold">
                      Choose any {combo.pickCount} of:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {combo.eligibleCourses.map((c) => (
                        <span key={c.courseId} className="bg-surface-raised border border-border-default text-text-secondary rounded px-1.5 py-0.5 font-bold">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {combo.requiredCourses.length > 0 && (
                    <div>
                      <span className="text-text-tertiary font-semibold">Always includes:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {combo.requiredCourses.map((c) => (
                          <span key={c.courseId} className="bg-status-success-bg border border-status-success-text/25 text-status-success-text rounded px-1.5 py-0.5 font-bold">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border-default pt-3 mt-4 md:pt-4 md:mt-5 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[8px] md:text-[9px] font-sans font-bold text-text-tertiary block uppercase tracking-wider">
                    Bundle Price
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base md:text-xl font-sans font-extrabold text-brand tabular-nums">
                      &#8377;{combo.price}
                    </span>
                    {savings > 0 && (
                      <span className="text-[9px] md:text-xs text-text-tertiary line-through tabular-nums">
                        &#8377;{estimatedIndividualTotal}
                      </span>
                    )}
                  </div>
                  {savings > 0 && (
                    <span className="text-[9px] md:text-[10px] font-sans font-bold text-status-success-text block tabular-nums">
                      Save &#8377;{savings}
                    </span>
                  )}
                </div>

                {comboStatus.type === 'pending' ? (
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-status-warning-bg border border-status-warning-text/25 text-status-warning-text rounded-lg md:rounded-xl text-[9px] md:text-xs font-sans font-bold animate-pulse shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    <span className="hidden min-[350px]:inline">Pending Verification</span>
                    <span className="min-[350px]:hidden">Pending</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onSelectCombo(combo)}
                    className="px-2.5 py-1.5 md:px-4 md:py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg md:rounded-xl text-[10px] md:text-xs font-sans font-bold transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-1 md:gap-1.5 shrink-0"
                  >
                    Select Papers
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
