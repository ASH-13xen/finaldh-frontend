export default function Button({ onClick, children, variant = 'primary', size = 'md', fullWidth = false, disabled = false, type }) {
  const baseStyle = 'inline-flex items-center justify-center gap-2 rounded-lg font-sans font-semibold tracking-wide transition-all duration-250 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

  const sizes = {
    sm: 'py-1.5 px-3.5 text-xs',
    md: 'py-3 px-5 text-sm',
  };

  const variants = {
    primary:
      'bg-brand hover:bg-brand-hover text-text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] shadow-sm hover:shadow-md hover:-translate-y-px',
    secondary:
      'bg-transparent border border-border-default text-text-primary hover:bg-surface-raised hover:border-text-tertiary',
    danger:
      'bg-status-danger-text hover:opacity-90 text-white shadow-sm hover:shadow-md hover:-translate-y-px',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}
