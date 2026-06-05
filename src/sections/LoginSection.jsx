export default function LoginSection({ error, googleButtonRef }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl flex flex-col">
        <div className="flex items-center justify-center w-12 h-12 bg-indigo-950/40 border border-indigo-900/50 text-indigo-400 rounded-xl mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>

        <h1 className="text-2xl font-bold text-white leading-snug">Sign In</h1>
        <p className="text-sm text-slate-400 mt-2 font-medium">Welcome back. Authenticate securely with your Google account to access the gateway.</p>

        {error && (
          <div className="mt-5 p-3.5 bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs font-medium rounded-xl flex items-start gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{error}</span>
          </div>
        )}

        <div className="my-7">
          <div ref={googleButtonRef} className="w-full min-h-[44px] flex justify-center animate-pulse"></div>
        </div>

        <div className="border-t border-slate-800 pt-5 flex items-center justify-center text-[11px] font-semibold text-slate-500 uppercase tracking-widest gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-slate-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Secured Session
        </div>
      </div>
    </div>
  );
}
