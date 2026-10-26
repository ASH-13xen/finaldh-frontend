import { useState, useEffect, useRef, useCallback } from 'react';

// Wrap any readable text. When the student selects text inside it, a floating
// "＋ Add to notes" button appears above the selection; clicking it calls onAdd(text).
export default function SelectionToNote({ children, onAdd, className = '' }) {
  const boxRef = useRef(null);
  const [pop, setPop] = useState(null); // { text, top, left }

  const readSelection = useCallback(() => {
    const sel = window.getSelection?.();
    const box = boxRef.current;
    if (!sel || sel.isCollapsed || !box || sel.rangeCount === 0) { setPop(null); return; }
    if (!box.contains(sel.anchorNode) || !box.contains(sel.focusNode)) { setPop(null); return; }
    const text = sel.toString().trim();
    if (text.length < 3) { setPop(null); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setPop({
      text,
      top: Math.max(8, rect.top - 40),
      left: Math.min(window.innerWidth - 150, Math.max(8, rect.left + rect.width / 2 - 70)),
    });
  }, []);

  useEffect(() => {
    // mouseup/touchend/keyup cover every way a selection finishes; selectionchange clears it.
    const onDone = () => setTimeout(readSelection, 0);
    const onChange = () => { if (window.getSelection?.()?.isCollapsed) setPop(null); };
    const onScroll = () => setPop(null);
    document.addEventListener('mouseup', onDone);
    document.addEventListener('touchend', onDone);
    document.addEventListener('keyup', onDone);
    document.addEventListener('selectionchange', onChange);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mouseup', onDone);
      document.removeEventListener('touchend', onDone);
      document.removeEventListener('keyup', onDone);
      document.removeEventListener('selectionchange', onChange);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [readSelection]);

  return (
    <div ref={boxRef} className={`allow-select ${className}`}>
      {children}
      {pop && (
        <button
          type="button"
          // mousedown would collapse the selection before click fires
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onAdd(pop.text); setPop(null); window.getSelection?.()?.removeAllRanges(); }}
          style={{ position: 'fixed', top: pop.top, left: pop.left }}
          className="z-[55] bg-brand hover:bg-brand-hover text-text-on-accent text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl cursor-pointer whitespace-nowrap"
        >
          ＋ Add to notes
        </button>
      )}
    </div>
  );
}
