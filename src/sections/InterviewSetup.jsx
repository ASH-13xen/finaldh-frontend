import { useEffect, useState } from 'react';
import Icon from '../components/mcq/Icon';
import { ActionButton, ErrorBanner } from '../components/mcq/ui';
import { Shell, PageHeader, Panel, Segmented, SeatAvatar } from '../components/interview/ui';
import { iv, errorMessage } from '../lib/interviewApi';
import { useSpeaker, useMicLevel, speechRecognitionSupported, useRecorder } from '../lib/interviewSpeech';

const PREF_KEY = 'interview:setup';
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; } };
const writePrefs = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* private mode */ } };

function OptionCard({ selected, onClick, icon, title, text, disabled, note }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`text-left rounded-3xl border-2 p-5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        selected ? 'border-brand bg-accent-soft-bg shadow-md' : 'border-border-default bg-surface hover:border-text-tertiary'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${selected ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary'}`}>
          <Icon name={icon} className="w-5 h-5" />
        </span>
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-brand bg-brand' : 'border-border-default'}`}>
          {selected && <Icon name="check" className="w-3 h-3 text-text-on-accent" strokeWidth={3} />}
        </span>
      </div>
      <h3 className="text-base font-bold text-text-primary mt-4">{title}</h3>
      <p className="text-sm text-text-secondary mt-1 leading-relaxed">{text}</p>
      {note && <p className="text-xs text-status-warning-text mt-2 font-semibold">{note}</p>}
    </button>
  );
}

function MicCheck() {
  const [on, setOn] = useState(false);
  const { level, denied } = useMicLevel(on);
  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Icon name="mic" className="w-4 h-4" /> Microphone</div>
        <ActionButton size="sm" onClick={() => setOn((v) => !v)}>{on ? 'Stop test' : 'Test mic'}</ActionButton>
      </div>
      <div className="mt-3 flex items-end gap-1 h-8" aria-label="Microphone level">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className={`flex-1 rounded-sm transition-all duration-75 ${on && level * 24 > i ? 'bg-brand' : 'bg-border-default'}`} style={{ height: `${30 + ((i * 7) % 70)}%` }} />
        ))}
      </div>
      <p className="text-xs text-text-tertiary mt-2">{denied ? 'Microphone access was blocked — allow it from the address bar.' : on ? 'Say something — the bars should move.' : 'Check that the board will hear you.'}</p>
    </div>
  );
}

