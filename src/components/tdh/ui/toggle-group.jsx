import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from './utils';

export function ToggleGroup({ className, ...props }) {
  return <ToggleGroupPrimitive.Root className={cn('flex', className)} {...props} />;
}

export function ToggleGroupItem({ className, ...props }) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        'inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary transition-colors cursor-pointer',
        'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        'data-[state=on]:text-brand data-[state=on]:font-semibold',
        className,
      )}
      {...props}
    />
  );
}
