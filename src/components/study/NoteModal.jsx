import { useState, useEffect, useRef } from 'react';
import { createNote } from '../../lib/studyApi';

// "Add to notes" dialog. Shows what the note is attached to (`title`) and the selected
// `quote` (if any), takes the student's own words, saves via /api/study/notes.
// Render it only while open (`{draft && <NoteModal …/>}`) so every note starts blank.
export default function NoteModal({ studyRef, title, quote = '', quoteFrom = '', onClose, onSaved }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef(null);

  useEffect(() => {
    textRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    if (!quote && !body.trim()) { setError('Write something first.'); return; }
    setSaving(true);
    setError('');
    try {
      const { item } = await createNote(studyRef, { quote, quoteFrom, body });
      onSaved?.(item);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add to notes"
        className="bg-surface border border-border-default w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border-default flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-text-primary text-base">Add to My Notes</h3>
            {title && <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-2">{title}</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-sunken text-text-secondary cursor-pointer text-lg leading-none flex-shrink-0" aria-label="Close">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          {quote && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
                Selected text{quoteFrom ? ` · ${quoteFrom}` : ''}
              </p>
              <blockquote className="font-reading text-sm text-text-primary leading-relaxed border-l-2 border-brand pl-3 max-h-40 overflow-y-auto whitespace-pre-line">
                {quote}
              </blockquote>
            </div>
          )}
          <div>
            <label htmlFor="note-body" className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
              Your note{quote ? ' (optional)' : ''}
            </label>
            <textarea
              id="note-body"
              ref={textRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }}
              rows={4}
              maxLength={10000}
              placeholder="Why this matters, how you'd use it in an answer…"
              className="mt-1 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand resize-y"
            />
          </div>
          {error && <p className="text-xs text-status-danger-text">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border-default flex justify-end gap-2">
          <button onClick={onClose} className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised rounded-lg px-4 py-2 cursor-pointer">Cancel</button>
          <button onClick={save} disabled={saving} className="text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent disabled:opacity-40 rounded-lg px-5 py-2 cursor-pointer">
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  );
}
