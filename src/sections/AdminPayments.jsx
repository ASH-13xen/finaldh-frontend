import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import AdminPurchases from './AdminPurchases';

// Admin "Payments" tab. Razorpay payments are read-only here: access unlocks automatically once a payment
// is confirmed, and refunds are issued from the Razorpay dashboard. The legacy manual-UPI course requests
// (still approvable until the queue is empty) sit behind the toggle; MCQ legacy requests live under Manage MCQ.

const STATUS_TABS = [
  ['paid', 'Paid'],
  ['failed', 'Failed'],
  ['created', 'Not completed'],
  ['all', 'All']
];

const STATUS_BADGE = {
  paid: { type: 'success', text: 'Paid' },
  failed: { type: 'danger', text: 'Failed' },
  created: { type: 'neutral', text: 'Not completed' }
};

const KIND_LABEL = { course: 'Course', combo: 'Combo', mcq_subject: 'MCQ subject' };

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatWhen = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function RazorpayPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusTab, setStatusTab] = useState('paid');
  const [search, setSearch] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payments/admin', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load payments');
      setPayments(data.payments || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const paid = payments.filter((p) => p.status === 'paid');
  const collected = paid.reduce((sum, p) => sum + p.amount, 0);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusTab !== 'all' && p.status !== statusTab) return false;
      if (!q) return true;
      return [p.userName, p.userEmail, p.itemLabel, p.razorpayPaymentId, p.razorpayOrderId]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [payments, statusTab, search]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pb-10 md:pb-14 text-text-primary">
      <div className="mb-6 md:mb-8 border-b border-border-default pb-4 md:pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-4xl font-display font-semibold text-text-primary tracking-tight">Payments</h1>
          <p className="text-text-secondary text-xs md:text-sm mt-1.5 md:mt-2 font-medium">
            Every Razorpay payment. Access unlocks automatically the moment a payment is confirmed — nothing to approve. Refunds are issued from the Razorpay dashboard.
          </p>
        </div>
        <button
          onClick={fetchPayments}
          className="px-4 py-2 bg-accent-soft-bg border border-accent-soft-border hover:bg-accent-soft-border/50 text-brand rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Refresh
        </button>
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
          <div className="p-4 bg-surface border border-border-default rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Collected</p>
            <p className="text-xl md:text-2xl font-display font-semibold text-text-primary mt-1">{rupees(collected)}</p>
          </div>
          <div className="p-4 bg-surface border border-border-default rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Paid orders</p>
            <p className="text-xl md:text-2xl font-display font-semibold text-text-primary mt-1">{paid.length}</p>
          </div>
          <div className="p-4 bg-surface border border-border-default rounded-xl col-span-2 md:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Failed / not completed</p>
            <p className="text-xl md:text-2xl font-display font-semibold text-text-primary mt-1">
              {payments.filter((p) => p.status === 'failed').length} / {payments.filter((p) => p.status === 'created').length}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border-default">
          {STATUS_TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setStatusTab(id)}
              className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${statusTab === id ? 'border-brand text-brand font-extrabold' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              {label} ({id === 'all' ? payments.length : payments.filter((p) => p.status === id).length})
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, item or payment ID"
          className="w-full md:w-80 bg-page border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand transition-all placeholder:text-text-tertiary"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center bg-surface border border-border-default rounded-2xl">
          <LoadingSpinner text="Loading payments..." />
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-status-danger-bg border border-status-danger-text/25 rounded-2xl p-6">
          <h3 className="font-bold text-text-primary">Failed to load payments</h3>
          <p className="text-xs text-text-secondary mt-1">{error}</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border-default rounded-xl bg-surface-raised p-6">
          <p className="text-sm text-text-tertiary font-semibold">No payments found.</p>
        </div>
      ) : (
        <ul className="bg-surface border border-border-default rounded-2xl divide-y divide-border-default overflow-hidden">
          {shown.map((p) => {
            const badge = STATUS_BADGE[p.status] || STATUS_BADGE.created;
            return (
              <li key={p._id} className="p-4 md:px-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                <div className="min-w-0 md:w-56 shrink-0">
                  <p className="text-sm font-bold text-text-primary truncate">{p.userName}</p>
                  <p className="text-[11px] text-text-secondary font-mono truncate">{p.userEmail}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary leading-snug">{p.itemLabel}</p>
                  <p className="text-[11px] text-text-tertiary font-medium mt-0.5">
                    {KIND_LABEL[p.kind] || p.kind}
                    {p.kind === 'combo' && p.courseIds?.length ? ` · ${p.courseIds.join(', ')}` : ''}
                    {' · '}{formatWhen(p.paidAt || p.createdAt)}
                    {p.method ? ` · ${p.method.toUpperCase()}` : ''}
                  </p>
                  {p.status === 'failed' && p.failureReason && (
                    <p className="text-[11px] text-status-danger-text font-semibold mt-0.5">{p.failureReason}</p>
                  )}
                </div>
                <div className="flex items-center justify-between md:justify-end gap-4 md:w-72 shrink-0">
                  <div className="text-left md:text-right min-w-0">
                    <p className="text-sm font-extrabold text-text-primary">{rupees(p.amount)}</p>
                    {p.razorpayPaymentId ? (
                      <a
                        href={`https://dashboard.razorpay.com/app/payments/${p.razorpayPaymentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-mono text-brand hover:underline break-all"
                        title="Open in Razorpay dashboard"
                      >
                        {p.razorpayPaymentId}
                      </a>
                    ) : (
                      <p className="text-[10px] font-mono text-text-tertiary break-all">{p.razorpayOrderId}</p>
                    )}
                  </div>
                  <StatusBadge type={badge.type} text={badge.text} className="shrink-0" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminPayments() {
  const [view, setView] = useState('razorpay');

  return (
    <>
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-6">
        <div className="inline-flex p-1 bg-sunken border border-border-default rounded-xl gap-1" role="tablist" aria-label="Payment records">
          {[['razorpay', 'Razorpay payments'], ['legacy', 'Legacy UPI requests']].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${view === id ? 'bg-surface text-text-primary shadow-sm border border-border-default' : 'text-text-secondary hover:text-text-primary border border-transparent'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === 'razorpay' ? <RazorpayPayments /> : <AdminPurchases />}
    </>
  );
}
