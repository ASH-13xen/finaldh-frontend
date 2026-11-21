// The frame around every Interview Prep screen. Interview Prep opens in its own window, so this is the only
// header: the Dark Horse logo, the five main tabs with a sliding ink pill (desktop), the AI-credit balance,
// the theme switch and an account menu (My DAF, My Prep, Insights, the main website, sign out). Phones get
// the same top bar plus a bottom tab bar.
import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { useTheme } from '../../contexts/ThemeContext';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion';
import { useT, HINDI_ENABLED } from '../lib/i18n';
import { usePrep, SCREENS, MOBILE_TABS } from '../lib/context';
import { LOGO } from '../lib/notes';
import CreditsPill from './credits/CreditsPill';

const NAV = SCREENS.filter((s) => s.nav);

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
      if (!pill) return;
      // Screens reached from the account menu (My DAF, My Prep, Insights) have no tab: hide the pill.
      if (!btn) { gsap.set(pill, { autoAlpha: 0 }); return; }
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
    <nav ref={navRef} aria-label={t('section.title')} className="relative hidden lg:flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      <span ref={pillRef} aria-hidden="true" className="invisible absolute left-0 top-1/2 -translate-y-1/2 h-10 rounded-full bg-text-primary" />
      {NAV.map((s) => {
        const active = s.key === screen;
        return (
          <button
            key={s.key}
            type="button"
            data-tab={s.key}
            onClick={() => go({ screen: s.key })}
            aria-current={active ? 'page' : undefined}
            className={`prep-focus relative z-10 h-10 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-300 cursor-pointer ${active ? 'text-page' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {t(s.long || s.label)}
          </button>
        );
      })}
    </nav>
  );
}

function MobileBar({ screen, go }) {
  const { t } = useT();
  return (
    <nav aria-label={t('section.title')} className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border-subtle bg-surface/92 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-[4.25rem]">
        {MOBILE_TABS.map((key) => {
          const s = SCREENS.find((x) => x.key === key);
          const active = key === screen;
          return (
            <button
              key={key}
              type="button"
              onClick={() => go({ screen: key })}
              aria-current={active ? 'page' : undefined}
              className={`prep-focus flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold cursor-pointer ${active ? 'text-brand' : 'text-text-tertiary'}`}
            >
              <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-300 ${active ? 'bg-accent-soft-bg' : ''}`}>
                <Icon name={s.icon} className="w-5 h-5" />
              </span>
              <span className="leading-none">{t(s.short || s.label)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ThemeButton() {
  const { t } = useT();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" onClick={toggleTheme} aria-label={t('acct.theme')} title={t('acct.theme')}
      className="prep-focus hidden sm:flex w-10 h-10 rounded-full border border-border-default bg-surface items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-primary cursor-pointer shrink-0">
      {dark
        ? <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
        : <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>}
    </button>
  );
}

function AccountMenu() {
  const { t } = useT();
  const { user, go, screen, onExit, onLogout } = usePrep();
  const { toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const to = (key) => { setOpen(false); go({ screen: key }); };
  const item = 'prep-focus w-full flex items-center gap-3 rounded-xl px-3 h-11 text-left text-[15px] font-semibold cursor-pointer hover:bg-sunken';
  const picture = user?.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || 'U')}`;
  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t('acct.menu')}
        className="prep-focus flex items-center gap-2 rounded-full border border-border-default bg-surface pl-1 pr-2.5 h-10 hover:border-text-primary cursor-pointer">
        <img src={picture} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        <Icon name="chevronDown" className={`w-4 h-4 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-border-default bg-surface shadow-[var(--prep-shadow-lift)] p-2">
          <div className="px-3 py-2.5 border-b border-border-subtle mb-1.5">
            <p className="font-semibold text-text-primary truncate">{user?.name || user?.fullName}</p>
            <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
          </div>
          {['daf', 'me', 'insights'].map((key) => {
            const s = SCREENS.find((x) => x.key === key);
            return (
              <button key={key} type="button" role="menuitem" onClick={() => to(key)} className={`${item} ${screen === key ? 'text-brand' : 'text-text-primary'}`}>
                <Icon name={s.icon} className="w-5 h-5" />{t(s.long || s.label)}
              </button>
            );
          })}
          {HINDI_ENABLED && <div className="px-3 py-2"><LangSwitch /></div>}
          {/* On phones the theme switch lives here (the header has no room for it). */}
          <button type="button" role="menuitem" onClick={() => { toggleTheme(); }} className={`${item} text-text-primary sm:hidden`}>
            <Icon name="sparkles" className="w-5 h-5" />{t('acct.theme')}
          </button>
          <div className="border-t border-border-subtle mt-1.5 pt-1.5">
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onExit?.(); }} className={`${item} text-text-primary`}>
              <Icon name="home" className="w-5 h-5" />{t('acct.main')}
            </button>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onLogout?.(); }} className={`${item} text-status-danger-text`}>
              <Icon name="logout" className="w-5 h-5" />{t('acct.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Shell({ children }) {
  const { screen, go, banner, user } = usePrep();
  const { t, lang, hi } = useT();
  const body = useRef(null);

  useGSAP(() => {
    if (!body.current || prefersReducedMotion()) return;
    gsap.fromTo(body.current, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, clearProps: 'transform' });
  }, { dependencies: [screen] });

  return (
    <div lang={lang} className={`prep-paper min-h-screen overflow-x-clip text-text-primary ${hi ? 'prep-hi' : ''}`}>
      {banner}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-page/85 backdrop-blur-xl supports-[backdrop-filter]:bg-page/70">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center gap-2 sm:gap-3 md:gap-5">
          <button type="button" onClick={() => go({ screen: 'home' })} className="prep-focus flex items-center gap-2.5 shrink-0 cursor-pointer rounded-xl min-w-0">
            <img src={LOGO} alt="" className="w-9 h-9 rounded-full object-cover border border-border-default" />
            <span className="flex flex-col items-start leading-none min-w-0">
              <span className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary">{t('section.kind')}</span>
              <span className="font-display italic text-lg md:text-xl font-semibold tracking-tight whitespace-nowrap sm:mt-1">{t('section.title')}</span>
            </span>
          </button>
          <div className="flex-1 min-w-0"><DesktopTabs screen={screen} go={go} /></div>
          <CreditsPill />
          <ThemeButton />
          {user && <AccountMenu />}{/* visitors get "Sign in" (CreditsPill) instead */}
        </div>
      </header>
      <div ref={body} className="prep-safe-bottom">{children}</div>
      <MobileBar screen={screen} go={go} />
    </div>
  );
}
