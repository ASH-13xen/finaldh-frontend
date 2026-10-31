import { useEffect, useRef, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { payWithRazorpay } from '../lib/razorpay';

// Shared checkout for every paid product (courses, combos, MCQ subjects). Mount it to buy `item`: it opens
// Razorpay Checkout straight away and shows our own screens around it - "opening", "confirming", then
// success or an error with retry. Replaced the old manual-UPI PurchaseModal (QR + screenshot upload).
//
// onPaid(payment) fires as soon as access is granted, so the page behind can refresh while the success
// screen is still up; onClose fires when the student leaves the dialog (or closes Checkout without paying).
export default function RazorpayCheckout({ item, title, onPaid, onClose }) {
  const [stage, setStage] = useState('starting'); // starting | paying | confirming | success | processing | failed | error
  const [message, setMessage] = useState('');
  const [payment, setPayment] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const startedAttempt = useRef(-1);

  useEffect(() => {
    // StrictMode runs effects twice in development: one Razorpay order per attempt, never two
    if (startedAttempt.current === attempt) return;
    startedAttempt.current = attempt;

    payWithRazorpay(item, { onStage: setStage })
      .then((result) => {
        if (result.status === 'paid') {
          setPayment(result.payment);
          setStage('success');
          onPaid?.(result.payment);
        } else if (result.status === 'cancelled') {
          onClose?.();
        } else if (result.status === 'failed') {
          setMessage(result.reason);
          setStage('failed');
        } else {
          setStage('processing');
          onPaid?.(null);
        }
      })
      .catch((err) => {
        setMessage(err.message || 'The payment could not be completed.');
        setStage('error');
      });
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => {
    setMessage('');
    setAttempt((a) => a + 1);
  };

  // Razorpay's own window is on screen
  if (stage === 'paying') return null;

  const busy = stage === 'starting' || stage === 'confirming';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/70 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Payment">
      <div className="bg-surface border border-border-default rounded-xl md:rounded-2xl w-full max-w-sm p-6 shadow-2xl relative my-auto text-center">
        {!busy && (
          <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 text-text-secondary hover:text-text-primary p-1 hover:bg-sunken rounded-lg transition cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}

        <p className="text-[11px] font-bold text-text-secondary leading-snug px-6 mb-5">{title}</p>

        {busy && (
          <div className="py-4 space-y-4">
            <LoadingSpinner text={stage === 'starting' ? 'Opening secure checkout' : 'Confirming your payment'} />
            {stage === 'confirming' && (
              <p className="text-xs text-text-secondary font-medium">Please don't close or refresh this page.</p>
            )}
          </div>
        )}

        {stage === 'success' && (
          <div className="space-y-4">
            <div className="w-14 h-14 mx-auto bg-status-success-bg border border-status-success-text/30 text-status-success-text rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-7 h-7"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <h3 className="text-base font-display font-semibold text-text-primary">Payment successful</h3>
              <p className="text-xs text-text-secondary mt-1.5 font-medium leading-relaxed">Your access is unlocked and ready to use.</p>
            </div>
            {payment?.paymentId && (
              <p className="text-[10px] text-text-tertiary font-medium">
                Payment ID <span className="font-mono select-all text-text-secondary">{payment.paymentId}</span>
              </p>
            )}
            <button onClick={onClose} className="w-full px-6 py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition shadow-md cursor-pointer">
              Done
            </button>
          </div>
        )}

        {stage === 'processing' && (
          <div className="space-y-4">
            <h3 className="text-base font-display font-semibold text-text-primary">Payment received</h3>
            <p className="text-xs text-text-secondary font-medium leading-relaxed">
              We're still confirming it with Razorpay. Your access unlocks automatically within a few minutes — refresh the page shortly. No need to pay again.
            </p>
            <button onClick={onClose} className="w-full px-6 py-2.5 bg-accent-soft-bg border border-accent-soft-border hover:bg-accent-soft-border/50 text-brand rounded-xl text-xs font-bold transition cursor-pointer">
              Close
            </button>
          </div>
        )}

        {(stage === 'failed' || stage === 'error') && (
          <div className="space-y-4">
            <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text rounded-xl text-xs font-bold leading-normal">
              {stage === 'failed' ? `Payment didn't go through: ${message}` : message}
            </div>
            {stage === 'failed' && (
              <p className="text-[11px] text-text-tertiary font-medium leading-relaxed">If any amount was deducted, your bank or Razorpay will refund it automatically.</p>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border-default text-text-secondary hover:text-text-primary rounded-xl text-xs font-bold transition cursor-pointer">
                Close
              </button>
              <button onClick={retry} className="flex-1 px-4 py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition shadow-md cursor-pointer">
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
