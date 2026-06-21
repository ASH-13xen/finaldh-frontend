export default function ComingSoon({ title, onBack }) {
  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-16 text-center">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-accent-950/50 border border-accent-900/50 flex items-center justify-center text-accent-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h2 className="text-xl font-extrabold text-slate-100 mb-2">{title} — Coming Soon</h2>
        <p className="text-sm text-slate-400 mb-6">We're polishing this section. Check back soon.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Back to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
