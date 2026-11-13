// How the candidate carries themselves, measured on their own device. The camera image is handed to a
// small face-tracking model running in the browser (MediaPipe Face Landmarker); only numbers leave
// the page - "looked toward the board 82% of the time" - never the video.
//
// usePresence(on) owns the one camera stream the interview room uses: the self-view, the head-follow
// effect in the 3D room, and the per-answer measurements the board takes into account.
import { useCallback, useEffect, useRef, useState } from 'react';

const MP_VERSION = '1.2.2';
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const FRAME_MS = 100;

// Phones are left out of the interview room: the camera, the board and the answer need a bigger screen.
// Tablets (shortest side 600 px or more) and laptops are in.
export const isPhone = () => {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const shortest = Math.min(window.screen?.width || 9999, window.screen?.height || 9999);
  return !!coarse && shortest < 600;
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// One camera frame -> what the face is doing. Landmark numbers are MediaPipe's 478-point face mesh:
// 1 nose tip, 33 / 263 outer eye corners, 10 top of the forehead, 152 chin.
const readFace = (result) => {
  const lm = result?.faceLandmarks?.[0];
  if (!lm) return null;
  const nose = lm[1];
  const le = lm[33];
  const re = lm[263];
  const top = lm[10];
  const chin = lm[152];
  const eyeX = (le.x + re.x) / 2;
  const eyeY = (le.y + re.y) / 2;
  const eyeDist = Math.hypot(re.x - le.x, re.y - le.y) || 0.0001;
  const faceH = Math.max(0.0001, chin.y - top.y);
  const shapes = {};
  for (const c of result.faceBlendshapes?.[0]?.categories || []) shapes[c.categoryName] = c.score;
  const b = (k) => shapes[k] || 0;
  return {
    cx: (top.x + chin.x) / 2,
    cy: (top.y + chin.y) / 2,
    size: eyeDist,
    yaw: (nose.x - eyeX) / eyeDist, // about 0.3 at a 30-degree turn
    pitch: (nose.y - eyeY) / faceH, // grows when the head drops
    roll: (Math.atan2(re.y - le.y, re.x - le.x) * 180) / Math.PI,
    gazeSide: Math.max(Math.min(b('eyeLookOutLeft'), b('eyeLookInRight')), Math.min(b('eyeLookInLeft'), b('eyeLookOutRight'))),
    gazeDown: (b('eyeLookDownLeft') + b('eyeLookDownRight')) / 2,
    blink: (b('eyeBlinkLeft') + b('eyeBlinkRight')) / 2,
    smile: (b('mouthSmileLeft') + b('mouthSmileRight')) / 2
  };
};

// How the face compares with where the candidate sat and looked when the interview began.
const judge = (f, base) => {
  const turned = Math.abs(f.yaw - base.yaw) > 0.27;
  const dropped = f.pitch - base.pitch > 0.075;
  const raised = base.pitch - f.pitch > 0.09;
  const eyesDown = f.blink < 0.45 && f.gazeDown > 0.55;
  const eyesAside = f.blink < 0.45 && f.gazeSide > 0.6;
  const down = dropped || eyesDown;
  return {
    toward: !turned && !down && !raised && !eyesAside,
    down,
    lean: Math.abs(f.roll - base.roll) > 13 || Math.abs(f.cx - base.cx) > 0.16,
    slump: f.cy - base.cy > 0.12,
    near: f.size / base.size > 1.4 || f.size / base.size < 0.7,
    smile: f.smile > 0.4
  };
};

const newTally = () => ({ start: performance.now(), frames: 0, face: 0, toward: 0, down: 0, lean: 0, slump: 0, near: 0, restless: 0, smile: 0, lookAways: 0, longestAway: 0, awaySince: null, held: 0, heldSince: null });

// Close an away stretch: 2 s or more counts as looking away.
const endAway = (tally, now) => {
  if (tally.awaySince == null) return;
  const secs = (now - tally.awaySince) / 1000;
  if (secs >= 2) {
    tally.lookAways += 1;
    tally.longestAway = Math.max(tally.longestAway, secs);
  }
  tally.awaySince = null;
};

const summarise = (tally, now) => {
  endAway(tally, now);
  const seconds = Math.max(0, (now - tally.start - tally.held) / 1000);
  if (!tally.frames) return { tracked: false, seconds: Math.round(seconds) };
  const share = (n) => Math.round((tally.face ? n / tally.face : 0) * 100) / 100;
  return {
    tracked: true,
    seconds: Math.round(seconds),
    absent: Math.round((1 - tally.face / tally.frames) * 100) / 100,
    eyeContact: Math.round((tally.toward / tally.frames) * 100) / 100, // time out of view counts as not facing the board
    lookAways: tally.lookAways,
    longestAway: Math.round(tally.longestAway),
    down: share(tally.down),
    lean: share(tally.lean),
    slump: share(tally.slump),
    near: share(tally.near),
    restless: share(tally.restless),
    smile: share(tally.smile)
  };
};

// Words a minute and filler words for a spoken answer (typed answers have neither).
const FILLERS = /\b(um+|uh+|erm|hmm+|basically|actually|you know|i mean|sort of|kind of|like i said)\b/gi;
export const speechStats = (text, seconds, spoken) => {
  const words = (String(text || '').trim().match(/\S+/g) || []).length;
  if (!spoken || !words || seconds < 5) return { wpm: null, fillers: null };
  return { wpm: Math.round(words / (seconds / 60)), fillers: (String(text).match(FILLERS) || []).length };
};

// status: 'off' | 'starting' | 'ready' (camera and tracking) | 'camera-only' (tracking could not load)
//       | 'denied' (no camera permission) | 'no-camera'
// live: { face, toward } refreshed while running. listen({ onMove, onAway }) sets the handlers:
// onMove(x, y) follows the head; onAway(seconds) fires once per stretch when the candidate has looked
// away for 5 s during an answer.
export function usePresence(on) {
  const [status, setStatus] = useState('off');
  const [live, setLive] = useState({ face: false, toward: false });
  const [retry, setRetry] = useState(0);
  const videoEls = useRef(new Set());
  const streamRef = useRef(null);
  const recent = useRef([]); // the last few seconds of faces, for setting the baseline
  const base = useRef(null);
  const tally = useRef(null);
  const lastCenter = useRef(null);
  const motion = useRef([]);
  const awayFired = useRef(false);
  const cbs = useRef({});

  useEffect(() => {
    if (!on) return undefined;
    let stopped = false;
    let timer = 0;
    let landmarker = null;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;

    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      let face = null;
      if (landmarker && video.readyState >= 2 && video.videoWidth) {
        try { face = readFace(landmarker.detectForVideo(video, now)); } catch { /* a dropped frame */ }
      }
      if (face) {
        recent.current.push({ ...face, at: now });
        while (recent.current.length && now - recent.current[0].at > 3000) recent.current.shift();
        // Restlessness: how far the head travelled in the last second.
        if (lastCenter.current) motion.current.push({ d: Math.hypot(face.cx - lastCenter.current.cx, face.cy - lastCenter.current.cy), at: now });
        lastCenter.current = face;
        while (motion.current.length && now - motion.current[0].at > 1000) motion.current.shift();
      }
      const b = base.current;
      const j = face && b ? judge(face, b) : null;
      // Follow slow drift (a chair moved back) using only frames where the candidate faces the board.
      if (face && b && j.toward) for (const k of ['cx', 'cy', 'size', 'yaw', 'pitch', 'roll']) b[k] += (face[k] - b[k]) * 0.003;

      const t = tally.current;
      if (t && t.heldSince == null) {
        t.frames += 1;
        if (face) {
          t.face += 1;
          if (j) {
            if (j.toward) t.toward += 1;
            if (j.down) t.down += 1;
            if (j.lean) t.lean += 1;
            if (j.slump) t.slump += 1;
            if (j.near) t.near += 1;
            if (j.smile) t.smile += 1;
          }
          if (motion.current.reduce((n, m) => n + m.d, 0) > 0.09) t.restless += 1;
        }
        const away = !face || (j && !j.toward);
        if (away) {
          if (t.awaySince == null) { t.awaySince = now; awayFired.current = false; }
          if (!awayFired.current && now - t.awaySince > 5000) { awayFired.current = true; cbs.current.onAway?.((now - t.awaySince) / 1000); }
        } else endAway(t, now);
      }
      if (face && b) cbs.current.onMove?.(-(face.cx - b.cx) * 4.5, -(face.cy - b.cy) * 4);
      setLive((l) => {
        const next = { face: !!face, toward: !!(j ? j.toward : face) };
        return l.face === next.face && l.toward === next.toward ? l : next;
      });
      timer = setTimeout(tick, Math.max(10, FRAME_MS - (performance.now() - now)));
    };

    (async () => {
      setStatus('starting');
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('no-camera'); return; }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      } catch (err) {
        if (!stopped) setStatus(err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError' ? 'no-camera' : 'denied');
        return;
      }
      if (stopped) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      streamRef.current = stream;
      for (const el of videoEls.current) el.srcObject = stream;
      video.srcObject = stream;
      await video.play().catch(() => {});
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const files = await FilesetResolver.forVisionTasks(MP_WASM);
        const options = (delegate) => ({ baseOptions: { modelAssetPath: MP_MODEL, delegate }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
        try { landmarker = await FaceLandmarker.createFromOptions(files, options('GPU')); } catch { landmarker = await FaceLandmarker.createFromOptions(files, options('CPU')); }
        if (stopped) { landmarker.close(); return; }
        setStatus('ready');
      } catch {
        if (!stopped) setStatus('camera-only');
      }
      tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      try { landmarker?.close(); } catch { /* already closed */ }
      setStatus('off');
      setLive({ face: false, toward: false });
    };
  }, [on, retry]);

  // A <video> that shows the candidate to themselves (mirrored by the caller).
  const attach = useCallback((el) => {
    if (!el) return;
    videoEls.current.add(el);
    if (streamRef.current) el.srcObject = streamRef.current;
  }, []);

  // "This is how I sit and where I look": taken from the last 1.5 s when the interview begins.
  // Returns false when no face was seen.
  const calibrate = useCallback(() => {
    const now = performance.now();
    const faces = recent.current.filter((f) => now - f.at < 1500);
    if (faces.length < 3) return false;
    base.current = Object.fromEntries(['cx', 'cy', 'size', 'yaw', 'pitch', 'roll'].map((k) => [k, median(faces.map((f) => f[k]))]));
    return true;
  }, []);

  const listen = useCallback((handlers) => { cbs.current = handlers || {}; }, []);

  const startAnswer = useCallback(() => { tally.current = newTally(); awayFired.current = false; }, []);

  // While paused, nothing is counted.
  const hold = useCallback((held) => {
    const t = tally.current;
    if (!t) return;
    const now = performance.now();
    if (held && t.heldSince == null) { endAway(t, now); t.heldSince = now; }
    if (!held && t.heldSince != null) { t.held += now - t.heldSince; t.heldSince = null; }
  }, []);

  // The numbers for the answer just given (null if no answer was being measured).
  const endAnswer = useCallback(() => {
    const t = tally.current;
    tally.current = null;
    if (!t) return null;
    hold(false);
    if (!base.current) return { tracked: false, seconds: Math.round((performance.now() - t.start - t.held) / 1000) };
    return summarise(t, performance.now());
  }, [hold]);

  const tracking = status === 'ready';
  return { status, live: { ...live, face: live.face && tracking }, attach, listen, calibrate, startAnswer, endAnswer, hold, retry: () => setRetry((n) => n + 1) };
}
