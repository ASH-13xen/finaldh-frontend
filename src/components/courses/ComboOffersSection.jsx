export default function ComboOffersSection({ comboOffers, getComboStatus, onSelectCombo }) {
  return (
    <div className="mb-10 md:mb-14">
      <div className="mb-5">
        <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 md:w-5 md:h-5 text-accent-400">
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
            <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
            <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
          </svg>
          Bundle & Save
        </h2>
        <p className="text-slate-400 text-xs md:text-sm mt-1 font-medium">
          Buy multiple papers together at a flat discounted price instead of purchasing them one by one.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              className="bg-gradient-to-br from-accent-950/30 to-slate-900/40 backdrop-blur-md border border-accent-900/50 hover:border-accent-700/60 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl flex flex-col justify-between hover:shadow-accent-950/20 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
            >
              <div className="space-y-2.5 md:space-y-3">
                <span className="text-[8px] md:text-[9px] font-extrabold text-accent-300 bg-accent-900/50 border border-accent-800/60 rounded px-1.5 py-0.5 uppercase tracking-wider w-fit block">
                  Bundle Offer
                </span>

                <h3 className="text-xs md:text-base font-bold text-slate-100 leading-relaxed">
                  {combo.label}
                </h3>

                <div className="space-y-2 text-[10px] md:text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold">
                      Choose any {combo.pickCount} of:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {combo.eligibleCourses.map((c) => (
                        <span key={c.courseId} className="bg-slate-800/80 border border-slate-700/60 text-slate-300 rounded px-1.5 py-0.5 font-bold">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {combo.requiredCourses.length > 0 && (
                    <div>
                      <span className="text-slate-400 font-semibold">Always includes:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {combo.requiredCourses.map((c) => (
                          <span key={c.courseId} className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 rounded px-1.5 py-0.5 font-bold">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-accent-900/40 pt-3 mt-4 md:pt-4 md:mt-5 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[8px] md:text-[9px] font-bold text-slate-400 block uppercase tracking-wider">
                    Bundle Price
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm md:text-lg font-extrabold text-accent-300">
                      ₹{combo.price}
                    </span>
                    {savings > 0 && (
                      <span className="text-[9px] md:text-xs text-slate-500 line-through">
                        ₹{estimatedIndividualTotal}
                      </span>
                    )}
                  </div>
                  {savings > 0 && (
                    <span className="text-[9px] md:text-[10px] font-bold text-emerald-400 block">
                      Save ₹{savings}
                    </span>
                  )}
                </div>

                {comboStatus.type === 'pending' ? (
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg md:rounded-xl text-[9px] md:text-xs font-bold animate-pulse shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    <span className="hidden min-[350px]:inline">Pending Verification</span>
                    <span className="min-[350px]:hidden">Pending</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onSelectCombo(combo)}
                    className="px-2.5 py-1.5 md:px-4 md:py-2 bg-accent-600 hover:bg-accent-550 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-md hover:shadow-accent-950/20 cursor-pointer flex items-center gap-1 md:gap-1.5 shrink-0"
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
