import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/mcq/Icon';
import { Modal, ActionButton } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { SeatAvatar, SourceChip } from '../components/interview/ui';
import { iv, upload, errorMessage, formatClock, wordCount, ASKER_LABEL } from '../lib/interviewApi';
import { useSpeaker, useBoardVoice, useDictation, useRecorder, useMicLevel, useCamera } from '../lib/interviewSpeech';

const SEATS = ['m1', 'm2', 'chairman', 'm3', 'm4'];
const PREF_KEY = 'interview:room';
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; } };
const writePrefs = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...readPrefs(), ...p })); } catch { /* private mode */ } };

// The current time, re-rendering once a second while `running` (drives both clocks in the room).
function useNow(running) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

function Seat({ asker, label, focus, active, speaking, thinking, level = 0 }) {
  return (
    <div className={`flex flex-col items-center text-center transition-all duration-300 ${active ? 'scale-100 opacity-100' : 'scale-90 opacity-55'} min-w-[64px] sm:min-w-[76px]`}>
      <span className="transition-transform duration-75" style={{ transform: `scale(${1 + level * 0.08})` }}>
        <SeatAvatar asker={asker} size={active ? 'stage' : 'md'} speaking={speaking} thinking={thinking} />
      </span>
      <p className={`mt-2.5 text-xs sm:text-sm font-bold ${active ? 'text-white' : 'text-white/70'}`}>{label}</p>
      {active && focus && <p className="hidden md:block text-[11px] text-white/50 mt-0.5 max-w-[150px] leading-snug">{focus}</p>}
    </div>
  );
}

