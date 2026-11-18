// Interview Prep: the redesigned interview section (DAF -> predicted questions -> question bank -> practice).
// Screens are local state pushed onto browser history, so the phone's Back button walks through them.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastProvider } from '../components/Toast';
import { ErrorBanner } from '../components/mcq/ui';
import { iv, errorMessage } from '../lib/interviewApi';
import { INTERVIEW_SECTION_LIVE } from '../lib/features';
import { LangProvider, useT } from './lib/i18n';
import { PrepContext, SCREEN_KEYS } from './lib/context';
import Shell from './components/Shell';
import Home from './screens/Home';
import { usePrepStore } from './lib/usePrepStore';
import { api } from './lib/api';
import CreditsSheet from './components/credits/CreditsSheet';

const Predictions = lazy(() => import('./screens/Predictions'));
const Daf = lazy(() => import('./screens/Daf'));
const Bank = lazy(() => import('./screens/Bank'));
const Practice = lazy(() => import('./screens/Practice'));
const Insights = lazy(() => import('./screens/Insights'));
const MyPrep = lazy(() => import('./screens/MyPrep'));
const Notes = lazy(() => import('./screens/Notes'));


// Old deep links (interview_profile) and new ones (interview_daf) both work.
const ALIASES = { profile: 'daf' };
const toScreen = (s) => {
  const k = ALIASES[s] || s;
  return SCREEN_KEYS.includes(k) ? k : 'home';
};

function Loader() {
  const { t } = useT();
  return (
    <div className="prep-paper min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="relative flex w-4 h-4" aria-hidden="true">
        <span className="absolute inset-0 rounded-full bg-brand/40 animate-ping" />
        <span className="relative w-4 h-4 rounded-full bg-brand" />
      </span>
      <p className="font-display italic text-2xl text-text-primary">{t('section.title')}</p>
      <p className="text-sm text-text-tertiary">{t('common.loading')}</p>
    </div>
  );
}

function Flow({ user, initialScreen, onLogout, onExit }) {
  const { t } = useT();
  const [view, setView] = useState(() => {
    const saved = window.history.state?.prepView;
    return saved && SCREEN_KEYS.includes(saved.screen) ? saved : { screen: toScreen(initialScreen) };
  });
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [reload, setReload] = useState(0);
  const [profile, setProfile] = useState(null);
  const [profileTick, setProfileTick] = useState(0);
  const [credits, setCredits] = useState(null);
  const [creditsTick, setCreditsTick] = useState(0);
  const [creditsOpen, setCreditsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.credits().then((c) => { if (!cancelled) setCredits(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, [creditsTick]);
  const refreshCredits = useCallback(() => setCreditsTick((k) => k + 1), []);
  const openCredits = useCallback(() => setCreditsOpen(true), []);

  useEffect(() => {
    let cancelled = false;
    iv('/status')
      .then((s) => { if (!cancelled) { setStatus(s); setStatusError(null); } })
      .catch((err) => { if (!cancelled) setStatusError(err); });
    return () => { cancelled = true; };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    iv('/profile')
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setProfile({ empty: true, items: [] }); });
    return () => { cancelled = true; };
  }, [profileTick]);

  // Leaving the DAF screen reloads the DAF, so every other screen sees what was just saved.
  const current = useRef(view);
  const arrive = useCallback((v) => {
    if (current.current.screen === 'daf' && v.screen !== 'daf') setProfileTick((k) => k + 1);
    current.current = v;
    setView(v);
  }, []);

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), prepView: view }, '');
    const onPop = (e) => { if (e.state?.prepView) arrive(e.state.prepView); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // Only once: later views are pushed by go().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((next, { replace = false } = {}) => {
    const v = { ...next, screen: toScreen(next.screen) };
    arrive(v);
    const state = { ...(window.history.state || {}), prepView: v };
    if (replace) window.history.replaceState(state, '');
    else window.history.pushState(state, '');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [arrive]);

  // The navbar link, clicked while already in the section, returns to its start.
  useEffect(() => {
    const home = () => go({ screen: 'home' });
    window.addEventListener('interview:home', home);
    return () => window.removeEventListener('interview:home', home);
  }, [go]);

  const refreshProfile = useCallback(() => setProfileTick((k) => k + 1), []);
  const prep = usePrepStore();

  const showBanner = !INTERVIEW_SECTION_LIVE && !!user?.isAdmin;
  const banner = useMemo(() => (showBanner ? (
    <div className="bg-status-warning-bg border-b border-status-warning-text/30 text-status-warning-text text-xs font-semibold text-center px-4 py-2">
      {t('common.adminOnly')}
    </div>
  ) : null), [showBanner, t]);

  const ctx = useMemo(() => ({
    status, user, go, screen: view.screen, view, banner, prep, onLogout, onExit,
    credits, refreshCredits, openCredits,
    daf: { profile, refresh: refreshProfile }
  }), [status, user, go, view, banner, prep, profile, refreshProfile, onLogout, onExit, credits, refreshCredits, openCredits]);

  if (statusError) {
    return <div className="max-w-3xl mx-auto px-4 py-16"><ErrorBanner onRetry={() => setReload((k) => k + 1)}>{errorMessage(statusError, t('common.error'))}</ErrorBanner></div>;
  }
  if (!status) return <Loader />;

  let body;
  switch (view.screen) {
    case 'daf':
      body = <Daf />;
      break;
    case 'predictions':
      body = <Predictions />;
      break;
    case 'practice':
      body = <Practice key={view.question || ''} />;
      break;
    case 'insights':
      body = <Insights />;
      break;
    case 'me':
      body = <MyPrep />;
      break;
    case 'notes':
      body = <Notes key={view.note || ''} />;
      break;
    case 'bank':
      body = <Bank key={`${view.q || ''}:${view.tab || ''}`} />;
      break;
    default:
      body = <Home />;
  }

  return (
    <PrepContext.Provider value={ctx}>
      <Shell>
        <Suspense fallback={<div className="min-h-[50vh]" />}>{body}</Suspense>
      </Shell>
      {creditsOpen && <CreditsSheet credits={credits} onClose={() => setCreditsOpen(false)} onPaid={refreshCredits} />}
    </PrepContext.Provider>
  );
}

// Interview Prep runs in its own window (the site's navbar opens it in a new tab): onExit goes to the main
// website in this window, onLogout signs out.
export default function PrepFlow({ user, activeTab, onLogout, onExit }) {
  const initialScreen = String(activeTab || '').replace(/^interview_/, '');
  return (
    <ToastProvider>
      <LangProvider>
        <Flow user={user} initialScreen={initialScreen} onLogout={onLogout} onExit={onExit} />
      </LangProvider>
    </ToastProvider>
  );
}
