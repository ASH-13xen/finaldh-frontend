// A student's progress on one question: the four-step status, "save for later", and their answer notes.
// All of it goes through the section's prep store (lib/usePrepStore.js).
import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { useT } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { STATUSES } from '../lib/usePrepStore';

export function StatusPicker({ qkey, info, compact = false }) {
  const { t } = useT();
  const { prep } = usePrep();
  const status = prep.items.get(qkey)?.status || 'todo';
  const at = STATUSES.indexOf(status);
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label={t('status.label')} className="flex items-center gap-1">
        {STATUSES.map((s, i) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            title={t(`status.${s}`)}
            aria-label={t(`status.${s}`)}
            onClick={() => prep.update(qkey, { status: s }, info)}
            className="prep-focus group h-8 flex items-center cursor-pointer rounded-full"
          >
            <span className={`block h-2.5 rounded-full transition-all duration-300 ${compact ? 'w-5' : 'w-7'} ${i <= at && at > 0 ? 'bg-brand' : 'bg-border-default group-hover:bg-text-tertiary'} ${i === 0 && at === 0 ? 'bg-text-tertiary/40' : ''}`} />
          </button>
        ))}
      </div>
      <span className={`text-sm font-semibold ${at > 0 ? 'text-brand' : 'text-text-tertiary'}`}>{t(`status.${status}`)}</span>
    </div>
  );
}

export function SaveToggle({ qkey, info }) {
  const { t } = useT();
  const { prep } = usePrep();
  const saved = !!prep.items.get(qkey)?.saved;
  return (
    <button
      type="button"
      onClick={() => prep.update(qkey, { saved: !saved }, info)}
      aria-pressed={saved}
      title={saved ? t('action.saved') : t('action.save')}
      aria-label={saved ? t('action.saved') : t('action.save')}
      className={`prep-focus w-10 h-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${saved ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-400/15 dark:border-amber-400/40 dark:text-amber-300' : 'border-border-default text-text-tertiary hover:text-text-primary hover:border-text-primary'}`}
    >
      <Icon name="bookmark" filled={saved} className="w-[18px] h-[18px]" />
    </button>
  );
}

export function NoteEditor({ qkey, info, autoFocus = false }) {
  const { t } = useT();
  const { prep } = usePrep();
  const saved = prep.items.get(qkey)?.note || '';
  const [text, setText] = useState(saved);
  const [state, setState] = useState('idle');
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(420, el.scrollHeight + 2)}px`;
  }, [text]);

  const save = async () => {
    if (text === saved) return;
    setState('saving');
    const ok = await prep.update(qkey, { note: text }, info);
    setState(ok ? 'saved' : 'idle');
  };

  return (
    <div className="mt-4 rounded-2xl border border-border-default bg-sunken/50 p-3 md:p-4">
      <textarea
        ref={ref}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => { setText(e.target.value); setState('idle'); }}
        onBlur={save}
        maxLength={2000}
        rows={3}
        placeholder={t('notes.placeholder')}
        className="prep-focus w-full resize-none bg-transparent text-[15px] leading-relaxed text-text-primary placeholder:text-text-tertiary outline-none"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-text-tertiary">{state === 'saving' ? t('notes.saving') : state === 'saved' ? t('notes.saved') : `${text.length}/2000`}</span>
        <button type="button" onClick={save} disabled={text === saved} className="prep-focus text-sm font-semibold text-brand disabled:text-text-tertiary cursor-pointer disabled:cursor-default">
          {t('notes.save')}
        </button>
      </div>
    </div>
  );
}
