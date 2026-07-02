import { useState, useEffect, useRef } from 'react';
import { gsap } from '../lib/gsapSetup';

const getStepLabel = (step, isDownloading) => {
  if (isDownloading) return 'Downloading...';
  if (step <= 0) return 'Starting...';
  if (step <= 2) return 'Queuing your request...';
  if (step <= 5) return 'Generating PDF pages...';
  if (step <= 7) return 'Adding security watermarks...';
  return 'Almost ready!';
};

export default function DownloadProgressBar({ step, isDownloading, downloadPercent }) {
  const [stepCounter, setStepCounter] = useState(0);
  const fillRef = useRef(null);

  useEffect(() => {
    if (step > stepCounter) {
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

  const label = getStepLabel(stepCounter, isDownloading);

  return (
    <div className="w-full space-y-1 mt-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider leading-none truncate">
          {label}
        </span>
        <span className="text-[9px] font-bold tabular-nums text-text-tertiary shrink-0">
          {progressPercent}%
        </span>
      </div>
      <div className="w-full bg-sunken rounded-full h-1.5 overflow-hidden border border-border-subtle">
        <div ref={fillRef} className="bg-linear-to-r from-brand to-accent-400 h-1.5 rounded-full" style={{ width: '0%' }}></div>
      </div>
    </div>
  );
}
