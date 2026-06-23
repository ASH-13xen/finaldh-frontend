import { subjectDisplayName } from './courseHelpers';

export default function CourseCard({
  course,
  status,
  pendingRequest,
  onPurchase,
  onTelegramNotify,
  onSeeSample,
}) {
  const subjectDisplay = subjectDisplayName(course.subject);
  const pdfNames = course.fileNames && course.fileNames.length > 0
    ? course.fileNames
    : [course.fileName || course.name];

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 hover:border-slate-700 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl flex flex-col justify-between hover:shadow-accent-950/10 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
      <div className="space-y-2.5 md:space-y-4">
        {/* Category Badge */}
        <span className="text-[8px] md:text-[9px] font-extrabold text-accent-400 bg-accent-950/40 border border-accent-900/60 rounded px-1.5 py-0.5 uppercase tracking-wider w-fit block">
          {subjectDisplay}
        </span>

        {/* Course Name */}
        <h3 className="text-xs md:text-base font-bold text-slate-100 group-hover:text-white line-clamp-2 leading-relaxed transition-colors">
          {course.name || course.fileName}
        </h3>

        {course.sampleFileUrl && (
          <button
            type="button"
            onClick={() => onSeeSample(course)}
            className="text-[10px] md:text-xs font-bold text-accent-400 hover:text-accent-300 underline-offset-2 hover:underline cursor-pointer flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 md:w-3.5 md:h-3.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            See Sample
          </button>
        )}

        {course.discountLimitTag && (
          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-[9px] font-bold text-amber-400 w-fit tracking-wide animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 text-amber-500"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            Discount valid only for first 50 students!
          </div>
        )}

        {/* Guests see the per-file breakdown with locked affordance, mirroring what a logged-in student will get */}
        {status.type === 'guest' && (
          <div className="space-y-2">
            {pdfNames.map((name, idx) => (
              <div key={idx} className="bg-slate-950/50 border border-slate-800/60 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-slate-500 shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="text-[11px] font-semibold text-slate-300 truncate">{name}</span>
                </div>
                <button
                  onClick={() => onPurchase(course)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Locked
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 pt-3 mt-4 md:pt-4 md:mt-6 flex items-center justify-between">
        <div>
          <span className="text-[8px] md:text-[9px] font-bold text-slate-400 block uppercase tracking-wider">
            Price
          </span>
          {course.useDiscount ? (
            <div className="flex items-baseline gap-1">
              <span className="text-sm md:text-lg font-extrabold text-accent-400">
                ₹{course.discountedPrice}
              </span>
              <span className="text-[9px] md:text-xs text-slate-500 line-through">
                ₹{course.price}
              </span>
            </div>
          ) : (
            <span className="text-sm md:text-lg font-extrabold text-slate-100">
              ₹{course.price || 499}
            </span>
          )}
        </div>

        {/* Status Render */}
        {status.type === 'purchased' ? (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs font-bold shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12" /></svg>
            Purchased
          </div>
        ) : status.type === 'pending' ? (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg md:rounded-xl text-[9px] md:text-xs font-bold animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span className="hidden min-[350px]:inline">Pending Verification</span>
            <span className="min-[350px]:hidden">Pending</span>
          </div>
        ) : status.type === 'guest' ? (
          <button
            onClick={() => onPurchase(course)}
            className="px-2.5 py-1.5 md:px-4 md:py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            <span className="hidden sm:inline">Sign In to Purchase</span>
            <span className="sm:hidden">Sign In</span>
          </button>
        ) : (
          <button
            onClick={() => onPurchase(course)}
            className="px-2.5 py-1.5 md:px-4 md:py-2 bg-accent-600 hover:bg-accent-550 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-md hover:shadow-accent-950/20 cursor-pointer flex items-center gap-1 md:gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 md:w-3.5 md:h-3.5"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
            {status.type === 'rejected' ? (
              <>
                <span className="hidden sm:inline">Retry Purchase</span>
                <span className="sm:hidden">Retry</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Purchase Now</span>
                <span className="sm:hidden">Purchase</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Telegram Notify button if pending & notify count < 2 */}
      {status.type === 'pending' &&
        pendingRequest &&
        pendingRequest.telegramNotificationCount < 2 && (
          <button
            onClick={(e) => onTelegramNotify(pendingRequest, course, e)}
            className="w-full mt-3 px-3 py-2 bg-accent-600 hover:bg-accent-550 text-white rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4 10-10S17.52 2 12 2zm4.64 6.8c-.15.75-.85 3.79-1.2 5.68-.15.8-.45 1.07-.73 1.1-.63.06-1.11-.42-1.72-.82-.96-.63-1.51-1.02-2.44-1.63-1.08-.71-.38-1.1.24-1.74.16-.17 3.01-2.76 3.07-3.01.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.21-.03-.1.02-1.61 1.02-4.56 3.02-.43.3-.82.45-1.17.44-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.41.82-.63 3.2-1.39 5.34-2.31 6.42-2.75 3.07-1.28 3.7-1.5 4.12-1.5.09 0 .3.02.43.13.11.09.14.22.15.31-.01.07.01.21-.01.29z" />
            </svg>
            Notify Admin on Telegram
          </button>
        )}
    </div>
  );
}
