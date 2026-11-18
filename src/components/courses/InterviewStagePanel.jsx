// The "Interview (PT)" tab on the course pages: what Interview Prep offers and a button into it (it opens in
// its own window), followed by any interview courses an admin has uploaded with the "Interview" stage.
const FEATURES = [
  ['Your DAF, read for you', 'Upload your DAF and see the questions boards actually ask people like you — ranked, with how often each was asked.'],
  ['3,147 real interviews', 'Every question from CSE 2020–2025, searchable by meaning, by DAF keyword and by board.'],
  ['Meet the boards', 'Each board’s habits: how much it asks from the DAF, how hard it follows up, and how candidates found it.'],
  ['Practice Studio', 'Answer aloud and see your pace, pauses and filler words; get AI feedback on tone and confidence.'],
  ['Write my answer', 'AI drafts answers from your own DAF, with the follow-ups to expect.'],
  ['Notes & the 100-question guide', 'Current topics with likely questions, and how to answer the questions asked most — as branded PDFs.']
];

export default function InterviewStagePanel({ guest, onOpen, children }) {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#14110d] text-[#f3ede2] px-6 py-10 md:px-12 md:py-14">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(55% 80% at 100% 0%, rgba(18,155,110,0.42), transparent 70%)' }} aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300">Interview · Personality Test</p>
          <h2 className="mt-4 font-display text-4xl md:text-6xl font-semibold leading-[1.04] tracking-tight">Walk into the board room knowing what they’ll ask.</h2>
          <p className="mt-5 text-lg text-white/75 leading-relaxed">Interview Prep turns six years of real UPSC interviews into your own preparation — from your DAF to the last practice round.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button type="button" onClick={onOpen} className="h-14 px-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-base font-semibold inline-flex items-center gap-2 cursor-pointer">
              {guest ? 'Sign in to start free' : 'Open Interview Prep'}
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
            </button>
            <span className="text-sm text-white/65">Free to start · 15 AI uses included · more from ₹299</span>
          </div>
        </div>
      </section>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map(([title, text]) => (
          <li key={title} className="bg-surface border border-border-default rounded-2xl p-5">
            <p className="font-display text-lg font-semibold text-text-primary">{title}</p>
            <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{text}</p>
          </li>
        ))}
      </ul>

      {children}
    </div>
  );
}
