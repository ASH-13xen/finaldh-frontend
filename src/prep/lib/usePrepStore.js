// The student's own preparation, loaded once for the section: each question's status, whether it is saved,
// and the student's note. Updates show at once and are saved in the background (rolled back on failure).
// A visitor who hasn't signed in has nothing saved; trying to save asks them to sign in (onGuest).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';

export const STATUSES = ['todo', 'drafted', 'practised', 'confident'];

export function usePrepStore({ guest = false, onGuest } = {}) {
  const [items, setItems] = useState(() => new Map());
  const [interviewDate, setInterviewDate] = useState(null);
  const [loaded, setLoaded] = useState(guest);
  const itemsRef = useRef(items);
  const onGuestRef = useRef(onGuest);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { onGuestRef.current = onGuest; }, [onGuest]);

  useEffect(() => {
    if (guest) return undefined;
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
  }, [guest]);

  // patch: { status?, saved?, note? }; info: { text, familyId, source } so lists can show the question.
  const update = useCallback(async (key, patch, info = {}) => {
    if (guest) { onGuestRef.current?.(); return false; }
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
  }, [guest]);

  // Puts what the server already saved (an answer draft) into the store without saving again.
  const merge = useCallback((key, patch) => {
    setItems((m) => new Map(m).set(key, { key, status: 'todo', saved: false, note: '', ...m.get(key), ...patch }));
  }, []);

  const setDate = useCallback(async (date) => {
    if (guest) { onGuestRef.current?.(); return; }
    setInterviewDate(date);
    try { await api.prepSettings({ interviewDate: date }); } catch { /* keeps the local value for this visit */ }
  }, [guest]);

  return useMemo(() => ({ items, loaded, update, merge, interviewDate, setDate }), [items, loaded, update, merge, interviewDate, setDate]);
}