function Orb({ level, state, onClick, disabled }) {
  const scale = 1 + Math.min(0.35, level * 0.6);
  const live = state === 'listening' || state === 'recording';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={live ? 'Pause listening' : 'Start answering'}
      className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50"
    >
      <span className={`absolute inset-0 rounded-full transition-transform duration-100 ${live ? 'bg-emerald-400/25' : 'bg-white/8'}`} style={{ transform: `scale(${live ? scale * 1.25 : 1})` }} />
      <span className={`absolute inset-2 rounded-full transition-transform duration-100 ${live ? 'bg-emerald-400/35' : 'bg-white/10'}`} style={{ transform: `scale(${live ? scale : 1})` }} />
      <span className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-xl ${live ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-white text-[#0b0f0d]'}`}>
        <Icon name={live ? 'pause' : 'mic'} className={`w-7 h-7 ${live ? 'text-white' : ''}`} />
      </span>
    </button>
  );
}

function CoachPanel({ turns }) {
  const answered = turns.filter((t) => t.answered);
  const last = answered[answered.length - 1];
  const f = last?.feedback;
  return (
    <aside className="rounded-3xl bg-white/[0.06] border border-white/10 p-5 text-white/90 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Coach</p>
      {!last ? (
        <p className="text-sm text-white/60 mt-3 leading-relaxed">Feedback on each answer appears here as you go. Look the board in the eye, take a breath, and lead with your main point.</p>
      ) : (
        <div className="mt-3 iv-rise" key={last.idx}>
          <p className="text-xs text-white/50">On: “{last.question.slice(0, 90)}{last.question.length > 90 ? '…' : ''}”</p>
          {f?.score != null && (
            <p className="mt-3 flex items-baseline gap-2"><span className="text-3xl font-bold text-white">{f.score.toFixed(1)}</span><span className="text-sm text-white/50">/ 10</span></p>
          )}
          {f?.verdict && <p className="text-sm text-white/85 mt-2 leading-relaxed">{f.verdict}</p>}
          {f?.strengths?.length > 0 && (
            <ul className="mt-3 space-y-1">{f.strengths.map((s, i) => <li key={i} className="text-sm text-white/75 flex gap-2"><Icon name="check" className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />{s}</li>)}</ul>
          )}
          {f?.improve?.length > 0 && (
            <ul className="mt-2 space-y-1">{f.improve.map((s, i) => <li key={i} className="text-sm text-white/75 flex gap-2"><Icon name="arrowRight" className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />{s}</li>)}</ul>
          )}
          {f?.betterAnswer && <p className="text-sm text-white/70 mt-3 leading-relaxed border-l-2 border-emerald-400/50 pl-3">{f.betterAnswer}</p>}
          {f?.pastNote && <p className="text-xs text-white/55 mt-3 leading-relaxed"><Icon name="quote" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{f.pastNote}</p>}
        </div>
      )}
      {answered.length > 1 && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-xs font-bold text-white/50 mb-2">So far</p>
          <ol className="space-y-1.5">
            {answered.slice(0, -1).reverse().map((t) => (
              <li key={t.idx} className="text-xs text-white/55 flex gap-2">
                <span className="font-bold text-white/70 w-6 shrink-0">{t.asker === 'chairman' ? 'CP' : t.asker.toUpperCase()}</span>
                <span className="flex-1 leading-snug">{t.question}</span>
                {t.feedback?.score != null ? <span className="font-bold text-white/80">{t.feedback.score}</span> : t.skipped ? <span className="text-white/40">passed</span> : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}

export default function InterviewRoom({ sessionId, initial, go }) {
  const toast = useToast();
  const [session, setSession] = useState(initial?.id === sessionId ? initial : null);
  const [loadError, setLoadError] = useState('');
  const [begun, setBegun] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | asking | answering | submitting | closing | finishing
  const [voiceOut, setVoiceOut] = useState(() => readPrefs().voiceOut ?? true);
  const [cameraOn, setCameraOn] = useState(() => readPrefs().camera ?? false);
  const [typing, setTyping] = useState(false); // voice mode: typing this one answer instead
  const [typed, setTyped] = useState('');
  const [answerStart, setAnswerStart] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [closingLine, setClosingLine] = useState('');

  const speaker = useSpeaker(); // the browser's built-in voices: the fallback
  const voice = useBoardVoice(); // natural voices streamed from the server when AI is on
  const [neural, setNeural] = useState(true);
  const dict = useDictation();
  const rec = useRecorder();
  const { attach: attachCamera, error: cameraError } = useCamera(cameraOn && begun);
  const listeningNow = dict.listening || rec.recording;
  const { level } = useMicLevel(listeningNow);
  const token = useRef(0);
  const textareaRef = useRef(null);

  const voiceMode = session?.inputMode === 'voice';
  const useNeural = neural && !!session?.aiUsed;
  const canSpeak = speaker.supported || useNeural;

  // Speaks a question (or the closing line) in its member's voice: the server's natural voice when
  // possible, the browser's otherwise. The first failure switches the rest of the interview to the fallback.
  const { play: playVoice, stop: stopNeuralVoice } = voice;
  const { speak: speakFallback, stop: stopFallbackVoice } = speaker;
  const say = useCallback(async (turnKey, text, asker) => {
    if (useNeural) {
      try {
        await playVoice(`${sessionId}:${turnKey}`, `/api/interview/sessions/${sessionId}/speech?turn=${turnKey}`);
        return;
      } catch {
        setNeural(false);
      }
    }
    await speakFallback(text, asker);
  }, [useNeural, playVoice, speakFallback, sessionId]);
  const stopVoices = useCallback(() => { stopNeuralVoice(); stopFallbackVoice(); }, [stopNeuralVoice, stopFallbackVoice]);
  const sttMode = voiceMode && dict.supported;
  const current = session?.current;

  useEffect(() => {
    if (session) return undefined;
    let cancelled = false;
    iv(`/sessions/${sessionId}`)
      .then(({ session: s }) => {
        if (cancelled) return;
        if (s.status !== 'in-progress') go({ screen: 'report', sessionId }, { replace: true });
        else setSession(s);
      })
      .catch((err) => { if (!cancelled) setLoadError(errorMessage(err)); });
    return () => { cancelled = true; };
  }, [session, sessionId, go]);

  // Ask the current question: speak it (if the board's voice is on), then open the floor.
  const ask = useCallback(async (turn) => {
    const my = ++token.current;
    dict.reset('');
    setTyped('');
    setTyping(false);
    setAnswerStart(null);
    if (voiceOut && canSpeak) {
      setPhase('asking');
      await say(turn.idx, turn.question, turn.asker);
      if (my !== token.current) return;
    }
    setPhase('answering');
    setAnswerStart(Date.now());
    if (session?.inputMode === 'voice' && dict.supported) dict.start();
    else if (session?.inputMode !== 'voice') setTimeout(() => textareaRef.current?.focus(), 50);
  }, [voiceOut, canSpeak, say, dict, session?.inputMode]);

  const currentIdx = current?.idx;
  useEffect(() => {
    if (!begun || currentIdx === undefined || !current) return;
    // Starting the speak -> listen sequence for a new question is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    ask(current);
    // Re-ask only when the question changes, not when `ask`'s dependencies do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [begun, currentIdx]);

  useEffect(() => () => { token.current += 1; speaker.stop(); dict.stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const now = useNow(begun && !!session);
  const answerSeconds = answerStart && phase === 'answering' ? Math.max(0, Math.floor((now - answerStart) / 1000)) : 0;
  const sessionLeft = session ? Math.max(0, Math.floor((new Date(session.endsAt).getTime() - now) / 1000)) : 0;

  const finish = useCallback(async () => {
    token.current += 1;
    stopVoices();
    dict.stop();
    setPhase('finishing');
    try {
      await iv(`/sessions/${sessionId}/end`, { method: 'POST' });
      go({ screen: 'report', sessionId }, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      setPhase('answering');
    }
  }, [sessionId, go, toast, stopVoices, dict]);

  const submit = async ({ skipped = false } = {}) => {
    if (!current || phase === 'submitting') return;
    let text;
    if (voiceMode && !typing) {
      if (rec.recording) { toast.info('Stop the recording first.'); return; }
      text = sttMode ? dict.stop() : typed;
    } else {
      text = typed;
    }
    if (!skipped && !text.trim()) { toast.info(voiceMode ? 'Say your answer first — or press Pass.' : 'Type your answer first — or press Pass.'); return; }
    token.current += 1;
    stopVoices();
    setPhase('submitting');
    try {
      const r = await iv(`/sessions/${sessionId}/answer`, {
        method: 'POST',
        body: { turnIdx: current.idx, answer: skipped ? '' : text.trim(), skipped, answerMode: voiceMode && !typing ? 'voice' : 'text', answerSeconds }
      });
      if (r.done) {
        setSession(r.session);
        setClosingLine(r.closing);
        setPhase('closing');
        if (voiceOut && canSpeak) await say('closing', r.closing, 'chairman');
        await finish();
        return;
      }
      setSession(r.session);
    } catch (err) {
      if (err.status === 409 && err.data?.session) {
        // Answered already (another tab, or a double click): carry on from where the server is.
        setSession(err.data.session);
        if (err.data.session.status !== 'in-progress') { go({ screen: 'report', sessionId }, { replace: true }); return; }
        if (err.data.session.current?.idx === current.idx) setPhase('answering');
        return;
      }
      toast.error(errorMessage(err));
      setPhase('answering');
      if (sttMode && !typing) dict.start();
    }
  };

  const toggleListening = async () => {
    if (phase !== 'answering') return;
    if (sttMode) {
      if (dict.listening) dict.stop();
      else { setTyping(false); dict.start(); }
      return;
    }
    // No speech recognition here: record, then have the server transcribe the clip.
    if (rec.recording) {
      const blob = await rec.stop();
      if (!blob?.size) return;
      setTranscribing(true);
      try {
        const { text } = await upload('/transcribe', 'audio', blob, 'answer.webm');
        setTyped((t) => `${t} ${text}`.trim());
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setTranscribing(false);
      }
    } else {
      try { await rec.start(); } catch { toast.error('Microphone access is blocked. Allow it in the address bar, or type your answer.'); }
    }
  };

  const switchToTyping = () => {
    const sofar = sttMode ? dict.stop() : typed;
    setTyped(sofar);
    setTyping(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const repeat = async () => {
    if (!current || phase !== 'answering' || !canSpeak) return;
    const wasListening = dict.listening;
    if (wasListening) dict.stop();
    await say(current.idx, current.question, current.asker);
    if (wasListening) dict.start();
  };

  const skipReading = () => {
    token.current += 1;
    stopVoices();
    setPhase('answering');
    setAnswerStart(Date.now());
    if (sttMode) dict.start();
  };

  const toggleVoiceOut = () => { setVoiceOut((v) => { writePrefs({ voiceOut: !v }); if (v) stopVoices(); return !v; }); };
  const toggleCamera = () => { setCameraOn((v) => { writePrefs({ camera: !v }); return !v; }); };

  if (loadError) {
    return (
      <div className="iv-stage min-h-[calc(100vh-73px)] flex items-center justify-center p-6">
        <div className="text-center text-white">
          <p className="text-lg font-bold">{loadError}</p>
          <button onClick={() => go({ screen: 'home' })} className="mt-4 text-emerald-300 font-bold hover:underline cursor-pointer">Back to Mock Interview</button>
        </div>
      </div>
    );
  }
  if (!session) return <div className="iv-stage min-h-[calc(100vh-73px)] flex items-center justify-center"><LoadingSpinner text="Preparing the board..." /></div>;

  const practice = session.mode === 'practice';
  const panel = Object.fromEntries(session.panel.map((p) => [p.id, p]));
  const activeAsker = phase === 'closing' ? 'chairman' : current?.asker || 'chairman';
  const liveText = typing || !sttMode ? typed : [dict.text, dict.interim].filter(Boolean).join(' ');
  const words = wordCount(liveText);
  const qNumber = (current?.idx ?? session.turns.length - 1) + 1;
  const timeUp = sessionLeft <= 0;

  return (
    <div className="iv-stage min-h-[calc(100vh-73px)] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${practice ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
            <Icon name={practice ? 'book' : 'gavel'} className="w-3.5 h-3.5" /> {practice ? 'Practice' : 'Real interview'}
          </span>
          <span className="text-sm text-white/60 truncate">Question {qNumber} <span className="text-white/35">of ~{session.progress.estimatedTotal}</span></span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${timeUp ? 'bg-rose-500/20 text-rose-300' : sessionLeft < 120 ? 'bg-amber-400/15 text-amber-300' : 'bg-white/8 text-white/80'}`} aria-label="Time left">
            <Icon name="clock" className="w-4 h-4" /> {formatClock(sessionLeft)}
          </span>
          <button onClick={toggleVoiceOut} className="p-2 rounded-full bg-white/8 hover:bg-white/15 cursor-pointer" title={voiceOut ? 'Mute the board' : 'Let the board speak'} aria-label={voiceOut ? 'Mute the board' : 'Let the board speak'}>
            <Icon name={voiceOut ? 'volume' : 'volumeOff'} className="w-4 h-4" />
          </button>
          <button onClick={toggleCamera} className="p-2 rounded-full bg-white/8 hover:bg-white/15 cursor-pointer" title={cameraOn ? 'Turn camera off' : 'See yourself (stays on your device)'} aria-label="Toggle camera">
            <Icon name={cameraOn ? 'video' : 'videoOff'} className="w-4 h-4" />
          </button>
          <button onClick={() => setConfirmEnd(true)} disabled={phase === 'finishing'} className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 hover:bg-rose-600 px-3.5 py-2 text-xs font-bold cursor-pointer disabled:opacity-60">
            <Icon name="phoneOff" className="w-4 h-4" /> <span className="hidden sm:inline">End</span>
          </button>
        </div>
      </div>

      <div className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 gap-6 ${practice ? 'lg:grid-cols-[1fr_340px]' : ''}`}>
        <div className="flex flex-col min-w-0">
          {/* The board */}
          <div className="overflow-x-auto pb-2">
            <div className="flex items-end gap-2 sm:gap-6 w-max mx-auto">
            {SEATS.map((a) => (
              <Seat
                key={a}
                asker={a}
                label={panel[a]?.label || ASKER_LABEL[a]}
                focus={panel[a]?.focus}
                active={a === activeAsker}
                speaking={a === activeAsker && (speaker.speaking || voice.speaking || phase === 'asking')}
                level={a === activeAsker ? voice.level : 0}
                thinking={phase === 'submitting' && a === activeAsker}
              />
            ))}
            </div>
          </div>

          {/* The question */}
          <div className="mt-6 sm:mt-8 mx-auto w-full max-w-3xl text-center">
            {phase === 'submitting' ? (
              <p className="text-white/60 text-lg py-6 flex items-center justify-center gap-2">
                The board is conferring
                <span className="inline-flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/70 iv-dot" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
              </p>
            ) : phase === 'closing' || phase === 'finishing' ? (
              <div className="iv-rise">
                <p className="font-display text-2xl sm:text-3xl leading-snug text-white">{closingLine || 'Thank you. That brings us to the end of your interview.'}</p>
                <p className="text-white/50 mt-4 flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-emerald-300 rounded-full animate-spin" /> Writing your report…</p>
              </div>
            ) : current ? (
              <div key={current.idx} className="iv-rise">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300/90 mb-3">{ASKER_LABEL[current.asker]}{current.source?.kind === 'followup' || current.source?.kind === 'generated' ? ' · follow-up' : ''}</p>
                <p className="font-display text-2xl sm:text-[2rem] leading-snug text-white">{current.question}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {practice && <SourceChip source={current.source} dark />}
                  {phase === 'asking' && (
                    <button onClick={skipReading} className="inline-flex items-center gap-1.5 rounded-xl bg-white/8 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 cursor-pointer">
                      <Icon name="chevronRight" className="w-3.5 h-3.5" /> Skip reading
                    </button>
                  )}
                  {phase === 'answering' && canSpeak && (
                    <button onClick={repeat} className="inline-flex items-center gap-1.5 rounded-xl bg-white/8 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 cursor-pointer">
                      <Icon name="repeat" className="w-3.5 h-3.5" /> Repeat the question
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Answer dock */}
          <div className="mt-auto pt-8">
            {timeUp && phase === 'answering' && (
              <p className="text-center text-sm text-amber-300 mb-3">Time is up — finish this answer and the board will close the interview.</p>
            )}
            <div className="relative rounded-3xl bg-white/[0.06] border border-white/10 p-4 sm:p-5 backdrop-blur">
              {cameraOn && begun && (
                <div className="hidden sm:block absolute -top-28 left-4 w-36 h-24 rounded-2xl overflow-hidden border border-white/15 bg-black shadow-xl">
                  {cameraError ? <p className="text-[11px] text-white/50 p-2">{cameraError}</p> : <video ref={attachCamera} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />}
                </div>
              )}

              {voiceMode && !typing ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <Orb level={level} state={dict.listening ? 'listening' : rec.recording ? 'recording' : 'idle'} onClick={toggleListening} disabled={phase !== 'answering' || transcribing} />
                    <span className="text-xs text-white/60 font-semibold">
                      {phase === 'asking' ? 'Listen to the question…' : transcribing ? 'Writing down your answer…' : dict.listening ? 'Listening' : rec.recording ? 'Recording' : phase === 'answering' ? 'Tap to speak' : ''}
                    </span>
                  </div>
                  <div className="flex-1 w-full min-w-0">
                    <div className="min-h-[88px] max-h-44 overflow-y-auto rounded-2xl bg-black/25 border border-white/8 px-4 py-3 text-[15px] leading-relaxed" aria-live="polite">
                      {liveText ? (
                        <><span className="text-white/90">{typing || !sttMode ? typed : dict.text}</span>{sttMode && dict.interim && <span className="text-white/45"> {dict.interim}</span>}</>
                      ) : (
                        <span className="text-white/35">{phase === 'answering' ? 'Your answer will appear here as you speak.' : '…'}</span>
                      )}
                    </div>
                    {dict.error && <p className="text-xs text-amber-300 mt-2">{dict.error}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                      <span className="text-xs text-white/45 tabular-nums">{phase === 'answering' ? `${formatClock(answerSeconds)} · ${words} words` : ''}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={switchToTyping} disabled={phase !== 'answering'} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-40">
                          <Icon name="keyboard" className="w-4 h-4" /> Type<span className="hidden sm:inline">&nbsp;instead</span>
                        </button>
                        <button onClick={() => submit({ skipped: true })} disabled={phase !== 'answering'} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white/80 bg-white/8 hover:bg-white/15 cursor-pointer disabled:opacity-40">Pass</button>
                        <button onClick={() => submit()} disabled={phase !== 'answering' || transcribing} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold whitespace-nowrap bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer disabled:opacity-40">
                          Finish answer <Icon name="arrowRight" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <textarea
                    ref={textareaRef}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
                    disabled={phase !== 'answering'}
                    rows={4}
                    placeholder={phase === 'answering' ? 'Type your answer as you would say it…' : 'Listen to the question…'}
                    className="w-full resize-y rounded-2xl bg-black/25 border border-white/10 focus:border-emerald-400/60 outline-none px-4 py-3 text-[15px] leading-relaxed text-white placeholder:text-white/35 disabled:opacity-60"
                    aria-label="Your answer"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                    <span className="text-xs text-white/45 tabular-nums">{phase === 'answering' ? `${formatClock(answerSeconds)} · ${words} words · Ctrl+Enter to send` : ''}</span>
                    <div className="flex items-center gap-2">
                      {voiceMode && (
                        <button onClick={() => { setTyping(false); if (sttMode) { dict.reset(typed); dict.start(); } }} disabled={phase !== 'answering'} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-40">
                          <Icon name="mic" className="w-4 h-4" /> Speak instead
                        </button>
                      )}
                      <button onClick={() => submit({ skipped: true })} disabled={phase !== 'answering'} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white/80 bg-white/8 hover:bg-white/15 cursor-pointer disabled:opacity-40">Pass</button>
                      <button onClick={() => submit()} disabled={phase !== 'answering'} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer disabled:opacity-40">
                        Send answer <Icon name="send" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {practice && <CoachPanel turns={session.turns} />}
      </div>

      {/* Begin overlay: also the click browsers need before they let the page speak */}
      {!begun && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="max-w-md text-center iv-rise">
            <div className="flex justify-center -space-x-2 mb-6">{['m1', 'm2', 'chairman', 'm3', 'm4'].map((a) => <SeatAvatar key={a} asker={a} size="md" />)}</div>
            <h2 className="font-display text-3xl font-bold text-white">The board is ready</h2>
            <p className="text-white/65 mt-3 leading-relaxed">
              {session.turns.length > 1 ? 'Picking up where you left off. ' : ''}
              {voiceMode ? 'The board will speak each question. Answer out loud — your words appear as you talk. Press “Finish answer” when you are done.' : 'Read each question and type your answer. Press Ctrl+Enter to send.'}
            </p>
            <button onClick={() => { voice.unlock(); setBegun(true); }} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-6 py-3.5 text-base font-bold text-white cursor-pointer shadow-xl">
              <Icon name="play" className="w-5 h-5" /> {session.turns.length > 1 ? 'Resume interview' : 'Begin interview'}
            </button>
            <p className="text-xs text-white/40 mt-4">{session.durationMinutes} minutes · {practice ? 'practice mode' : 'real mode'}{cameraOn ? ' · camera stays on your device' : ''}</p>
          </div>
        </div>
      )}

      {confirmEnd && (
        <Modal
          title="End the interview now?"
          onClose={() => setConfirmEnd(false)}
          footer={<><ActionButton onClick={() => setConfirmEnd(false)}>Keep going</ActionButton><ActionButton tone="danger" icon="phoneOff" onClick={() => { setConfirmEnd(false); finish(); }}>End and see report</ActionButton></>}
        >
          <p className="text-sm text-text-secondary pb-3">You’ll get a report on the {session.turns.filter((t) => t.answered).length} question(s) answered so far.</p>
        </Modal>
      )}
    </div>
  );
}
