import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui's class helper, scoped to PYQ & TDH Research.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
