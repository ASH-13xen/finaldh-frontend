// Practice Studio's on-device voice analysis. Records the answer (it stays in the browser), samples the
// voice 20 times a second (loudness) and 5 times a second (pitch), and uses the browser's own speech
// recognition for the words. From that: pace, pauses, start delay, filler words, hedges, pitch variation,
// trailing off - and rough 0-10 scores. Browser recognition drops "um"/"uh"; AI feedback catches those.
import { useCallback, useEffect, useRef, useState } from 'react';

const FILLERS = {
  en: ['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'hmm', 'basically', 'actually', 'you know', 'i mean', 'sort of', 'kind of', 'literally'],
  hi: ['मतलब', 'यानी', 'अच्छा', 'matlab', 'yaani', 'acha', 'achha', 'basically', 'actually', 'you know', 'um', 'uh', 'hmm']
};
const HEDGES = {
  en: ['i think', 'i guess', 'maybe', 'perhaps', 'probably', 'not sure', 'i feel', 'i suppose'],
  hi: ['शायद', 'मुझे लगता है', 'पता नहीं', 'लगता है', 'i think', 'maybe']
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseRe = (list) => new RegExp(`(^|[\\s,.;!?"'(])(${list.map(esc).sort((a, b) => b.length - a.length).join('|')})(?=$|[\\s,.;!?"')])`, 'giu');
const countIn = (text, list) => (String(text || '').match(phraseRe(list)) || []).length;
export const countWords = (text) => (String(text || '').trim().match(/[\p{L}\p{N}']+/gu) || []).length;

// Splits a transcript into parts marked filler / hedge / plain, for highlighting.
export const markTranscript = (text, lang = 'en') => {
  const out = [];
  const re = new RegExp(`${phraseRe(FILLERS[lang] || FILLERS.en).source}|${phraseRe(HEDGES[lang] || HEDGES.en).source}`, 'giu');
  const fillers = new Set((FILLERS[lang] || FILLERS.en).map((f) => f.toLowerCase()));
  let last = 0;
  for (const m of String(text || '').matchAll(re)) {
    const word = m[2] || m[4];
    const start = m.index + (m[1] || m[3] || '').length;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: word, kind: fillers.has(word.toLowerCase()) ? 'filler' : 'hedge' });
    last = start + word.length;
  }
  if (last < String(text || '').length) out.push({ text: text.slice(last) });
  return out;
};

// Autocorrelation pitch on a 4x decimated window (cheap enough for phones). 0 = unvoiced.
const detectPitch = (buf, sampleRate) => {
  const step = 4;
  const sr = sampleRate / step;
  const n = Math.floor(buf.length / step);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = buf[i * step];
  const minLag = Math.floor(sr / 400);
  const maxLag = Math.min(n - 2, Math.floor(sr / 70));
  let energy = 0;
  for (let i = 0; i < n; i++) energy += x[i] * x[i];
  if (!energy) return 0;
  let best = 0;
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < n - lag; i++) s += x[i] * x[i + lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  return bestLag && best / energy > 0.35 ? sr / bestLag : 0;
};

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const std = (a) => { const m = mean(a); return a.length ? Math.sqrt(mean(a.map((v) => (v - m) ** 2))) : 0; };
const clamp10 = (v) => Math.max(1, Math.min(10, Math.round(v * 10) / 10));

export const FRAME = 0.05; // seconds between loudness samples

// frames: [{ t, rms, pitch }] -> the numbers and scores in the report.
export const analyse = (frames, transcript, lang = 'en') => {
  const duration = frames.length ? frames[frames.length - 1].t : 0;
  const floor = pct(frames.map((f) => f.rms), 0.2);
  const thr = Math.max(0.012, floor * 3);
  const speaking = frames.map((f) => f.rms > thr);
  const first = speaking.indexOf(true);
  const last = speaking.lastIndexOf(true);
  const pauses = [];
  if (first >= 0) {
    let runStart = null;
    for (let i = first; i <= last; i++) {
      if (!speaking[i]) { if (runStart === null) runStart = i; } else if (runStart !== null) {
        const len = (i - runStart) * FRAME;
        if (len >= 0.6) pauses.push({ start: frames[runStart].t, end: frames[i].t, len });
        runStart = null;
      }
    }
  }
  const longPauses = pauses.filter((p) => p.len >= 2).length;
  const spanSec = first >= 0 ? frames[last].t - frames[first].t : 0;
  const speakingSec = speaking.filter(Boolean).length * FRAME;
  const words = countWords(transcript);
  const minutes = Math.max(spanSec, 1) / 60;
  const wpm = words >= 8 && spanSec >= 6 ? Math.round(words / minutes) : null;
  const fillers = countIn(transcript, FILLERS[lang] || FILLERS.en);
  const hedges = countIn(transcript, HEDGES[lang] || HEDGES.en);
  const voiced = frames.filter((f, i) => speaking[i] && f.pitch > 0).map((f) => f.pitch);
  const pitchVariation = voiced.length > 10 ? Math.round((std(voiced) / mean(voiced)) * 1000) / 1000 : null;
  const loud = frames.filter((_, i) => speaking[i]).map((f) => f.rms);
  const tail = loud.slice(Math.floor(loud.length * 0.85));
  const trailingOff = loud.length > 40 && mean(tail) < mean(loud) * 0.6;
  const startDelaySec = first >= 0 ? Math.round(frames[first].t * 10) / 10 : Math.round(duration * 10) / 10;
  const fillersPerMin = Math.round((fillers / minutes) * 10) / 10;
  const longPerMin = longPauses / minutes;

  const pace = wpm == null ? null : clamp10(10 - Math.max(0, wpm < 120 ? 120 - wpm : wpm > 165 ? wpm - 165 : 0) / 8);
  const fluency = first < 0 ? null : clamp10(10 - longPerMin * 1.6 - fillersPerMin * 0.8 - (pauses.length / minutes > 9 ? 1 : 0));
  // Without recognised words, hedges can't be counted: don't hand out a perfect score on half the evidence.
  const confidenceRaw = 10 - Math.max(0, startDelaySec - 3) * 0.6 - (hedges / minutes) * 1.2 - (trailingOff ? 1.5 : 0) - (pitchVariation != null && pitchVariation < 0.06 ? 1 : 0);
  const confidence = first < 0 ? null : clamp10(words >= 8 ? confidenceRaw : Math.min(8, confidenceRaw));

  return {
    metrics: {
      durationSec: Math.round(duration * 10) / 10,
      speakingSec: Math.round(speakingSec * 10) / 10,
      words,
      wpm,
      fillers,
      fillersPerMin,
      longPauses,
      pauses: pauses.length,
      hedges,
      startDelaySec,
      pitchVariation,
      trailingOff
    },
    pauseList: pauses,
    scores: { pace, fluency, confidence },
    silent: first < 0
  };
};

const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
};

export const recordingSupported = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
export const speechRecognitionSupported = () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// state: idle | requesting | recording | processing | done | error
export function useRecorder() {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [live, setLive] = useState({ level: 0, seconds: 0, words: 0, transcript: '' });
  const [result, setResult] = useState(null);
  const r = useRef(null);

  const cleanup = useCallback(() => {
    const cur = r.current;
    if (!cur) return;
    cur.recording = false;
    clearInterval(cur.timer);
    try { cur.sr?.abort(); } catch { /* already stopped */ }
    cur.stream?.getTracks().forEach((tr) => tr.stop());
    if (cur.ctx && cur.ctx.state !== 'closed') cur.ctx.close().catch(() => {});
  }, []);

  // Stop the microphone when the screen goes away; free the last recording's memory too.
  const urlRef = useRef(null);
  useEffect(() => () => {
    cleanup();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, [cleanup]);

  const start = useCallback(async ({ lang = 'en' } = {}) => {
    setError('');
    setResult(null);
    if (!recordingSupported()) { setState('error'); setError('unsupported'); return; }
    setState('requesting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      setState('error');
      setError(err?.name === 'NotAllowedError' ? 'denied' : 'nomic');
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    rec.start(250);

    let finalText = '';
    let interim = '';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let sr = null;
    const cur = { stream, ctx, rec, chunks, frames: [], recording: true, lang, getText: () => `${finalText} ${interim}`.trim() };
    if (SR) {
      sr = new SR();
      sr.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      sr.continuous = true;
      sr.interimResults = true;
      sr.onresult = (e) => {
        interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += `${res[0].transcript} `;
          else interim += res[0].transcript;
        }
      };
      // Chrome ends recognition after a silence; carry on while recording.
      sr.onend = () => { if (cur.recording) { try { sr.start(); } catch { /* restarting too fast */ } } };
      sr.onerror = () => {};
      try { sr.start(); } catch { /* not allowed here */ }
    }
    cur.sr = sr;
    const t0 = performance.now();
    let tick = 0;
    cur.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const t = (performance.now() - t0) / 1000;
      const pitch = tick % 4 === 0 && rms > 0.015 ? detectPitch(buf, ctx.sampleRate) : 0;
      cur.frames.push({ t, rms, pitch });
      if (tick % 3 === 0) {
        const text = cur.getText();
        setLive({ level: Math.min(1, rms * 9), seconds: t, words: countWords(text), transcript: text });
      }
      tick++;
      if (t > 300) cur.stopNow?.(); // five minutes is plenty for one answer
    }, FRAME * 1000);
    r.current = cur;
    setState('recording');
  }, []);

  const stop = useCallback(async () => {
    const cur = r.current;
    if (!cur || !cur.recording) return;
    cur.recording = false;
    setState('processing');
    clearInterval(cur.timer);
    try { cur.sr?.stop(); } catch { /* already stopped */ }
    const blob = await new Promise((res) => {
      cur.rec.onstop = () => res(new Blob(cur.chunks, { type: cur.rec.mimeType || 'audio/webm' }));
      try { cur.rec.stop(); } catch { res(new Blob(cur.chunks)); }
    });
    // Let the last words arrive from recognition.
    await new Promise((res) => setTimeout(res, 700));
    const transcript = cur.getText();
    cleanup();
    const a = analyse(cur.frames, transcript, cur.lang);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(blob);
    setResult({ blob, url: urlRef.current, mime: blob.type, frames: cur.frames, transcript, ...a });
    setState('done');
  }, [cleanup]);

  useEffect(() => { if (r.current) r.current.stopNow = stop; }, [stop, state]);

  const reset = useCallback(() => { cleanup(); setResult(null); setState('idle'); setLive({ level: 0, seconds: 0, words: 0, transcript: '' }); }, [cleanup]);

  return { state, error, live, result, start, stop, reset };
}
