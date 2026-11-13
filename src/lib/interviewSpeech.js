// Voice for the mock interview, all in the browser:
//  - the panel speaks with speechSynthesis (one distinct voice per member, Indian English when installed)
//  - the candidate answers through SpeechRecognition (Chrome, Edge, Safari) with live captions
//  - browsers without it (Firefox) record with MediaRecorder and the server transcribes the clip
//  - a mic level meter drives the answer orb
import { useCallback, useEffect, useRef, useState } from 'react';

// ------------------------------------------------------------------ speaking

const VOICE_STYLE = {
  chairman: { rate: 0.94, pitch: 0.92 },
  m1: { rate: 1.0, pitch: 1.08 },
  m2: { rate: 0.98, pitch: 0.98 },
  m3: { rate: 1.02, pitch: 1.14 },
  m4: { rate: 0.97, pitch: 0.88 }
};

const loadVoices = () => new Promise((resolve) => {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!synth) return resolve([]);
  const have = synth.getVoices();
  if (have.length) return resolve(have);
  const done = () => resolve(synth.getVoices());
  synth.addEventListener?.('voiceschanged', done, { once: true });
  setTimeout(done, 1200);
});

// Indian English first, then other English voices; members get different ones where there are several.
const rankVoices = (voices) => {
  const score = (v) => (/en[-_]IN/i.test(v.lang) ? 0 : /^en[-_]GB/i.test(v.lang) ? 1 : /^en/i.test(v.lang) ? 2 : 9) + (v.localService ? 0 : 0.5);
  return voices.filter((v) => /^en/i.test(v.lang)).sort((a, b) => score(a) - score(b));
};

// Chrome cuts utterances off after ~15 s, so long questions are spoken sentence by sentence.
const chunks = (text) => String(text || '').match(/[^.!?]+[.!?]*\s*/g)?.map((s) => s.trim()).filter(Boolean) || [];

