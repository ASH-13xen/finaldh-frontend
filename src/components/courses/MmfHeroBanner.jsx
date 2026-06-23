import { MMF_FEATURES } from './courseHelpers';

export default function MmfHeroBanner({ course, status, pendingRequest, onPurchase, onTelegramNotify }) {
  return (
    <div className="mb-10 md:mb-14">
      <div className="bg-gradient-to-br from-accent-950/40 via-slate-900/60 to-slate-900/40 border border-accent-700/50 rounded-2xl p-5 md:p-10 shadow-2xl shadow-accent-950/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-500 to-transparent"></div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] md:text-xs font-extrabold text-accent-300 bg-accent-600/20 border border-accent-500/50 rounded-full px-3 py-1 uppercase tracking-wider mb-3">
              Most Popular
            </span>
            <h2 className="text-lg md:text-3xl font-black text-white tracking-tight mb-1.5">
              {course.name}
            </h2>
            <p className="text-slate-300 text-xs md:text-sm font-medium mb-5">
              Everything you need for GS Mains, compiled into one master file.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {MMF_FEATURES.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12" /></svg>
                  <span className="text-[11px] md:text-xs text-slate-300 font-medium leading-relaxed">
                    {point}
                  </span>
                </div>
              ))}
            </div>

            {course.discountLimitTag && (
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-[9px] font-bold text-amber-400 w-fit tracking-wide animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 text-amber-500"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                Discount valid only for first 50 students!
              </div>
            )}
          </div>

          <div className="lg:w-56 flex flex-col items-center lg:items-end gap-4 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-accent-900/40">
            <div className="text-center lg:text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Price
              </span>
              {course.useDiscount ? (
                <div className="flex items-baseline gap-1.5 justify-center lg:justify-end">
                  <span className="text-xl md:text-2xl font-extrabold text-accent-300">
                    ₹{course.discountedPrice}
                  </span>
                  <span className="text-sm text-slate-500 line-through">
                    ₹{course.price}
                  </span>
                </div>
              ) : (
                <span className="text-xl md:text-2xl font-extrabold text-white">
                  ₹{course.price}
                </span>
              )}
            </div>

            {status.type === 'purchased' ? (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs font-bold shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12" /></svg>
                Purchased
              </div>
            ) : status.type === 'pending' ? (
              <div className="w-full flex flex-col items-center lg:items-end gap-2">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-bold animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  Pending Verification
                </div>
                {pendingRequest && pendingRequest.telegramNotificationCount < 2 && (
                  <button
                    onClick={(e) => onTelegramNotify(pendingRequest, course, e)}
                    className="w-full px-3 py-2 bg-accent-600 hover:bg-accent-550 text-white rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    Notify Admin on Telegram
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => onPurchase(course)}
                className="w-full lg:w-auto px-6 py-3 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-accent-950/30 cursor-pointer flex items-center justify-center gap-2"
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
