import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from './utils';

// shadcn/ui Button, re-themed to the site's paper + emerald tokens.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-text-on-accent hover:bg-brand-hover shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_1px_2px_rgba(13,122,86,0.25)]',
        outline: 'border border-border-default bg-surface text-text-primary hover:bg-surface-raised hover:border-text-tertiary/50',
        ghost: 'text-text-secondary hover:bg-sunken hover:text-text-primary',
        link: 'text-brand underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-[13px]',
        lg: 'h-11 px-5',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
