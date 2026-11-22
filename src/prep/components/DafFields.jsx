// Inputs for the DAF form: big text fields, suggestion lists, chips for lists (hobbies, languages,
// services), and the education and work rows. `unsure` marks a field AI found hard to read.
import { useId, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { useT } from '../lib/i18n';

const inputCls = 'prep-focus w-full h-14 rounded-2xl border border-border-default bg-surface px-4 text-[17px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-primary transition-colors';

export function FieldShell({ label, hint, unsure, children, htmlFor }) {
  const { t } = useT();
  return (
    <div className={unsure ? 'rounded-3xl bg-amber-50 dark:bg-amber-400/10 ring-1 ring-amber-300 dark:ring-amber-400/40 p-3 -m-3' : ''}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label htmlFor={htmlFor} className="text-[15px] font-semibold text-text-primary">{label}</label>
        {unsure && <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300"><Icon name="alert" className="w-3.5 h-3.5" />{t('daf.check')}</span>}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-sm text-text-tertiary">{hint}</p>}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, hint, unsure, suggestions, maxLength = 200, readOnly = false }) {
  const id = useId();
  const listId = suggestions?.length ? `${id}-list` : undefined;
  const cls = readOnly ? `${inputCls.replace('bg-surface', 'bg-sunken').replace('text-text-primary', 'text-text-secondary')} cursor-not-allowed` : inputCls;
  return (
    <FieldShell label={label} hint={hint} unsure={unsure} htmlFor={id}>
      <input id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={readOnly ? '' : placeholder} maxLength={maxLength} list={listId} className={cls} autoComplete="off" readOnly={readOnly} aria-readonly={readOnly || undefined} />
      {listId && <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
    </FieldShell>
  );
}

export function SelectField({ label, value, onChange, options, unsure }) {
  const { t } = useT();
  const id = useId();
  return (
    <FieldShell label={label} unsure={unsure} htmlFor={id}>
      <div className="relative">
        <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} className={`${inputCls} appearance-none pr-12 cursor-pointer`}>
          <option value="">{t('f.choose')}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Icon name="chevronDown" className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary" />
      </div>
    </FieldShell>
  );
}

// A list of short items as chips: type and press Enter (or comma), or tap a suggestion.
export function ChipsField({ label, value = [], onChange, suggestions = [], unsure, max = 15, ordered = false }) {
  const { t } = useT();
  const id = useId();
  const [draft, setDraft] = useState('');
  const has = (s) => value.some((v) => v.toLowerCase() === s.toLowerCase());
  const add = (s) => {
    const v = s.trim().replace(/,$/, '');
    if (!v || has(v) || value.length >= max) return;
    onChange([...value, v.slice(0, 80)]);
    setDraft('');
  };
  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  const left = suggestions.filter((s) => !has(s)).slice(0, 14);
  return (
    <FieldShell label={label} unsure={unsure} htmlFor={id}>
      <div className="rounded-2xl border border-border-default bg-surface px-3 py-2.5 focus-within:border-text-primary transition-colors">
        <div className="flex flex-wrap gap-2">
          {value.map((v, i) => (
            <span key={v} className="inline-flex items-center gap-1.5 h-9 pl-3.5 pr-1.5 rounded-full bg-text-primary text-page text-sm font-semibold">
              {ordered && <span className="prep-num text-page/60">{i + 1}.</span>}{v}
              <button type="button" onClick={() => remove(i)} aria-label={`${t('f.remove')} ${v}`} className="prep-focus w-6 h-6 rounded-full flex items-center justify-center hover:bg-page/20 cursor-pointer"><Icon name="x" className="w-3.5 h-3.5" /></button>
            </span>
          ))}
          <input
            id={id}
            value={draft}
            onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); add(draft); }
              if (e.key === 'Backspace' && !draft && value.length) remove(value.length - 1);
            }}
            onBlur={() => draft && add(draft)}
            placeholder={value.length ? '' : t('f.addChip')}
            className="flex-1 min-w-[10rem] h-9 bg-transparent text-[16px] outline-none placeholder:text-text-tertiary"
          />
        </div>
      </div>
      {left.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-text-tertiary mr-1">{t('f.suggestions')}</span>
          {left.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="prep-focus h-8 px-3 rounded-full border border-dashed border-border-default text-sm text-text-secondary hover:border-text-primary hover:text-text-primary cursor-pointer">+ {s}</button>
          ))}
        </div>
      )}
    </FieldShell>
  );
}

// Rows of objects (education, work) with an "add another" button.
export function RowsField({ label, rows = [], onChange, fields, addLabel, unsure, max = 5 }) {
  const { t } = useT();
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <FieldShell label={label} unsure={unsure}>
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={i} className="relative rounded-3xl border border-border-default bg-surface p-4 md:p-5">
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={t('f.remove')} className="prep-focus absolute right-3 top-3 w-9 h-9 rounded-full flex items-center justify-center text-text-tertiary hover:text-status-danger-text hover:bg-status-danger-bg cursor-pointer">
              <Icon name="trash" className="w-4 h-4" />
            </button>
            <div className="grid sm:grid-cols-2 gap-4 pr-8">
              {fields.map((f) => (
                <TextField key={f.key} label={f.label} value={r[f.key]} onChange={(v) => set(i, f.key, v)} suggestions={f.suggestions} placeholder={f.placeholder} maxLength={f.max || 120} />
              ))}
            </div>
          </div>
        ))}
        {rows.length < max && (
          <button type="button" onClick={() => onChange([...rows, Object.fromEntries(fields.map((f) => [f.key, '']))])}
            className="prep-focus w-full h-14 rounded-2xl border-2 border-dashed border-border-default text-text-secondary hover:border-text-primary hover:text-text-primary font-semibold flex items-center justify-center gap-2 cursor-pointer">
            <Icon name="plus" className="w-5 h-5" />{addLabel}
          </button>
        )}
      </div>
    </FieldShell>
  );
}
