import { useState, useEffect, useCallback } from 'react';
import { listBookmarkKeys, toggleBookmark, refKeyOf } from './studyApi';

// Bookmark state for one section: loads the student's starred refKeys once, then
// `isBookmarked(ref)` / `toggle(ref)` with an optimistic flip (rolled back on failure).
export default function useBookmarks(section) {
  const [keys, setKeys] = useState(() => new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listBookmarkKeys(section)
      .then((d) => { if (alive) setKeys(new Set(d.keys || [])); })
      .catch(() => { /* not fatal — stars just start empty */ });
    return () => { alive = false; };
  }, [section]);

  const flip = (key, on) =>
    setKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });

  const isBookmarked = useCallback((ref) => keys.has(refKeyOf(ref)), [keys]);

  const toggle = useCallback(async (ref) => {
    const key = refKeyOf(ref);
    const was = keys.has(key);
    flip(key, !was);
    setError('');
    try {
      const res = await toggleBookmark(ref);
      flip(res.refKey || key, res.bookmarked);
    } catch (err) {
      flip(key, was);
      setError(err.message);
    }
  }, [keys]);

  return { isBookmarked, toggle, error };
}
