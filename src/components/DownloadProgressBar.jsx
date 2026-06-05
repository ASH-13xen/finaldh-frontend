import React, { useState, useEffect } from 'react';

export default function DownloadProgressBar({ step, isDownloading, downloadPercent }) {
  const [stepCounter, setStepCounter] = useState(0);

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

  return (
    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden mt-1 border border-slate-800/80">
      <div 
        className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-2 rounded-full transition-all duration-350" 
        style={{ width: `${progressPercent}%` }}
      ></div>
    </div>
  );
}
