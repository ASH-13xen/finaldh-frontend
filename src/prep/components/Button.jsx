// Big, rounded buttons for the Interview Prep section. `magnetic` makes a primary call to action lean
// toward the mouse on desktop.
import { useRef } from 'react';
import Icon from '../../components/mcq/Icon';
import { useMagnetic } from '../lib/motion';

const TONES = {
  primary: 'bg-brand text-text-on-accent hover:bg-brand-hover shadow-[0_10px_30px_-10px_rgba(13,122,86,0.55)]',
  ink: 'bg-text-primary text-page hover:opacity-90 shadow-[0_10px_30px_-12px_rgba(20,17,13,0.45)]',
  ghost: 'bg-transparent text-text-primary border border-border-default hover:border-text-primary',
  soft: 'bg-accent-soft-bg text-brand border border-accent-soft-border hover:border-brand',
  plain: 'bg-transparent text-text-secondary hover:text-text-primary'
};
const SIZES = {
  xl: 'h-16 px-8 text-lg gap-3',
  lg: 'h-14 px-7 text-base gap-2.5',
  md: 'h-11 px-5 text-sm gap-2',
  sm: 'h-9 px-4 text-sm gap-1.5'
};

export default function Button({ tone = 'primary', size = 'lg', icon, iconRight, magnetic = false, className = '', children, ...rest }) {
  const ref = useRef(null);
  useMagnetic(ref, { enabled: magnetic });
  return (
    <button
      ref={ref}
      type="button"
      className={`prep-focus inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${TONES[tone]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />}
    </button>
  );
}