export function useSpeaker() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const token = useRef(0);

  useEffect(() => {
    if (!supported) return undefined;
    let alive = true;
    loadVoices().then((v) => { if (alive) setVoices(rankVoices(v)); });
    return () => { alive = false; window.speechSynthesis.cancel(); };
  }, [supported]);

  const voiceFor = useCallback((asker) => {
    if (!voices.length) return null;
    const order = ['chairman', 'm1', 'm2', 'm3', 'm4'];
    const i = Math.max(0, order.indexOf(asker));
    const indian = voices.filter((v) => /en[-_]IN/i.test(v.lang));
    const pool = indian.length >= 2 ? indian : voices;
    return pool[i % pool.length];
  }, [voices]);

  const stop = useCallback(() => {
    token.current += 1;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  // Resolves when the text has been spoken (or immediately when speech isn't available / was stopped).
  const speak = useCallback((text, asker = 'chairman') => new Promise((resolve) => {
    if (!supported || !text) { resolve(); return; }
    window.speechSynthesis.cancel();
    const my = ++token.current;
    const parts = chunks(text);
    const style = VOICE_STYLE[asker] || VOICE_STYLE.chairman;
    const voice = voiceFor(asker);
    setSpeaking(true);
    const next = (i) => {
      if (my !== token.current) { resolve(); return; }
      if (i >= parts.length) { setSpeaking(false); resolve(); return; }
      const u = new SpeechSynthesisUtterance(parts[i]);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-IN';
      u.rate = style.rate;
      u.pitch = style.pitch;
      u.onend = () => next(i + 1);
      u.onerror = () => next(i + 1);
      window.speechSynthesis.speak(u);
    };
    next(0);
  }), [supported, voiceFor]);

  return { supported, speaking, speak, stop, voiceCount: voices.length, hasIndianVoice: voices.some((v) => /en[-_]IN/i.test(v.lang)) };
}

// ------------------------------------------------------------------ the board's neural voice

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

// Natural voices from the server (Gemini text-to-speech): 16-bit PCM streamed from /api/interview, played
// with Web Audio as it arrives so the question starts about a second after it is asked. Each clip is
// kept, so "repeat the question" doesn't fetch it again. play() rejects when the server can't produce a
// voice (AI off, quota), and callers fall back to useSpeaker().
export function useBoardVoice() {
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourcesRef = useRef([]);
  const token = useRef(0);
  const cache = useRef(new Map());
  const inflightRef = useRef(new Map()); // clips being downloaded ahead of time, by key
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);

  const audio = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
    }
    return ctxRef.current;
  }, []);

  // Call from a click handler: browsers only let audio start after the user has interacted.
  const unlock = useCallback(() => { audio()?.resume().catch(() => {}); }, [audio]);

  const stopSources = () => {
    for (const s of sourcesRef.current) { try { s.stop(); } catch { /* already stopped */ } }
    sourcesRef.current = [];
  };

  const stop = useCallback(() => {
    token.current += 1;
    stopSources();
    setSpeaking(false);
  }, []);

  // Voice level for the speaking member's ring, while audio plays.
  useEffect(() => {
    if (!speaking || !analyserRef.current) return undefined;
    const an = analyserRef.current;
    const buf = new Uint8Array(an.fftSize);
    let raf;
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 5));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  // Download a clip in full ahead of time, so the next line starts the moment the last one ends.
  const prefetch = useCallback((key, url) => {
    if (cache.current.has(key) || inflightRef.current.has(key)) return;
    const job = (async () => {
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(`voice unavailable (${res.status})`);
      const rate = Number(res.headers.get('X-Sample-Rate')) || 24000;
      const buf = new Uint8Array(await res.arrayBuffer());
      const n = Math.floor(buf.length / 2);
      if (!n) throw new Error('voice returned no audio');
      const view = new DataView(buf.buffer, buf.byteOffset, n * 2);
      const samples = new Float32Array(n);
      for (let i = 0; i < n; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
      cache.current.set(key, { samples, rate });
      if (cache.current.size > 60) cache.current.delete(cache.current.keys().next().value);
    })().finally(() => inflightRef.current.delete(key));
    job.catch(() => {});
    inflightRef.current.set(key, job);
  }, []);

  const play = useCallback(async (key, url) => {
    const ctx = audio();
    if (!ctx) throw new Error('Web Audio is not supported');
    const my = ++token.current;
    stopSources();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    let at = ctx.currentTime + 0.05;
    let last = null;
    const schedule = (samples, rate) => {
      const b = ctx.createBuffer(1, samples.length, rate);
      b.copyToChannel(samples, 0);
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(analyserRef.current);
      if (at < ctx.currentTime) at = ctx.currentTime + 0.02;
      src.start(at);
      at += b.duration;
      sourcesRef.current.push(src);
      last = src;
    };
    const finished = () => new Promise((resolve) => {
      if (!last) { resolve(); return; }
      last.onended = resolve;
      setTimeout(resolve, Math.max(0, (at - ctx.currentTime) * 1000) + 800); // in case onended never fires
    });

    // A clip already downloading is used if it arrives within 2.5 s; a slow one is not waited for (the
    // voice service occasionally stalls), the clip is streamed afresh instead.
    const inflight = inflightRef.current.get(key);
    if (inflight) {
      await Promise.race([inflight.catch(() => {}), new Promise((resolve) => { setTimeout(resolve, 2500); })]);
      if (my !== token.current) return;
    }
    const cached = cache.current.get(key);
    if (cached) {
      setSpeaking(true);
      schedule(cached.samples, cached.rate);
      await finished();
      if (my === token.current) setSpeaking(false);
      return;
    }

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok || !res.body) throw new Error(`voice unavailable (${res.status})`);
    if (my !== token.current) return;
    const rate = Number(res.headers.get('X-Sample-Rate')) || 24000;
    const reader = res.body.getReader();
    const minChunk = Math.round(rate * 0.2); // ~0.2 s per scheduled buffer keeps playback smooth
    const parts = [];
    let pending = [];
    let pendingLen = 0;
    let carry = null;
    const flush = () => {
      if (!pendingLen) return;
      const merged = new Float32Array(pendingLen);
      let o = 0;
      for (const p of pending) { merged.set(p, o); o += p.length; }
      pending = [];
      pendingLen = 0;
      if (!last) setSpeaking(true);
      schedule(merged, rate);
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (my !== token.current) { reader.cancel().catch(() => {}); return; }
      if (done) break;
      let bytes = value;
      if (carry) { const m = new Uint8Array(carry.length + bytes.length); m.set(carry); m.set(bytes, carry.length); bytes = m; carry = null; }
      if (bytes.length % 2) { carry = bytes.slice(-1); bytes = bytes.slice(0, -1); }
      const n = bytes.length / 2;
      if (!n) continue;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
      const f = new Float32Array(n);
      for (let i = 0; i < n; i++) f[i] = view.getInt16(i * 2, true) / 32768;
      parts.push(f);
      pending.push(f);
      pendingLen += n;
      if (pendingLen >= minChunk) flush();
    }
    flush();
    if (!parts.length) throw new Error('voice returned no audio');

    const total = parts.reduce((n, p) => n + p.length, 0);
    const whole = new Float32Array(total);
    let o = 0;
    for (const p of parts) { whole.set(p, o); o += p.length; }
    cache.current.set(key, { samples: whole, rate });
    if (cache.current.size > 40) cache.current.delete(cache.current.keys().next().value);

    await finished();
    if (my === token.current) setSpeaking(false);
  }, [audio]);

  useEffect(() => () => { token.current += 1; stopSources(); ctxRef.current?.close().catch(() => {}); }, []);

  return { play, prefetch, stop, unlock, speaking, level: speaking ? level : 0 };
}

