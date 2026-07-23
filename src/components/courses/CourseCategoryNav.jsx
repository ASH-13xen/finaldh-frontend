import { useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion } from '../../lib/gsapSetup';

const chipClass = (active) =>
  `shrink-0 whitespace-nowrap text-xs sm:text-sm font-sans font-extrabold px-4 sm:px-5 py-2.5 sm:py-3 rounded-full border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.03] ${
    active
      ? 'bg-brand text-text-on-accent border-brand shadow-md scale-[1.02]'
      : 'bg-accent-soft-bg text-brand border-accent-soft-border hover:bg-accent-soft-border'
  }`;

export default function CourseCategoryNav({ hasMmf, hasCac, hasCombos, optionalCount, gsCoreCount }) {
  const [activeId, setActiveId] = useState(null);
  const navRef = useRef(null);
  const hasAnimated = useRef(false);

  const items = [
    gsCoreCount > 0 && { id: 'category-gscore', label: 'TCC - GS' },
    hasCombos && { id: 'category-combos', label: 'TCC- GS(Bundle and Save)' },
    optionalCount > 0 && { id: 'category-optional', label: 'TCC- Optionals' },
    hasMmf && { id: 'category-mmf', label: 'Mains Master File' },
    hasCac && { id: 'category-cac', label: 'Current Affairs Compass(Mains)' },
  ].filter(Boolean);

  // Entrance animation - runs once on first real mount (this component self-guards below,
  // so "mount" only happens once course data has actually loaded and there's something to show).
  useEffect(() => {
    if (hasAnimated.current || !navRef.current || items.length < 2) return;
    hasAnimated.current = true;
    if (prefersReducedMotion()) return;
    gsap.from(navRef.current, { opacity: 0, y: -8, duration: 0.35, ease: 'power2.out' });
  }, [items.length]);

  // Scrollspy: highlight whichever section is currently in view. Section elements live in
  // sibling components (CategorizedCourseGrid, the MMF/CAC banner wrappers) but are committed
  // to the DOM in the same paint as this component, so querying by id in an effect is safe.
  useEffect(() => {
    if (items.length < 2 || prefersReducedMotion()) return;
    const triggers = items
      .map(({ id }) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return ScrollTrigger.create({
          trigger: el,
          start: 'top 40%',
          end: 'bottom 40%',
          onEnter: () => setActiveId(id),
          onEnterBack: () => setActiveId(id),
        });
      })
      .filter(Boolean);
    return () => triggers.forEach((t) => t.kill());
  }, [items.map((i) => i.id).join('|')]);

  if (items.length < 2) return null;

  const handleClick = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={navRef} className="mb-8 md:mb-10 flex gap-2.5 sm:gap-3 overflow-x-auto md:flex-wrap pb-1.5 -mx-1 px-1">
      {items.map(({ id, label }) => (
        <button key={id} type="button" onClick={() => handleClick(id)} className={chipClass(activeId === id)}>
          {label}
        </button>
      ))}
    </div>
  );
}
