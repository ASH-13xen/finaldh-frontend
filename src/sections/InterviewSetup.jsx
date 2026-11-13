import { useEffect, useState } from 'react';
import Icon from '../components/mcq/Icon';
import { ActionButton, ErrorBanner } from '../components/mcq/ui';
import { Shell, PageHeader, Panel, SeatAvatar } from '../components/interview/ui';
import { iv, errorMessage } from '../lib/interviewApi';
import { useSpeaker, useBoardVoice, useMicLevel, speechRecognitionSupported, useRecorder } from '../lib/interviewSpeech';
import { usePresence, isPhone } from '../lib/interviewPresence';

// Used if the server does not send its list (it always should).
const FORMATS = [
  { key: 'quick', label: 'Quick drill', questions: 8, followUps: 4, about: 'about 10 minutes' },
  { key: 'standard', label: 'Standard board', questions: 14, followUps: 7, about: 'about 20 minutes' },
  { key: 'full', label: 'Full board', questions: 20, followUps: 10, about: 'about 30 minutes' }
];
const TEMPERAMENTS = [
  { key: 'cordial', label: 'Cordial', blurb: 'Encouraging. Puts you at ease and corrects gently.' },
  { key: 'standard', label: 'Standard', blurb: 'Business-like. Brief, firm when you are vague.' },
  { key: 'strict', label: 'Strict', blurb: 'A stress board. Sceptical, exacting, quick to challenge.' }
];
const FORMAT_ICON = { quick: 'zap', standard: 'users', full: 'gavel' };
const TEMPERAMENT_ICON = { cordial: 'heart', standard: 'user', strict: 'alert' };

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

