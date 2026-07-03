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
    <div className="bg-surface border border-border-default hover:border-brand/40 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
      <div className="space-y-2.5 md:space-y-4">
        {/* Category Badge */}
        <span className="text-[8px] md:text-[9px] font-sans font-extrabold text-brand bg-accent-soft-bg border border-accent-soft-border rounded px-1.5 py-0.5 uppercase tracking-wider w-fit block">
          {subjectDisplay}
        </span>

        {/* Course Name + See Sample on the same line */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xs md:text-base font-sans font-bold text-text-primary group-hover:text-brand line-clamp-2 leading-relaxed transition-colors">
            {course.name || course.fileName}
          </h3>
          {course.sampleFileUrl && (
            <button
              type="button"
              onClick={() => onSeeSample(course)}
              className="inline-flex items-center gap-1 shrink-0 px-2 py-1 md:px-3 md:py-1.5 bg-accent-soft-bg hover:bg-accent-soft-border border border-accent-soft-border text-brand rounded-lg text-[10px] md:text-sm font-sans font-bold transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 md:w-4 md:h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              See Sample
            </button>
          )}
        </div>

        {course.discountLimitTag && (
          <div className="flex items-center gap-1 bg-status-warning-bg border border-status-warning-text/25 rounded px-2 py-1 text-[9px] font-sans font-bold text-status-warning-text w-fit tracking-wide animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            Discount valid only for first 50 students!
          </div>
        )}

        {/* Guests see the per-file breakdown with locked affordance, mirroring what a logged-in student will get */}
        {status.type === 'guest' && (
          <div className="space-y-2">
            {pdfNames.map((name, idx) => (
              <div key={idx} className="bg-sunken border border-border-subtle rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-text-tertiary shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="text-[11px] font-sans font-semibold text-text-secondary truncate">{name}</span>
                </div>
                <button
                  onClick={() => onPurchase(course)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-surface-raised hover:bg-sunken border border-border-default text-text-tertiary hover:text-text-secondary rounded-lg text-[10px] font-sans font-bold transition-all cursor-pointer whitespace-nowrap"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Locked
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border-default pt-3 mt-4 md:pt-4 md:mt-6 flex items-center justify-between">
        <div>
          <span className="text-[8px] md:text-[9px] font-sans font-bold text-text-tertiary block uppercase tracking-wider">
            Price
          </span>
          {course.useDiscount ? (
            <div className="flex items-baseline gap-1">
              <span className="text-base md:text-xl font-sans font-extrabold text-brand tabular-nums">
                &#8377;{course.discountedPrice}
              </span>
              <span className="text-[9px] md:text-xs text-text-tertiary line-through tabular-nums">
                &#8377;{course.price}
              </span>
            </div>
          ) : (
            <span className="text-base md:text-xl font-sans font-extrabold text-text-primary tabular-nums">
              &#8377;{course.price || 499}
            </span>
          )}
        </div>

        {/* Status Render */}
        {status.type === 'purchased' ? (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-status-success-bg border border-status-success-text/25 text-status-success-text rounded-xl text-xs font-sans font-bold shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12" /></svg>
            Purchased
          </div>
        ) : status.type === 'pending' ? (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-status-warning-bg border border-status-warning-text/25 text-status-warning-text rounded-lg md:rounded-xl text-[9px] md:text-xs font-sans font-bold animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span className="hidden min-[350px]:inline">Pending Verification</span>
            <span className="min-[350px]:hidden">Pending</span>
          </div>
        ) : status.type === 'guest' ? (
          <button
            onClick={() => onPurchase(course)}
            className="px-2.5 py-1.5 md:px-4 md:py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg md:rounded-xl text-[10px] md:text-xs font-sans font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            <span className="hidden sm:inline">Sign In to Purchase</span>
            <span className="sm:hidden">Sign In</span>
          </button>
        ) : (
          <button
            onClick={() => onPurchase(course)}
            className="px-2.5 py-1.5 md:px-4 md:py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg md:rounded-xl text-[10px] md:text-xs font-sans font-bold transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-1 md:gap-1.5"
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
            className="w-full mt-3 px-3 py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-[10px] font-sans font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
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
