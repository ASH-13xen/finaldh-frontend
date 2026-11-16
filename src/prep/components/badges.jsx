// Small labels used across the section: how likely a question is, where it comes from, and when it was asked.
import Icon from '../../components/mcq/Icon';
import { useT, yearsRange } from '../lib/i18n';

const TIER_STYLE = {
  certain: { color: 'var(--prep-tier-certain)', bg: 'var(--prep-tier-certain-bg)' },
  likely: { color: 'var(--prep-tier-likely)', bg: 'var(--prep-tier-likely-bg)' },
  worth: { color: 'var(--prep-tier-worth)', bg: 'var(--prep-tier-worth-bg)' }
};

export function TierBadge({ tier, size = 'md' }) {
  const { t } = useT();
  const s = TIER_STYLE[tier] || TIER_STYLE.worth;
  return (
    <span
      title={t(`tier.${tier}.about`)}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${size === 'sm' ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3 py-1.5'}`}
      style={{ color: s.color, background: s.bg }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
      {t(`tier.${tier}`)}
    </span>
  );
}

const SOURCE_ICON = { past: 'check', tailored: 'repeat', new: 'sparkles' };

export function SourceBadge({ source }) {
  const { t } = useT();
  const ai = source === 'new';
  return (
    <span
      title={t(`source.${source}.about`)}
      className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-3 py-1.5 whitespace-nowrap border ${ai ? 'border-dashed border-text-tertiary/60 text-text-secondary' : 'border-border-default text-text-secondary bg-surface'}`}
    >
      <Icon name={SOURCE_ICON[source] || 'check'} className="w-3.5 h-3.5" />
      {t(`source.${source}`)}
    </span>
  );
}

// A tiny bar chart of the years a question was asked in (CSE 2020-2025).
export function YearSpark({ yearCounts = {}, years = [2020, 2021, 2022, 2023, 2024, 2025], className = '' }) {
  const max = Math.max(1, ...years.map((y) => yearCounts[y] || 0));
  return (
    <span className={`inline-flex items-end gap-[3px] h-4 ${className}`} aria-hidden="true">
      {years.map((y) => {
        const n = yearCounts[y] || 0;
        return <span key={y} className={`w-[5px] rounded-sm ${n ? 'bg-brand' : 'bg-border-default'}`} style={{ height: `${n ? 30 + (70 * n) / max : 18}%` }} title={`${y}: ${n}`} />;
      })}
    </span>
  );
}

export function AskedLine({ n, years, className = '' }) {
  const { tn } = useT();
  if (!n) return null;
  return (
    <span className={`text-sm text-text-secondary ${className}`}>
      {tn('common.askedTimes', n)}{years?.length ? ` · CSE ${yearsRange(years)}` : ''}
    </span>
  );
}

export function Chip({ active = false, onClick, children, count, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`prep-focus inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap ${active ? 'bg-text-primary text-page border-text-primary' : 'bg-surface text-text-secondary border-border-default hover:border-text-primary hover:text-text-primary'} ${className}`}
    >
      {children}
      {count !== undefined && <span className={`prep-num text-xs ${active ? 'text-page/70' : 'text-text-tertiary'}`}>{count}</span>}
    </button>
  );
}
