// Renders an Economy Master File topic body (blocks of styled spans, see EconomyTopic model)
// keeping the PDF's own emphasis: bold key terms, green/cyan highlights, ✅ / ❌ marks.
// `plain` drops the highlights for students who find them noisy.

const HL_CLASS = {
  g: 'bg-emerald-200/70 dark:bg-emerald-400/25 rounded-[3px] px-0.5 -mx-0.5 box-decoration-clone',
  c: 'bg-cyan-200/70 dark:bg-cyan-400/25 rounded-[3px] px-0.5 -mx-0.5 box-decoration-clone',
  y: 'bg-amber-200/80 dark:bg-amber-400/25 rounded-[3px] px-0.5 -mx-0.5 box-decoration-clone',
};

const BULLETS = ['•', '◦', '▪', '·'];

export function Spans({ spans, plain = false }) {
  return spans.map((s, i) => {
    if (s.m === 'ok') {
      return (
        <span key={i} title="Correct" className="inline-flex items-center justify-center w-4 h-4 mx-0.5 rounded-[4px] bg-emerald-500 text-white text-[10px] font-black align-[-2px]">✓</span>
      );
    }
    if (s.m === 'no') {
      return (
        <span key={i} title="Incorrect" className="inline-flex items-center justify-center w-4 h-4 mx-0.5 rounded-[4px] bg-red-500 text-white text-[10px] font-black align-[-2px]">✕</span>
      );
    }
    let node = s.t;
    if (s.b) node = <strong className="font-semibold text-text-primary">{node}</strong>;
    if (s.hl && !plain) node = <mark className={`${HL_CLASS[s.hl]} text-inherit`}>{node}</mark>;
    return <span key={i}>{node}</span>;
  });
}

export default function TopicBody({ blocks = [], plain = false, className = '' }) {
  if (!blocks.length) {
    return <p className={`text-sm text-text-tertiary italic ${className}`}>This topic is a table or chart in the PDF. Open the original page to see it.</p>;
  }
  return (
    <div className={`space-y-1.5 text-[15px] leading-relaxed text-text-secondary ${className}`}>
      {blocks.map((b, i) => {
        if (b.heading) {
          return (
            <p key={i} className="pt-2 text-xs font-bold uppercase tracking-wider text-brand">
              <Spans spans={b.spans} plain />
            </p>
          );
        }
        const pad = { paddingLeft: `${(b.level || 0) * 1.15}rem` };
        if (!b.glyph) return <p key={i} style={pad}><Spans spans={b.spans} plain={plain} /></p>;
        return (
          <div key={i} className="flex gap-2" style={pad}>
            <span aria-hidden="true" className="text-text-tertiary select-none w-2.5 flex-shrink-0 text-center">{BULLETS[b.level || 0] || '•'}</span>
            <p className="min-w-0 flex-1"><Spans spans={b.spans} plain={plain} /></p>
          </div>
        );
      })}
    </div>
  );
}