// ------------------------------------------------------------------ listening (Web Speech API)

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const speechRecognitionSupported = () => !!Recognition;

// Continuous dictation. Chrome ends a recognition session after a pause or ~60 s, so it is restarted
// for as long as `listening` is wanted; finished phrases accumulate in `text`.
export function useDictation({ lang = 'en-IN' } = {}) {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const rec = useRef(null);
  const want = useRef(false);
  const finalRef = useRef('');
  const interimRef = useRef('');

  const make = useCallback(() => {
    const r = new Recognition();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current = `${finalRef.current} ${res[0].transcript}`.replace(/\s+/g, ' ').trim();
        else live += res[0].transcript;
      }
      interimRef.current = live.trim();
      setText(finalRef.current);
      setInterim(interimRef.current);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        want.current = false;
        setError('Microphone access is blocked. Allow it in the address bar, or type your answer.');
      } else if (e.error === 'network') {
        setError('Speech recognition needs an internet connection.');
      }
    };
    r.onend = () => {
      interimRef.current = '';
      setInterim('');
      if (want.current) {
        try { r.start(); } catch { /* already starting */ }
      } else {
        setListening(false);
      }
    };
    return r;
  }, [lang]);

  const start = useCallback(() => {
    if (!Recognition) return;
    setError('');
    want.current = true;
    if (!rec.current) rec.current = make();
    try { rec.current.start(); } catch { /* already running */ }
    setListening(true);
  }, [make]);

  const stop = useCallback(() => {
    want.current = false;
    try { rec.current?.stop(); } catch { /* not running */ }
    setListening(false);
    // Fold any half-recognised phrase into the answer so nothing said is lost.
    if (interimRef.current) {
      finalRef.current = `${finalRef.current} ${interimRef.current}`.trim();
      interimRef.current = '';
      setText(finalRef.current);
    }
    setInterim('');
    return finalRef.current;
  }, []);

  const reset = useCallback((value = '') => {
    finalRef.current = value;
    interimRef.current = '';
    setText(value);
    setInterim('');
  }, []);

  useEffect(() => () => { want.current = false; try { rec.current?.abort(); } catch { /* noop */ } }, []);

  return { supported: !!Recognition, listening, text, interim, error, start, stop, reset, setText: reset };
}

// ------------------------------------------------------------------ recording fallback

export function useRecorder() {
  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
  const [recording, setRecording] = useState(false);
  const rec = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => window.MediaRecorder.isTypeSupported?.(t)) || '';
    const r = new window.MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunksRef.current = [];
    r.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
    r.start(1000);
    rec.current = r;
    setRecording(true);
  }, []);

  // Resolves with the recorded Blob.
  const stop = useCallback(() => new Promise((resolve) => {
    const r = rec.current;
    if (!r) { resolve(null); return; }
    r.onstop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setRecording(false);
      resolve(new Blob(chunksRef.current, { type: r.mimeType || 'audio/webm' }));
    };
    r.stop();
  }), []);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);
  return { supported, recording, start, stop };
}

// ------------------------------------------------------------------ mic level

// 0..1 loudness of the microphone, sampled every animation frame while `active`.
export function useMicLevel(active) {
  const [level, setLevel] = useState(0);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return undefined;
    let stream;
    let ctx;
    let raf;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        let smooth = 0;
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4);
          smooth = smooth * 0.75 + rms * 0.25;
          setLevel(smooth);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setDenied(true);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [active]);
  return { level: active ? level : 0, denied };
}

// ------------------------------------------------------------------ camera

// Self-view only: the video never leaves the device. `attach` is a callback ref for the <video>.
export function useCamera(on) {
  const videoEl = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!on || !navigator.mediaDevices?.getUserMedia) return undefined;
    let stopped = false;
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoEl.current) videoEl.current.srcObject = s;
        setError('');
      })
      .catch(() => setError('Camera unavailable'));
    return () => { stopped = true; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [on]);
  const attach = useCallback((el) => {
    videoEl.current = el;
    if (el && streamRef.current) el.srcObject = streamRef.current;
  }, []);
  return { attach, error };
}
