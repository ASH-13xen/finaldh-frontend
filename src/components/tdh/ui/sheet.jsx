import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from './utils';

// shadcn/ui Sheet (Radix Dialog), scoped to PYQ & TDH Research. Enter/exit use CSS keyframes so
// Radix Presence can wait for the exit animation before unmounting. The keyframe names are
// prefixed so nothing else on the site can collide with them.
// The <style> lives beside the Root, NOT inside the Portal: Radix gives every Portal child its
// own Presence, so a <style> in there unmounts the instant the sheet closes, taking the exit
// keyframes with it — the exit animation never runs and the sheet stays stuck "closing".
const KEYFRAMES = `
@keyframes tdh-sheet-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes tdh-sheet-out-right { from { transform: translateX(0); } to { transform: translateX(100%); } }
@keyframes tdh-sheet-in-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes tdh-sheet-out-left { from { transform: translateX(0); } to { transform: translateX(-100%); } }
@keyframes tdh-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes tdh-fade-out { from { opacity: 1; } to { opacity: 0; } }
`;

export function Sheet(props) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <DialogPrimitive.Root {...props} />
    </>
  );
}
export function SheetTrigger(props) { return <DialogPrimitive.Trigger {...props} />; }
export function SheetClose(props) { return <DialogPrimitive.Close {...props} />; }
export function SheetTitle({ className, ...props }) {
  return <DialogPrimitive.Title className={cn('text-[15px] font-semibold text-text-primary', className)} {...props} />;
}
export function SheetDescription({ className, ...props }) {
  return <DialogPrimitive.Description className={cn('text-[12.5px] text-text-tertiary', className)} {...props} />;
}

const SIDE = {
  right: 'right-0 border-l data-[state=open]:animate-[tdh-sheet-in-right_260ms_cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-[tdh-sheet-out-right_200ms_ease-in]',
  left: 'left-0 border-r data-[state=open]:animate-[tdh-sheet-in-left_260ms_cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-[tdh-sheet-out-left_200ms_ease-in]',
};

export function SheetContent({ className, children, side = 'right', showClose = true, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-[60] bg-black/30 backdrop-blur-[1px]',
          'data-[state=open]:animate-[tdh-fade-in_200ms_ease-out] data-[state=closed]:animate-[tdh-fade-out_180ms_ease-in]',
          'motion-reduce:animate-none',
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-[61] flex h-full w-[min(88vw,340px)] flex-col border-border-default bg-surface shadow-xl outline-none',
          SIDE[side] || SIDE.right,
          'motion-reduce:animate-none',
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute right-3 top-3 grid size-8 cursor-pointer place-items-center rounded-md text-text-tertiary hover:bg-sunken hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
