import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from './utils';

export function Progress({ className, value = 0, indicatorClassName, ...props }) {
  return (
    <ProgressPrimitive.Root className={cn('relative h-1 w-full overflow-hidden rounded-full bg-sunken', className)} value={value} {...props}>
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full flex-1 bg-brand transition-transform duration-500 ease-out', indicatorClassName)}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
