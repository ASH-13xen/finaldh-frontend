import { useEffect, useRef } from 'react';
import Icon from '../mcq/Icon';
import { SEAT_STYLE } from './ui';

// A board member's notepad, opened by tapping the pad on the table (practice mode only). The feedback
// on each answer is written here in the member's hand. The paper keeps its own colours in both themes,
// like a real sheet would.
function Note({ turn, number }) {
  const f = turn.feedback || {};
  return (
    <li className="pb-5 mb-5 border-b border-dashed border-[#1f2a5a]/20 last:border-0 last:mb-0">
      <p className="text-[13px] leading-snug text-[#5a5546] font-display italic">
        <span className="not-italic font-bold text-[#8a7c55] mr-1.5">Q{number}.</span>
        {turn.question}
      </p>
      {turn.skipped ? (
        <p className="iv-hand iv-ruled text-[1.45rem] mt-2 text-[#1f2a5a]">{f.verdict || 'Passed.'}</p>
      ) : (
        <div className="relative mt-2">
          {f.score != null && (
            <span className="iv-hand iv-circled float-right ml-3 mt-1 px-3 py-0.5 text-[1.7rem] font-bold leading-none" aria-label={`Score ${f.score} out of 10`}>
              {Number(f.score).toFixed(1).replace(/\.0$/, '')}<span className="text-base">/10</span>
            </span>
          )}
          {f.verdict && <p className="iv-hand iv-ruled text-[1.45rem] text-[#1f2a5a]">{f.verdict}</p>}
        </div>
      )}
      {f.strengths?.length > 0 && (
        <ul className="iv-hand iv-ruled text-[1.3rem] text-[#1d5a3c] clear-both">
          {f.strengths.map((s, i) => <li key={i}><span aria-hidden="true">✓ </span>{s}</li>)}
        </ul>
      )}
      {f.improve?.length > 0 && (
        <ul className="iv-hand iv-ruled text-[1.3rem] text-[#a3342b] clear-both">
          {f.improve.map((s, i) => <li key={i}><span aria-hidden="true">→ </span>{s}</li>)}
        </ul>
      )}
      {f.betterAnswer && (
        <p className="iv-hand iv-ruled text-[1.3rem] text-[#1f2a5a] clear-both">
          <span className="underline decoration-[#b3392f] decoration-2 underline-offset-4">A stronger answer:</span> {f.betterAnswer}
        </p>
      )}
      {f.pastNote && (
        <p className="mt-3 text-xs leading-relaxed text-[#6b6450] clear-both flex gap-1.5">
          <Icon name="quote" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{f.pastNote}</span>
        </p>
      )}
    </li>
  );
}

export default function NotepadSheet({ panel, turns, memberId, unread = {}, onSelect, onClose, held = false }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const member = panel.find((p) => p.id === memberId) || panel[0];
  const answered = turns.filter((t) => t.answered);
  const notes = answered.filter((t) => t.asker === member.id);

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${member.label}’s notes`}>
      <div className="iv-sheet iv-paper w-full sm:max-w-xl max-h-[88%] short:max-h-[96%] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-[0_30px_80px_-10px_rgba(0,0,0,0.8)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-6 shrink-0 bg-[#b64538] shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]" />
        <div className="flex items-start justify-between gap-3 pl-12 pr-4 pt-4">
          <div className="min-w-0">
            <h2 className="iv-hand text-[2rem] font-bold leading-none text-[#1f2a5a]">{member.label}’s notes</h2>
            <p className="text-xs text-[#6b6450] mt-1.5 leading-snug">{member.focus}</p>
          </div>
          <button ref={closeRef} onClick={onClose} className="p-2 -mr-1 rounded-full text-[#5a5546] hover:bg-black/10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f2a5a]/50" aria-label="Close the notepad">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 pl-12 pr-4 pt-3 pb-3" role="tablist" aria-label="Board members">
          {panel.map((p) => {
            const count = answered.filter((t) => t.asker === p.id).length;
            const on = p.id === member.id;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={on}
                onClick={() => onSelect(p.id)}
                className={`relative shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors ${on ? 'bg-[#1f2a5a] border-[#1f2a5a] text-[#f6efd9]' : 'border-[#1f2a5a]/25 text-[#3a3f5a] hover:bg-[#1f2a5a]/10'}`}
              >
                <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${SEAT_STYLE[p.id]}`} />
                {p.label}
                <span className={on ? 'text-[#f6efd9]/70' : 'text-[#3a3f5a]/60'}>{count}</span>
                {unread[p.id] && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#b3392f] ring-2 ring-[#f6efd9]" aria-label="new note" />}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto pl-12 pr-5 pb-6 pt-2">
          {notes.length ? (
            <ol>{notes.map((t) => <Note key={t.idx} turn={t} number={answered.indexOf(t) + 1} />)}</ol>
          ) : (
            <p className="iv-hand iv-ruled text-[1.45rem] text-[#1f2a5a]/70 py-6">Nothing written yet. {member.label} hasn’t heard an answer from you so far.</p>
          )}
        </div>

        {held && (
          <p className="shrink-0 border-t border-[#1f2a5a]/15 bg-[#efe6cb] pl-12 pr-4 py-2.5 text-xs font-semibold text-[#5a5546] flex items-center gap-1.5">
            <Icon name="pause" className="w-3.5 h-3.5" /> The clock is paused while you read. Close the notepad to carry on.
          </p>
        )}
      </div>
    </div>
  );
}
