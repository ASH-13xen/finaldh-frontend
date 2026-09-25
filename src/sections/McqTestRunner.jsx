import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Icon from '../components/mcq/Icon';
import { ActionButton, Chip, Modal, ModeBadge, ProgressBar, ToolButton } from '../components/mcq/ui';
import ReportModal from '../components/mcq/ReportModal';
import { HelpModal } from '../components/mcq/HelpAndTour';
import { useToast } from '../components/Toast';
import { mcq, errorMessage, formatClock } from '../lib/mcqApi';

const CONFIDENCE_OPTIONS = [
  { tag: 'sure', label: '100% sure', hint: 'You are certain' },
  { tag: 'elimination', label: 'Eliminated options', hint: 'You ruled out wrong options' },
  { tag: 'guess', label: 'Just a guess', hint: 'You are unsure' }
];

const MARKED = ['marked-for-review', 'answered-marked-for-review'];
const isMarked = (m) => MARKED.includes(m?.status);

const TILE = {
  'not-visited': 'bg-surface-raised text-text-tertiary border border-border-default',
  'not-answered': 'bg-status-danger-text text-white',
  answered: 'bg-brand text-text-on-accent',
  'marked-for-review': 'bg-status-info-text text-white',
  'answered-marked-for-review': 'bg-status-info-text text-white ring-2 ring-brand ring-offset-1 ring-offset-surface'
};

// Status a question should have once the student leaves it (unless they explicitly changed it).
const inferStatus = (m) => {
  const marked = isMarked(m);
  return m?.selectedOption ? (marked ? 'answered-marked-for-review' : 'answered') : (marked ? 'marked-for-review' : 'not-answered');
};

const matchesFilter = (order, m, flaggedSet, filter) => {
  const status = m?.status || 'not-visited';
  if (filter === 'unanswered') return !m?.selectedOption;
  if (filter === 'marked') return MARKED.includes(status);
  if (filter === 'flagged') return flaggedSet.has(order);
  return true;
};

// ---- module-level components (defined here, NOT inside the runner, so React never remounts them on every keystroke) ----

function CountTiles({ counts, dense }) {
  const cell = `rounded-lg text-center font-bold ${dense ? 'px-2 py-2.5 text-sm' : 'px-2 py-2 text-xs'}`;
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className={`${cell} bg-status-success-bg border border-status-success-text/30 text-status-success-text`}>Answered: {counts.answered}</div>
      <div className={`${cell} bg-status-danger-bg border border-status-danger-text/30 text-status-danger-text`}>Unanswered: {counts.unanswered}</div>
      <div className={`${cell} bg-status-info-bg border border-status-info-text/30 text-status-info-text`}>Marked: {counts.marked}</div>
      <div className={`${cell} bg-sunken border border-border-default text-text-tertiary`}>Not visited: {counts.notVisited}</div>
    </div>
  );
}

