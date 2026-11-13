import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/mcq/Icon';
import { Modal, ActionButton } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { SeatAvatar, SourceChip } from '../components/interview/ui';
import BoardStage from '../components/interview/BoardStage';
import NotepadSheet from '../components/interview/NotepadSheet';
import MarksFinale from '../components/interview/MarksFinale';
import { iv, upload, errorMessage, formatClock, wordCount, ASKER_LABEL } from '../lib/interviewApi';
import { useSpeaker, useBoardVoice, useDictation, useRecorder, useMicLevel } from '../lib/interviewSpeech';
import { useAmbientParallax, requestTiltPermission, isTouchDevice } from '../lib/interviewParallax';
import { usePresence, isPhone, speechStats } from '../lib/interviewPresence';

const SEATS = ['m1', 'm2', 'chairman', 'm3', 'm4'];
const PREF_KEY = 'interview:room';
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; } };
const writePrefs = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...readPrefs(), ...p })); } catch { /* private mode */ } };
const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Seconds left on the interview clock, as the server last reported it.
const secondsLeftOf = (s) => (typeof s?.secondsLeft === 'number'
  ? s.secondsLeft
  : Math.max(0, Math.round((new Date(s?.endsAt || 0).getTime() - Date.now()) / 1000)));

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

const requestNativeFullscreen = () => {
  const el = document.documentElement;
  try {
    const p = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    p?.catch?.(() => {});
  } catch { /* not allowed here: the in-page full view still applies */ }
};
const exitNativeFullscreen = () => {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      const p = (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      p?.catch?.(() => {});
    }
  } catch { /* already out */ }
};

// One seat in the simple (2D) room, used when 3D is unavailable or switched off.
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

function SimpleBoard({ panel, active, speaking, thinking, level, top, bottom, empty = false }) {
  return (
    <div className="iv-stage absolute inset-0 flex items-center justify-center" style={{ paddingTop: top, paddingBottom: bottom }}>
      <div className={`overflow-x-auto max-w-full px-3 pb-2 ${empty ? 'invisible' : ''}`}>
        <div className="flex items-end gap-2 sm:gap-6 w-max mx-auto">
          {SEATS.map((a) => (
            <Seat key={a} asker={a} label={panel[a]?.label || ASKER_LABEL[a]} focus={panel[a]?.focus} active={a === active} speaking={a === active && speaking} level={a === active ? level : 0} thinking={a === active && thinking} />
          ))}
        </div>
      </div>
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
      className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] short:w-12 short:h-12 rounded-full flex items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50"
    >
      <span className={`absolute inset-0 rounded-full transition-transform duration-100 ${live ? 'bg-emerald-400/25' : 'bg-white/8'}`} style={{ transform: `scale(${live ? scale * 1.22 : 1})` }} />
      <span className={`absolute inset-1.5 rounded-full transition-transform duration-100 ${live ? 'bg-emerald-400/35' : 'bg-white/10'}`} style={{ transform: `scale(${live ? scale : 1})` }} />
      <span className={`relative w-11 h-11 sm:w-[52px] sm:h-[52px] short:w-9 short:h-9 rounded-full flex items-center justify-center shadow-xl ${live ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-white text-[#0b0f0d]'}`}>
        <Icon name={live ? 'pause' : 'mic'} className={`w-6 h-6 short:w-5 short:h-5 ${live ? 'text-white' : ''}`} />
      </span>
    </button>
  );
}

