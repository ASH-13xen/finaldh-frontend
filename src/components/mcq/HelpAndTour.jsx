import { useState } from 'react';
import Icon from './Icon';
import { ActionButton, Modal } from './ui';

import { markTourSeen } from '../../lib/mcqTour';

const STEPS = [
  {
    icon: 'layers',
    title: 'Welcome to MCQ Practice',
    body: 'Pick a subject, choose a test, and get detailed feedback on where you are strong and where you need work. This 30-second tour explains how it works.'
  },
  {
    icon: 'clock',
    title: 'Two ways to attempt every test',
    body: null,
    custom: (
      <div className="grid sm:grid-cols-2 gap-3 mt-3 text-left">
        <div className="rounded-xl border border-status-info-text/30 bg-status-info-bg p-4">
          <p className="font-extrabold text-status-info-text flex items-center gap-2"><Icon name="clock" className="w-4 h-4" /> Take Test</p>
          <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">Timed, scored like the real exam. Answers are shown only after you submit. Counts towards ranking.</p>
        </div>
        <div className="rounded-xl border border-status-success-text/30 bg-status-success-bg p-4">
          <p className="font-extrabold text-status-success-text flex items-center gap-2"><Icon name="book" className="w-4 h-4" /> Practice</p>
          <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">No time limit. Check the answer and explanation after every question. A timer is optional.</p>
        </div>
      </div>
    )
  },
  {
    icon: 'target',
    title: 'Each test can be attempted twice',
    body: 'Test and Practice share the same 2 attempts per test (each test card shows how many you have left), so choose with care. Leaving mid-way never wastes an attempt — you can always resume. Reviewing answers afterwards is unlimited.'
  },
  {
    icon: 'bookmark',
    title: 'Flag it, report it, come back to it',
    body: 'Tap the bookmark on any question to save it to your Flagged list and practise those questions together later. See a wrong answer? Use Report — you can even suggest the right option and the team will review it.'
  }
];

export function WelcomeTour({ onClose }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const finish = () => { markTourSeen(); onClose(); };

  return (
    <Modal
      title=""
      onClose={finish}
      width="max-w-xl"
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
            {STEPS.map((_, idx) => <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-6 bg-brand' : 'w-1.5 bg-border-default'}`} />)}
          </span>
          {!last && <ActionButton tone="ghost" size="sm" onClick={finish}>Skip</ActionButton>}
          {i > 0 && <ActionButton tone="secondary" icon="arrowLeft" onClick={() => setI(i - 1)}>Back</ActionButton>}
          <ActionButton tone="primary" onClick={() => (last ? finish() : setI(i + 1))}>{last ? 'Got it — let’s start' : 'Next'}</ActionButton>
        </>
      }
    >
      <div className="text-center pb-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-accent-soft-bg border border-accent-soft-border text-brand flex items-center justify-center mb-4">
          <Icon name={step.icon} className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-display font-extrabold text-text-primary">{step.title}</h3>
        {step.body && <p className="text-base text-text-secondary mt-2.5 leading-relaxed">{step.body}</p>}
        {step.custom}
      </div>
    </Modal>
  );
}

const SHORTCUTS = [
  ['A B C D  or  1 2 3 4', 'Choose an option'],
  ['←  →', 'Previous / next question'],
  ['Enter', 'Save & next  (Practice: check answer)'],
  ['M', 'Mark for review'],
  ['F', 'Flag (bookmark) for later'],
  ['R', 'Report this question']
];

export function HelpModal({ onClose, onReplayTour }) {
  return (
    <Modal title="How MCQ Practice works" onClose={onClose} width="max-w-2xl" footer={<ActionButton tone="primary" onClick={onClose}>Close</ActionButton>}>
      <div className="space-y-6 pb-4 text-sm text-text-secondary leading-relaxed">
        <section>
          <h3 className="font-extrabold text-text-primary text-base mb-2">Test mode vs Practice mode</h3>
          <div className="overflow-x-auto rounded-xl border border-border-default">
            <table className="w-full text-left">
              <thead className="bg-sunken text-text-primary text-xs uppercase tracking-wide">
                <tr><th className="px-3 py-2"></th><th className="px-3 py-2">Test</th><th className="px-3 py-2">Practice</th></tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr><td className="px-3 py-2 font-semibold text-text-primary">Timer</td><td className="px-3 py-2">Countdown, auto-submits</td><td className="px-3 py-2">Optional stopwatch (you choose)</td></tr>
                <tr><td className="px-3 py-2 font-semibold text-text-primary">Answers</td><td className="px-3 py-2">After you submit</td><td className="px-3 py-2">Check after each question</td></tr>
                <tr><td className="px-3 py-2 font-semibold text-text-primary">Ranking</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">No</td></tr>
                <tr><td className="px-3 py-2 font-semibold text-text-primary">Uses an attempt</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">Yes</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="font-extrabold text-text-primary text-base mb-2">Attempts</h3>
          <p>Every test can be started <b>2 times in total</b> (the test card shows your exact allowance) — Test and Practice share the same attempts. If you leave in the middle, you can resume the same attempt and it does not use another one. After both attempts you can still open your results, read every explanation and use your Flagged questions as often as you like.</p>
        </section>

        <section>
          <h3 className="font-extrabold text-text-primary text-base mb-2">Flag vs Mark for review</h3>
          <ul className="space-y-1.5 list-disc pl-5">
            <li><b className="text-text-primary">Mark for review</b> (<Icon name="flag" className="w-3.5 h-3.5 inline -mt-0.5" />) is only for the attempt you are in — “I want to look at this again before I submit”.</li>
            <li><b className="text-text-primary">Flag</b> (<Icon name="bookmark" className="w-3.5 h-3.5 inline -mt-0.5" />) saves the question to your <b>Flagged</b> list permanently, so you can practise all your flagged questions together later.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-extrabold text-text-primary text-base mb-2">Question palette colours</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold">
            <span className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-surface-raised border border-border-default" /> Not visited</span>
            <span className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-status-danger-text" /> Seen, not answered</span>
            <span className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-brand" /> Answered</span>
            <span className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-status-info-text" /> Marked for review</span>
          </div>
        </section>

        <section>
          <h3 className="font-extrabold text-text-primary text-base mb-2 flex items-center gap-2"><Icon name="keyboard" className="w-4 h-4" /> Keyboard shortcuts</h3>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt><kbd className="px-2 py-0.5 rounded-md bg-sunken border border-border-default text-xs font-mono text-text-primary">{k}</kbd></dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {onReplayTour && (
          <ActionButton tone="soft" icon="sparkles" onClick={onReplayTour}>Replay the quick tour</ActionButton>
        )}
      </div>
    </Modal>
  );
}
