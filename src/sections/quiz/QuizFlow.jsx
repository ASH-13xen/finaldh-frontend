import { useState } from 'react';
import QuizHome from './QuizHome';
import QuizRunner from './QuizRunner';
import QuizSummary from './QuizSummary';
import QuizHistory from './QuizHistory';

// One Question Bank's practice flow (subject passed in), reached from inside the MCQ Tests
// section (McqFlow). Owns home -> runner -> summary (+ history) as local state. Attempts are
// resumable server-side, so losing this state on remount never loses progress. `onExitToMcq`
// returns to the MCQ landing. Uses the app's Dark Horse theme (green/paper semantic tokens).

export default function QuizFlow({ subject, onExitToMcq }) {
  const SUBJECT = subject;
  const [screen, setScreen] = useState('home'); // 'home' | 'runner' | 'summary' | 'history'
  const [config, setConfig] = useState(null);   // { mode, topic?, size? }
  const [summaryAttemptId, setSummaryAttemptId] = useState(null);

  const startRun = (cfg) => { setConfig(cfg); setScreen('runner'); };

  return (
    <div className="min-h-[calc(100vh-73px)] bg-page text-text-primary">
      {screen === 'home' && (
        <QuizHome
          subject={SUBJECT}
          onStart={startRun}
          onOpenHistory={() => setScreen('history')}
          onExitToMcq={onExitToMcq}
        />
      )}

      {screen === 'runner' && config && (
        <QuizRunner
          subject={SUBJECT}
          config={config}
          onExit={() => { setConfig(null); setScreen('home'); }}
          onFinished={(attemptId) => { setSummaryAttemptId(attemptId); setScreen('summary'); }}
        />
      )}

      {screen === 'summary' && summaryAttemptId && (
        <QuizSummary
          attemptId={summaryAttemptId}
          onRetake={(cfg) => { setSummaryAttemptId(null); startRun(cfg); }}
          onBackToList={() => { setSummaryAttemptId(null); setConfig(null); setScreen('home'); }}
        />
      )}

      {screen === 'history' && (
        <QuizHistory
          subject={SUBJECT}
          onBack={() => setScreen('home')}
          onOpenAttempt={(attemptId) => { setSummaryAttemptId(attemptId); setScreen('summary'); }}
        />
      )}
    </div>
  );
}
