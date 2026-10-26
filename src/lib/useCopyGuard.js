import { useEffect } from 'react';

// Site-wide copy deterrent for everyone (admins included): no text selection, no
// copy / cut, no right-click menu, no dragging text or images out, no print /
// save-page / view-source shortcuts. Typing fields keep working normally, and
// anything inside `.allow-select` can still be selected (the "Add to notes"
// selection popup needs that) — but still not copied.
// This raises the effort; it cannot stop screenshots or a determined user with
// dev tools. The CSS half lives in index.css under `.no-copy`.
const editable = (el) => !!el?.closest?.('input, textarea, [contenteditable=""], [contenteditable="true"]');

export default function useCopyGuard(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const root = document.documentElement;
    root.classList.add('no-copy');

    const block = (e) => { if (!editable(e.target)) e.preventDefault(); };
    const blockAlways = (e) => e.preventDefault();
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      // print, save page, view source
      if (k === 'p' || k === 's' || k === 'u') e.preventDefault();
    };

    document.addEventListener('copy', block, true);
    document.addEventListener('cut', block, true);
    document.addEventListener('contextmenu', block, true);
    document.addEventListener('dragstart', blockAlways, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      root.classList.remove('no-copy');
      document.removeEventListener('copy', block, true);
      document.removeEventListener('cut', block, true);
      document.removeEventListener('contextmenu', block, true);
      document.removeEventListener('dragstart', blockAlways, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [enabled]);
}
