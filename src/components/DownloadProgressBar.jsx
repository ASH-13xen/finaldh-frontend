import { useState, useEffect, useRef } from 'react';
import { gsap } from '../lib/gsapSetup';

export default function DownloadProgressBar({ step, isDownloading, downloadPercent }) {
  const [stepCounter, setStepCounter] = useState(0);
  const fillRef = useRef(null);

  useEffect(() => {
    if (step > stepCounter) {
      console.log(`[Progress Bar] Incrementing progress step counter: ${stepCounter} -> ${step}`);
      setStepCounter(step);
    }
  }, [step, stepCounter]);

  // Reset counter when download resets (no active step or isDownloading finishes)
  useEffect(() => {
    if (step === 0 && !isDownloading) {
      setStepCounter(0);
    }
  }, [step, isDownloading]);

  // Determine final progress percentage to fill the bar
  let progressPercent = 0;
  if (isDownloading) {
    progressPercent = downloadPercent;
  } else if (stepCounter > 0) {
    progressPercent = Math.round((stepCounter / 9) * 100);
  }

  useEffect(() => {
    if (!fillRef.current) return;
    gsap.to(fillRef.current, { width: `${progressPercent}%`, duration: 0.5, ease: 'power3.out' });
  }, [progressPercent]);

  return (
    <div className="w-full bg-sunken rounded-full h-2 overflow-hidden mt-1 border border-border-subtle">
      <div ref={fillRef} className="bg-gradient-to-r from-brand to-accent-400 h-2 rounded-full" style={{ width: '0%' }}></div>
    </div>
  );
}
