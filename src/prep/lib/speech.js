// Reading questions aloud with the device's own voice (free - no AI). Devices differ a lot: Edge has natural
// "Online (Natural)" voices, Chrome has Google voices, iPhones and Macs have Rishi / Veena and enhanced voices,
// while Windows' old "Desktop" voices sound robotic. We pick the most natural English voice the device has
// (Indian English first) and speak at a natural pace. One thing is spoken at a time, across the whole page.
const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
export const speechSupported = () => !!synth() && typeof window.SpeechSynthesisUtterance === 'function';

const NATURAL = /natural|neural|online|enhanced|premium|wavenet|studio/i;
// Old or joke voices: robotic Windows "Desktop" (SAPI) voices, eSpeak, and macOS novelty voices.
const ROBOTIC = /desktop|espeak|compact|\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
const INDIAN_NAMES = /\b(rishi|veena|neerja|prabhat|aarav|ananya|kajal|isha|lekha)\b/i;

// How natural a voice will sound; -100 = not English. Higher is better.
export const scoreVoice = (v) => {
  const lang = String(v?.lang || '').replace('_', '-').toLowerCase();
  if (!lang.startsWith('en')) return -100;
  const name = `${v.name || ''} ${v.voiceURI || ''}`;
  let s = lang === 'en-in' ? 30 : ['en-gb', 'en-us', 'en-au', 'en-ie', 'en-ca', 'en-nz', 'en-za'].includes(lang) ? 10 : 5;
  if (NATURAL.test(name)) s += 45;
  if (/google/i.test(name)) s += 25;
  if (INDIAN_NAMES.test(name)) s += 15;
  if (ROBOTIC.test(name)) s -= 40;
  // Windows' own Microsoft voices are the old robotic ones unless they are the newer "Natural" ones.
  else if (/microsoft/i.test(name) && !NATURAL.test(name)) s -= 25;
  if (v.default) s += 2;
  return s;
};
// The best English voice there is (even a robotic one beats none); null when there is no English voice.
export const pickVoice = (voices) => {
  let best = null;
  for (const v of voices || []) if (scoreVoice(v) > -100 && (!best || scoreVoice(v) > scoreVoice(best))) best = v;
  return best;
};

// Short pieces: some browsers cut a long utterance off after about 15 seconds.
export const splitForSpeech = (text) => String(text || '').replace(/\s+/g, ' ').trim()
  .split(/(?<=[.?!])\s+/)
  .flatMap((s) => (s.length <= 220 ? [s] : s.split(/(?<=[,;:])\s+/)))
  .filter(Boolean);

// Voices load late in some browsers (Chrome fires "voiceschanged" afterwards).
const voicesNow = () => synth()?.getVoices() || [];
const loadVoices = () => new Promise((resolve) => {
  const s = synth();
  if (!s) { resolve([]); return; }
  if (voicesNow().length) { resolve(voicesNow()); return; }
  const done = () => { s.removeEventListener?.('voiceschanged', done); resolve(voicesNow()); };
  s.addEventListener?.('voiceschanged', done);
  setTimeout(done, 1500);
});

// Who is speaking (an id per button), so every speaker button shows the right state.
let current = null;
const listeners = new Set();
const setCurrent = (id) => { current = id; listeners.forEach((fn) => fn(id)); };
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const speakingId = () => current;

let token = 0;
let watch = null;
export function stop() {
  token += 1;
  clearInterval(watch);
  synth()?.cancel();
  if (current !== null) setCurrent(null);
}

// Speaks `text` (stopping anything else). Called straight from a tap, so iPhones allow it.
export function speak(text, id) {
  const s = synth();
  const parts = splitForSpeech(text);
  if (!s || !parts.length) return;
  const wasBusy = s.speaking || s.pending;
  stop();
  const my = token;
  setCurrent(id);
  const run = (voices) => {
    if (my !== token) return;
    const voice = pickVoice(voices);
    let i = 0;
    let started = false;
    const next = () => {
      if (my !== token) return;
      if (i >= parts.length) { stop(); return; }
      const u = new window.SpeechSynthesisUtterance(parts[i++]);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-IN';
      // Natural voices sound right at normal speed; older ones are clearer a touch slower.
      u.rate = voice && (NATURAL.test(voice.name) || /google/i.test(voice.name)) ? 1 : 0.95;
      u.pitch = 1;
      u.onstart = () => { started = true; };
      u.onend = next;
      u.onerror = () => { if (my === token) stop(); };
      s.speak(u);
    };
    next();
    // Some browsers never report the end, or never start at all (a broken or missing speech engine): the
    // button resets when nothing is speaking for a moment, when nothing has started after 5 seconds, and
    // in any case after the longest the question could take.
    const began = Date.now();
    const words = parts.join(' ').split(/\s+/).length;
    const longest = 6000 + words * 700;
    let quiet = 0;
    clearInterval(watch);
    watch = setInterval(() => {
      if (my !== token) { clearInterval(watch); return; }
      const elapsed = Date.now() - began;
      quiet = s.speaking && !s.pending ? 0 : s.pending ? quiet : quiet + 1;
      if (quiet >= 4 || (!started && elapsed > 5000) || elapsed > longest) stop();
    }, 500);
  };
  const ready = voicesNow();
  // Chrome can drop a new utterance said in the same instant as cancelling one: a short wait then.
  if (ready.length && !wasBusy) run(ready);
  else if (ready.length) setTimeout(() => run(ready), 80);
  else loadVoices().then(run);
}

// Nothing keeps talking once the page is hidden or left.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
}
