import { useState } from 'react';
import Icon from '../components/mcq/Icon';
import { ActionButton, AttemptDots, Chip } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import { mcq, errorMessage } from '../lib/mcqApi';

const DEFAULT_TEST_INSTRUCTIONS = [
  'Every question has exactly 4 options — choose the best one.',
  'A countdown timer runs at the top. The test is submitted automatically when time runs out.',
  '“Save & Next” records your answer and moves on. “Mark for review” is a reminder for yourself, and “Clear” removes your choice.',
  'Use the question palette to jump to any question — its colours show what you have answered.',
  'Wrong answers carry negative marking; skipping a question costs nothing.',
  'You can leave and come back: your progress is saved, but the timer keeps running.',
  'Your detailed analysis appears as soon as you submit.'
];

function ModeCard({ selected, onSelect, icon, title, tone, bullets }) {
  const ring = tone === 'info' ? 'border-status-info-text bg-status-info-bg' : 'border-status-success-text bg-status-success-bg';
  const accent = tone === 'info' ? 'text-status-info-text' : 'text-status-success-text';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`text-left rounded-2xl border-2 p-5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${selected ? ring : 'border-border-default bg-surface hover:border-text-tertiary'}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className={`flex items-center gap-2 text-lg font-extrabold ${selected ? accent : 'text-text-primary'}`}>
          <Icon name={icon} className="w-5 h-5" /> {title}
        </span>
        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected ? 'border-current ' + accent : 'border-border-default'}`}>
          {selected && <span className="w-3 h-3 rounded-full bg-current" />}
        </span>
      </div>
      <ul className="space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-text-secondary leading-snug">
            <Icon name="check" className={`w-4 h-4 shrink-0 mt-0.5 ${accent}`} /> {b}
          </li>
        ))}
      </ul>
    </button>
  );
}

