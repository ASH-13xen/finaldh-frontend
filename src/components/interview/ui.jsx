import { useState } from 'react';
import Icon from '../mcq/Icon';
import { askerShort, ASKER_LABEL, yearsRange } from '../../lib/interviewApi';

// Building blocks shared by the Mock Interview screens. Colours come from the app's theme tokens, so
// every piece works in light and dark mode.

export function Shell({ children, wide = false }) {
  return <div className={`w-full ${wide ? 'max-w-7xl' : 'max-w-6xl'} mx-auto px-4 sm:px-6 pb-16`}>{children}</div>;
}

// Page header with the section's soft aurora wash. `onBack` adds a back link above the title.
export function PageHeader({ eyebrow, title, subtitle, actions, onBack, backLabel = 'Mock Interview' }) {
  return (
    <header className="relative -mx-4 sm:-mx-6 px-4 sm:px-6 pt-8 md:pt-10 pb-7 mb-8 iv-aurora border-b border-border-subtle">
      {onBack && (
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-tertiary hover:text-text-primary mb-4 cursor-pointer">
          <Icon name="arrowLeft" className="w-4 h-4" /> {backLabel}
        </button>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div className="max-w-3xl">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand mb-2">{eyebrow}</p>}
          <h1 className="text-3xl md:text-[2.6rem] leading-tight font-display font-bold text-text-primary tracking-tight">{title}</h1>
          {subtitle && <p className="text-base text-text-secondary mt-3 leading-relaxed">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({ children, className = '', as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`bg-surface/90 backdrop-blur border border-border-default rounded-3xl shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_32px_-18px_rgba(0,0,0,0.25)] ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 w-9 h-9 rounded-xl bg-accent-soft-bg border border-accent-soft-border text-brand flex items-center justify-center shrink-0">
            <Icon name={icon} className="w-[18px] h-[18px]" />
          </span>
        )}
        <div>
          <h2 className="text-lg font-bold text-text-primary leading-snug">{title}</h2>
          {subtitle && <p className="text-sm text-text-tertiary mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, hint, icon }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface px-4 py-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
        {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-text-primary">{value}</div>
      {hint && <div className="text-xs text-text-tertiary mt-0.5">{hint}</div>}
    </div>
  );
}

// Likelihood is an ordered level, shown with words (and an icon for "new"), never colour alone.
const LIKELIHOOD = {
  high: { label: 'High likelihood', cls: 'bg-brand text-text-on-accent border-brand' },
  medium: { label: 'Medium likelihood', cls: 'bg-accent-soft-bg text-brand border-accent-soft-border' },
  low: { label: 'Low likelihood', cls: 'bg-surface text-text-secondary border-border-default' },
  new: { label: 'New angle', cls: 'bg-surface text-text-secondary border-dashed border-text-tertiary', icon: 'sparkles' }
};
export function LikelihoodPill({ level }) {
  const l = LIKELIHOOD[level] || LIKELIHOOD.low;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${l.cls}`}>
      {l.icon && <Icon name={l.icon} className="w-3 h-3" />}
      {l.label}
    </span>
  );
}

const SOURCE_ICON = { opening: 'user', family: 'history', pattern: 'layers', predicted: 'sparkles', followup: 'repeat', generated: 'repeat', closing: 'check', hidden: 'eyeOff' };
export function SourceChip({ source, dark = false, className = '' }) {
  if (!source || !source.label) return null;
  return (
    <span className={`inline-flex items-start gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium leading-snug ${dark ? 'bg-white/8 text-white/75 border border-white/10' : 'bg-sunken text-text-secondary border border-border-subtle'} ${className}`}>
      <Icon name={SOURCE_ICON[source.kind] || 'info'} className="w-3.5 h-3.5 mt-px shrink-0" />
      <span>{source.label}</span>
    </span>
  );
}

export function AiBadge({ ai }) {
  if (!ai) return null;
  return ai.available ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-soft-border bg-accent-soft-bg px-3 py-1 text-xs font-bold text-brand">
      <Icon name="sparkles" className="w-3.5 h-3.5" /> AI feedback on
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface px-3 py-1 text-xs font-bold text-text-secondary" title="Questions, predictions and the interview all work from past transcripts. AI scoring, tailored questions and DAF reading switch on once it is enabled.">
      <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary" /> AI feedback coming soon
    </span>
  );
}

// Segmented control. options: [{ value, label, icon? }]
export function Segmented({ value, onChange, options, size = 'md', ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex p-1 rounded-2xl bg-sunken border border-border-subtle">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${
              active ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            {o.icon && <Icon name={o.icon} className="w-4 h-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Free-text tags: type and press Enter or comma; click × to remove. `suggestions` offers quick adds.
export function ChipInput({ values, onChange, placeholder, suggestions = [], max = 15, id }) {
  const [draft, setDraft] = useState('');
  const add = (v) => {
    const t = v.trim();
    if (!t || values.some((x) => x.toLowerCase() === t.toLowerCase()) || values.length >= max) return;
    onChange([...values, t]);
  };
  const commit = () => { add(draft.replace(/,$/, '')); setDraft(''); };
  const remaining = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-default bg-surface px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand/40 focus-within:border-brand">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-accent-soft-bg border border-accent-soft-border text-brand text-sm font-semibold pl-3 pr-1.5 py-0.5">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="p-0.5 rounded-full hover:bg-accent-soft-border/50 cursor-pointer" aria-label={`Remove ${v}`}>
              <Icon name="x" className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => { if (e.target.value.endsWith(',')) { add(e.target.value.slice(0, -1)); setDraft(''); } else setDraft(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1));
          }}
          onBlur={commit}
          placeholder={values.length ? '' : placeholder}
          className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm text-text-primary placeholder:text-text-tertiary py-1"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {remaining.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-default px-2.5 py-0.5 text-xs font-semibold text-text-tertiary hover:text-brand hover:border-brand cursor-pointer">
              <Icon name="plus" className="w-3 h-3" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// "Asked in which years" - one small bar per year, height = interviews that year. Single series, so no
// legend; the numbers are in the hover title and the caption next to it.
export function YearBars({ yearCounts = {}, allYears = [2020, 2021, 2022, 2023, 2024] }) {
  const max = Math.max(1, ...allYears.map((y) => yearCounts[y] || 0));
  return (
    <span className="inline-flex items-end gap-[3px] h-5" role="img" aria-label={`Asked per year: ${allYears.map((y) => `${y}: ${yearCounts[y] || 0}`).join(', ')}`}>
      {allYears.map((y) => {
        const n = yearCounts[y] || 0;
        return (
          <span
            key={y}
            title={`CSE ${y}: ${n}`}
            className={`w-[6px] rounded-t-[2px] ${n ? 'bg-brand' : 'bg-border-default'}`}
            style={{ height: `${n ? Math.max(25, (n / max) * 100) : 12}%` }}
          />
        );
      })}
    </span>
  );
}

export function TimesAsked({ n, years }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary whitespace-nowrap">
      <span className="text-text-primary font-bold">{n}×</span> asked{years?.length ? <span className="text-text-tertiary">· {yearsRange(years)}</span> : null}
    </span>
  );
}

// Panel seats get a fixed colour each (identity only - their name is always written next to them).
// eslint-disable-next-line react-refresh/only-export-components
export const SEAT_STYLE = {
  chairman: 'from-amber-300 to-amber-600',
  m1: 'from-emerald-300 to-emerald-600',
  m2: 'from-sky-300 to-sky-600',
  m3: 'from-violet-300 to-violet-600',
  m4: 'from-rose-300 to-rose-600'
};

export function SeatAvatar({ asker, size = 'md', speaking = false, thinking = false }) {
  const dims = { sm: 'w-9 h-9 text-xs', md: 'w-14 h-14 text-base', lg: 'w-24 h-24 text-2xl', stage: 'w-[72px] h-[72px] text-xl sm:w-24 sm:h-24 sm:text-2xl' }[size];
  return (
    <span className="relative inline-flex">
      {speaking && (
        <>
          <span className="absolute inset-0 rounded-full bg-emerald-400/50 iv-ring" />
          <span className="absolute inset-0 rounded-full bg-emerald-400/40 iv-ring iv-ring-delay" />
        </>
      )}
      <span className={`relative ${dims} rounded-full bg-gradient-to-br ${SEAT_STYLE[asker] || SEAT_STYLE.m1} flex items-center justify-center font-bold text-white shadow-lg ring-2 ${speaking ? 'ring-emerald-300' : 'ring-white/10'}`}>
        {askerShort(asker)}
      </span>
      {thinking && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 rounded-full bg-black/70 px-1.5 py-1">
          {[0, 1, 2].map((i) => <span key={i} className="w-1 h-1 rounded-full bg-white iv-dot" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </span>
      )}
    </span>
  );
}

export function AskerTag({ asker, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary ${className}`}>
      <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${SEAT_STYLE[asker] || SEAT_STYLE.m1}`} />
      {ASKER_LABEL[asker] || 'Board'}
    </span>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`iv-skeleton rounded-xl ${className}`} />;
}

export function SourcesCredit({ sources }) {
  if (!sources?.length) return null;
  return (
    <p className="text-xs text-text-tertiary leading-relaxed mt-10 border-t border-border-subtle pt-4">
      Questions come from interview transcripts that candidates shared freely with the community —{' '}
      {sources.map((s, i) => (
        <span key={s.name}>
          {i > 0 && ' and '}
          <span className="font-semibold text-text-secondary">{s.name}</span> ({s.detail})
        </span>
      ))}
      . Thank you to everyone who sent theirs in. Names and identifying details are removed.
    </p>
  );
}
