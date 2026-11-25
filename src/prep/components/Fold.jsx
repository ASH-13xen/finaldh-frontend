// A section that folds, so a long page reads like a list of contents: its title and a one-line summary always
// show, and the content opens on a tap. Whether it is open is remembered in this browser per section (a
// convenience - it falls back to `defaultOpen` when storage is unavailable).
import { useState } from 'react';
import Icon from '../../components/mcq/Icon';

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
};

export default function Fold({ id, title, summary, icon, defaultOpen = false, size = 'md', className = '', children, tour }) {
  const key = `prep.fold.${id}`;
  const [open, setOpen] = useState(() => read(key, defaultOpen));
  const toggle = () => setOpen((o) => {
    try { localStorage.setItem(key, o ? '0' : '1'); } catch { /* storage blocked */ }
    return !o;
  });
  const titleCls = size === 'lg' ? 'text-2xl md:text-4xl' : 'text-xl md:text-3xl';
  return (
    <section className={className} data-tour={tour}>
      <button type="button" onClick={toggle} aria-expanded={open}
        className="prep-focus group w-full flex items-start gap-4 text-left py-4 md:py-5 border-b border-border-subtle cursor-pointer">
        {icon && <span className="mt-0.5 w-10 h-10 rounded-2xl bg-accent-soft-bg text-brand flex items-center justify-center shrink-0"><Icon name={icon} className="w-5 h-5" /></span>}
        <span className="flex-1 min-w-0">
          <span className={`block font-display ${titleCls} font-semibold tracking-tight text-text-primary group-hover:text-brand transition-colors`}>{title}</span>
          {summary && <span className="block mt-1 text-[15px] text-text-tertiary leading-snug">{summary}</span>}
        </span>
        <Icon name="chevronDown" className={`w-6 h-6 mt-2 shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pt-6">{children}</div>}
    </section>
  );
}
