// "Hear the question": reads a question aloud with the device's most natural voice (lib/speech.js). Tap again
// to stop. Shows nothing on a browser that can't speak. `variant`: 'icon' (a round button) or 'pill' (with a
// label); `dark` for dark backgrounds.
import { useEffect, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { useT } from '../lib/i18n';
import { speak, stop, subscribe, speakingId, speechSupported } from '../lib/speech';

export default function SpeakButton({ text, id, variant = 'icon', dark = false, label, className = '' }) {
  const { t } = useT();
  const key = id || text;
  const [on, setOn] = useState(() => speakingId() === key);
  useEffect(() => subscribe((cur) => setOn(cur === key)), [key]);
  // Leaving the screen (or the card closing) stops its question.
  useEffect(() => () => { if (speakingId() === key) stop(); }, [key]);
  if (!text || !speechSupported()) return null;
  const name = on ? t('speak.stop') : label || t('speak.hear');
  const click = (e) => {
    e.stopPropagation();
    if (on) stop(); else speak(text, key);
  };
  // Inside cards that react to taps or drags (flashcards), the button keeps the tap to itself.
  const keep = (e) => e.stopPropagation();
  const tone = dark
    ? 'border-white/20 text-white/85 hover:border-white hover:text-white'
    : 'border-border-default bg-surface text-text-secondary hover:text-text-primary hover:border-text-primary';
  const active = on ? (dark ? 'border-emerald-300 text-emerald-200' : 'border-brand text-brand') : '';
  return variant === 'pill' ? (
    <button type="button" onClick={click} onPointerDown={keep} aria-pressed={on} title={name}
      className={`prep-focus h-11 px-5 rounded-full border text-sm font-semibold inline-flex items-center gap-2 cursor-pointer ${tone} ${active} ${className}`}>
      <Icon name={on ? 'pause' : 'volume'} className="w-4 h-4" />{name}
    </button>
  ) : (
    <button type="button" onClick={click} onPointerDown={keep} aria-pressed={on} aria-label={name} title={name}
      className={`prep-focus w-9 h-9 shrink-0 rounded-full border flex items-center justify-center cursor-pointer ${tone} ${active} ${className}`}>
      <Icon name={on ? 'pause' : 'volume'} className="w-4 h-4" />
    </button>
  );
}
