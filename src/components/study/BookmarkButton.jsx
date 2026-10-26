// ☆ / ★ toggle. `compact` = icon only (list rows); otherwise icon + label.
export default function BookmarkButton({ active, onToggle, label = 'Bookmark', activeLabel = 'Bookmarked', compact = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={active}
      title={active ? 'Remove bookmark' : 'Bookmark for revision'}
      aria-label={active ? `Remove ${label.toLowerCase()}` : label}
      className={`flex items-center gap-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors flex-shrink-0 ${
        compact ? 'w-7 h-7 justify-center' : 'px-3 py-1.5'
      } ${
        active
          ? 'bg-status-warning-bg border-status-warning-text/40 text-status-warning-text'
          : 'bg-surface border-border-default text-text-tertiary hover:border-brand hover:text-text-primary'
      } ${className}`}
    >
      <span aria-hidden="true" className="text-sm leading-none">{active ? '★' : '☆'}</span>
      {!compact && <span className="hidden sm:inline">{active ? activeLabel : label}</span>}
    </button>
  );
}
