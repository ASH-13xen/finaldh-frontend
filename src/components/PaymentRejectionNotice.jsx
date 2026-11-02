import { useEffect, useState } from 'react';

// Full-screen notice for a Razorpay payment the admin rejected (the buyer's name / email didn't check out).
// Shown to the student on their next visit, one rejected payment at a time, until they press "I understand"
// - there is deliberately no close button or click-outside. The refund itself is made by hand by the admin;
// Razorpay's refund is not used.
const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function PaymentRejectionNotice() {
  const [notices, setNotices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/rejections', { headers: authHeader() })
      .then((res) => (res.ok ? res.json() : { rejections: [] }))
      .then((data) => { if (!cancelled) setNotices(data.rejections || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (notices.length === 0) return null;
  const notice = notices[0];
  const what = notice.kind === 'mcq' ? 'this test series' : 'this course';

  const acknowledge = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/payments/rejections/${notice.kind}/${notice.id}/acknowledge`, {
        method: 'POST',
        headers: authHeader()
      });
      if (!res.ok && res.status !== 404) throw new Error();
      setNotices((prev) => prev.slice(1));
    } catch {
      setError('Could not save that. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-ink-950/75 backdrop-blur-sm p-4 overflow-y-auto"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="payment-rejection-title"
      aria-describedby="payment-rejection-body"
    >
      <div className="w-full max-w-lg my-auto bg-surface border border-border-default rounded-2xl shadow-2xl overflow-hidden">
        {/* Header band */}
        <div className="bg-status-danger-bg border-b border-status-danger-text/20 px-6 pt-6 pb-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="w-12 h-12 shrink-0 rounded-full bg-surface border border-status-danger-text/30 text-status-danger-text flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <line x1="15" y1="15" x2="19" y2="15" />
                <line x1="5" y1="15" x2="8" y2="15" />
              </svg>
            </div>
            {notices.length > 1 && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-status-danger-text bg-surface border border-status-danger-text/25 rounded-full px-2.5 py-1">
                1 of {notices.length}
              </span>
            )}
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-status-danger-text">Payment notice</p>
          <h2 id="payment-rejection-title" className="mt-1 text-2xl sm:text-[1.7rem] font-display font-semibold text-text-primary leading-tight">
            Payment rejected
          </h2>
          <p className="mt-1.5 text-sm font-semibold text-text-secondary leading-snug">{notice.itemLabel}</p>
        </div>

        {/* Body */}
        <div id="payment-rejection-body" className="px-6 py-6 sm:px-8 space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Your payment of{' '}
            <span className="font-bold text-text-primary whitespace-nowrap">₹{Number(notice.amount).toLocaleString('en-IN')}</span>
            {notice.paidAt && (
              <> on <span className="font-bold text-text-primary whitespace-nowrap">{formatDate(notice.paidAt)}</span></>
            )}{' '}
            could not be verified because the name or email ID on your account appears to be incorrect or misleading.
          </p>

          <div className="flex gap-3 items-start rounded-xl bg-status-success-bg border border-status-success-text/25 px-4 py-3.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 mt-0.5 text-status-success-text">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <p className="text-sm text-text-primary leading-relaxed">
              <span className="font-bold text-status-success-text">You will be refunded within the same day.</span>{' '}
              We&apos;ll contact you on your registered email ID or phone number.
            </p>
          </div>

          <div className="flex gap-3 items-start rounded-xl bg-sunken border border-border-subtle px-4 py-3.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 mt-0.5 text-brand">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-sm text-text-secondary leading-relaxed">
              To buy {what}, please purchase again using a <span className="font-semibold text-text-primary">valid email ID</span> and your <span className="font-semibold text-text-primary">real name</span>.
            </p>
          </div>

          {error && (
            <p className="text-xs font-bold text-status-danger-text" role="alert">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          <button
            type="button"
            onClick={acknowledge}
            disabled={saving}
            autoFocus
            className="w-full py-3.5 bg-brand hover:bg-brand-hover disabled:opacity-60 text-text-on-accent rounded-xl text-sm font-bold tracking-wide transition shadow-md cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-brand/25"
          >
            {saving ? 'Saving…' : 'I understand'}
          </button>
        </div>
      </div>
    </div>
  );
}
