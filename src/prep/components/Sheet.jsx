// A panel over the page: slides in from the right on wide screens, up from the bottom on phones.
// Escape or the backdrop closes it; the page behind doesn't scroll while it is open.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../components/mcq/Icon';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion';
import { useT } from '../lib/i18n';

export default function Sheet({ onClose, label, children, wide = false }) {
  const { t, lang, hi } = useT();
  const panel = useRef(null);
  const backdrop = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    panel.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const phone = window.matchMedia('(max-width: 767px)').matches;
    gsap.from(backdrop.current, { autoAlpha: 0, duration: 0.35, ease: 'power1.out' });
    gsap.from(panel.current, phone ? { yPercent: 100, duration: 0.6 } : { xPercent: 100, duration: 0.65 });
  });

  return createPortal(
    <div lang={lang} className={`fixed inset-0 z-[120] ${hi ? 'prep-hi' : ''}`}>
      <div ref={backdrop} className="absolute inset-0 bg-[rgba(20,17,13,0.45)] backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`absolute outline-none bg-page text-text-primary shadow-2xl flex flex-col
          inset-x-0 bottom-0 h-[92vh] rounded-t-[2rem] border-t border-border-subtle
          md:inset-y-0 md:right-0 md:left-auto md:h-auto md:rounded-none md:rounded-l-[2rem] md:border-t-0 md:border-l ${wide ? 'md:w-[min(56rem,92vw)]' : 'md:w-[min(44rem,92vw)]'}`}
      >
        <div className="md:hidden mx-auto mt-3 w-10 h-1.5 rounded-full bg-border-default shrink-0" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          className="prep-focus absolute right-4 top-4 md:right-6 md:top-6 z-10 w-11 h-11 rounded-full bg-surface border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-primary cursor-pointer"
          aria-label={t('dd.close')}
        >
          <Icon name="x" className="w-5 h-5" />
        </button>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body
  );
}
