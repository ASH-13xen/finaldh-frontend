import { useEffect, useRef, useState } from 'react';
import { gsap, SplitText, prefersReducedMotion } from '../lib/gsapSetup';
import { detectInAppBrowser, externalBrowserLink, isIOS, isMobileDevice } from '../lib/inAppBrowser';

// Clipboard API first; app WebViews often refuse it, so fall back to the old select-and-copy trick
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      el.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
};

export default function LoginSection({ error, googleButtonRef }) {
  const headlineRef = useRef(null);
  const cardRef = useRef(null);
  // navigator.userAgent is static for the component's lifetime - a plain const is enough,
  // no need for useState/useEffect just to read it once.
  const inAppBrowser = detectInAppBrowser();
  const onMobile = isMobileDevice();
  const ios = isIOS(navigator.userAgent);
  const browserName = ios ? 'Safari' : onMobile ? 'Chrome' : 'your browser';
  const appName = inAppBrowser.label ? `${inAppBrowser.label}'s` : "this app's";
  const openLink = externalBrowserLink();
  const pageUrl = window.location.href;
  const [copied, setCopied] = useState(null); // null | 'ok' | 'failed'

  const handleCopyLink = async () => {
    setCopied((await copyText(pageUrl)) ? 'ok' : 'failed');
    setTimeout(() => setCopied(null), 4000);
  };

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline();
    let split;
    if (headlineRef.current) {
      split = new SplitText(headlineRef.current, { type: 'words' });
      gsap.set(split.words, { opacity: 0, y: 14 });
      tl.to(split.words, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power2.out' });
    }
    if (cardRef.current) {
      // fromTo (not from) — React StrictMode's dev-only double-invoke runs this effect
      // twice; gsap.from() would capture the card's already-zeroed current opacity (left
      // by the first, unkilled timeline) as its end-state, animating 0 -> 0 visibly static.
      tl.fromTo(cardRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, '-=0.15');
    }
    return () => {
      split?.revert();
      tl.kill();
    };
  }, []);

  return (
    <div className="min-h-screen bg-page text-text-primary flex flex-col lg:flex-row">
      {/* Left: editorial brand moment */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-16 lg:py-0 relative overflow-hidden">
        <span aria-hidden="true" className="hidden lg:block font-display absolute -top-10 -left-4 text-[14rem] leading-none text-brand/6 select-none pointer-events-none">&ldquo;</span>
        <div className="max-w-lg relative">
          <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-brand block mb-4">The Dark Horse UPSC</span>
          <h1 ref={headlineRef} className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-text-primary">
            Prepare with precision.
          </h1>
          <p className="mt-6 text-sm sm:text-base text-text-secondary font-medium max-w-md leading-relaxed">
            Topic-wise study guides, previous-year questions, and progress tracking — built around one goal: clearing the UPSC Civil Services Examination.
          </p>
        </div>
      </div>

      {/* Right: sign-in card */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 lg:py-0 bg-surface-raised lg:border-l border-border-default">
        <div ref={cardRef} className="w-full max-w-md bg-surface border border-border-default rounded-2xl p-8 shadow-xl flex flex-col">
          <div className="flex items-center justify-center w-12 h-12 bg-accent-soft-bg border border-accent-soft-border text-brand rounded-xl mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>

          <h2 className="font-display font-semibold text-2xl text-text-primary leading-snug">Sign In</h2>
          <p className="text-sm text-text-secondary mt-2 font-medium">Welcome back. Authenticate securely with your Google account to access the gateway.</p>

          {error && (
            <div className="mt-5 p-3.5 bg-status-danger-bg border border-status-danger-text/30 text-status-danger-text text-xs font-medium rounded-xl flex items-start gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
            </div>
          )}

          {inAppBrowser.detected && (
            <div className="mt-5 p-4 bg-status-warning-bg border border-status-warning-text/30 rounded-xl" role="alert">
              <div className="flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 mt-0.5 shrink-0 text-status-warning-text"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-primary leading-snug">Open this page in {browserName} to sign in</p>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed font-medium">
                    Google blocks sign-in inside {appName} built-in browser — that&apos;s why you see a blank white screen.
                  </p>
                </div>
              </div>

              <div className="mt-3.5 flex flex-col sm:flex-row gap-2">
                {openLink && (
                  <a
                    href={openLink}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg text-xs font-sans font-bold transition-all duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Open in {browserName}
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-surface border border-status-warning-text/30 text-status-warning-text hover:bg-status-warning-bg rounded-lg text-xs font-sans font-bold transition-all duration-200 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>{copied === 'ok' ? `Copied — paste it in ${browserName}` : 'Copy link'}</span>
                </button>
              </div>

              <p className="mt-3 text-[11px] text-text-secondary leading-relaxed font-medium">
                {ios ? (
                  <>Button not working? Tap <b className="text-text-primary">•••</b> at the top right and choose <b className="text-text-primary">Open in Safari</b>.</>
                ) : (
                  <>Button not working? Tap <b className="text-text-primary">⋮</b> at the top right and choose <b className="text-text-primary">Open in browser</b>.</>
                )}
                {' '}Or type this address in {browserName}:{' '}
                <span className="font-mono font-semibold text-text-primary break-all select-all">{pageUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
              </p>
              {copied === 'failed' && (
                <p className="mt-2 text-[11px] font-bold text-status-warning-text">Couldn&apos;t copy here — press and hold the address above to copy it.</p>
              )}
            </div>
          )}

          <div className="my-7">
            <div ref={googleButtonRef} className="w-full min-h-[44px] flex justify-center animate-pulse"></div>
          </div>

          {/* Detection can't catch every app's browser, so phones always get a way out */}
          {!inAppBrowser.detected && onMobile && (
            <p className="-mt-3 mb-6 text-[11px] text-text-tertiary text-center leading-relaxed font-medium">
              Blank white screen after tapping Sign in? You&apos;re in an app&apos;s built-in browser (Telegram, Instagram…).{' '}
              {openLink && (
                <>
                  <a href={openLink} className="font-bold text-brand underline underline-offset-2">Open in {browserName}</a>
                  {' or '}
                </>
              )}
              <button type="button" onClick={handleCopyLink} className="font-bold text-brand underline underline-offset-2 cursor-pointer">
                {copied === 'ok' ? 'link copied' : 'copy the link'}
              </button>
              {' '}into {browserName}.
            </p>
          )}

          <div className="border-t border-border-default pt-5 flex items-center justify-center text-[11px] font-sans font-semibold text-text-tertiary uppercase tracking-widest gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Secured Session
          </div>
        </div>
      </div>
    </div>
  );
}
