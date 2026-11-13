// "The Window": the 3D room shifts as the viewer moves, as if the screen were a pane of glass.
// The viewer's head (from the camera tracker in interviewPresence.js) when they turn that on; otherwise
// the tablet's tilt or the mouse, from here. Each calls onMove(x, y, gain) with x/y in -1..1.
import { useEffect, useRef } from 'react';

export const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

// iOS only hands out motion data after a tap. Call this from a click handler; it is a no-op elsewhere.
export async function requestTiltPermission() {
  try {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') return (await D.requestPermission()) === 'granted';
    return !!D;
  } catch {
    return false;
  }
}

// Mouse on laptops, tilt on phones. `paused` stops reacting without unhooking.
export function useAmbientParallax(onMove, { enabled = true } = {}) {
  const cb = useRef(onMove);
  useEffect(() => { cb.current = onMove; });
  useEffect(() => {
    if (!enabled) return undefined;
    if (isTouchDevice()) {
      let base = null;
      const onTilt = (e) => {
        if (e.gamma == null || e.beta == null) return;
        // Whatever angle the phone is held at when the room opens is "straight ahead".
        if (!base) base = { g: e.gamma, b: e.beta };
        base.g += (e.gamma - base.g) * 0.002; // drift slowly toward how it is being held now
        base.b += (e.beta - base.b) * 0.002;
        const landscape = Math.abs(window.orientation || 0) === 90;
        const dx = (landscape ? e.beta - base.b : e.gamma - base.g) / 18;
        const dy = (landscape ? e.gamma - base.g : e.beta - base.b) / 22;
        cb.current?.(dx, -dy, 0.9);
      };
      window.addEventListener('deviceorientation', onTilt);
      return () => window.removeEventListener('deviceorientation', onTilt);
    }
    const onPointer = (e) => {
      if (e.pointerType === 'touch') return;
      cb.current?.((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1), 0.55);
    };
    window.addEventListener('pointermove', onPointer);
    return () => window.removeEventListener('pointermove', onPointer);
  }, [enabled]);
}
