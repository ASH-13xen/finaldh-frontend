import { useState, useEffect } from 'react';

// Admin "Pricing & Sales" for Toppers Copy: a price per subject plus the all-subjects
// bundle, and the UPI purchase requests to approve. Same flow as AdminMcqData's
// Subject Pricing / Purchase Requests tabs.

const ALL_SUBJECTS = '__all__';
const authed = (url, opts = {}) =>
  fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}`, ...(opts.headers || {}) },
  });
const planLabel = (plan) =>
  plan === ALL_SUBJECTS
    ? 'All subjects (bundle)'
    : plan.replace(/^OptionalSubject/, 'Optional: ').replace(/([a-z])([A-Z])/g, '$1 $2');

const inputCls = 'w-24 bg-page border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-lg px-3 py-1.5 text-xs font-semibold transition-all';

export default function ToppersSales() {
  const [view, setView] = useState('pricing');
  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        {[['pricing', 'Pricing'], ['requests', 'Purchase Requests']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${view === k ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary hover:bg-surface-raised'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'pricing' ? <PricingView /> : <RequestsView />}
    </div>
  );
}

function PricingView() {
  const [plans, setPlans] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await authed('/api/toppers-copy/admin/pricing');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load pricing');
      setPlans(data.plans || []);
      setDrafts(Object.fromEntries((data.plans || []).map((p) => [p.plan, {
        price: p.price == null ? '' : String(p.price),
        discountedPrice: p.discountedPrice ? String(p.discountedPrice) : '',
        useDiscount: p.useDiscount,
      }])));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const update = (plan, field, value) => setDrafts((d) => ({ ...d, [plan]: { ...d[plan], [field]: value } }));

  const save = async (plan) => {
    const d = drafts[plan];
    if (d.price === '' || Number.isNaN(Number(d.price))) { alert('Enter a price first.'); return; }
    setSaving(plan); setSaved(null);
    try {
      const res = await authed(`/api/toppers-copy/admin/pricing/${encodeURIComponent(plan)}`, {
        method: 'PUT',
        body: JSON.stringify({ price: Number(d.price), discountedPrice: Number(d.discountedPrice) || 0, useDiscount: d.useDiscount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save price');
      setSaved(plan);
      await load();
      setTimeout(() => setSaved(null), 2000);
    } catch (err) { alert(err.message); } finally { setSaving(null); }
  };

  return (
    <div className="space-y-3">
      <div className="bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-4 text-xs text-text-secondary">
        Students buy one paper at a time, or every paper with the bundle. Buying unlocks every topic in it, including ones
        published later. Questions ticked under Manage / Publish → Free samples stay open to everyone. A plan with no
        price can&apos;t be bought.
      </div>
      {loading ? (
        <p className="text-xs text-text-tertiary">Loading...</p>
      ) : error ? (
        <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>
      ) : (
        plans.map((p) => {
          const d = drafts[p.plan] || { price: '', discountedPrice: '', useDiscount: false };
          return (
            <div key={p.plan} className={`p-4 border rounded-xl ${p.plan === ALL_SUBJECTS ? 'bg-accent-soft-bg border-accent-soft-border' : 'bg-sunken border-border-default'}`}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs font-bold text-text-primary truncate">{planLabel(p.plan)}</p>
                {!p.configured && (
                  <span className="flex-shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-status-warning-bg border border-status-warning-text/30 text-status-warning-text">Not set</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-tertiary font-bold">₹</span>
                  <input type="number" min="0" value={d.price} onChange={(e) => update(p.plan, 'price', e.target.value)} className={inputCls} />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={d.useDiscount} onChange={(e) => update(p.plan, 'useDiscount', e.target.checked)} className="w-3.5 h-3.5 accent-brand cursor-pointer" />
                  <span className="text-[10px] font-bold text-text-secondary">Discount</span>
                </label>
                {d.useDiscount && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-tertiary font-bold">₹</span>
                    <input type="number" min="0" placeholder="discounted" value={d.discountedPrice} onChange={(e) => update(p.plan, 'discountedPrice', e.target.value)} className={inputCls} />
                  </div>
                )}
                <button
                  onClick={() => save(p.plan)}
                  disabled={saving === p.plan}
                  className="ml-auto px-4 py-1.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-lg text-[10px] font-bold transition cursor-pointer"
                >
                  {saving === p.plan ? 'Saving...' : saved === p.plan ? 'Saved ✓' : 'Save'}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function RequestsView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [lightbox, setLightbox] = useState(null);

  const withToken = (path) => `${path}${path.includes('?') ? '&' : '?'}token=${localStorage.getItem('token')}`;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await authed('/api/toppers-copy/admin/purchase-requests');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch purchase requests');
      setRequests(data || []);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const act = async (id, action) => {
    setProcessingId(id);
    try {
      const res = await authed(`/api/toppers-copy/admin/purchase-requests/${id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} request`);
      setRequests((rs) => rs.map((r) => (r._id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r)));
    } catch (err) { alert(err.message); } finally { setProcessingId(null); }
  };

  const shown = requests.filter((r) => filter === 'all' || r.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-text-tertiary">Check the UPI payment, then approve to unlock access for the student.</p>
        <button onClick={load} className="px-3 py-1.5 bg-accent-soft-bg border border-accent-soft-border text-brand rounded-xl text-xs font-bold cursor-pointer">Refresh</button>
      </div>
      <div className="flex border-b border-border-default mb-5 gap-4">
        {['pending', 'approved', 'rejected', 'all'].map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer ${filter === k ? 'border-brand text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          >
            {k} ({requests.filter((r) => k === 'all' || r.status === k).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-text-tertiary">Loading...</p>
      ) : error ? (
        <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>
      ) : shown.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-border-default rounded-xl text-sm text-text-tertiary font-semibold">
          No {filter !== 'all' ? filter : ''} requests.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((r) => (
            <div key={r._id} className="bg-surface border border-border-default rounded-2xl p-5 flex flex-col justify-between gap-3">
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-text-primary text-sm">{r.userName}</h3>
                    <p className="text-[11px] text-text-secondary font-mono truncate">{r.userEmail}</p>
                  </div>
                  <span className="text-[9px] text-text-tertiary font-bold whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="p-3 bg-sunken border border-border-default rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2"><span className="text-text-secondary">Plan:</span><span className="font-bold text-text-primary text-right">{planLabel(r.plan)}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-text-secondary">Price:</span><span className="font-extrabold text-brand">₹{r.price}</span></div>
                  {r.upiTxnId && (
                    <div className="flex justify-between gap-2"><span className="text-text-secondary">UPI Ref:</span><span className="font-mono font-bold text-text-primary select-all">{r.upiTxnId}</span></div>
                  )}
                </div>
                <button type="button" onClick={() => setLightbox(r.screenshotUrl)} className="block w-full overflow-hidden border border-border-default rounded-xl aspect-[16/9] bg-page cursor-zoom-in">
                  <img src={withToken(r.screenshotUrl)} alt="Payment screenshot" className="w-full h-full object-cover" />
                </button>
              </div>
              <div className="border-t border-border-default pt-3 flex items-center justify-end gap-2">
                {r.status === 'pending' ? (
                  <>
                    <button onClick={() => act(r._id, 'reject')} disabled={processingId === r._id} className="px-3 py-1.5 border border-border-default hover:bg-status-danger-bg hover:text-status-danger-text text-text-secondary rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">Reject</button>
                    <button onClick={() => act(r._id, 'approve')} disabled={processingId === r._id} className="px-4 py-1.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">
                      {processingId === r._id ? 'Processing...' : 'Approve'}
                    </button>
                  </>
                ) : (
                  <span className={`px-3 py-1 rounded-xl text-xs font-extrabold uppercase ${r.status === 'approved' ? 'bg-status-success-bg text-status-success-text' : 'bg-status-danger-bg text-status-danger-text'}`}>{r.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[150] bg-ink-950/95 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={withToken(lightbox)} alt="Payment screenshot" className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