function Palette({ questions, meta, flaggedSet, current, filter, setFilter, practice, onGo }) {
  const FILTERS = [['all', 'All'], ['unanswered', 'Unanswered'], ['marked', 'Marked'], ['flagged', 'Flagged']];
  const tiles = questions.filter((q) => matchesFilter(q.order, meta[q.order], flaggedSet, filter));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Palette filter">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer ${filter === id ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary hover:bg-surface-raised'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto p-1">
        {tiles.length === 0 && <p className="col-span-5 text-sm text-text-tertiary py-4 text-center">Nothing matches this filter.</p>}
        {tiles.map((q) => {
          const m = meta[q.order];
          const status = m?.status || 'not-visited';
          let cls = TILE[status] || TILE['not-visited'];
          if (practice && m?.revealed) cls = m.isCorrect ? 'bg-status-success-text text-white' : m.isCorrect === false ? 'bg-status-warning-text text-white' : cls;
          return (
            <button
              key={q.order}
              onClick={() => onGo(q.order)}
              aria-label={`Question ${q.order}${flaggedSet.has(q.order) ? ', flagged' : ''}${isMarked(m) ? ', marked for review' : ''}${m?.selectedOption ? ', answered' : ''}`}
              className={`relative w-full aspect-square rounded-lg text-sm font-bold flex items-center justify-center cursor-pointer transition-all ${cls} ${q.order === current ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface' : ''}`}
            >
              {q.order}
              {flaggedSet.has(q.order) && <Icon name="bookmark" filled className="w-3 h-3 absolute -top-1 -right-1 text-status-warning-text drop-shadow" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand" />Answered</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-status-danger-text" />Unanswered</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-status-info-text" />Marked</span>
        <span className="flex items-center gap-1.5"><Icon name="bookmark" filled className="w-3 h-3 text-status-warning-text" />Flagged</span>
        {practice && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-status-success-text" />Correct</span>}
      </div>
    </div>
  );
}

function OptionButton({ option, selected, revealed, isCorrectOption, isWrongPick, disabled, onPick }) {
  let cls = 'border-border-default bg-surface hover:border-text-tertiary hover:bg-sunken/60';
  let badge = 'border-border-default text-text-tertiary';
  if (revealed && isCorrectOption) { cls = 'border-status-success-text bg-status-success-bg'; badge = 'border-status-success-text bg-status-success-text text-white'; }
  else if (revealed && isWrongPick) { cls = 'border-status-danger-text bg-status-danger-bg'; badge = 'border-status-danger-text bg-status-danger-text text-white'; }
  else if (selected) { cls = 'border-brand bg-accent-soft-bg'; badge = 'border-brand bg-brand text-text-on-accent'; }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onPick}
      className={`w-full text-left flex items-start gap-3.5 p-4 rounded-xl border-2 transition-all min-h-14 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${disabled ? 'cursor-default' : 'cursor-pointer'} ${cls}`}
    >
      <span className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-extrabold ${badge}`}>
        {revealed && isCorrectOption ? <Icon name="check" className="w-4 h-4" strokeWidth={3} /> : revealed && isWrongPick ? <Icon name="x" className="w-4 h-4" strokeWidth={3} /> : option.label}
      </span>
      <span className="text-base text-text-primary leading-relaxed pt-0.5 flex-1">{option.text}</span>
      {revealed && isCorrectOption && <span className="text-xs font-extrabold uppercase text-status-success-text pt-1.5">Correct</span>}
      {revealed && isWrongPick && <span className="text-xs font-extrabold uppercase text-status-danger-text pt-1.5">Your answer</span>}
    </button>
  );
}

export default function McqTestRunner({ attemptId, onExit, onSubmitted }) {
  const toast = useToast();

  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [meta, setMeta] = useState({});
  const [current, setCurrent] = useState(1);
  const [flagged, setFlagged] = useState(() => new Set());
  const [reportedSet, setReportedSet] = useState(() => new Set());
  const [timerOn, setTimerOn] = useState(true);
  const [remaining, setRemaining] = useState(0);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const [elapsedQuestion, setElapsedQuestion] = useState(0);
  const [saveState, setSaveState] = useState('saved'); // saved | saving | error
  const [paletteFilter, setPaletteFilter] = useState('all');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [exitOpen, setExitOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  // Refs hold the "latest" values that timers, key handlers and the save queue need without re-subscribing.
  const metaRef = useRef({});
  const currentRef = useRef(1);
  const timeByOrderRef = useRef({}); // seconds already recorded per question (server value + what we sent)
  const questionMsRef = useRef(0); // visible time on the current question, not yet sent
  const lastTickRef = useRef(0); // set when the attempt finishes loading
  const clockOffsetRef = useRef(0); // server time - device time, so a wrong device clock cannot skew the countdown
  const deadlineRef = useRef(null);
  const chainRef = useRef(Promise.resolve());
  const pendingRef = useRef(0);
  const failedOrdersRef = useRef(new Set());
  const autoSubmitRef = useRef(false);
  const submittingRef = useRef(false);
  const actionsRef = useRef({});

  const practice = attempt?.mode === 'practice';
  const total = questions.length;

  useEffect(() => { metaRef.current = meta; }, [meta]);
  useEffect(() => { currentRef.current = current; }, [current]);

  // ---------- ordered save queue ----------
  // Requests are sent one after another in the order they were made, so a slow earlier request can never
  // overwrite a newer answer, and "await chain" means "everything so far has reached the server".
  const runInQueue = useCallback((task) => {
    const p = chainRef.current.then(task, task);
    chainRef.current = p.catch(() => {});
    return p;
  }, []);

  const finishedElsewhere = useCallback(() => onSubmitted(attemptId), [onSubmitted, attemptId]);

  const enqueuePatch = useCallback((order, body) => {
    pendingRef.current += 1;
    setSaveState('saving');
    return runInQueue(async () => {
      try {
        const res = await mcq(`/attempts/${attemptId}/responses/${order}`, { method: 'PATCH', body });
        failedOrdersRef.current.delete(order);
        if (res?.deadlineExpired) finishedElsewhere();
      } catch (err) {
        if (err.status === 409) { finishedElsewhere(); return; }
        failedOrdersRef.current.add(order);
      } finally {
        pendingRef.current -= 1;
        if (pendingRef.current === 0) setSaveState(failedOrdersRef.current.size ? 'error' : 'saved');
      }
    });
  }, [attemptId, runInQueue, finishedElsewhere]);

  // ---------- per-question clock (only counts while the tab is visible) ----------
  const takeQuestionSeconds = useCallback(() => {
    const secs = Math.round(questionMsRef.current / 1000);
    questionMsRef.current = 0;
    if (secs > 0) {
      const order = currentRef.current;
      timeByOrderRef.current[order] = (timeByOrderRef.current[order] || 0) + secs;
    }
    return secs;
  }, []);

  // ---------- load / resume ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await mcq(`/attempts/${attemptId}`);
        if (cancelled) return;
        if (data.deadlineExpired || data.status) { onSubmitted(attemptId); return; }

        const m = {};
        const times = {};
        (data.responses || []).forEach((r) => {
          m[r.order] = {
            status: r.status, selectedOption: r.selectedOption, confidenceTag: r.confidenceTag ?? null,
            revealed: !!r.revealed, correctOption: r.correctOption, explanation: r.explanation, examSource: r.examSource,
            isCorrect: r.revealed && r.selectedOption ? r.selectedOption === r.correctOption : (r.revealed ? null : undefined)
          };
          times[r.order] = r.timeSpentSeconds || 0;
        });
        timeByOrderRef.current = times;
        clockOffsetRef.current = data.serverNow ? Date.parse(data.serverNow) - Date.now() : 0;
        deadlineRef.current = data.serverDeadline ? Date.parse(data.serverDeadline) : null;

        const start = data.lastActiveQuestionOrder || 1;
        setAttempt({ mode: data.mode, source: data.source, title: data.testTitle, attempts: data.attempts, subject: data.subject });
        setTimerOn(data.timerEnabled !== false);
        setQuestions(data.questions || []);
        setMeta(m);
        setFlagged(new Set(data.flaggedOrders || []));
        setCurrent(start);
        currentRef.current = start;
        questionMsRef.current = 0;
        lastTickRef.current = Date.now();
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(errorMessage(err, 'Failed to load your test.'));
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // ---------- submitting ----------
  const doSubmit = useCallback(async (auto) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = currentRef.current;
      const m = metaRef.current[order] || {};
      const secs = takeQuestionSeconds();
      enqueuePatch(order, { deltaTimeSpentSeconds: secs, selectedOption: m.selectedOption ?? null, status: inferStatus(m), confidenceTag: m.confidenceTag ?? null });
      await chainRef.current; // everything queued has been sent
      await mcq(`/attempts/${attemptId}/submit`, { method: 'POST', body: { autoSubmit: !!auto } });
      onSubmitted(attemptId);
    } catch (err) {
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitError(errorMessage(err, 'Could not submit. Check your connection and try again.'));
      setSubmitOpen(true);
    }
  }, [attemptId, enqueuePatch, onSubmitted, takeQuestionSeconds]);

  // ---------- timers ----------
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') questionMsRef.current += now - lastTickRef.current;
      lastTickRef.current = now;

      if (deadlineRef.current) {
        const secs = Math.max(0, Math.floor((deadlineRef.current - (now + clockOffsetRef.current)) / 1000));
        setRemaining(secs);
        if (secs <= 0 && !autoSubmitRef.current) {
          autoSubmitRef.current = true;
          doSubmit(true);
        }
      }
      const cur = currentRef.current;
      const doneSecs = Object.entries(timeByOrderRef.current).reduce((s, [o, v]) => s + (Number(o) === cur ? 0 : v), 0);
      const qSecs = (timeByOrderRef.current[cur] || 0) + Math.floor(questionMsRef.current / 1000);
      setElapsedQuestion(qSecs);
      setElapsedTotal(doneSecs + qSecs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, doSubmit]);

  // A running exam should not vanish because of an accidental tab close.
  useEffect(() => {
    if (phase !== 'ready' || practice) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase, practice]);

  // ---------- actions ----------
  // Updates the ref synchronously (so the very next handler already sees it) and then the rendered state.
  const updateMeta = useCallback((order, patch) => {
    const prev = metaRef.current;
    const next = { ...prev, [order]: { ...(prev[order] || { status: 'not-visited', selectedOption: null }), ...patch } };
    metaRef.current = next;
    setMeta(next);
  }, []);

  // Leave the current question (its time + latest state are queued, never awaited) and open another.
  const goTo = useCallback((order) => {
    if (order < 1 || order > total || order === currentRef.current) return;
    const from = currentRef.current;
    const m = metaRef.current[from] || {};
    const secs = takeQuestionSeconds();
    const status = inferStatus(m);
    updateMeta(from, { status });
    enqueuePatch(from, { deltaTimeSpentSeconds: secs, selectedOption: m.selectedOption ?? null, status, confidenceTag: m.confidenceTag ?? null });

    const target = metaRef.current[order];
    if (!target || target.status === 'not-visited') updateMeta(order, { status: 'not-answered' });
    enqueuePatch(order, { isVisit: true });
    setCurrent(order);
    currentRef.current = order;
    questionMsRef.current = 0;
    setPaletteOpen(false);
  }, [total, takeQuestionSeconds, updateMeta, enqueuePatch]);

  const pickOption = useCallback((label) => {
    const order = currentRef.current;
    const m = metaRef.current[order] || {};
    if (m.revealed) return;
    const status = isMarked(m) ? 'answered-marked-for-review' : 'answered';
    updateMeta(order, { selectedOption: label, status });
    // Saved immediately - an answer is never lost just because the student closed the tab before pressing Next.
    enqueuePatch(order, { selectedOption: label, status, confidenceTag: m.confidenceTag ?? null });
  }, [updateMeta, enqueuePatch]);

  const clearResponse = useCallback(() => {
    const order = currentRef.current;
    const m = metaRef.current[order] || {};
    if (m.revealed) return;
    const status = isMarked(m) ? 'marked-for-review' : 'not-answered';
    updateMeta(order, { selectedOption: null, status, confidenceTag: null });
    enqueuePatch(order, { selectedOption: null, status, confidenceTag: null });
  }, [updateMeta, enqueuePatch]);

  const setConfidence = useCallback((tag) => {
    const order = currentRef.current;
    const m = metaRef.current[order] || {};
    if (m.revealed) return;
    const next = m.confidenceTag === tag ? null : tag;
    updateMeta(order, { confidenceTag: next });
    enqueuePatch(order, { confidenceTag: next });
  }, [updateMeta, enqueuePatch]);

  const toggleMarked = useCallback(() => {
    const order = currentRef.current;
    const m = metaRef.current[order] || {};
    const marked = isMarked(m);
    const status = m.selectedOption ? (marked ? 'answered' : 'answered-marked-for-review') : (marked ? 'not-answered' : 'marked-for-review');
    updateMeta(order, { status });
    enqueuePatch(order, { status });
  }, [updateMeta, enqueuePatch]);

  const toggleFlag = useCallback(async () => {
    const order = currentRef.current;
    const q = questions.find((x) => x.order === order);
    if (!q) return;
    const was = flagged.has(order);
    setFlagged((prev) => { const n = new Set(prev); if (was) n.delete(order); else n.add(order); return n; });
    try {
      await mcq(`/flags/${q._id}`, { method: was ? 'DELETE' : 'PUT', body: was ? undefined : {} });
      toast.success(was ? 'Removed from your Flagged list.' : 'Saved to your Flagged list — find it under “Flagged” on the MCQ home page.', 2500);
    } catch (err) {
      setFlagged((prev) => { const n = new Set(prev); if (was) n.add(order); else n.delete(order); return n; });
      toast.error(errorMessage(err));
    }
  }, [questions, flagged, toast]);

  // Practice: reveal the key + explanation for the current question and lock it.
  const checkAnswer = useCallback(async () => {
    const order = currentRef.current;
    const m = metaRef.current[order] || {};
    if (m.revealed || checking) return;
    setChecking(true);
    const secs = takeQuestionSeconds();
    try {
      const res = await runInQueue(() => mcq(`/attempts/${attemptId}/responses/${order}/reveal`, {
        method: 'POST', body: { selectedOption: m.selectedOption ?? null, deltaTimeSpentSeconds: secs }
      }));
      updateMeta(order, {
        revealed: true, correctOption: res.correctOption, explanation: res.explanation, examSource: res.examSource,
        selectedOption: res.selectedOption, isCorrect: res.isCorrect, status: res.selectedOption ? (isMarked(m) ? 'answered-marked-for-review' : 'answered') : m.status
      });
    } catch (err) {
      // the time was not recorded on the server - keep counting it locally instead of losing it
      questionMsRef.current += secs * 1000;
      timeByOrderRef.current[order] = Math.max(0, (timeByOrderRef.current[order] || 0) - secs);
      toast.error(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }, [attemptId, checking, runInQueue, takeQuestionSeconds, toast, updateMeta]);

  const toggleTimer = useCallback(async () => {
    const next = !timerOn;
    setTimerOn(next);
    try { await mcq(`/attempts/${attemptId}/settings`, { method: 'PATCH', body: { timerEnabled: next } }); }
    catch { /* display preference only - keep the local choice */ }
  }, [attemptId, timerOn]);

  const saveAndNext = useCallback(() => {
    if (currentRef.current >= total) { setSubmitOpen(true); return; }
    goTo(currentRef.current + 1);
  }, [goTo, total]);

  const retrySaves = useCallback(() => {
    const orders = [...failedOrdersRef.current];
    orders.forEach((order) => {
      const m = metaRef.current[order] || {};
      enqueuePatch(order, { selectedOption: m.selectedOption ?? null, status: inferStatus(m), confidenceTag: m.confidenceTag ?? null });
    });
    if (orders.length === 0) setSaveState('saved');
  }, [enqueuePatch]);

  const saveAndExit = useCallback(async () => {
    const order = currentRef.current;
    const m = metaRef.current[order] || {};
    const secs = takeQuestionSeconds();
    enqueuePatch(order, { deltaTimeSpentSeconds: secs, selectedOption: m.selectedOption ?? null, status: inferStatus(m), confidenceTag: m.confidenceTag ?? null });
    await Promise.race([chainRef.current, new Promise((r) => setTimeout(r, 4000))]);
    onExit();
  }, [enqueuePatch, onExit, takeQuestionSeconds]);

  // ---------- keyboard ----------
  // Handlers change every render, so the listener reads them from a ref instead of re-subscribing.
  useEffect(() => {
    actionsRef.current = { pickOption, goTo, saveAndNext, checkAnswer, toggleMarked, toggleFlag, openReport: () => setReportOpen(true) };
  });
  const modalOpen = submitOpen || reportOpen || helpOpen || exitOpen || paletteOpen;
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const onKey = (e) => {
      if (modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      const a = actionsRef.current;
      const cur = currentRef.current;
      const key = e.key.toLowerCase();
      // After clicking a button, focus stays on it and a later Enter would "click" that button instead of
      // running the shortcut. Using any shortcut key releases focus so the keyboard flow stays consistent.
      const isShortcut = ('abcd'.includes(key) && key.length === 1) || ['1', '2', '3', '4', 'arrowright', 'arrowleft', 'n', 'p', 'm', 'f', 'r'].includes(key);
      if (isShortcut && tag === 'BUTTON') e.target.blur();
      if ('abcd'.includes(key) && key.length === 1) { a.pickOption(key.toUpperCase()); e.preventDefault(); }
      else if (['1', '2', '3', '4'].includes(key)) { a.pickOption('ABCD'[Number(key) - 1]); e.preventDefault(); }
      else if (key === 'arrowright' || key === 'n') { a.goTo(cur + 1); }
      else if (key === 'arrowleft' || key === 'p') { a.goTo(cur - 1); }
      else if (key === 'm') a.toggleMarked();
      else if (key === 'f') a.toggleFlag();
      else if (key === 'r') a.openReport();
      else if (key === 'enter' && tag !== 'BUTTON' && tag !== 'A') {
        const mm = metaRef.current[cur] || {};
        if (attempt?.mode === 'practice' && !mm.revealed && mm.selectedOption) a.checkAnswer();
        else a.saveAndNext();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, modalOpen, attempt?.mode]);

  // ---------- render ----------
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Loading your test..." />
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[calc(100vh-73px)] bg-page px-4">
        <div className="p-6 bg-status-danger-bg border border-status-danger-text/30 rounded-2xl text-status-danger-text text-base font-semibold max-w-md text-center">{loadError}</div>
        <ActionButton tone="secondary" icon="arrowLeft" onClick={onExit}>Back to tests</ActionButton>
      </div>
    );
  }

  const q = questions.find((x) => x.order === current);
  const m = meta[current] || { status: 'not-visited', selectedOption: null };
  const revealed = !!m.revealed;

  const counts = { answered: 0, unanswered: 0, marked: 0, notVisited: 0 };
  const unansweredOrders = [];
  questions.forEach((x) => {
    const mm = meta[x.order];
    const status = mm?.status || 'not-visited';
    if (mm?.selectedOption) counts.answered += 1; else unansweredOrders.push(x.order);
    if (MARKED.includes(status)) counts.marked += 1;
    if (status === 'not-visited') counts.notVisited += 1;
    else if (!mm?.selectedOption) counts.unanswered += 1;
  });

  const lowTime = !practice && remaining <= 300;
  const isLast = current >= total;
  const marked = isMarked(m);
  const isFlagged = flagged.has(current);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-4">
      {/* Top bar */}
      <div className="sticky top-16 md:top-[72px] z-30 bg-surface border border-border-default rounded-2xl shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <ModeBadge mode={attempt.mode} source={attempt.source} />
            <span className="text-sm font-bold text-text-primary truncate max-w-[40vw] sm:max-w-xs">{attempt.title}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold ${saveState === 'error' ? 'text-status-danger-text' : 'text-text-tertiary'}`} aria-live="polite">
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && <><Icon name="check" className="w-3.5 h-3.5 text-brand" /> Saved</>}
              {saveState === 'error' && (
                <>
                  <Icon name="alert" className="w-3.5 h-3.5" /> Not saved
                  <button onClick={retrySaves} className="underline font-bold cursor-pointer">Retry</button>
                </>
              )}
            </span>

            {/* Timer: countdown in Test mode; optional stopwatch in Practice */}
            {!practice ? (
              <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-mono text-base font-extrabold ${lowTime ? 'bg-status-danger-bg text-status-danger-text border border-status-danger-text/30 animate-pulse' : 'bg-sunken text-text-primary'}`} aria-label={`Time remaining ${formatClock(remaining)}`}>
                <Icon name="clock" className="w-4 h-4" /> {formatClock(remaining)}
              </div>
            ) : (
              <button
                onClick={toggleTimer}
                aria-pressed={timerOn}
                title={timerOn ? 'Hide the timer' : 'Show the timer'}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold cursor-pointer border transition-all ${timerOn ? 'bg-sunken border-border-default text-text-primary' : 'bg-surface border-dashed border-border-default text-text-tertiary'}`}
              >
                <Icon name={timerOn ? 'timer' : 'eyeOff'} className="w-4 h-4" />
                {timerOn ? <span className="font-mono font-extrabold">{formatClock(elapsedTotal)}</span> : 'Timer off'}
              </button>
            )}

            <button onClick={() => setHelpOpen(true)} className="hidden sm:block p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-raised cursor-pointer" aria-label="Help and keyboard shortcuts" title="Help & keyboard shortcuts">
              <Icon name="keyboard" className="w-5 h-5" />
            </button>
            <button onClick={() => setPaletteOpen(true)} className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sunken border border-border-default text-sm font-bold text-text-secondary cursor-pointer" aria-label="Open question palette">
              <Icon name="grid" className="w-4 h-4" /> {counts.answered}/{total}
            </button>
            {/* wrapped in a span: ActionButton already sets display:inline-flex, which would defeat "hidden" */}
            <span className="hidden sm:block">
              <ActionButton size="sm" tone="secondary" icon="logout" onClick={() => setExitOpen(true)} hint="Leave now and resume later">Save &amp; exit</ActionButton>
            </span>
            <ActionButton size="sm" tone="primary" icon="send" onClick={() => setSubmitOpen(true)}>{practice ? 'Finish' : 'Submit'}</ActionButton>
          </div>
        </div>
        <div className="px-4 pb-3 flex items-center gap-3">
          <ProgressBar value={counts.answered} max={total} />
          <span className="text-xs font-bold text-text-tertiary whitespace-nowrap">{counts.answered} / {total} answered</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Question */}
        <article className="md:col-span-8 lg:col-span-9 bg-surface border border-border-default rounded-2xl p-5 md:p-7 flex flex-col gap-6" aria-label={`Question ${current}`}>
          {q ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-text-tertiary">Question {current} of {total}</h2>
                  {marked && <Chip tone="info"><Icon name="flag" filled className="w-3 h-3" /> Marked for review</Chip>}
                  {practice && timerOn && <Chip><Icon name="timer" className="w-3 h-3" /> {formatClock(elapsedQuestion)} on this question</Chip>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <ToolButton icon="bookmark" label={isFlagged ? 'Flagged' : 'Flag'} active={isFlagged} onClick={toggleFlag} hint="Save to your Flagged list to practise later (F)" />
                  <ToolButton icon="flag" label={marked ? 'Marked' : 'Mark'} active={marked} activeTone="info" onClick={toggleMarked} hint="Mark for review in this attempt (M)" />
                  <ToolButton icon="alert" label={reportedSet.has(q._id) ? 'Reported' : 'Report'} active={reportedSet.has(q._id)} activeTone="danger" onClick={() => setReportOpen(true)} hint="Tell us if this question or its answer is wrong (R)" />
                </div>
              </header>

              <p className="text-lg md:text-xl font-semibold text-text-primary leading-relaxed whitespace-pre-wrap">{q.questionText}</p>

              <div className="flex flex-col gap-3" role="radiogroup" aria-label="Answer options">
                {q.options.map((opt) => (
                  <OptionButton
                    key={opt.label}
                    option={opt}
                    selected={m.selectedOption === opt.label}
                    revealed={revealed}
                    isCorrectOption={revealed && m.correctOption === opt.label}
                    isWrongPick={revealed && m.selectedOption === opt.label && m.correctOption !== opt.label}
                    disabled={revealed}
                    onPick={() => pickOption(opt.label)}
                  />
                ))}
              </div>

              {/* Practice: verdict + explanation */}
              {practice && revealed && (
                <div className="flex flex-col gap-3" aria-live="polite">
                  <div className={`rounded-xl px-5 py-4 border-2 font-bold text-base flex items-center gap-2.5 ${m.isCorrect ? 'bg-status-success-bg border-status-success-text/50 text-status-success-text' : m.isCorrect === false ? 'bg-status-danger-bg border-status-danger-text/50 text-status-danger-text' : 'bg-sunken border-border-default text-text-primary'}`}>
                    <Icon name={m.isCorrect ? 'check' : m.isCorrect === false ? 'x' : 'info'} className="w-5 h-5" strokeWidth={3} />
                    {m.isCorrect ? 'Correct — well done!' : m.isCorrect === false ? `Not quite. The correct answer is ${m.correctOption}.` : `The correct answer is ${m.correctOption}.`}
                  </div>
                  <div className="rounded-xl bg-sunken border border-border-default px-5 py-4">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-text-tertiary mb-1.5">Explanation</p>
                    <p className="text-base text-text-secondary leading-relaxed whitespace-pre-wrap">{m.explanation || 'No explanation has been added for this question yet.'}</p>
                    {m.examSource && <p className="mt-3"><Chip tone="brand">Appeared in: {m.examSource}</Chip></p>}
                  </div>
                  <button onClick={() => setReportOpen(true)} className="self-start inline-flex items-center gap-1.5 text-sm font-bold text-text-tertiary hover:text-status-danger-text cursor-pointer">
                    <Icon name="alert" className="w-4 h-4" /> Think this answer is wrong? Report it
                  </button>
                </div>
              )}

              {!revealed && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-text-tertiary">How sure are you? <span className="normal-case font-medium">(optional — improves your analysis)</span></span>
                  <div className="flex flex-wrap gap-2">
                    {CONFIDENCE_OPTIONS.map(({ tag, label, hint }) => (
                      <button
                        key={tag}
                        type="button"
                        title={hint}
                        aria-pressed={m.confidenceTag === tag}
                        onClick={() => setConfidence(tag)}
                        className={`px-3.5 py-2 rounded-full text-sm font-bold cursor-pointer transition-all border ${m.confidenceTag === tag ? 'border-brand bg-brand text-text-on-accent' : 'border-border-default bg-sunken text-text-secondary hover:border-text-tertiary'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-border-default">
                <ActionButton tone="secondary" icon="chevronLeft" onClick={() => goTo(current - 1)} disabled={current <= 1}>Previous</ActionButton>
                {!revealed && <ActionButton tone="ghost" icon="undo" onClick={clearResponse} disabled={!m.selectedOption} hint="Remove your selected answer">Clear</ActionButton>}

                <div className="flex flex-wrap items-center gap-2.5 ml-auto">
                  {practice && !revealed && (
                    <>
                      <ActionButton tone="ghost" onClick={checkAnswer} disabled={checking} hint="Reveal the answer without choosing one">Skip &amp; show answer</ActionButton>
                      <ActionButton tone="soft" icon="eye" onClick={checkAnswer} disabled={!m.selectedOption || checking}>{checking ? 'Checking…' : 'Check answer'}</ActionButton>
                    </>
                  )}
                  <ActionButton tone="primary" onClick={saveAndNext}>
                    {isLast ? (practice ? 'Finish practice' : 'Save & finish') : (practice && revealed ? 'Next question' : 'Save & next')}
                    <Icon name={isLast ? 'check' : 'chevronRight'} className="w-4 h-4" />
                  </ActionButton>
                </div>
              </div>
            </>
          ) : (
            <p className="text-base text-text-tertiary">Question not found.</p>
          )}
        </article>

        {/* Palette (desktop) */}
        <aside className="hidden md:flex md:col-span-4 lg:col-span-3 bg-surface border border-border-default rounded-2xl p-5 flex-col gap-4 sticky top-[190px]" aria-label="Question palette">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-text-tertiary">Question palette</h2>
          <CountTiles counts={counts} />
          <Palette questions={questions} meta={meta} flaggedSet={flagged} current={current} filter={paletteFilter} setFilter={setPaletteFilter} practice={practice} onGo={goTo} />
        </aside>
      </div>

      {/* Palette (mobile bottom sheet) */}
      {paletteOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:hidden bg-page/70 backdrop-blur-sm" onClick={() => setPaletteOpen(false)}>
          <div className="bg-surface border-t border-border-default rounded-t-2xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-text-primary">Question palette</h3>
              <button onClick={() => setPaletteOpen(false)} className="p-1.5 text-text-tertiary cursor-pointer" aria-label="Close palette"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <CountTiles counts={counts} dense />
            <Palette questions={questions} meta={meta} flaggedSet={flagged} current={current} filter={paletteFilter} setFilter={setPaletteFilter} practice={practice} onGo={goTo} />
            <ActionButton tone="secondary" icon="logout" className="w-full" onClick={() => { setPaletteOpen(false); setExitOpen(true); }}>Save &amp; exit</ActionButton>
            <ActionButton tone="primary" icon="send" className="w-full" onClick={() => { setPaletteOpen(false); setSubmitOpen(true); }}>{practice ? 'Finish' : 'Submit test'}</ActionButton>
          </div>
        </div>
      )}

      {/* Submit dialog */}
      {submitOpen && (
        <Modal
          title={practice ? 'Finish practice?' : 'Submit test?'}
          onClose={() => !submitting && setSubmitOpen(false)}
          footer={
            <>
              <ActionButton tone="secondary" onClick={() => setSubmitOpen(false)} disabled={submitting}>{practice ? 'Keep practising' : 'Continue test'}</ActionButton>
              <ActionButton tone="primary" icon="send" onClick={() => doSubmit(false)} disabled={submitting}>{submitting ? 'Submitting…' : practice ? 'Yes, finish' : 'Yes, submit'}</ActionButton>
            </>
          }
        >
          <CountTiles counts={counts} dense />
          {unansweredOrders.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm text-text-secondary mb-2"><b>{unansweredOrders.length}</b> question{unansweredOrders.length !== 1 ? 's' : ''} without an answer — tap a number to go there:</p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {unansweredOrders.map((o) => (
                  <button key={o} onClick={() => { setSubmitOpen(false); goTo(o); }} className="min-w-9 h-9 px-2 rounded-lg bg-status-danger-bg border border-status-danger-text/30 text-status-danger-text text-sm font-bold cursor-pointer">{o}</button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-status-success-text font-semibold flex items-center gap-2"><Icon name="check" className="w-4 h-4" /> You answered every question.</p>
          )}
          <p className="text-sm text-text-tertiary mt-4 mb-2">{practice ? 'Your results and explanations will be shown next.' : 'Once submitted you cannot resume this attempt. Your detailed analysis appears straight away.'}</p>
          {submitError && <p className="text-sm font-semibold text-status-danger-text mb-2" role="alert">{submitError}</p>}
        </Modal>
      )}

      {/* Save & exit dialog */}
      {exitOpen && (
        <Modal
          title="Leave for now?"
          onClose={() => setExitOpen(false)}
          footer={
            <>
              <ActionButton tone="secondary" onClick={() => setExitOpen(false)}>Stay here</ActionButton>
              <ActionButton tone="primary" icon="logout" onClick={saveAndExit}>Save &amp; exit</ActionButton>
            </>
          }
        >
          <p className="text-base text-text-secondary leading-relaxed pb-3">
            Your answers are saved. You can resume this {practice ? 'practice session' : 'test'} any time from the test list — it will <b>not</b> use another attempt.
            {!practice && <> <b className="text-status-warning-text">The test timer keeps running while you are away</b> and the test submits automatically when time runs out.</>}
          </p>
        </Modal>
      )}

      {reportOpen && q && (
        <ReportModal
          question={{ _id: q._id, order: current, questionText: q.questionText }}
          attemptId={attemptId}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => setReportedSet((prev) => new Set(prev).add(q._id))}
        />
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
