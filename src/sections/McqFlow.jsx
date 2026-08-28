import { useState } from 'react';
import McqSubjectsLanding from './McqSubjectsLanding';
import McqTestList from './McqTestList';
import McqInstructions from './McqInstructions';
import McqTestRunner from './McqTestRunner';
import McqAnalyzer from './McqAnalyzer';
import McqHistory from './McqHistory';
import QuizFlow from './quiz/QuizFlow';

// Owns the subject -> test list -> instructions -> runner -> analyzer/history flow as plain
// local state, mirroring how DashboardSection already tracks PYQRecommender's selected course.
// startTest/getAttempt are resumable server-side, so losing this state on remount (e.g. the
// user re-clicks "MCQ Tests" in the Navbar) never loses an in-progress attempt.
export default function McqFlow({ user }) {
  const [screen, setScreen] = useState('subjects');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [activeAttemptId, setActiveAttemptId] = useState(null);

  if (screen === 'testList' && selectedSubject) {
    return (
      <McqTestList
        subject={selectedSubject}
        user={user}
        onSelectTest={(test) => { setSelectedTest(test); setScreen('instructions'); }}
        onBack={() => { setSelectedSubject(null); setScreen('subjects'); }}
      />
    );
  }

  if (screen === 'instructions' && selectedTest) {
    return (
      <McqInstructions
        test={selectedTest}
        onStart={(attemptId) => { setActiveAttemptId(attemptId); setScreen('runner'); }}
        onBack={() => setScreen('testList')}
      />
    );
  }

  if (screen === 'runner' && activeAttemptId) {
    return (
      <McqTestRunner
        attemptId={activeAttemptId}
        onSubmitted={(attemptId) => { setActiveAttemptId(attemptId); setScreen('analyzer'); }}
      />
    );
  }

  if (screen === 'analyzer' && activeAttemptId) {
    return (
      <McqAnalyzer
        attemptId={activeAttemptId}
        user={user}
        onBackToTests={() => { setActiveAttemptId(null); setScreen(selectedSubject ? 'testList' : 'subjects'); }}
        onViewHistory={() => setScreen('history')}
      />
    );
  }

  if (screen === 'history') {
    return (
      <McqHistory
        onBack={() => setScreen(selectedSubject ? 'testList' : 'subjects')}
        onViewAttempt={(attemptId) => { setActiveAttemptId(attemptId); setScreen('analyzer'); }}
      />
    );
  }

  // Geography practice quiz — reached from the "Practice" card on the subjects landing.
  if (screen === 'quizPractice') {
    return <QuizFlow onExitToMcq={() => setScreen('subjects')} />;
  }

  return (
    <McqSubjectsLanding
      onSelectSubject={(subject) => { setSelectedSubject(subject); setScreen('testList'); }}
      onSelectPractice={() => setScreen('quizPractice')}
      onViewHistory={() => setScreen('history')}
    />
  );
}
