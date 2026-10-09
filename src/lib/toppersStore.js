import { useState, useEffect, useCallback } from 'react';

// Buying Toppers Copy: one subject, or every subject at once (the backend's ALL_SUBJECTS
// plan). Prices, ownership and the student's requests come from GET /api/toppers-copy/store.
// Kept out of components/ToppersCopyUnlock.jsx so that file stays Fast-Refresh friendly.
export const ALL_SUBJECTS = '__all__';

export const planPrice = (p) => (p?.useDiscount ? p.discountedPrice : p?.price);

export function useToppersStore() {
  const [store, setStore] = useState({ plans: [], requests: [], isAdmin: false, loaded: false });
  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/toppers-copy/store', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (res.ok) setStore({ ...data, loaded: true });
    } catch (err) {
      console.error('toppers store load failed', err);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const plan = (key) => store.plans.find((p) => p.plan === key) || null;
  const pending = (key) => store.requests.some((r) => r.plan === key && r.status === 'pending');
  return { ...store, reload, plan, pending };
}
