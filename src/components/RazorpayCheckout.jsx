import { useEffect, useRef, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { payWithRazorpay } from '../lib/razorpay';

// Shared checkout for every paid product (courses, combos, MCQ subjects). Mount it to buy `item`: it opens
// Razorpay Checkout straight away and shows our own screens around it - "opening", "confirming", then
// "payment received, pending verification" or an error with retry. Replaced the old manual-UPI
// PurchaseModal (QR + screenshot upload); everything after the payment works as it did there: the admin
// verifies the purchase request, and the student can nudge them on Telegram (twice per request).
//
// onPaid(result) fires as soon as the payment is confirmed and the request exists, so the page behind can
// show it as pending while this screen is still up; onClose fires when the student leaves the dialog (or
// closes Checkout without paying).
export default function RazorpayCheckout({ item, title, onPaid, onClose, telegramMessage, telegramTrackEndpointBase }) {
  const [stage, setStage] = useState('starting'); // starting | paying | confirming | success | processing | failed | error
  const [message, setMessage] = useState('');
  const [payment, setPayment] = useState(null);
  const [request, setRequest] = useState(null);
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
          setRequest(result.request);
          setStage('success');
          onPaid?.(result);
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

  // Same behaviour as the old checkout: phones open the Telegram app with the message filled in; desktops
  // open Telegram Web and copy the message to the clipboard for pasting
  const handleTelegramNotify = () => {
    if (!request) return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let telegramUrl = `https://t.me/tdhadmin?text=${encodeURIComponent(telegramMessage)}`;
    if (!isMobile) {
      telegramUrl = 'https://web.telegram.org/k/#@tdhadmin';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(telegramMessage).catch(() => {});
      }
    }
    window.open(telegramUrl, '_blank');

    fetch(`${telegramTrackEndpointBase}/${request._id}/notify-telegram`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setRequest((prev) => ({ ...prev, telegramNotificationCount: data.telegramNotificationCount }));
      })
      .catch((err) => console.error('[Telegram Notify] tracking failed:', err));
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
              <h3 className="text-base font-display font-semibold text-text-primary">Payment received</h3>
              <p className="text-xs text-text-secondary mt-1.5 font-medium leading-relaxed">
                Your purchase is now pending verification. Admin will verify and activate your access within 6-8 hours.
              </p>
            </div>
            {payment?.paymentId && (
              <p className="text-[10px] text-text-tertiary font-medium">
                Payment ID <span className="font-mono select-all text-text-secondary">{payment.paymentId}</span>
              </p>
            )}
            {telegramMessage && request && request.telegramNotificationCount < 2 && (
              <div>
                <button
                  type="button"
                  onClick={handleTelegramNotify}
                  className="w-full px-4 py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4 10-10S17.52 2 12 2zm4.64 6.8c-.15.75-.85 3.79-1.2 5.68-.15.8-.45 1.07-.73 1.1-.63.06-1.11-.42-1.72-.82-.96-.63-1.51-1.02-2.44-1.63-1.08-.71-.38-1.1.24-1.74.16-.17 3.01-2.76 3.07-3.01.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.21-.03-.1.02-1.61 1.02-4.56 3.02-.43.3-.82.45-1.17.44-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.41.82-.63 3.2-1.39 5.34-2.31 6.42-2.75 3.07-1.28 3.7-1.5 4.12-1.5.09 0 .3.02.43.13.11.09.14.22.15.31-.01.07.01.21-.01.29z"/></svg>
                  Notify Admin on Telegram
                </button>
                <p className="text-[10px] text-text-tertiary mt-2 font-medium leading-relaxed">
                  Notify us personally or request for the Telegram group link.
                </p>
              </div>
            )}
            <button onClick={onClose} className="w-full px-6 py-2.5 bg-accent-soft-bg border border-accent-soft-border hover:bg-accent-soft-border/50 text-brand rounded-xl text-xs font-bold transition cursor-pointer">
              Close Window
            </button>
          </div>
        )}

        {stage === 'processing' && (
          <div className="space-y-4">
            <h3 className="text-base font-display font-semibold text-text-primary">Payment received</h3>
            <p className="text-xs text-text-secondary font-medium leading-relaxed">
              We're still confirming it with Razorpay. Within a few minutes it will show as pending verification — refresh the page shortly. No need to pay again.
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
