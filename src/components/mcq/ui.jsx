import { useEffect } from 'react';
import Icon from './Icon';

// Shared building blocks for the MCQ screens: readable sizes (nothing below 12px), icon + label buttons
// with accessible names, and consistent status colours.

// eslint-disable-next-line react-refresh/only-export-components
export const BUTTON_TONES = {
  primary: 'bg-brand hover:bg-brand-hover text-text-on-accent shadow-sm',
  secondary: 'bg-surface border border-border-default text-text-primary hover:bg-surface-raised hover:border-text-tertiary',
  soft: 'bg-accent-soft-bg border border-accent-soft-border text-brand hover:bg-accent-soft-border/40',
  danger: 'bg-status-danger-bg border border-status-danger-text/30 text-status-danger-text hover:opacity-90',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
};

const SIZES = { sm: 'px-3 py-2 text-xs gap-1.5', md: 'px-4 py-2.5 text-sm gap-2', lg: 'px-6 py-3.5 text-base gap-2.5' };

// A button that always has a visible text label (icon is decoration). `hint` becomes the tooltip.
export function ActionButton({ icon, children, tone = 'secondary', size = 'md', hint, className = '', ...rest }) {
  return (
    <button
      type="button"
      title={hint}
      className={`inline-flex items-center justify-center rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-page ${BUTTON_TONES[tone]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />}
      {children}
    </button>
  );
}

// Icon-only or icon+label toggle used in the question toolbar. `active` shows the pressed state.
export function ToolButton({ icon, label, active = false, activeTone = 'brand', hint, showLabel = true, ...rest }) {
  const activeStyles = {
    brand: 'bg-accent-soft-bg border-brand text-brand',
    info: 'bg-status-info-bg border-status-info-text/50 text-status-info-text',
    danger: 'bg-status-danger-bg border-status-danger-text/50 text-status-danger-text'
  };
  return (
    <button
      type="button"
      title={hint || label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        active ? activeStyles[activeTone] : 'bg-surface border-border-default text-text-secondary hover:text-text-primary hover:border-text-tertiary'
      }`}
      {...rest}
    >
      <Icon name={icon} filled={active && (icon === 'bookmark' || icon === 'flag')} className="w-4 h-4" />
      <span className={showLabel ? '' : 'sr-only sm:not-sr-only'}>{label}</span>
    </button>
  );
}

const MODE_STYLES = {
  test: 'bg-status-info-bg text-status-info-text border-status-info-text/30',
  practice: 'bg-status-success-bg text-status-success-text border-status-success-text/30'
};
export function ModeBadge({ mode, source }) {
  const label = source === 'flagged' ? 'Flagged practice' : source === 'mistakes' ? 'Mistakes practice' : mode === 'practice' ? 'Practice' : 'Test';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${MODE_STYLES[mode === 'practice' ? 'practice' : 'test']}`}>
      <Icon name={mode === 'practice' ? 'book' : 'clock'} className="w-3 h-3" />
      {label}
    </span>
  );
}

export function Chip({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-sunken text-text-secondary border-border-subtle',
    success: 'bg-status-success-bg text-status-success-text border-status-success-text/30',
    warning: 'bg-status-warning-bg text-status-warning-text border-status-warning-text/30',
    danger: 'bg-status-danger-bg text-status-danger-text border-status-danger-text/30',
    info: 'bg-status-info-bg text-status-info-text border-status-info-text/30',
    brand: 'bg-accent-soft-bg text-brand border-accent-soft-border'
  };
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

export function ProgressBar({ value, max, className = '', tone = 'brand' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = tone === 'warning' ? 'bg-status-warning-text' : 'bg-brand';
  return (
    <div className={`h-2 w-full rounded-full bg-sunken overflow-hidden ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// "●●○" - attempts used out of the allowance
export function AttemptDots({ used, max }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${used} of ${max} attempts used`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`w-2.5 h-2.5 rounded-full border ${i < used ? 'bg-brand border-brand' : 'bg-transparent border-text-tertiary'}`} />
      ))}
    </span>
  );
}

export function EmptyState({ icon = 'info', title, children, action }) {
  return (
    <div className="bg-surface border border-dashed border-border-default rounded-2xl px-6 py-14 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-sunken flex items-center justify-center text-text-tertiary mb-4">
        <Icon name={icon} className="w-6 h-6" />
      </div>
      <p className="text-base font-bold text-text-primary">{title}</p>
      {children && <p className="text-sm text-text-tertiary mt-1.5 max-w-md mx-auto leading-relaxed">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// Modal shell: Escape closes, click on the backdrop closes, focus stays inside via autofocus on the panel.
export function Modal({ title, onClose, children, width = 'max-w-lg', footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-page/75 backdrop-blur-sm p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`bg-surface border border-border-default rounded-2xl w-full ${width} max-h-[90vh] flex flex-col shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
          <h2 className="text-lg font-extrabold text-text-primary font-display">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-raised cursor-pointer" aria-label="Close">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-2 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border-default flex flex-wrap items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

// Section wrapper used across the results page
export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`bg-surface border border-border-default rounded-2xl p-5 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h2 className="text-base font-extrabold text-text-primary">{title}</h2>}
            {subtitle && <p className="text-sm text-text-tertiary mt-0.5 leading-relaxed">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorBanner({ children, onRetry }) {
  if (!children) return null;
  return (
    <div className="flex items-center justify-between gap-3 p-4 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-sm font-semibold" role="alert">
      <span>{children}</span>
      {onRetry && <ActionButton size="sm" tone="danger" icon="refresh" onClick={onRetry}>Retry</ActionButton>}
    </div>
  );
}