// Replaces the old wall-of-text instructions page: choose the mode, see what it costs, then begin.
export default function McqStartSheet({ test, initialMode, onBack, onStarted }) {
  const toast = useToast();
  const [mode, setMode] = useState(initialMode === 'practice' ? 'practice' : 'test');
  const [timerOn, setTimerOn] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const attempts = test.attempts || { used: 0, max: 2, remaining: 2 };
  const instructions = test.instructions?.length > 0 ? test.instructions : DEFAULT_TEST_INSTRUCTIONS;

  const start = async () => {
    setStarting(true);
    setError('');
    try {
      const data = await mcq(`/tests/${test._id}/start`, { method: 'POST', body: { mode, timerEnabled: timerOn } });
      if (data.resumed) toast.info('You already had an unfinished attempt, so we resumed it. This did not use another attempt.');
      onStarted(data.attemptId);
    } catch (err) {
      setError(errorMessage(err, 'Could not start the test.'));
      setStarting(false);
    }
  };

  const noAttempts = attempts.remaining <= 0;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col gap-6">
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-text-secondary hover:text-brand mb-3 cursor-pointer">
          <Icon name="arrowLeft" className="w-4 h-4" /> Back to tests
        </button>
        <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">{test.title}</h1>
        {test.description && <p className="text-base text-text-secondary mt-1.5">{test.description}</p>}
        <div className="flex flex-wrap gap-2 mt-4">
          <Chip><Icon name="clock" className="w-3 h-3" /> {test.durationMinutes} minutes</Chip>
          <Chip><Icon name="list" className="w-3 h-3" /> {test.questionCount} questions</Chip>
          <Chip>{test.totalMarks} marks</Chip>
          {test.negativeMarkingRatio > 0 ? <Chip tone="danger">−{test.negativeMarkingRatio} per wrong answer</Chip> : <Chip tone="success">No negative marking</Chip>}
        </div>
      </div>

      {/* What this will cost the student - said plainly before they commit */}
      <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${noAttempts ? 'bg-status-danger-bg border-status-danger-text/30' : 'bg-accent-soft-bg border-accent-soft-border'}`}>
        <AttemptDots used={attempts.used} max={attempts.max} />
        <div className="text-sm leading-relaxed text-text-secondary">
          {noAttempts ? (
            <p><b className="text-status-danger-text">You have used all {attempts.max} attempts for this test.</b> You can still review your past results and explanations from the test list.</p>
          ) : (
            <p>
              <b className="text-text-primary">You have {attempts.remaining} of {attempts.max} attempts left.</b> Starting either mode uses one — Test and Practice share the same attempts.
              If you leave part-way you can resume it; that does <b>not</b> use another attempt.
            </p>
          )}
        </div>
      </div>

      <section aria-label="Choose a mode">
        <h2 className="text-lg font-extrabold text-text-primary mb-3">How do you want to attempt it?</h2>
        <div role="radiogroup" aria-label="Mode" className="grid md:grid-cols-2 gap-4">
          <ModeCard
            selected={mode === 'test'} onSelect={() => setMode('test')} icon="clock" title="Test mode" tone="info"
            bullets={[`Timed: ${test.durationMinutes} minutes, submits automatically`, 'Answers are revealed only after you submit', 'Scored with negative marking and ranked against other students', 'Best for exam simulation']}
          />
          <ModeCard
            selected={mode === 'practice'} onSelect={() => setMode('practice')} icon="book" title="Practice mode" tone="success"
            bullets={['No time limit — go at your own pace', 'Check the answer and explanation after each question', 'Not ranked, so there is no pressure', 'Best for learning a topic']}
          />
        </div>

        {mode === 'practice' && (
          <div className="mt-4 flex items-start justify-between gap-4 bg-surface border border-border-default rounded-2xl px-5 py-4">
            <div>
              <p className="font-bold text-text-primary flex items-center gap-2"><Icon name="timer" className="w-4 h-4 text-brand" /> Timer</p>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed max-w-xl">
                <b>On</b> shows a running clock so you can see how long each question takes you. <b>Off</b> hides it for a calmer session — your time is still recorded in your results. You can switch it any time during practice.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={timerOn}
              aria-label="Timer"
              onClick={() => setTimerOn((v) => !v)}
              className={`shrink-0 flex items-center gap-2 rounded-full pl-2 pr-4 py-1.5 border-2 font-bold text-sm cursor-pointer transition-all ${timerOn ? 'bg-brand border-brand text-text-on-accent' : 'bg-surface border-border-default text-text-secondary'}`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${timerOn ? 'bg-text-on-accent/25' : 'bg-sunken'}`}>
                <Icon name={timerOn ? 'eye' : 'eyeOff'} className="w-3.5 h-3.5" />
              </span>
              {timerOn ? 'On' : 'Off'}
            </button>
          </div>
        )}
      </section>

      <section className="bg-surface border border-border-default rounded-2xl">
        <button onClick={() => setShowInstructions((v) => !v)} aria-expanded={showInstructions} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer">
          <span className="font-extrabold text-text-primary flex items-center gap-2"><Icon name="info" className="w-5 h-5 text-brand" /> Instructions &amp; question palette</span>
          <Icon name="chevronDown" className={`w-5 h-5 text-text-tertiary transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
        </button>
        {showInstructions && (
          <div className="px-5 pb-5 border-t border-border-default pt-4">
            <ol className="space-y-2.5">
              {instructions.map((line, i) => (
                <li key={i} className="flex gap-3 text-sm text-text-secondary leading-relaxed"><span className="text-brand font-extrabold">{i + 1}.</span>{line}</li>
              ))}
            </ol>
            <div className="mt-5 pt-4 border-t border-border-default">
              <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2">Palette colours</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary">
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-surface-raised border border-border-default" /> Not visited</span>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-status-danger-text" /> Seen, not answered</span>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-brand" /> Answered</span>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-status-info-text" /> Marked for review</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <label className="flex items-start gap-3 bg-surface border border-border-default rounded-2xl px-5 py-4 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-5 h-5 mt-0.5 accent-brand cursor-pointer" />
        <span className="text-sm text-text-secondary leading-relaxed">
          I understand that starting {mode === 'test' ? 'this test' : 'practice'} uses one of my attempts, and I have read the instructions.
        </span>
      </label>

      {error && <div className="p-4 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-sm font-semibold" role="alert">{error}</div>}

      <ActionButton size="lg" tone="primary" icon="play" className="w-full" disabled={!agreed || starting || noAttempts} onClick={start}>
        {starting ? 'Starting…' : `Start ${mode === 'test' ? 'Test' : 'Practice'}`}
      </ActionButton>
    </div>
  );
}