// The camera stays on for the whole interview: the board takes note of eye contact and posture.
function CameraCheck() {
  const [on, setOn] = useState(false);
  const { status, live, attach } = usePresence(on);
  const note = status === 'starting' ? 'Starting your camera…'
    : status === 'ready' ? (live.face ? 'The board can see you. Sit like this.' : 'We can’t see your face. Face the screen, in good light.')
      : status === 'camera-only' ? 'Camera works. Reading body language could not start in this browser; the board will go by your answers only.'
        : status === 'denied' ? 'Camera access is blocked. Allow it from the camera icon in the address bar.'
          : status === 'no-camera' ? 'No camera found. The interview needs one.'
            : 'The camera stays on during the interview. Your video never leaves this device.';
  const good = status === 'ready' && live.face;
  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Icon name="video" className="w-4 h-4" /> Camera</div>
        <ActionButton size="sm" onClick={() => setOn((v) => !v)}>{on ? 'Stop test' : 'Test camera'}</ActionButton>
      </div>
      <div className="mt-3 flex items-center gap-3">
        {on && (
          <div className="w-24 h-[72px] rounded-xl overflow-hidden bg-sunken shrink-0">
            <video ref={attach} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
          </div>
        )}
        <p className={`text-xs leading-relaxed ${good ? 'text-brand font-semibold' : status === 'denied' || status === 'no-camera' ? 'text-status-danger-text font-semibold' : 'text-text-tertiary'}`}>{note}</p>
      </div>
    </div>
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
  const formats = status.formats?.length ? status.formats : FORMATS;
  const temperaments = status.temperaments?.length ? status.temperaments : TEMPERAMENTS;
  const [format, setFormat] = useState(() => (formats.some((f) => f.key === prefs.format) ? prefs.format : status.defaultFormat || 'standard'));
  const [temperament, setTemperament] = useState(() => (temperaments.some((t) => t.key === prefs.temperament) ? prefs.temperament : status.defaultTemperament || 'standard'));
  const [phone] = useState(isPhone);
  const [focus, setFocus] = useState(initialFocus || []);
  const [items, setItems] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const speaker = useSpeaker();
  const voice = useBoardVoice();
  const recorder = useRecorder();
  const canPlayVoice = speaker.supported || status.ai?.available;

  // The natural voice the board will use (when AI is on), otherwise the browser's.
  const playSample = async () => {
    voice.unlock();
    if (status.ai?.available) {
      try { await voice.play('sample:chairman', '/api/interview/voice-sample?asker=chairman'); return; } catch { /* fall back below */ }
    }
    speaker.speak('Good morning. Please have a seat. Shall we begin?', 'chairman');
  };
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
    writePrefs({ mode, inputMode, format, temperament });
    try {
      const { session } = await iv('/sessions', { method: 'POST', body: { mode, inputMode: effectiveInput, format, temperament, focus } });
      go({ screen: 'room', sessionId: session.id, initial: session }, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setStarting(false);
    }
  };

  const toggleFocus = (key) => setFocus((f) => (f.includes(key) ? f.filter((x) => x !== key) : [...f, key].slice(0, 6)));
  const chosen = formats.find((f) => f.key === format) || formats[1] || formats[0];
  const board = temperaments.find((t) => t.key === temperament) || temperaments[1] || temperaments[0];

  if (phone) {
    return (
      <Shell>
        <PageHeader onBack={onHome} eyebrow="Mock interview" title="Use a laptop or tablet" subtitle="The interview room needs a bigger screen and a camera that can see you, as the real board does." />
        <Panel className="p-6 text-sm text-text-secondary leading-relaxed">
          <p>Sign in on a laptop or tablet to take a mock interview. Everything else works here: fill in your DAF, go through your predicted questions, search the question bank and read your reports.</p>
          <div className="flex flex-wrap gap-2 mt-5">
            <ActionButton icon="edit" onClick={() => go({ screen: 'profile' })}>Your DAF</ActionButton>
            <ActionButton icon="sparkles" onClick={() => go({ screen: 'predictions' })}>Predicted questions</ActionButton>
          </div>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader onBack={onHome} eyebrow="Mock interview" title="Set up your interview" subtitle="Choose how you want to be interviewed. You can stop at any time and still get a report." />

      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-bold text-text-primary mb-3">Mode</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <OptionCard selected={mode === 'practice'} onClick={() => setMode('practice')} icon="book" title="Practice" text="See where each question came from, and quick feedback after every answer." />
            <OptionCard selected={mode === 'real'} onClick={() => setMode('real')} icon="gavel" title="Real interview" text="No hints and no feedback until the end, like the actual Personality Test." />
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

        <section>
          <h2 className="text-sm font-bold text-text-primary mb-3">Interview</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {formats.map((f) => (
              <OptionCard key={f.key} selected={format === f.key} onClick={() => setFormat(f.key)} icon={FORMAT_ICON[f.key] || 'users'} title={f.label} text={`${f.questions} questions, and up to ${f.followUps} follow-ups when your answers invite them. ${f.about[0].toUpperCase()}${f.about.slice(1)}.`} />
            ))}
          </div>
          <p className="text-xs text-text-tertiary mt-2">The real Personality Test usually runs 25–35 minutes. The Full board is closest to it.</p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-text-primary mb-3">The board</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {temperaments.map((t) => (
              <OptionCard key={t.key} selected={temperament === t.key} onClick={() => setTemperament(t.key)} icon={TEMPERAMENT_ICON[t.key] || 'user'} title={t.label} text={t.blurb} />
            ))}
          </div>
          <p className="text-xs text-text-tertiary mt-2">The board’s manner changes how it speaks to you, not how it marks you.</p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-text-primary mb-3">Check your setup</h2>
          <div className="grid md:grid-cols-2 gap-3 items-start">
            <CameraCheck />
            <div className="space-y-3">
              <div className="rounded-2xl border border-border-default bg-surface p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Icon name="volume" className="w-4 h-4" /> Board’s voice</div>
                <ActionButton size="sm" disabled={!canPlayVoice || voice.speaking || speaker.speaking} onClick={playSample}>
                  {speaker.speaking || voice.speaking ? 'Speaking…' : 'Play sample'}
                </ActionButton>
              </div>
              {effectiveInput === 'voice' && <MicCheck />}
              {!canPlayVoice && <p className="text-xs text-status-warning-text">This browser can’t speak the questions aloud; they will appear as text.</p>}
            </div>
          </div>
          <p className="text-xs text-text-tertiary mt-2 flex items-start gap-1.5">
            <Icon name="lock" className="w-3.5 h-3.5 mt-px shrink-0" />
            Your camera stays on for the whole interview, and the board takes note when you look away, read from notes or slouch. The video never leaves your device: only numbers like “faced the board 85% of the time” are saved.
          </p>
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
              <p className="text-sm font-bold text-text-primary">{chosen.label} · {chosen.questions} questions · {board.label.toLowerCase()} board · {mode === 'real' ? 'real interview' : 'practice'} · {effectiveInput === 'voice' ? 'spoken answers' : 'typed answers'}</p>
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
