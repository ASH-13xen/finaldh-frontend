import { ALL_SUBJECTS, planPrice } from '../lib/toppersStore';

// Buy buttons for Toppers Copy: one subject, or every subject at once. State comes from
// useToppersStore (lib/toppersStore.js); the checkout itself is the shared PurchaseModal,
// opened by the caller.

function PriceTag({ p }) {
  return (
    <>
      ₹{planPrice(p)}
      {p.useDiscount && p.price > p.discountedPrice ? (
        <span className="ml-1.5 line-through opacity-60 font-semibold">₹{p.price}</span>
      ) : null}
    </>
  );
}

// The two ways to unlock a subject, as buttons (or a "under review" note per plan).
function PlanButtons({ subject, label, store, onBuy }) {
  const options = [
    { key: subject, name: `Unlock ${label}` },
    { key: ALL_SUBJECTS, name: 'All subjects' },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ key, name }) => {
        const p = store.plan(key);
        if (!p?.configured || p.owned) return null;
        if (store.pending(key)) {
          return (
            <span key={key} className="px-3 py-2 rounded-xl text-xs font-bold bg-status-warning-bg border border-status-warning-text/30 text-status-warning-text">
              {name}: payment under review
            </span>
          );
        }
        const primary = key === subject;
        return (
          <button
            key={key}
            onClick={() => onBuy(key)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
              primary
                ? 'bg-brand hover:bg-brand-hover text-text-on-accent shadow-sm'
                : 'bg-surface border border-border-default hover:border-brand text-text-primary'
            }`}
          >
            {name} — <PriceTag p={p} />
          </button>
        );
      })}
    </div>
  );
}

// Shown above the topic list while the student doesn't own the current subject.
export function UnlockBanner({ subject, label, freeCount, store, onBuy }) {
  const anyPrice = [subject, ALL_SUBJECTS].some((k) => store.plan(k)?.configured);
  return (
    <div className="mb-6 bg-accent-soft-bg border border-accent-soft-border rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand mb-0.5">
          {freeCount > 0 ? `Free preview · ${freeCount} sample question${freeCount === 1 ? '' : 's'}` : 'Preview'}
        </p>
        <p className="text-sm text-text-primary font-semibold leading-snug">
          {anyPrice
            ? `Unlock ${label} to read every topper copy, AI analysis and PYQ model answer — including topics added later.`
            : 'Pricing for this paper is being set up — check back soon.'}
        </p>
      </div>
      <PlanButtons subject={subject} label={label} store={store} onBuy={onBuy} />
    </div>
  );
}

// Opened from a locked question or PYQ answer.
export function UnlockChooser({ subject, label, store, onBuy, onClose }) {
  const anyPrice = [subject, ALL_SUBJECTS].some((k) => store.plan(k)?.configured);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border-default rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tc-unlock-title"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 id="tc-unlock-title" className="text-base font-extrabold text-text-primary">🔒 Part of the full {label}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-sunken text-text-secondary cursor-pointer text-lg leading-none" aria-label="Close">✕</button>
        </div>
        <p className="text-sm text-text-secondary mb-5 leading-relaxed">
          {anyPrice
            ? 'Free sample questions are open to everyone. Unlock this paper (or every paper) to read all topper copies, AI analyses and PYQ model answers.'
            : 'Pricing for this paper is being set up — check back soon.'}
        </p>
        <PlanButtons subject={subject} label={label} store={store} onBuy={onBuy} />
      </div>
    </div>
  );
}
