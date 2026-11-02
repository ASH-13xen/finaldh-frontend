// What the admin checks on a Razorpay purchase request, in place of the old UPI screenshot: the phone and
// email the buyer typed into Razorpay Checkout, and the payment itself. Razorpay has already confirmed the
// amount - the admin is verifying the buyer (real name / email), not the money.
export default function RazorpayPaymentDetails({ request, compact = false }) {
  const checkoutEmailDiffers =
    request.payerEmail && request.payerEmail.toLowerCase() !== (request.userEmail || '').toLowerCase();

  const rows = [
    ['Phone', request.payerContact || '—', true],
    ['Checkout email', request.payerEmail || '—', true],
    ['Paid via', request.payerMethod ? request.payerMethod.toUpperCase() : '—', false]
  ];

  return (
    <div className={`bg-sunken border border-border-subtle rounded-xl ${compact ? 'p-3 space-y-1.5' : 'p-3.5 space-y-2'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">Paid with Razorpay</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-status-success-bg text-status-success-text rounded-full text-[9px] font-extrabold uppercase tracking-wide">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Amount confirmed
        </span>
      </div>

      {rows.map(([label, value, mono]) => (
        <div key={label} className="flex justify-between items-center gap-3 text-xs">
          <span className="text-text-secondary font-medium shrink-0">{label}:</span>
          <span className={`font-bold text-right break-all select-all ${mono ? 'font-mono' : ''} ${label === 'Checkout email' && checkoutEmailDiffers ? 'text-status-warning-text' : 'text-text-primary'}`}>
            {value}
          </span>
        </div>
      ))}
      {checkoutEmailDiffers && (
        <p className="text-[10px] text-status-warning-text font-semibold leading-snug">Checkout email differs from the account email.</p>
      )}

      <div className="flex justify-between items-center gap-3 text-xs pt-1 border-t border-border-subtle">
        <span className="text-text-secondary font-medium shrink-0">Payment ID:</span>
        {request.razorpayPaymentId ? (
          <a
            href={`https://dashboard.razorpay.com/app/payments/${request.razorpayPaymentId}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-brand font-bold hover:underline break-all text-right"
            title="Open in Razorpay dashboard"
          >
            {request.razorpayPaymentId}
          </a>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </div>
    </div>
  );
}
