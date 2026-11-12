// Renders an Economy Master File topic body (blocks of styled spans, see EconomyTopic model)
// keeping the PDF's own emphasis: bold key terms, green/cyan highlights, ✅ / ❌ marks.
// `plain` drops the highlights for students who find them noisy.

const HL_CLASS = {
  g: 'bg-emerald-200/70 dark:bg-emerald-400/25 rounded-[3px] px-0.5 -mx-0.5 box-decoration-clone',
  c: 'bg-cyan-200/70 dark:bg-cyan-400/25 rounded-[3px] px-0.5 -mx-0.5 box-decoration-clone',
  y: 'bg-amber-200/80 dark:bg-amber-400/25 rounded-[3px] px-0.5 -mx-0.5 box-decoration-clone',
};

const BULLETS = ['•', '◦', '▪', '·'];

// The PDF import sometimes cuts a highlight mid-word ("same directi|on", "long-|term").
// Grow every highlight to whole words by moving the cut-off letters into it.
const WORD_END = /[\p{L}\p{N}'’-]+$/u;
const WORD_START = /^[\p{L}\p{N}'’]+/u;
function snapHighlights(spans) {
  const out = spans.map((s) => ({ ...s }));
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i];
    const b = out[i + 1];
    if (a.m || b.m || !a.t || !b.t || !a.hl === !b.hl) continue;
    if (!/[\p{L}\p{N}'’-]$/u.test(a.t) || !/^[\p{L}\p{N}'’]/u.test(b.t)) continue;
    if (a.hl) {
      const piece = b.t.match(WORD_START)[0];        // highlight ends mid-word: pull the rest of the word in
      a.t += piece;
      b.t = b.t.slice(piece.length);
    } else {
      const piece = a.t.match(WORD_END)[0];          // highlight starts mid-word: pull its beginning in
      a.t = a.t.slice(0, -piece.length);
      b.t = piece + b.t;
    }
  }
  return out.filter((s) => s.m || s.t);
}

export function Spans({ spans, plain = false }) {
  return (plain ? spans : snapHighlights(spans)).map((s, i) => {
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
