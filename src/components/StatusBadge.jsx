const STYLES = {
  success: 'bg-status-success-bg text-status-success-text',
  warning: 'bg-status-warning-bg text-status-warning-text',
  danger: 'bg-status-danger-bg text-status-danger-text',
  neutral: 'bg-surface-raised text-text-secondary',
};

export default function StatusBadge({ type = 'neutral', text, icon, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-sans font-bold ${STYLES[type] || STYLES.neutral} ${className}`}
    >
      {icon}
      {text}
    </span>
  );
}
