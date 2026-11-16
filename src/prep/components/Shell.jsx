// The frame around every Interview Prep screen: a sticky tab bar with a sliding ink pill (desktop), a
// bottom tab bar with a "More" sheet (phones), the English/Hindi switch, and a soft page transition.
import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion';
import { useT } from '../lib/i18n';
import { usePrep, SCREENS, MOBILE_TABS } from '../lib/context';

// The app's own navbar is sticky too; the section bar sits right under it.
function useAppNavHeight() {
  const [h, setH] = useState(64);
  useEffect(() => {
    const nav = document.querySelector('nav.sticky');
    if (!nav) return undefined;
    const ro = new ResizeObserver(() => setH(nav.offsetHeight));
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);
  return h;
}

export function LangSwitch({ className = '' }) {
  const { lang, setLang, t } = useT();
  const thumb = useRef(null);
  useGSAP(() => {
    gsap.to(thumb.current, { xPercent: lang === 'hi' ? 100 : 0, duration: prefersReducedMotion() ? 0 : 0.45 });
  }, { dependencies: [lang] });
  return (
    <div role="group" aria-label={t('lang.label')} className={`relative grid grid-cols-2 rounded-full border border-border-default bg-surface p-1 ${className}`}>
      <span ref={thumb} aria-hidden="true" className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-text-primary" />
      {['en', 'hi'].map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`prep-focus relative z-10 h-8 px-3.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${lang === l ? 'text-page' : 'text-text-secondary hover:text-text-primary'}`}
          lang={l}
        >
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  );
}

function DesktopTabs({ screen, go }) {
  const { t } = useT();
  const navRef = useRef(null);
  const pillRef = useRef(null);
  const placed = useRef(false);

  useGSAP(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    const place = (animate) => {
      const btn = nav?.querySelector(`[data-tab="${screen}"]`);
      if (!btn || !pill) return;
      const to = { x: btn.offsetLeft, width: btn.offsetWidth, autoAlpha: 1 };
      if (!animate || prefersReducedMotion()) gsap.set(pill, to);
      else gsap.to(pill, { ...to, duration: 0.55, ease: 'power3.out' });
    };
    place(placed.current);
    placed.current = true;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(nav);
    return () => ro.disconnect();
  }, { dependencies: [screen] });

  return (
    <nav ref={navRef} aria-label={t('section.title')} className="relative hidden md:flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      <span ref={pillRef} aria-hidden="true" className="invisible absolute left-0 top-1/2 -translate-y-1/2 h-10 rounded-full bg-text-primary" />
      {SCREENS.map((s) => {
        const active = s.key === screen;
        return (
          <button
            key={s.key}
            type="button"
            data-tab={s.key}
            disabled={!s.ready}
            onClick={() => go({ screen: s.key })}
            aria-current={active ? 'page' : undefined}
            className={`prep-focus relative z-10 h-10 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-300 ${active ? 'text-page' : s.ready ? 'text-text-secondary hover:text-text-primary cursor-pointer' : 'text-text-tertiary/70 cursor-default'}`}
          >
            {t(s.label)}
            {!s.ready && <span className="ml-1.5 align-middle text-[9px] font-extrabold uppercase tracking-wider text-text-tertiary">{t('common.soon')}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function MobileBar({ screen, go }) {
  const { t } = useT();
  const [more, setMore] = useState(false);
  const sheet = useRef(null);
  const rest = SCREENS.filter((s) => !MOBILE_TABS.includes(s.key));
  const inMore = rest.some((s) => s.key === screen);

  useGSAP(() => {
    if (!more || !sheet.current || prefersReducedMotion()) return;
    gsap.from(sheet.current, { yPercent: 100, duration: 0.5, ease: 'power3.out' });
  }, { dependencies: [more] });

  useEffect(() => {
    if (!more) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMore(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [more]);

  const open = (key) => { setMore(false); go({ screen: key }); };

  return (
    <>
      <nav aria-label={t('section.title')} className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border-subtle bg-surface/92 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6 h-[4.25rem]">
          {MOBILE_TABS.map((key) => {
            const s = SCREENS.find((x) => x.key === key);
            const active = key === screen;
            return (
              <button
                key={key}
                type="button"
                disabled={!s.ready}
                onClick={() => go({ screen: key })}
                aria-current={active ? 'page' : undefined}
                className={`prep-focus flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold ${active ? 'text-brand' : s.ready ? 'text-text-tertiary' : 'text-text-tertiary/50'}`}
              >
                <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-300 ${active ? 'bg-accent-soft-bg' : ''}`}>
                  <Icon name={s.icon} className="w-5 h-5" />
                </span>
                <span className="leading-none">{t(s.short || s.label)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-haspopup="dialog"
            className={`prep-focus flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold ${inMore ? 'text-brand' : 'text-text-tertiary'}`}
          >
            <span className={`flex items-center justify-center w-12 h-7 rounded-full ${inMore ? 'bg-accent-soft-bg' : ''}`}><Icon name="more" className="w-5 h-5" /></span>
            <span className="leading-none">{t('nav.more')}</span>
          </button>
        </div>
      </nav>

      {more && (
        <div className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" onClick={() => setMore(false)} role="presentation">
          <div
            ref={sheet}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.more')}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 inset-x-0 rounded-t-[2rem] bg-surface border-t border-border-subtle px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto w-10 h-1.5 rounded-full bg-border-default mb-5" />
            <div className="grid gap-2">
              {rest.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  disabled={!s.ready}
                  onClick={() => open(s.key)}
                  className={`prep-focus flex items-center gap-4 rounded-2xl px-4 h-14 text-left text-base font-semibold ${s.key === screen ? 'bg-accent-soft-bg text-brand' : 'text-text-primary'} ${s.ready ? 'cursor-pointer' : 'opacity-50'}`}
                >
                  <Icon name={s.icon} className="w-5 h-5" />
                  <span className="flex-1">{t(s.long || s.label)}</span>
                  {!s.ready && <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary">{t('common.soon')}</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-5 pt-5 border-t border-border-subtle">
              <span className="text-sm font-semibold text-text-secondary">{t('lang.label')}</span>
              <LangSwitch />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Shell({ children }) {
  const { screen, go, banner } = usePrep();
  const { t, lang, hi } = useT();
  const navH = useAppNavHeight();
  const body = useRef(null);

  useGSAP(() => {
    if (!body.current || prefersReducedMotion()) return;
    gsap.fromTo(body.current, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, clearProps: 'transform' });
  }, { dependencies: [screen] });

  return (
    <div lang={lang} className={`prep-paper min-h-[calc(100vh-64px)] text-text-primary ${hi ? 'prep-hi' : ''}`}>
      {banner}
      <div className="sticky z-40 border-b border-border-subtle bg-page/80 backdrop-blur-xl supports-[backdrop-filter]:bg-page/70" style={{ top: navH }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center gap-4 md:gap-6">
          <button type="button" onClick={() => go({ screen: 'home' })} className="prep-focus flex items-center gap-2 shrink-0 cursor-pointer rounded-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-brand shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)]" aria-hidden="true" />
            <span className="font-display italic text-lg md:text-xl font-semibold tracking-tight">{t('section.title')}</span>
          </button>
          <div className="flex-1 min-w-0"><DesktopTabs screen={screen} go={go} /></div>
          <LangSwitch />
        </div>
      </div>
      <div ref={body} className="prep-safe-bottom">{children}</div>
      <MobileBar screen={screen} go={go} />
    </div>
  );
}
