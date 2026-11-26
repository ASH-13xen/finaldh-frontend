import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from './utils';

export function TooltipProvider(props) { return <TooltipPrimitive.Provider {...props} />; }
export function Tooltip(props) { return <TooltipPrimitive.Root {...props} />; }
export function TooltipTrigger(props) { return <TooltipPrimitive.Trigger {...props} />; }

export function TooltipContent({ className, sideOffset = 6, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn('z-50 rounded-md bg-text-primary px-2 py-1 text-[11.5px] font-medium text-page shadow-md', className)}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
