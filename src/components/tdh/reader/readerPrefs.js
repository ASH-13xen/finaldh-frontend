import { useEffect, useState, useSyncExternalStore } from 'react';

// Literata — the serif Google built for long-form screen reading (Play Books). Loaded only when
// this section mounts, so no other page pays for it or changes.
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&display=swap';
export function useReadingFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);
}

// Reader preferences, set on the section wrapper as CSS variables (see readerVars).
export const READER_SIZES = { sm: '1rem', md: '1.125rem', lg: '1.25rem' };
export const READER_FONTS = { serif: "'Literata', 'Source Serif 4', Georgia, serif", sans: "'Inter', system-ui, sans-serif" };
// width: 'wide' lets text use the whole column; 'focus' caps lines near 68 characters.
export const readerVars = ({ size = 'md', font = 'serif', width = 'wide' } = {}) => ({
  '--tdh-fs': READER_SIZES[size] || READER_SIZES.md,
  '--tdh-read-font': READER_FONTS[font] || READER_FONTS.serif,
  '--tdh-measure': width === 'focus' ? '68ch' : 'none',
});

/** True while the media query matches (e.g. '(min-width: 1024px)'). */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Height of the site's sticky top bar, so this section's sticky panel and jump links sit
 * below it instead of sliding underneath. Read-only: it only measures the navbar.
 */
export function useStickyTopOffset() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const bar = [...document.querySelectorAll('nav, header')].find((el) => {
      const cs = getComputedStyle(el);
      return (cs.position === 'sticky' || cs.position === 'fixed') && parseFloat(cs.top || '0') === 0;
    });
    if (!bar) return undefined;
    const measure = () => setH(bar.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);
  return h;
}