// A round control in the room's top bar. `text` shows beside the icon on wider screens.
function BarButton({ icon, label, text, textFrom = 'md', onClick, on = false, disabled = false, tone = 'plain', badge = 0, busy = false }) {
  const wide = { md: ['md:px-3.5', 'hidden md:inline'], lg: ['lg:px-3.5', 'hidden lg:inline'] }[textFrom];
  const tones = {
    plain: on ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/50' : 'bg-white/10 hover:bg-white/20 text-white',
    warn: 'bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/50',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white'
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={on || undefined}
      className={`relative shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full h-9 min-w-9 ${text ? wide[0] : ''} text-xs font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${tones[tone]}`}
    >
      {busy ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name={icon} className="w-4 h-4" />}
      {text && <span className={`${wide[1]} whitespace-nowrap`}>{text}</span>}
      {badge > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-300 text-[#231a05] text-[10px] font-extrabold flex items-center justify-center">{badge}</span>}
    </button>
  );
}

export default function InterviewRoom({ sessionId, initial, go }) {
  const toast = useToast();
  const own = initial?.id === sessionId ? initial : null;
  const [session, setSession] = useState(own);
  const [clock, setClock] = useState(() => ({ left: own ? secondsLeftOf(own) : 0, at: Date.now() }));
  const [loadError, setLoadError] = useState('');
  const [begun, setBegun] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | asking | answering | submitting | closing | finishing | finale
  const [paused, setPaused] = useState(false);
  const [fullView, setFullView] = useState(false);
  const [voiceOut, setVoiceOut] = useState(() => readPrefs().voiceOut ?? true);
  const [showSelf, setShowSelf] = useState(() => readPrefs().self ?? true); // the camera always runs; this is only the preview
  const [phoneBlocked] = useState(isPhone);
  const [spoken, setSpoken] = useState(null); // { asker, text, mood, kind } a line the board is saying between questions
  const [headTrack, setHeadTrack] = useState(() => readPrefs().head ?? false);
  const [simple, setSimple] = useState(() => readPrefs().simple ?? prefersReducedMotion());
  const [stageFailed, setStageFailed] = useState(false);
  const [stageReady, setStageReady] = useState(false);
  const [typing, setTyping] = useState(false); // voice mode: typing this one answer instead
  const [typed, setTyped] = useState('');
  const [answerStart, setAnswerStart] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [closingLine, setClosingLine] = useState('');
  const [notesFor, setNotesFor] = useState(null); // member whose notepad is open
  const [unread, setUnread] = useState({});
  const [noteChip, setNoteChip] = useState(null); // { asker, score, key }
  const [marks, setMarks] = useState(null); // the finale's marks, once the report is in
  const [revealed, setRevealed] = useState([]);
  const [finaleDone, setFinaleDone] = useState(false);
  const [insets, setInsets] = useState({ top: 56, bottom: 230 });
  const [finaleInsets, setFinaleInsets] = useState({ top: 96, bottom: 170 });

  const speaker = useSpeaker(); // the browser's built-in voices: the fallback
  const voice = useBoardVoice(); // natural voices streamed from the server when AI is on
  const [neural, setNeural] = useState(true);
  const dict = useDictation();
  const rec = useRecorder();
  const listeningNow = dict.listening || rec.recording;
  const { level } = useMicLevel(listeningNow);
  const token = useRef(0);
  const textareaRef = useRef(null);
  const rootRef = useRef(null);
  const topRef = useRef(null);
  const bottomRef = useRef(null);
  const stageRef = useRef(null);
  const running = useRef(false); // whether the interview clock should be running right now
  const clockOps = useRef(Promise.resolve());
  const pausedFrom = useRef(null);
  const notesHeld = useRef(false);
  const chipTimer = useRef(0);
  const lastNudge = useRef(0);
  const voiceFailures = useRef(0);
  const interrupting = useRef(false);

  const voiceMode = session?.inputMode === 'voice';
  const useNeural = neural && !!session?.aiUsed;
  const canSpeak = speaker.supported || useNeural;
  const use3d = !simple && !stageFailed;
  const sessionLoaded = !!session;

  // The camera: on from the moment the room opens (it is needed to begin) until the marks are shown.
  const presence = usePresence(!phoneBlocked && sessionLoaded && phase !== 'finale');
  const { startAnswer, endAnswer, hold: holdPresence, calibrate, listen: listenPresence, status: camStatus, live: camLive, attach: attachCamera, retry: retryCamera } = presence;
  const cameraUsable = camStatus === 'camera-only' || (camStatus === 'ready' && camLive.face);

  // ---------------------------------------------------------------- voices

  // Speaks a line of the interview in its member's voice: the server's natural voice when possible, the
  // browser's otherwise. `query` names the line on the server (turn=3, turn=3&part=reaction, turn=closing).
  // One failed clip is spoken by the browser and the natural voice is tried again on the next line;
  // three failures in a row switch the rest of the interview to the browser's voice.
  const { play: playVoice, prefetch: prefetchVoice, stop: stopNeuralVoice } = voice;
  const { speak: speakFallback, stop: stopFallbackVoice } = speaker;
  const voiceUrl = useCallback((query) => `/api/interview/sessions/${sessionId}/speech?${query}`, [sessionId]);
  const say = useCallback(async (query, text, asker) => {
    if (useNeural) {
      try {
        await playVoice(`${sessionId}:${query}`, voiceUrl(query));
        voiceFailures.current = 0;
        return;
      } catch {
        voiceFailures.current += 1;
        if (voiceFailures.current >= 3) setNeural(false);
      }
    }
    await speakFallback(text, asker);
  }, [useNeural, playVoice, speakFallback, sessionId, voiceUrl]);
  // Everything this question will say starts downloading at once, so the lines follow without gaps.
  const linesOf = (turn) => [
    ...(turn.lead || []).map((l, i) => ({ query: `turn=${turn.idx}&part=lead&i=${i}`, text: l.text, asker: l.asker })),
    { query: `turn=${turn.idx}`, text: turn.question, asker: turn.asker }
  ];
  const prefetchTurn = (turn) => {
    if (!useNeural || !voiceOut || !turn) return;
    for (const l of linesOf(turn)) prefetchVoice(`${sessionId}:${l.query}`, voiceUrl(l.query));
  };
  const stopVoices = useCallback(() => { stopNeuralVoice(); stopFallbackVoice(); }, [stopNeuralVoice, stopFallbackVoice]);
  const sttMode = voiceMode && dict.supported;
  const current = session?.current;

  // ---------------------------------------------------------------- the clock

  // Pause / resume on the server, one request at a time so a quick pause-then-resume cannot cross over.
  // The reply's time is only trusted if it still matches what the room wants.
  const holdClock = useCallback((hold, reason) => {
    clockOps.current = clockOps.current
      .catch(() => {})
      .then(() => iv(`/sessions/${sessionId}/${hold ? 'pause' : 'resume'}`, { method: 'POST', body: { reason } }))
      .then((r) => {
        const s = r?.session;
        if (s && typeof s.secondsLeft === 'number' && !!s.paused === !running.current) setClock({ left: s.secondsLeft, at: Date.now() });
      })
      .catch(() => { /* an older server without pause: the room still pauses, the clock just keeps its own time */ });
  }, [sessionId]);

  const takeSession = useCallback((s) => {
    setSession(s);
    setClock({ left: secondsLeftOf(s), at: Date.now() });
  }, []);

  useEffect(() => {
    if (session) return undefined;
    let cancelled = false;
    iv(`/sessions/${sessionId}`)
      .then(({ session: s }) => {
        if (cancelled) return;
        if (s.status !== 'in-progress') go({ screen: 'report', sessionId }, { replace: true });
        else takeSession(s);
      })
      .catch((err) => { if (!cancelled) setLoadError(errorMessage(err)); });
    return () => { cancelled = true; };
  }, [session, sessionId, go, takeSession]);

  // The clock waits for "Begin": time spent reading the welcome screen is not interview time.
  useEffect(() => {
    if (sessionLoaded && !running.current) holdClock(true, 'begin');
  }, [sessionLoaded, holdClock]);

  // ---------------------------------------------------------------- asking and answering

  // Ask the current question: speak the lines before it and the question itself (if the board's voice
  // is on), then open the floor.
  const ask = useCallback(async (turn, { again = false } = {}) => {
    const my = ++token.current;
    interrupting.current = false;
    dict.reset('');
    setTyped('');
    setTyping(false);
    setAnswerStart(null);
    if (voiceOut && canSpeak) {
      setPhase('asking');
      const lines = again ? linesOf(turn).slice(-1) : linesOf(turn); // asked again after a pause: the question only
      // The first line streams as it is spoken; the ones after it download meanwhile so they follow without a gap.
      if (useNeural) for (const l of lines.slice(1)) prefetchVoice(`${sessionId}:${l.query}`, voiceUrl(l.query));
      for (const l of lines) {
        await say(l.query, l.text, l.asker);
        if (my !== token.current) return;
      }
    }
    setPhase('answering');
    setAnswerStart(Date.now());
    startAnswer();
    if (session?.inputMode === 'voice' && dict.supported) dict.start();
    else if (session?.inputMode !== 'voice' && !isTouchDevice()) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [voiceOut, canSpeak, say, dict, session?.inputMode, startAnswer, useNeural, prefetchVoice, sessionId, voiceUrl]);

  // What the member says after an answer ("That is from your own form..."), shown and spoken.
  const react = async (turn, my) => {
    const text = turn?.reaction?.text;
    if (!text) return;
    setSpoken({ asker: turn.asker, text, mood: turn.reaction.mood, kind: 'reaction' });
    setPhase('reacting');
    if (voiceOut && canSpeak) await say(`turn=${turn.idx}&part=reaction`, text, turn.asker);
    else await new Promise((resolve) => { setTimeout(resolve, Math.min(4500, 1400 + text.length * 40)); });
    if (my === token.current) setSpoken(null);
  };

  const currentIdx = current?.idx;
  useEffect(() => {
    if (!begun || currentIdx === undefined || !current) return;
    // Starting the speak -> listen sequence for a new question is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    ask(current);
    // Re-ask only when the question changes, not when `ask`'s dependencies do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [begun, currentIdx]);

  useEffect(() => () => {
    token.current += 1;
    speaker.stop();
    voice.stop();
    dict.stop();
    clearTimeout(chipTimer.current);
    exitNativeFullscreen();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ticking = begun && !paused && sessionLoaded && phase !== 'finishing' && phase !== 'finale';
  const now = useNow(ticking);
  const answerSeconds = answerStart && phase === 'answering' ? Math.max(0, Math.floor((now - answerStart) / 1000)) : 0;
  const sessionLeft = Math.max(0, Math.floor(ticking ? clock.left - Math.max(0, now - clock.at) / 1000 : clock.left));
  // Interviews run to a number of questions; the clock shows time spent. The allowance behind it only
  // matters for an interview left open, so it is mentioned when nearly used up.
  const elapsed = session ? Math.max(0, session.durationMinutes * 60 - sessionLeft) : 0;

  const toReport = useCallback(() => go({ screen: 'report', sessionId }, { replace: true }), [go, sessionId]);

  const finish = useCallback(async () => {
    token.current += 1;
    stopVoices();
    dict.stop();
    running.current = false;
    setPaused(false);
    setNotesFor(null);
    setNoteChip(null);
    setSpoken(null);
    endAnswer();
    setPhase('finishing');
    try {
      const { session: done } = await iv(`/sessions/${sessionId}/end`, { method: 'POST' });
      const m = done?.report?.marks;
      if (m?.members?.length) {
        setSession(done);
        setMarks(m);
        setPhase('finale');
      } else {
        toReport();
      }
    } catch (err) {
      toast.error(errorMessage(err));
      running.current = true;
      setPhase('answering');
    }
  }, [sessionId, toReport, toast, stopVoices, dict, endAnswer]);

  // The finale: the 3D room slides and flips real cards; the simple room turns them over on a timer.
  const finale3d = use3d && stageReady;
  useEffect(() => {
    if (phase !== 'finale' || !marks) return undefined;
    const reveal = (id) => setRevealed((r) => (r.includes(id) ? r : [...r, id]));
    const complete = () => setFinaleDone(true);
    if (finale3d && stageRef.current?.ready()) {
      stageRef.current.playFinale(marks.members, { onReveal: reveal, onDone: complete });
      return undefined;
    }
    const timers = SEATS.map((id, i) => setTimeout(() => reveal(id), 900 + i * 850));
    timers.push(setTimeout(complete, 900 + SEATS.length * 850 + 300));
    return () => timers.forEach(clearTimeout);
  }, [phase, marks, finale3d]);

  // A member has written something about the answer just given (practice mode).
  const noteArrived = (turn) => {
    if (!turn?.feedback || turn.skipped) return;
    setUnread((u) => ({ ...u, [turn.asker]: true }));
    setNoteChip({ asker: turn.asker, score: turn.feedback.score, key: turn.idx });
    clearTimeout(chipTimer.current);
    chipTimer.current = setTimeout(() => setNoteChip(null), 9000);
  };

  const submit = async ({ skipped = false, interrupted = false } = {}) => {
    if (!current || phase === 'submitting' || paused) return;
    let text;
    if (voiceMode && !typing) {
      if (rec.recording) { toast.info('Stop the recording first.'); return; }
      text = sttMode ? dict.stop() : typed;
    } else {
      text = typed;
    }
    if (!skipped && !interrupted && !text.trim()) { toast.info(voiceMode ? 'Say your answer first — or press Pass.' : 'Type your answer first — or press Pass.'); return; }
    const my = ++token.current;
    stopVoices();
    setPhase('submitting');
    const spokenAnswer = voiceMode && !typing;
    const measured = endAnswer();
    const speech = speechStats(text, answerSeconds, spokenAnswer);
    const behaviour = measured ? { ...measured, ...speech } : spokenAnswer ? { tracked: false, seconds: answerSeconds, ...speech } : null;
    try {
      const r = await iv(`/sessions/${sessionId}/answer`, {
        method: 'POST',
        body: { turnIdx: current.idx, answer: skipped ? '' : text.trim(), skipped, interrupted, answerMode: spokenAnswer ? 'voice' : 'text', answerSeconds, behaviour }
      });
      if (my !== token.current) return; // ended meanwhile
      const answered = r.session.turns.find((t) => t.idx === current.idx);
      noteArrived(answered);
      if (answered?.reaction?.mood && answered.reaction.mood !== 'neutral') stageRef.current?.setMood(answered.asker, answered.reaction.mood);
      prefetchTurn(r.session.current);
      await react(answered, my);
      if (my !== token.current) return;
      if (r.done) {
        takeSession(r.session);
        setClosingLine(r.closing);
        setPhase('closing');
        if (voiceOut && canSpeak) await say('turn=closing', r.closing, 'chairman');
        await finish();
        return;
      }
      takeSession(r.session);
    } catch (err) {
      if (err.status === 409 && err.data?.session) {
        // Answered already (another tab, or a double click): carry on from where the server is.
        takeSession(err.data.session);
        if (err.data.session.status !== 'in-progress') { toReport(); return; }
        if (err.data.session.current?.idx === current.idx) { setPhase('answering'); startAnswer(); }
        return;
      }
      toast.error(errorMessage(err));
      setPhase('answering');
      startAnswer();
      if (sttMode && !typing) dict.start();
    }
  };

  // The board cuts a long spoken answer short, as real boards do: the member says so, and the answer
  // so far is taken as given.
  const interrupt = async () => {
    if (!current?.interruptLine || interrupting.current) return;
    interrupting.current = true;
    const my = ++token.current;
    dict.stop(); // stop listening so the board's words are not taken down as the answer
    setSpoken({ asker: current.asker, text: current.interruptLine, mood: 'sceptical', kind: 'interrupt' });
    stageRef.current?.setMood(current.asker, 'sceptical');
    if (voiceOut && canSpeak) await say(`turn=${current.idx}&part=interrupt`, current.interruptLine, current.asker);
    else await new Promise((resolve) => { setTimeout(resolve, 2200); });
    if (my !== token.current) return;
    setSpoken(null);
    await submit({ interrupted: true });
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
    if (!current || phase !== 'answering' || !canSpeak || paused) return;
    const wasListening = dict.listening;
    if (wasListening) dict.stop();
    await say(`turn=${current.idx}`, current.question, current.asker);
    if (wasListening) dict.start();
  };

  const skipReading = () => {
    token.current += 1;
    stopVoices();
    setPhase('answering');
    setAnswerStart(Date.now());
    startAnswer();
    if (sttMode) dict.start();
  };
  // Cuts short what the member is saying after an answer; the next question follows.
  const skipLine = () => stopVoices();

  // ---------------------------------------------------------------- pause, full view, begin

  const canPause = begun && !paused && (phase === 'asking' || phase === 'answering');
  const pause = (reason) => {
    if (!canPause) return false;
    token.current += 1; // stops the question being read, if it is
    stopVoices();
    const wasListening = dict.listening;
    if (wasListening) dict.stop();
    if (rec.recording) toggleListening(); // keep what was recorded: stop and transcribe it
    pausedFrom.current = { phase, wasListening, at: Date.now() };
    running.current = false;
    setClock((c) => ({ left: Math.max(0, c.left - Math.max(0, Date.now() - c.at) / 1000), at: Date.now() }));
    setPaused(true);
    holdPresence(true);
    holdClock(true, typeof reason === 'string' ? reason : undefined);
    return true;
  };

  const resume = () => {
    if (!paused) return;
    const from = pausedFrom.current;
    pausedFrom.current = null;
    running.current = true;
    setClock((c) => ({ left: c.left, at: Date.now() }));
    setPaused(false);
    holdPresence(false);
    holdClock(false);
    if (from?.phase === 'asking' && current) { ask(current, { again: true }); return; }
    if (from) setAnswerStart((s) => (s ? s + (Date.now() - from.at) : s));
    if (from?.wasListening && sttMode && !typing) dict.start();
  };

  const enterFullView = () => { setFullView(true); requestNativeFullscreen(); };
  const exitFullView = () => { setFullView(false); exitNativeFullscreen(); };

  // Leaving the browser's fullscreen (Esc, or the system gesture) also leaves the room's full view.
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement) setFullView(false); };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // In full view the page behind must not scroll; Esc leaves it where the browser has no fullscreen of its own.
  useEffect(() => {
    if (!fullView) return undefined;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) setFullView(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = before; window.removeEventListener('keydown', onKey); };
  }, [fullView]);

  const begin = (full) => {
    if (!cameraUsable) return;
    if (camStatus === 'ready') calibrate(); // how the candidate sits and looks right now is "facing the board"
    voice.unlock(); // browsers only let a page speak after a click
    requestTiltPermission();
    if (full) enterFullView();
    running.current = true;
    setClock((c) => ({ left: c.left, at: Date.now() }));
    setBegun(true);
    holdClock(false);
  };

  // ---------------------------------------------------------------- notepads

  const openNotes = (id) => {
    setNotesFor(id);
    setUnread((u) => ({ ...u, [id]: false }));
    setNoteChip(null);
    if (pause('notes')) notesHeld.current = true; // reading the notes should not cost interview time
  };
  const closeNotes = () => {
    setNotesFor(null);
    if (notesHeld.current) { notesHeld.current = false; resume(); }
  };
  const selectNotes = (id) => { setNotesFor(id); setUnread((u) => ({ ...u, [id]: false })); };

  // ---------------------------------------------------------------- the 3D room

  const onMove = useCallback((x, y, gain) => stageRef.current?.setParallax(x, y, gain), []);
  useEffect(() => {
    listenPresence({
      onMove: (x, y) => { if (headTrack && use3d) stageRef.current?.setParallax(x, y, 1.25); },
      // Looking away for a while mid-answer: the member who asked taps their pen to bring them back.
      onAway: () => {
        if (Date.now() - lastNudge.current < 15000 || !current) return;
        lastNudge.current = Date.now();
        stageRef.current?.tell(current.asker, 'penTap');
      }
    });
  });
  const following = headTrack && camStatus === 'ready';
  useAmbientParallax(onMove, { enabled: use3d && !following });

  // The camera frames its subject in the space the bars leave free, so it needs their sizes.
  useEffect(() => {
    if (!sessionLoaded) return undefined;
    const measure = () => setInsets({ top: topRef.current?.offsetHeight || 0, bottom: bottomRef.current?.offsetHeight || 0 });
    const observer = new ResizeObserver(measure);
    if (topRef.current) observer.observe(topRef.current);
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [sessionLoaded]);

  // The room fills the screen below the site's navigation bar, whatever its height on this device.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const place = () => {
      if (el.dataset.full === 'true') return;
      el.style.setProperty('--iv-top', `${Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY))}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [sessionLoaded, fullView]);

  // A long answer: another member steals a look at their watch, and past the board's patience
  // (shorter on a strict board) a spoken answer is cut short.
  const activeForTells = current?.asker;
  const interruptAfter = session?.interruptAfter || 130;
  const watchAt = voiceMode ? Math.max(45, interruptAfter - 35) : 100;
  useEffect(() => {
    if (phase !== 'answering' || paused) return;
    if (answerSeconds === watchAt || answerSeconds === watchAt + 70) {
      const others = SEATS.filter((x) => x !== activeForTells);
      stageRef.current?.tell(others[answerSeconds === watchAt ? 1 : 2], 'watch');
    }
    // Cutting in is what this clock is for.
    if (voiceMode && sttMode && !typing && answerSeconds >= interruptAfter) interrupt();
    // interrupt reads the current turn itself; only the clock should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerSeconds]);

  const toggleVoiceOut = () => { setVoiceOut((v) => { writePrefs({ voiceOut: !v }); if (v) stopVoices(); return !v; }); };
  const toggleSelf = () => { setShowSelf((v) => { writePrefs({ self: !v }); return !v; }); };
  const toggleHead = () => { setHeadTrack((v) => { writePrefs({ head: !v }); if (v) onMove(0, 0, 1); return !v; }); };
  const toggleSimple = () => { setSimple((v) => { writePrefs({ simple: !v }); return !v; }); setStageReady(false); };

  if (phoneBlocked) {
    return (
      <div className="iv-stage min-h-[calc(100vh-73px)] flex items-center justify-center p-6">
        <div className="max-w-sm text-center text-white iv-rise">
          <span className="inline-flex w-14 h-14 rounded-full bg-white/10 items-center justify-center"><Icon name="video" className="w-6 h-6" /></span>
          <h2 className="font-display text-2xl font-bold mt-4">Open this on a laptop or tablet</h2>
          <p className="text-white/65 mt-2 leading-relaxed">The interview room needs a bigger screen and a camera that can see you, like the real board. Sign in on a laptop or tablet to take the interview — your DAF and predicted questions are already there.</p>
          <button onClick={() => go({ screen: 'home' })} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 px-5 py-3 text-sm font-bold cursor-pointer"><Icon name="arrowLeft" className="w-4 h-4" /> Back to Mock Interview</button>
        </div>
      </div>
    );
  }
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
  const labels = Object.fromEntries(session.panel.map((p) => [p.id, p.label]));
  const inFinale = phase === 'finale';
  const activeAsker = phase === 'closing' || inFinale ? 'chairman' : current?.asker || 'chairman';
  const liveText = typing || !sttMode ? typed : [dict.text, dict.interim].filter(Boolean).join(' ');
  const words = wordCount(liveText);
  const qNumber = session.progress.mainAsked ?? (current?.idx ?? session.turns.length - 1) + 1;
  const qTotal = session.progress.mainTotal ?? session.progress.estimatedTotal;
  const timeUp = sessionLeft <= 0;
  const allowanceLow = sessionLeft < 180;
  const followUp = current?.source?.kind === 'followup' || current?.source?.kind === 'generated';
  const boardSpeaking = speaker.speaking || voice.speaking || phase === 'asking';
  // While a member reacts to an answer, the scene treats it as them speaking.
  const scenePhase = !begun ? 'idle' : phase === 'finishing' ? 'submitting' : inFinale ? 'idle' : phase === 'reacting' ? 'asking' : phase;
  const unreadCount = Object.values(unread).filter(Boolean).length;
  const answeredCount = session.turns.filter((t) => t.answered).length;
  const showDock = begun && !inFinale;
  const resumed = session.turns.length > 1;

  return (
    <div
      ref={rootRef}
      data-full={fullView}
      className={`bg-[#050807] text-white overflow-hidden select-none ${fullView ? 'fixed inset-0 z-[80]' : 'relative min-h-[320px] h-[calc(100vh-73px)]'}`}
      style={{ height: fullView ? '100dvh' : 'calc(100dvh - var(--iv-top, 73px))' }}
    >
      {use3d ? (
        <BoardStage
          ref={stageRef}
          phase={scenePhase}
          active={activeAsker}
          level={voice.level}
          autoLevel={speaker.speaking && !voice.speaking}
          followUp={followUp}
          paused={paused}
          labels={labels}
          insetTop={inFinale ? finaleInsets.top : insets.top}
          insetBottom={inFinale ? finaleInsets.bottom : begun ? Math.max(0, insets.bottom - 36) : 0}
          unread={unread}
          padsOpen={practice && begun && !inFinale && !paused}
          onPad={openNotes}
          onReady={() => setStageReady(true)}
          onUnavailable={() => setStageFailed(true)}
        />
      ) : (
        <SimpleBoard panel={panel} active={activeAsker} speaking={boardSpeaking} thinking={phase === 'submitting'} level={voice.level} top={insets.top} bottom={inFinale ? 0 : insets.bottom} empty={inFinale} />
      )}

      {/* Top bar. On phones it is all controls; the question number moves down beside the speaker's name. */}
      <div ref={topRef} className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-2 px-3 sm:px-5 pt-3 short:pt-2 pb-5 short:pb-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="hidden sm:flex items-center gap-2.5 min-w-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${practice ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
            <Icon name={practice ? 'book' : 'gavel'} className="w-3.5 h-3.5" /> {practice ? 'Practice' : 'Real interview'}
          </span>
          {!inFinale && <span className="text-sm text-white/70 truncate iv-caption">Question {qNumber} <span className="text-white/40">of {qTotal}{session.formatLabel ? ` · ${session.formatLabel}` : ''}{session.temperamentLabel ? ` · ${session.temperamentLabel.toLowerCase()} board` : ''}</span></span>}
        </div>
        <div className={`flex flex-1 sm:flex-none items-center gap-1.5 sm:gap-2 ${inFinale ? 'justify-end' : 'justify-between sm:justify-end'}`}>
          {!inFinale && (
            <>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full h-9 px-3 text-sm font-bold tabular-nums ${timeUp ? 'bg-rose-500/25 text-rose-200' : allowanceLow ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/90'}`}
                aria-label={`Time spent ${formatClock(elapsed)}`}
                title={allowanceLow ? `The board will close the interview in ${formatClock(sessionLeft)}` : 'Time spent so far'}
              >
                <Icon name={paused || !begun ? 'pause' : 'clock'} className="w-4 h-4 hidden min-[380px]:block" /> {formatClock(elapsed)}
              </span>
              <BarButton icon={voiceOut ? 'volume' : 'volumeOff'} label={voiceOut ? 'Mute the board' : 'Let the board speak'} onClick={toggleVoiceOut} />
              <BarButton icon={showSelf ? 'video' : 'videoOff'} label={showSelf ? 'Hide your camera preview (the board still sees you)' : 'Show your camera preview'} on={showSelf} onClick={toggleSelf} />
              {use3d && !isTouchDevice() && camStatus === 'ready' && (
                <span className="hidden sm:inline-flex">
                  <BarButton icon="scanFace" label={headTrack ? 'The room follows your head. Click to stop.' : 'Let the room follow your head as you move'} on={headTrack} onClick={toggleHead} />
                </span>
              )}
              {practice && <BarButton icon="notepad" label="The board’s notes on your answers" badge={unreadCount} disabled={!begun} onClick={() => openNotes(SEATS.find((x) => unread[x]) || activeAsker)} />}
              <BarButton icon={paused ? 'play' : 'pause'} label={paused ? 'Resume the interview' : 'Pause the interview'} text={paused ? 'Resume' : 'Pause'} textFrom="lg" disabled={paused ? false : !canPause} onClick={paused ? resume : pause} />
            </>
          )}
          <BarButton icon={fullView ? 'minimize' : 'maximize'} label={fullView ? 'Exit full view' : 'Full view'} text={fullView ? 'Exit full view' : 'Full view'} textFrom="lg" onClick={fullView ? exitFullView : enterFullView} />
          {inFinale ? (
            <BarButton icon="arrowRight" label="See the full report" text="Report" onClick={toReport} />
          ) : (
            <BarButton icon="phoneOff" label="End the interview" text="End" tone="danger" disabled={phase === 'finishing' || !begun} onClick={() => setConfirmEnd(true)} />
          )}
        </div>
      </div>

      {/* Yourself. The video stays on this device; in practice mode a dot shows whether you are facing the board. */}
      {showSelf && begun && !inFinale && (
        <div className="absolute z-20 left-3 sm:left-5 w-28 h-[84px] sm:w-40 sm:h-28 rounded-2xl overflow-hidden border border-white/20 bg-black shadow-2xl" style={{ top: insets.top + 4 }}>
          <video ref={attachCamera} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
          {practice && camStatus === 'ready' && (
            <span className={`absolute left-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold ${!camLive.face ? 'text-rose-200' : camLive.toward ? 'text-emerald-200' : 'text-amber-200'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${!camLive.face ? 'bg-rose-400' : camLive.toward ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {!camLive.face ? 'Not in view' : camLive.toward ? 'Facing the board' : 'Looking away'}
            </span>
          )}
        </div>
      )}

      {/* A member just wrote something down */}
      {noteChip && practice && !notesFor && !paused && !inFinale && (
        <button
          key={noteChip.key}
          onClick={() => openNotes(noteChip.asker)}
          className="iv-rise absolute z-20 left-1/2 -translate-x-1/2 max-w-[92%] inline-flex items-center gap-2 rounded-full bg-[#f6efd9] text-[#1f2a5a] pl-3 pr-4 py-2 text-xs sm:text-sm font-bold shadow-2xl cursor-pointer hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/60"
          style={{ bottom: Math.max(0, insets.bottom - 34) }}
        >
          <Icon name="notepad" className="w-4 h-4 shrink-0" />
          <span className="truncate">{ASKER_LABEL[noteChip.asker]} made a note{noteChip.score != null ? ` · ${noteChip.score}/10` : ''}</span>
          <span className="text-[#b3392f] whitespace-nowrap">Read it</span>
        </button>
      )}

      {/* The question, as a film caption, and the answer dock. Side by side on a phone held sideways. */}
      <div ref={bottomRef} className={`absolute bottom-0 inset-x-0 z-10 px-3 sm:px-6 pb-3 sm:pb-5 short:pb-2 ${showDock ? 'pt-14 short:pt-9 bg-gradient-to-t from-black/90 via-black/65 to-transparent' : ''}`}>
        {showDock && (
          <div className="short:flex short:items-end short:gap-4">
            <div className="mx-auto w-full max-w-3xl text-center short:text-left short:flex-1 short:min-w-0 short:mx-0 short:pb-1" aria-live="polite">
              {spoken ? (
                <div key={`${spoken.kind}:${spoken.text}`} className="iv-rise pb-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/90 mb-1.5 short:mb-1 iv-caption">{ASKER_LABEL[spoken.asker]}</p>
                  <p className="font-display italic text-lg sm:text-xl lg:text-2xl short:text-base leading-snug text-white/95 iv-caption">“{spoken.text}”</p>
                  {spoken.kind === 'reaction' && (
                    <button onClick={skipLine} className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white/85 cursor-pointer">
                      <Icon name="chevronRight" className="w-3.5 h-3.5" /> Next question
                    </button>
                  )}
                </div>
              ) : phase === 'submitting' ? (
                <p className="text-white/75 text-base sm:text-lg py-3 flex items-center justify-center short:justify-start gap-2 iv-caption">
                  The board is conferring
                  <span className="inline-flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/80 iv-dot" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
                </p>
              ) : phase === 'closing' || phase === 'finishing' ? (
                <div className="iv-rise pb-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/90 mb-2 short:mb-1 iv-caption">Chairperson</p>
                  <p className="font-display text-xl sm:text-2xl lg:text-[1.75rem] short:text-lg leading-snug text-white iv-caption">{closingLine || 'Thank you. That brings us to the end of your interview.'}</p>
                  <p className="text-white/60 mt-3 short:mt-1.5 flex items-center justify-center short:justify-start gap-2 text-sm"><span className="w-4 h-4 border-2 border-white/30 border-t-emerald-300 rounded-full animate-spin" /> {phase === 'finishing' ? 'The board is marking your interview…' : 'One moment…'}</p>
                </div>
              ) : current ? (
                <div key={current.idx} className="iv-rise">
                  {(current.lead || []).filter((l) => l.kind === 'handover').map((l) => (
                    <p key={l.text} className="text-xs sm:text-sm italic text-white/60 mb-1.5 iv-caption">{ASKER_LABEL[l.asker]}: “{l.text}”</p>
                  ))}
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/90 mb-1.5 sm:mb-2 short:mb-1 iv-caption">
                    {ASKER_LABEL[current.asker]}{followUp ? ' · follow-up' : ''}
                    <span className="sm:hidden text-white/55"> · Q{qNumber}/{qTotal}</span>
                  </p>
                  <p className="font-display text-[1.15rem] sm:text-2xl lg:text-[1.75rem] short:text-[1.05rem] leading-snug text-white iv-caption select-text">{current.question}</p>
                  <div className="mt-2.5 short:mt-1.5 flex flex-wrap items-center justify-center short:justify-start gap-2 min-h-[30px]">
                    {practice && <SourceChip source={current.source} dark />}
                    {phase === 'asking' && (
                      <button onClick={skipReading} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white/85 cursor-pointer">
                        <Icon name="chevronRight" className="w-3.5 h-3.5" /> Skip reading
                      </button>
                    )}
                    {phase === 'answering' && canSpeak && (
                      <button onClick={repeat} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white/85 cursor-pointer">
                        <Icon name="repeat" className="w-3.5 h-3.5" /> <span>Repeat<span className="hidden sm:inline short:hidden"> the question</span></span>
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
              {timeUp && phase === 'answering' && (
                <p className="text-sm text-amber-300 mt-2 iv-caption">Time is up — finish this answer and the board will close the interview.</p>
              )}
            </div>

            <div className="mx-auto w-full max-w-3xl mt-3 short:mt-0 short:mx-0 short:w-[47%] short:shrink-0 rounded-3xl short:rounded-2xl bg-black/50 border border-white/12 p-3 sm:p-4 short:p-2.5 backdrop-blur-md shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9)]">
              {voiceMode && !typing ? (
                <div className="flex items-center gap-3 sm:gap-5 short:gap-2.5">
                  <div className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] sm:w-24 short:w-16">
                    <Orb level={level} state={dict.listening ? 'listening' : rec.recording ? 'recording' : 'idle'} onClick={toggleListening} disabled={phase !== 'answering' || transcribing || paused} />
                    <span className="text-[11px] short:text-[10px] text-white/65 font-semibold text-center leading-tight min-h-[14px]">
                      {phase === 'asking' ? 'Listen…' : transcribing ? 'Writing it down…' : dict.listening ? 'Listening' : rec.recording ? 'Recording' : phase === 'answering' ? 'Tap to speak' : ''}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="min-h-[58px] max-h-24 sm:max-h-28 short:min-h-[40px] short:max-h-[44px] overflow-y-auto rounded-2xl bg-black/35 border border-white/8 px-3.5 py-2.5 short:py-1.5 text-sm sm:text-[15px] leading-relaxed select-text" aria-live="polite">
                      {liveText ? (
                        <><span className="text-white/90">{typing || !sttMode ? typed : dict.text}</span>{sttMode && dict.interim && <span className="text-white/45"> {dict.interim}</span>}</>
                      ) : (
                        <span className="text-white/40">{phase === 'answering' ? <><span className="short:hidden">Your answer will appear here as you speak.</span><span className="hidden short:inline">Speak your answer…</span></> : '…'}</span>
                      )}
                    </div>
                    {dict.error && <p className="text-xs text-amber-300 mt-1.5">{dict.error}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 short:mt-1.5">
                      <span className="text-xs text-white/50 tabular-nums">{phase === 'answering' ? `${formatClock(answerSeconds)} · ${words} words` : ''}</span>
                      <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                        <button onClick={switchToTyping} disabled={phase !== 'answering'} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-white/75 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-40" aria-label="Type this answer instead">
                          <Icon name="keyboard" className="w-4 h-4" /> <span className="hidden sm:inline short:hidden">Type instead</span>
                        </button>
                        <button onClick={() => submit({ skipped: true })} disabled={phase !== 'answering'} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white/85 bg-white/10 hover:bg-white/20 cursor-pointer disabled:opacity-40">Pass</button>
                        <button onClick={() => submit()} disabled={phase !== 'answering' || transcribing} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold whitespace-nowrap bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer disabled:opacity-40">
                          <span>Finish<span className="hidden sm:inline short:hidden"> answer</span></span> <Icon name="arrowRight" className="w-4 h-4" />
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
                    disabled={phase !== 'answering' || paused}
                    rows={3}
                    placeholder={phase === 'answering' ? 'Type your answer as you would say it…' : 'Listen to the question…'}
                    className="block w-full resize-none rounded-2xl bg-black/35 border border-white/10 focus:border-emerald-400/60 outline-none px-3.5 py-2.5 short:py-1.5 short:h-[52px] text-[15px] leading-relaxed text-white placeholder:text-white/40 disabled:opacity-60 select-text"
                    aria-label="Your answer"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2 short:mt-1.5">
                    <span className="text-xs text-white/50 tabular-nums">{phase === 'answering' ? <>{formatClock(answerSeconds)} · {words} words<span className="hidden md:inline short:hidden"> · Ctrl+Enter to send</span></> : ''}</span>
                    <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                      {voiceMode && (
                        <button onClick={() => { setTyping(false); if (sttMode) { dict.reset(typed); dict.start(); } }} disabled={phase !== 'answering'} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-white/75 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-40" aria-label="Speak this answer instead">
                          <Icon name="mic" className="w-4 h-4" /> <span className="short:hidden">Speak instead</span>
                        </button>
                      )}
                      <button onClick={() => submit({ skipped: true })} disabled={phase !== 'answering'} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white/85 bg-white/10 hover:bg-white/20 cursor-pointer disabled:opacity-40">Pass</button>
                      <button onClick={() => submit()} disabled={phase !== 'answering'} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer disabled:opacity-40">
                        <span>Send<span className="hidden sm:inline short:hidden"> answer</span></span> <Icon name="send" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* The marks, one card at a time */}
      {inFinale && marks && <MarksFinale marks={marks} revealed={revealed} done={finaleDone} threeD={finale3d} onReport={toReport} onSkip={toReport} onInsets={setFinaleInsets} />}

      {/* A member's notepad */}
      {notesFor && <NotepadSheet panel={session.panel} turns={session.turns} memberId={notesFor} unread={unread} onSelect={selectNotes} onClose={closeNotes} held={paused} />}

      {/* Paused */}
      {paused && !notesFor && (
        <div className="absolute inset-0 z-30 flex overflow-y-auto bg-black/70 backdrop-blur-sm p-6 short:p-3" role="dialog" aria-modal="true" aria-label="Interview paused">
          <div className="m-auto max-w-sm short:max-w-xl w-full text-center iv-rise">
            <span className="inline-flex short:hidden w-14 h-14 rounded-full bg-white/10 items-center justify-center"><Icon name="pause" className="w-6 h-6" /></span>
            <h2 className="font-display text-3xl short:text-2xl font-bold text-white mt-4 short:mt-0">Interview paused</h2>
            <p className="text-white/65 mt-2 short:mt-1 short:text-sm leading-relaxed">
              The clock has stopped at <span className="font-bold text-white tabular-nums">{formatClock(elapsed)}</span>. {phase === 'asking' ? 'The board will repeat the question when you come back.' : 'Your answer so far is kept.'}
            </p>
            <div className="mt-6 short:mt-3 flex flex-col short:flex-row gap-2.5">
              <button onClick={resume} autoFocus className="short:flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-6 py-3.5 short:px-4 short:py-3 text-base short:text-sm font-bold text-white cursor-pointer shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50">
                <Icon name="play" className="w-5 h-5" /> Resume interview
              </button>
              <div className="flex gap-2.5 short:flex-[1.4]">
                {fullView ? (
                  <button onClick={exitFullView} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 px-4 py-3 text-sm font-bold text-white cursor-pointer">
                    <Icon name="minimize" className="w-4 h-4" /> Exit full view
                  </button>
                ) : (
                  <button onClick={enterFullView} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 px-4 py-3 text-sm font-bold text-white cursor-pointer">
                    <Icon name="maximize" className="w-4 h-4" /> Full view
                  </button>
                )}
                <button onClick={() => setConfirmEnd(true)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500/90 hover:bg-rose-500 px-4 py-3 text-sm font-bold text-white cursor-pointer">
                  <Icon name="phoneOff" className="w-4 h-4" /> End interview
                </button>
              </div>
            </div>
            {!stageFailed && (
              <button onClick={toggleSimple} className="mt-5 short:mt-3 text-xs font-semibold text-white/50 hover:text-white underline underline-offset-4 cursor-pointer">
                {simple ? 'Switch to the 3D room' : 'Room running slowly? Switch to the simple room'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Begin: also the click browsers need before they let the page speak */}
      {!begun && (
        <div className="absolute inset-0 z-30 flex overflow-y-auto bg-black/60 backdrop-blur-[3px] p-6 short:p-3">
          <div className="m-auto max-w-md short:max-w-2xl text-center iv-rise">
            {!use3d && <div className="flex short:hidden justify-center -space-x-2 mb-6">{SEATS.map((a) => <SeatAvatar key={a} asker={a} size="md" />)}</div>}
            <p className="short:hidden text-[11px] font-bold uppercase tracking-[0.28em] text-amber-200/90">Mock Personality Test</p>
            <h2 className="font-display text-3xl sm:text-4xl short:text-2xl font-bold text-white mt-3 short:mt-0">The board is ready</h2>
            <p className="text-white/70 mt-3 short:mt-1.5 short:text-sm leading-relaxed">
              {resumed ? 'Picking up where you left off. ' : ''}
              {voiceMode ? 'The board will speak each question. Answer out loud — your words appear as you talk. Press “Finish” when you are done.' : 'Read each question and type your answer.'}
              {practice ? ' Tap a member’s notepad to read what they wrote about your answer.' : ''}
            </p>
            <div className="mt-6 short:mt-3 flex items-center gap-3 rounded-2xl bg-black/45 border border-white/10 p-2.5 text-left">
              <div className="relative w-24 h-[72px] shrink-0 rounded-xl overflow-hidden bg-black/60">
                <video ref={attachCamera} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
                {camStatus === 'starting' && <span className="absolute inset-0 flex items-center justify-center"><span className="w-5 h-5 border-2 border-white/25 border-t-emerald-300 rounded-full animate-spin" /></span>}
              </div>
              <div className="min-w-0 text-xs leading-relaxed">
                {camStatus === 'starting' && <p className="text-white/70">Starting your camera…</p>}
                {camStatus === 'ready' && camLive.face && <p className="text-emerald-200 font-semibold">Camera on — the board can see you.</p>}
                {camStatus === 'ready' && !camLive.face && <p className="text-amber-200 font-semibold">We can’t see your face. Sit facing the screen, in good light.</p>}
                {camStatus === 'camera-only' && <p className="text-amber-200 font-semibold">Camera on. Reading your body language could not start on this device, so the board will go by your answers only.</p>}
                {camStatus === 'denied' && <p className="text-rose-200 font-semibold">Camera access is blocked. Allow it from the camera icon in the address bar, then press Try again.</p>}
                {camStatus === 'no-camera' && <p className="text-rose-200 font-semibold">No camera found. The interview needs a camera, as the real board sees you.</p>}
                {(camStatus === 'denied' || camStatus === 'no-camera') && (
                  <button onClick={retryCamera} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 font-bold text-white cursor-pointer"><Icon name="refresh" className="w-3.5 h-3.5" /> Try again</button>
                )}
                <p className="text-white/45 mt-1">Your video never leaves this device. Only numbers — how often you faced the board, your posture — are saved.</p>
              </div>
            </div>
            <div className="mt-5 short:mt-3 flex flex-col sm:flex-row items-stretch justify-center gap-2.5">
              <button onClick={() => begin(true)} disabled={!cameraUsable} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-6 py-3.5 short:py-2.5 text-base font-bold text-white cursor-pointer shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50 disabled:opacity-40 disabled:cursor-not-allowed">
                <Icon name="maximize" className="w-5 h-5" /> {resumed ? 'Resume in full view' : 'Begin in full view'}
              </button>
              <button onClick={() => begin(false)} disabled={!cameraUsable} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 px-6 py-3.5 short:py-2.5 text-base font-bold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                <Icon name="play" className="w-5 h-5" /> {resumed ? 'Resume here' : 'Begin here'}
              </button>
            </div>
            <p className="text-xs text-white/45 mt-4 short:mt-2">
              {session.formatLabel ? `${session.formatLabel} · ${qTotal} questions` : `${session.durationMinutes} minutes`} · {session.temperamentLabel ? `${session.temperamentLabel.toLowerCase()} board` : 'the board'} · {practice ? 'practice mode' : 'real mode'}
              {use3d ? (isTouchDevice() ? ' · tilt the screen to look around' : ' · move your mouse to look around') : ''}
            </p>
            {!stageFailed && (
              <button onClick={toggleSimple} className="mt-3 short:mt-1.5 text-xs font-semibold text-white/50 hover:text-white underline underline-offset-4 cursor-pointer">
                {simple ? 'Use the 3D room' : 'Use the simple room instead'}
              </button>
            )}
          </div>
        </div>
      )}

      {confirmEnd && (
        <Modal
          title="End the interview now?"
          onClose={() => setConfirmEnd(false)}
          footer={<><ActionButton onClick={() => setConfirmEnd(false)}>Keep going</ActionButton><ActionButton tone="danger" icon="phoneOff" onClick={() => { setConfirmEnd(false); finish(); }}>End and see my marks</ActionButton></>}
        >
          <p className="text-sm text-text-secondary pb-3">You’ll get the board’s marks and a report on the {answeredCount} question{answeredCount === 1 ? '' : 's'} answered so far.</p>
        </Modal>
      )}
    </div>
  );
}