export default function InterviewSetup({ status, go, onHome, focus: initialFocus }) {
  const prefs = readPrefs();
  const [mode, setMode] = useState(prefs.mode || 'practice');
  const [inputMode, setInputMode] = useState(prefs.inputMode || 'voice');
  const [minutes, setMinutes] = useState(prefs.minutes || 20);
  const [focus, setFocus] = useState(initialFocus || []);
  const [items, setItems] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const speaker = useSpeaker();
  const recorder = useRecorder();
  const stt = speechRecognitionSupported();
  const canSpeakAnswers = stt || (recorder.supported && status.ai?.available);

  useEffect(() => {
    let cancelled = false;
    iv('/profile').then((d) => { if (!cancelled) setItems((d.items || []).filter((i) => !['intro', 'motivation'].includes(i.type))); }).catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  const effectiveInput = inputMode === 'voice' && !canSpeakAnswers ? 'text' : inputMode;

  const start = async () => {
    setStarting(true);
    setError('');
    writePrefs({ mode, inputMode, minutes });
    try {
      const { session } = await iv('/sessions', { method: 'POST', body: { mode, inputMode: effectiveInput, minutes, focus } });
      go({ screen: 'room', sessionId: session.id, initial: session }, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setStarting(false);
    }
  };

  const toggleFocus = (key) => setFocus((f) => (f.includes(key) ? f.filter((x) => x !== key) : [...f, key].slice(0, 6)));

  return (
    <Shell>
      <PageHeader onBack={onHome} eyebrow="Mock interview" title="Set up your interview" subtitle="Choose how you want to be interviewed. You can stop at any time and still get a report." />

      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-bold text-text-primary mb-3">Mode</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <OptionCard selected={mode === 'practice'} onClick={() => setMode('practice')} icon="book" title="Practice" text="See where each question came from, and quick feedback after every answer." />
            <OptionCard selected={mode === 'real'} onClick={() => setMode('real')} icon="gavel" title="Real interview" text="No hints, no feedback until the end. A clock runs, like the actual Personality Test." />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-text-primary mb-3">How you answer</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <OptionCard
              selected={effectiveInput === 'voice'}
              onClick={() => setInputMode('voice')}
              disabled={!canSpeakAnswers}
              icon="mic"
              title="Speak"
              text="The board speaks each question aloud and you answer out loud. Your words appear as you talk."
              note={!canSpeakAnswers ? 'Speaking answers needs Chrome, Edge or Safari in this browser for now.' : !stt ? 'Your recording is turned into text after you finish each answer.' : ''}
            />
            <OptionCard selected={effectiveInput === 'text'} onClick={() => setInputMode('text')} icon="keyboard" title="Type" text="Read the questions and type your answers. The board can still speak the questions if you like." />
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-bold text-text-primary mb-3">Length</h2>
            <Segmented value={minutes} onChange={setMinutes} options={[{ value: 10, label: '10 min' }, { value: 20, label: '20 min' }, { value: 30, label: '30 min' }]} ariaLabel="Interview length" />
            <p className="text-xs text-text-tertiary mt-2">The real Personality Test usually runs 25–35 minutes.</p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary mb-3">Check your setup</h2>
            <div className="space-y-3">
              <div className="rounded-2xl border border-border-default bg-surface p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Icon name="volume" className="w-4 h-4" /> Board’s voice</div>
                <ActionButton size="sm" disabled={!speaker.supported} onClick={() => speaker.speak('Good morning. Please have a seat. Shall we begin?', 'chairman')}>
                  {speaker.speaking ? 'Speaking…' : 'Play sample'}
                </ActionButton>
              </div>
              {effectiveInput === 'voice' && <MicCheck />}
              {!speaker.supported && <p className="text-xs text-status-warning-text">This browser can’t speak the questions aloud; they will appear as text.</p>}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-text-primary mb-1">Focus (optional)</h2>
          <p className="text-sm text-text-tertiary mb-3">Pick parts of your DAF for the board to dig into. Leave empty for a full interview.</p>
          {items === null ? null : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default p-4 text-sm text-text-secondary flex flex-wrap items-center justify-between gap-3">
              Without your DAF the board will ask general and current-affairs questions.
              <ActionButton size="sm" icon="edit" onClick={() => go({ screen: 'profile' })}>Add DAF</ActionButton>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {items.map((it) => {
                const on = focus.includes(it.key);
                return (
                  <button key={it.key} type="button" onClick={() => toggleFocus(it.key)} aria-pressed={on} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold cursor-pointer transition-colors ${on ? 'bg-brand border-brand text-text-on-accent' : 'bg-surface border-border-default text-text-secondary hover:border-brand hover:text-brand'}`}>
                    {on && <Icon name="check" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />}{it.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <Panel className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">{['chairman', 'm1', 'm2', 'm3', 'm4'].map((a) => <SeatAvatar key={a} asker={a} size="sm" />)}</div>
            <div>
              <p className="text-sm font-bold text-text-primary">{mode === 'real' ? 'Real interview' : 'Practice'} · {minutes} minutes · {effectiveInput === 'voice' ? 'spoken answers' : 'typed answers'}</p>
              <p className="text-xs text-text-tertiary mt-0.5">The Chairperson and four members are waiting{status.ai?.available ? '. AI will react to your answers and score them.' : '. Questions come from past transcripts; AI scoring is coming soon.'}</p>
            </div>
          </div>
          <ActionButton tone="primary" size="lg" icon="play" onClick={start} disabled={starting}>{starting ? 'Preparing the board…' : 'Enter the interview room'}</ActionButton>
        </Panel>
        {error && <ErrorBanner>{error}</ErrorBanner>}
      </div>
    </Shell>
  );
}
