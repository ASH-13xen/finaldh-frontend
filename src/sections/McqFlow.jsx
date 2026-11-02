import { useState, useEffect, useCallback } from 'react';
import McqSubjectsLanding from './McqSubjectsLanding';
import McqTestList from './McqTestList';
import McqStartSheet from './McqStartSheet';
import McqTestRunner from './McqTestRunner';
import McqAnalyzer from './McqAnalyzer';
import McqHistory from './McqHistory';
import McqFlagged from './McqFlagged';
import { ToastProvider, useToast } from '../components/Toast';
import { HelpModal, WelcomeTour } from '../components/mcq/HelpAndTour';
import { hasSeenTour } from '../lib/mcqTour';
import { mcq, errorMessage } from '../lib/mcqApi';

// Owns the subject -> tests -> start -> runner -> results flow as plain local state (there is no router
// in this app). Each screen change is also pushed onto the browser history, so the Back button walks
// back through the MCQ screens instead of jumping out to whatever tab the student came from.
// Attempts are resumable server-side, so losing this state on a refresh never loses work.
function Flow({ user }) {
  const toast = useToast();
  const [view, setView] = useState({ screen: 'home' });
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !hasSeenTour());

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), mcqView: { screen: 'home' } }, '');
    const onPop = (e) => { if (e.state?.mcqView) setView(e.state.mcqView); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((next) => {
    setView(next);
    window.history.pushState({ ...(window.history.state || {}), mcqView: next }, '');
    window.scrollTo({ top: 0 });
  }, []);

  // The navbar's "MCQ Tests" link, clicked while already in this area, brings the student back to the start.
  useEffect(() => {
    const home = () => go({ screen: 'home' });
    window.addEventListener('mcq:home', home);
    return () => window.removeEventListener('mcq:home', home);
  }, [go]);

  // Sessions built from the student's flagged questions / mistakes
  const startFlagged = async (subject) => {
    try {
      const data = await mcq('/practice/flagged', { method: 'POST', body: { subject: subject || undefined } });
      go({ screen: 'runner', attemptId: data.attemptId, subject: view.subject });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const startMistakes = async (attemptId) => {
    try {
      const data = await mcq('/practice/mistakes', { method: 'POST', body: { attemptId } });
      go({ screen: 'runner', attemptId: data.attemptId, subject: view.subject });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const backToTests = () => go(view.subject ? { screen: 'testList', subject: view.subject } : { screen: 'home' });

  let body;
  switch (view.screen) {
    case 'testList':
      body = (
        <McqTestList
          subject={view.subject}
          user={user}
          onBack={() => go({ screen: 'home' })}
          onStart={(test, mode) => go({ screen: 'start', subject: view.subject, test, mode })}
          onResume={(attemptId) => go({ screen: 'runner', attemptId, subject: view.subject })}
          onReview={(attemptId) => go({ screen: 'analyzer', attemptId, subject: view.subject })}
          onOpenFlagged={() => go({ screen: 'flagged', subject: view.subject })}
          onHelp={() => setHelpOpen(true)}
        />
      );
      break;
    case 'start':
      body = (
        <McqStartSheet
          test={view.test}
          initialMode={view.mode}
          onBack={() => go({ screen: 'testList', subject: view.subject })}
          onStarted={(attemptId) => go({ screen: 'runner', attemptId, subject: view.subject })}
        />
      );
      break;
    case 'runner':
      body = (
        <McqTestRunner
          key={view.attemptId}
          attemptId={view.attemptId}
          onExit={backToTests}
          onSubmitted={(attemptId) => go({ screen: 'analyzer', attemptId, subject: view.subject })}
        />
      );
      break;
    case 'analyzer':
      body = (
        <McqAnalyzer
          key={view.attemptId}
          attemptId={view.attemptId}
          onBack={backToTests}
          onViewHistory={() => go({ screen: 'history', subject: view.subject })}
          onPracticeMistakes={startMistakes}
          onOpenFlagged={() => go({ screen: 'flagged', subject: view.subject })}
        />
      );
      break;
    case 'history':
      body = (
        <McqHistory
          onBack={backToTests}
          onViewAttempt={(attemptId) => go({ screen: 'analyzer', attemptId, subject: view.subject })}
        />
      );
      break;
    case 'flagged':
      body = (
        <McqFlagged
          onBack={backToTests}
          onPractice={startFlagged}
        />
      );
      break;
    default:
      body = (
        <McqSubjectsLanding
          onOpenSubject={(subject) => go({ screen: 'testList', subject })}
          onResume={(attemptId) => go({ screen: 'runner', attemptId })}
          onOpenFlagged={() => go({ screen: 'flagged' })}
          onOpenHistory={() => go({ screen: 'history' })}
          onHelp={() => setHelpOpen(true)}
          onTour={() => setTourOpen(true)}
        />
      );
  }

  return (
    <>
      {body}
      {tourOpen && <WelcomeTour onClose={() => setTourOpen(false)} />}
      {helpOpen && (
        <HelpModal
          onClose={() => setHelpOpen(false)}
          onReplayTour={() => { setHelpOpen(false); setTourOpen(true); }}
        />
      )}
    </>
  );
}

export default function McqFlow({ user }) {
  return (
    <ToastProvider>
      <Flow user={user} />
    </ToastProvider>
  );
}
