import { useCallback, useEffect, useState } from 'react';
import { ToastProvider } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { ErrorBanner } from '../components/mcq/ui';
import InterviewHome from './InterviewHome';
import InterviewProfile from './InterviewProfile';
import InterviewPredictions from './InterviewPredictions';
import InterviewBank from './InterviewBank';
import InterviewSetup from './InterviewSetup';
import InterviewRoom from './InterviewRoom';
import InterviewReport from './InterviewReport';
import InterviewHistory from './InterviewHistory';
import { iv, errorMessage } from '../lib/interviewApi';
import { INTERVIEW_SECTION_LIVE } from '../lib/features';

const SCREENS = ['home', 'profile', 'predictions', 'bank', 'setup', 'room', 'report', 'history'];

// The Mock Interview section: DAF -> predicted questions -> question bank -> mock interview -> report.
// Like McqFlow, screens are local state pushed onto browser history so Back walks through them.
function Flow({ user, initialScreen }) {
  const [view, setView] = useState(() => ({ screen: SCREENS.includes(initialScreen) ? initialScreen : 'home' }));
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    iv('/status')
      .then((s) => { if (!cancelled) { setStatus(s); setStatusError(''); } })
      .catch((err) => { if (!cancelled) setStatusError(errorMessage(err, 'Could not load the interview section.')); });
    return () => { cancelled = true; };
  }, [reload]);

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), ivView: view }, '');
    const onPop = (e) => { if (e.state?.ivView) setView(e.state.ivView); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // Only once: later views are pushed by go().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((next, { replace = false } = {}) => {
    setView(next);
    const state = { ...(window.history.state || {}), ivView: next };
    if (replace) window.history.replaceState(state, '');
    else window.history.pushState(state, '');
    window.scrollTo({ top: 0 });
  }, []);

  // The navbar link, clicked while already in the section, returns to its start.
  useEffect(() => {
    const home = () => go({ screen: 'home' });
    window.addEventListener('interview:home', home);
    return () => window.removeEventListener('interview:home', home);
  }, [go]);

  if (statusError) {
    return <div className="max-w-3xl mx-auto px-4 py-16"><ErrorBanner onRetry={() => setReload((k) => k + 1)}>{statusError}</ErrorBanner></div>;
  }
  if (!status) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-73px)]"><LoadingSpinner text="Opening the interview room..." /></div>;
  }

  const home = () => go({ screen: 'home' });
  const common = { status, user, go, onHome: home };

  let body;
  switch (view.screen) {
    case 'profile':
      body = <InterviewProfile {...common} />;
      break;
    case 'predictions':
      body = <InterviewPredictions {...common} />;
      break;
    case 'bank':
      body = <InterviewBank {...common} initialQuery={view.q} />;
      break;
    case 'setup':
      body = <InterviewSetup {...common} focus={view.focus || []} />;
      break;
    case 'room':
      body = <InterviewRoom key={view.sessionId} {...common} sessionId={view.sessionId} initial={view.initial} />;
      break;
    case 'report':
      body = <InterviewReport key={view.sessionId} {...common} sessionId={view.sessionId} />;
      break;
    case 'history':
      body = <InterviewHistory {...common} />;
      break;
    default:
      body = <InterviewHome {...common} />;
  }

  return (
    <>
      {!INTERVIEW_SECTION_LIVE && user?.isAdmin && view.screen !== 'room' && (
        <div className="bg-status-warning-bg border-b border-status-warning-text/30 text-status-warning-text text-xs font-semibold text-center px-4 py-2">
          Admins only — students can’t see this section until INTERVIEW_SECTION_LIVE is switched on (lib/features.js and the backend’s environment).
        </div>
      )}
      {body}
    </>
  );
}

export default function InterviewFlow({ user, activeTab }) {
  const initialScreen = String(activeTab || '').replace(/^interview_/, '');
  return (
    <ToastProvider>
      <Flow user={user} initialScreen={initialScreen} />
    </ToastProvider>
  );
}
