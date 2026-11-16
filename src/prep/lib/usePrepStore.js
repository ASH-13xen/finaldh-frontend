// The student's own preparation, loaded once for the section: each question's status, whether it is saved,
// and the student's note. Updates show at once and are saved in the background (rolled back on failure).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';

export const STATUSES = ['todo', 'drafted', 'practised', 'confident'];

export function usePrepStore() {
  const [items, setItems] = useState(() => new Map());
  const [interviewDate, setInterviewDate] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const itemsRef = useRef(items);

  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    let cancelled = false;
    api.prep()
      .then((d) => {
        if (cancelled) return;
        setItems(new Map((d.items || []).map((i) => [i.key, i])));
        setInterviewDate(d.interviewDate || null);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // patch: { status?, saved?, note? }; info: { text, familyId, source } so lists can show the question.
  const update = useCallback(async (key, patch, info = {}) => {
    const before = itemsRef.current.get(key);
    const next = { key, status: 'todo', saved: false, note: '', ...before, ...info, ...patch, updatedAt: new Date().toISOString() };
    setItems((m) => new Map(m).set(key, next));
    try {
      await api.savePrep(key, { ...patch, ...info });
      return true;
    } catch {
      setItems((m) => {
        const copy = new Map(m);
        if (before) copy.set(key, before); else copy.delete(key);
        return copy;
      });
      return false;
    }
  }, []);

  const setDate = useCallback(async (date) => {
    setInterviewDate(date);
    try { await api.prepSettings({ interviewDate: date }); } catch { /* keeps the local value for this visit */ }
  }, []);

  return useMemo(() => ({ items, loaded, update, interviewDate, setDate }), [items, loaded, update, interviewDate, setDate]);
}
