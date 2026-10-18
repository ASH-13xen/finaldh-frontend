import { useState, useEffect, useRef } from 'react';
import { createNote, listNotebooks, createNotebook, getLastNotebook, setLastNotebook } from '../../lib/studyApi';

const NEW_NB = '__new__';

// "Add to notes" dialog. Shows what the note is attached to (`title`) and the selected
// `quote` (if any), takes the student's own words and which notebook to file it in, saves via
// /api/study/notes. With studyRef { refType: 'own' } it's "Write a note" instead: a title
// plus text, not attached to anything. `notebookId` preselects a notebook (else the last used).
// Render it only while open (`{draft && <NoteModal …/>}`) so every note starts blank.
export default function NoteModal({ studyRef, title, quote = '', quoteFrom = '', notebookId, onClose, onSaved }) {
  const own = studyRef?.refType === 'own';
  const [noteTitle, setNoteTitle] = useState('');
  const [body, setBody] = useState('');
  const [notebooks, setNotebooks] = useState(null);
  const [nbId, setNbId] = useState(notebookId ?? getLastNotebook());
  const [newNbName, setNewNbName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    (own ? titleRef : textRef).current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, own]);

  useEffect(() => {
    let alive = true;
    listNotebooks()
      .then((d) => {
        if (!alive) return;
        const list = d.notebooks || [];
        setNotebooks(list);
        // The remembered notebook may have been deleted since.
        setNbId((cur) => (cur && cur !== NEW_NB && !list.some((nb) => nb._id === cur) ? '' : cur));
      })
      .catch(() => { if (alive) setNotebooks([]); });
    return () => { alive = false; };
  }, []);

  const save = async () => {
    if (!quote && !body.trim() && !(own && noteTitle.trim())) { setError('Write something first.'); return; }
    if (nbId === NEW_NB && !newNbName.trim()) { setError('Name the new notebook.'); return; }
    setSaving(true);
    setError('');
    try {
      let target = nbId;
      if (nbId === NEW_NB) {
        const { notebook } = await createNotebook(newNbName);
        setNotebooks((list) => [...(list || []), notebook]);
        setNbId(notebook._id);
        target = notebook._id;
      }
      const { item } = await createNote(studyRef, { quote, quoteFrom, body, title: own ? noteTitle : undefined, notebookId: target || null });
      setLastNotebook(target);
      onSaved?.(item);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onCtrlEnter = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); };
  const field = 'w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand';
  const label = 'text-[11px] font-bold uppercase tracking-wider text-text-tertiary';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={own ? 'Write a note' : 'Add to notes'}
        className="bg-surface border border-border-default w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border-default flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-text-primary text-base">{own ? 'Write a note' : 'Add to My Notes'}</h3>
            {title && <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-2">{title}</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-sunken text-text-secondary cursor-pointer text-lg leading-none flex-shrink-0" aria-label="Close">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          {quote && (
            <div>
              <p className={`${label} mb-1`}>
                Selected text{quoteFrom ? ` · ${quoteFrom}` : ''}
              </p>
              <blockquote className="font-reading text-sm text-text-primary leading-relaxed border-l-2 border-brand pl-3 max-h-40 overflow-y-auto whitespace-pre-line">
                {quote}
              </blockquote>
            </div>
          )}
          {own && (
            <div>
              <label htmlFor="note-title" className={label}>Title</label>
              <input
                id="note-title"
                ref={titleRef}
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                onKeyDown={onCtrlEnter}
                maxLength={200}
                placeholder="e.g. Federalism — keywords for the intro"
                className={`mt-1 ${field}`}
              />
            </div>
          )}
          <div>
            <label htmlFor="note-body" className={label}>
              {own ? 'Note' : `Your note${quote ? ' (optional)' : ''}`}
            </label>
            <textarea
              id="note-body"
              ref={textRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onCtrlEnter}
              rows={own ? 8 : 4}
              maxLength={10000}
              placeholder={own ? 'Points, examples, data, a framework…' : "Why this matters, how you'd use it in an answer…"}
              className={`mt-1 ${field} resize-y`}
            />
          </div>
          <div>
            <label htmlFor="note-notebook" className={label}>Notebook</label>
            <div className="mt-1 flex flex-col sm:flex-row gap-2">
              <select
                id="note-notebook"
                value={nbId}
                disabled={!notebooks}
                onChange={(e) => setNbId(e.target.value)}
                className={`${field} sm:flex-1`}
              >
                <option value="">No notebook</option>
                {(notebooks || []).map((nb) => <option key={nb._id} value={nb._id}>{nb.name}</option>)}
                <option value={NEW_NB}>+ New notebook…</option>
              </select>
              {nbId === NEW_NB && (
                <input
                  value={newNbName}
                  onChange={(e) => setNewNbName(e.target.value)}
                  onKeyDown={onCtrlEnter}
                  maxLength={60}
                  autoFocus
                  placeholder="Notebook name"
                  aria-label="New notebook name"
                  className={`${field} sm:flex-1`}
                />
              )}
            </div>
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
