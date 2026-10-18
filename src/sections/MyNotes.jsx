import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import NoteModal from '../components/study/NoteModal';
import MatchListsView from './quiz/MatchListsView';
import {
  listItems, updateNote, deleteItem, markRevised, moveToNotebook, restoreItem, emptyBin,
  listNotebooks, createNotebook, renameNotebook, deleteNotebook,
} from '../lib/studyApi';
import { jumpTo } from '../lib/studyJump';

// ---------------------------------------------------------------------------
// "My Notes" — every bookmark and note the student saved in Toppers Copy, the Question Bank
// and the Economy Master File, plus notes they wrote themselves. A sidebar picks the view
// (All / Starred / one of their named notebooks / Recently deleted); inside it, filter by
// section / subject, search, edit, file into a notebook, delete (to the bin), jump back to
// the source, or step through the list in Revision mode.
// ---------------------------------------------------------------------------

const PAGE = 50;

const SECTION_LABEL = {
  toppers_copy: 'Toppers Copy',
  question_bank: 'Question Bank',
  economy_master: 'Economy Master File',
  own: 'Written by you',
};
const SECTION_TABS = [
  ['toppers_copy', 'Toppers Copy'],
  ['question_bank', 'Question Bank'],
  ['economy_master', 'Economy'],
  ['own', 'Written by you'],
];
const REF_LABEL = {
  tc_question: 'Question',
  tc_answer: 'Topper copy',
  tc_pyq: 'PYQ',
  qb_question: 'MCQ',
  em_topic: 'Topic',
  own: '',
};

// Sections whose items open back at their source (Question Bank items are shown in place).
const OPENABLE = ['toppers_copy', 'economy_master'];

const SIDEBAR_KEY = 'my_notes_sidebar';

const relTime = (d) => {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(d).toLocaleDateString();
};

// Where "Open" goes for a Toppers Copy / Economy item.
const openSource = (item) => {
  const r = item.ref || {};
  if (item.refType === 'em_topic') {
    jumpTo('economy_master', { topicId: r.economyTopic });
    return;
  }
  jumpTo('toppers_copy', {
    subject: item.context?.subject,
    toppersCopyId: r.toppersCopy || null,
    questionId: item.refType === 'tc_pyq' ? null : r.question,
    answerIdx: item.refType === 'tc_answer' ? r.answerIdx : null,
    pyqId: item.refType === 'tc_pyq' ? r.pyq : null,
  });
};

const Tab = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-1 pb-2.5 pt-1 text-sm whitespace-nowrap border-b-2 -mb-px cursor-pointer transition-colors ${
      active ? 'border-brand text-text-primary font-bold' : 'border-transparent text-text-tertiary hover:text-text-secondary font-semibold'
    }`}
  >
    {children}
  </button>
);

const NavItem = ({ active, onClick, icon, label, count }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors ${
      active ? 'bg-surface-raised text-text-primary font-bold' : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
    }`}
  >
    <span className="flex items-center gap-2 min-w-0">
      <span className="w-4 text-center flex-shrink-0" aria-hidden="true">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
    {count > 0 && <span className="text-[11px] font-semibold tabular-nums text-text-tertiary">{count}</span>}
  </button>
);

const btnGhost = 'text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40';
const btnPrimary = 'text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg px-4 py-2 cursor-pointer disabled:opacity-40';
const inputCls = 'w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand';

export default function MyNotes() {
  const [view, setView] = useState({ type: 'all' }); // all | starred | notebook (+id) | bin
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [revising, setRevising] = useState(false);
  const [writing, setWriting] = useState(false);
  const [notice, setNotice] = useState(null); // { text, undo?: item }
  const reqId = useRef(0);

  const [nb, setNb] = useState({ notebooks: [], counts: { all: 0, starred: 0, bin: 0 }, binDays: 30 });
  const [nbQuery, setNbQuery] = useState('');
  const [creatingNb, setCreatingNb] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) !== 'closed'; } catch { return true; }
  });
  const [mobileNav, setMobileNav] = useState(false);

  const inBin = view.type === 'bin';
  const currentNb = view.type === 'notebook' ? nb.notebooks.find((n) => n._id === view.id) : null;

  const refreshNotebooks = useCallback(() => {
    listNotebooks().then(setNb).catch(() => { /* sidebar keeps its last counts */ });
  }, []);
  useEffect(() => { refreshNotebooks(); }, [refreshNotebooks]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  const params = useMemo(() => ({
    kind: view.type === 'starred' ? 'bookmark' : '',
    notebook: view.type === 'notebook' ? view.id : '',
    bin: inBin ? '1' : '',
    section,
    subject,
    q: debouncedQuery,
  }), [view, inBin, section, subject, debouncedQuery]);

  // (Re)load the first page whenever the view or a filter changes. reqId drops stale responses.
  useEffect(() => {
    const id = ++reqId.current;
    listItems({ ...params, skip: 0, limit: PAGE })
      .then((d) => {
        if (id !== reqId.current) return;
        setItems(d.items || []);
        setTotal(d.total || 0);
        setFacets(d.facets || []);
        setError('');
      })
      .catch((err) => { if (id === reqId.current) setError(err.message); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [params, reloadKey]);

  const reload = () => { setReloadKey((k) => k + 1); refreshNotebooks(); };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const d = await listItems({ ...params, skip: items.length, limit: PAGE });
      setItems((prev) => [...prev, ...(d.items || [])]);
      setTotal(d.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const pickView = (v) => {
    setView(v);
    setSection('');
    setSubject('');
    setLoading(true);
    setRevising(false);
    setMobileNav(false);
  };
  const pickSection = (s) => { setSection(s); setSubject(''); };

  const toggleSidebar = () => {
    setSidebarOpen((open) => {
      try { localStorage.setItem(SIDEBAR_KEY, open ? 'closed' : 'open'); } catch { /* private mode */ }
      return !open;
    });
  };

  // Section tab + subject counts for the current view (Starred only counts bookmarks).
  const counts = useMemo(() => {
    const c = { all: 0 };
    const subjects = new Map();
    for (const f of facets) {
      if (view.type === 'starred' && f.kind !== 'bookmark') continue;
      c.all += f.count;
      c[f.section] = (c[f.section] || 0) + f.count;
      if (f.subject && (!section || f.section === section)) subjects.set(f.subject, (subjects.get(f.subject) || 0) + f.count);
    }
    return { ...c, subjects: [...subjects].sort((a, b) => a[0].localeCompare(b[0])) };
  }, [facets, section, view.type]);

  // subject -> topic -> items, keeping the server's newest-first order inside each group
  const grouped = useMemo(() => {
    const bySubject = new Map();
    for (const it of items) {
      const own = it.context?.section === 'own';
      const s = own ? 'Written by you' : it.context?.subject || 'Other';
      const t = own ? '' : (it.context?.topic || 'General') + (it.subtopic ? ` › ${it.subtopic}` : '');
      if (!bySubject.has(s)) bySubject.set(s, new Map());
      const topics = bySubject.get(s);
      if (!topics.has(t)) topics.set(t, []);
      topics.get(t).push(it);
    }
    return [...bySubject].map(([s, topics]) => ({ subject: s, topics: [...topics].map(([topic, list]) => ({ topic, list })) }));
  }, [items]);

  const patchItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((it) => (it._id === id ? { ...it, ...patch } : it)));
  }, []);

  const dropFromList = useCallback((item) => {
    setItems((prev) => prev.filter((it) => it._id !== item._id));
    setTotal((n) => Math.max(0, n - 1));
    setFacets((prev) => prev.map((f) => (
      f.kind === item.kind && f.section === item.context?.section && f.subject === item.context?.subject
        ? { ...f, count: f.count - 1 } : f
    )).filter((f) => f.count > 0));
  }, []);

  const removeItem = useCallback(async (item) => {
    if (item.kind === 'bookmark' && !window.confirm('Remove this bookmark?')) return;
    if (item.deletedAt && !window.confirm('Delete this note for good? This can’t be undone.')) return;
    try {
      await deleteItem(item._id);
      dropFromList(item);
      refreshNotebooks();
      if (item.kind === 'note' && !item.deletedAt) setNotice({ text: 'Note moved to Recently deleted.', undo: item });
    } catch (err) {
      setError(err.message);
    }
  }, [dropFromList, refreshNotebooks]);

  const restore = useCallback(async (item, { fromUndo = false } = {}) => {
    try {
      await restoreItem(item._id);
      setNotice(fromUndo ? null : { text: 'Note restored.' });
      if (fromUndo) setReloadKey((k) => k + 1);
      else dropFromList(item);
      refreshNotebooks();
    } catch (err) {
      setError(err.message);
    }
  }, [dropFromList, refreshNotebooks]);

  const moveItem = useCallback(async (item, notebookId) => {
    try {
      const { item: updated } = await moveToNotebook(item._id, notebookId);
      const now = updated.notebook || null;
      if (view.type === 'notebook' && now !== view.id) dropFromList(item);
      else patchItem(item._id, { notebook: now });
      refreshNotebooks();
    } catch (err) {
      setError(err.message);
    }
  }, [view, dropFromList, patchItem, refreshNotebooks]);

  const doEmptyBin = async () => {
    if (!window.confirm(`Delete all ${nb.counts.bin} notes in Recently deleted for good? This can’t be undone.`)) return;
    try {
      await emptyBin();
      setItems([]);
      setTotal(0);
      setFacets([]);
      refreshNotebooks();
    } catch (err) {
      setError(err.message);
    }
  };

  const addNotebook = async (name) => {
    const { notebook } = await createNotebook(name);
    setCreatingNb(false);
    refreshNotebooks();
    pickView({ type: 'notebook', id: notebook._id });
  };

  const doRenameNotebook = async (name) => {
    await renameNotebook(currentNb._id, name);
    refreshNotebooks();
  };

  const doDeleteNotebook = async () => {
    const n = currentNb.count;
    const msg = n
      ? `Delete the notebook “${currentNb.name}”? Its ${n} item${n === 1 ? '' : 's'} stay in All notes.`
      : `Delete the notebook “${currentNb.name}”?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteNotebook(currentNb._id);
      refreshNotebooks();
      pickView({ type: 'all' });
    } catch (err) {
      setError(err.message);
    }
  };

  const nbNames = useMemo(() => new Map(nb.notebooks.map((n) => [n._id, n.name])), [nb.notebooks]);
  const shownNotebooks = useMemo(() => {
    const q = nbQuery.trim().toLowerCase();
    return q ? nb.notebooks.filter((n) => n.name.toLowerCase().includes(q)) : nb.notebooks;
  }, [nb.notebooks, nbQuery]);

  if (revising) {
    return (
      <RevisionMode
        items={items}
        onExit={() => setRevising(false)}
        onRevised={(id, r) => patchItem(id, r)}
      />
    );
  }

  const viewTitle = inBin ? 'Recently deleted'
    : view.type === 'starred' ? 'Starred'
      : currentNb ? currentNb.name
        : 'All notes';
  const filtered = !!(section || subject || debouncedQuery);
  const canWrite = view.type === 'all' || view.type === 'notebook';
  const tabs = SECTION_TABS.filter(([key]) => counts[key] > 0 || section === key);

  const sidebar = (
    <nav aria-label="Notebooks" className="space-y-1">
      <input
        type="search"
        value={nbQuery}
        onChange={(e) => setNbQuery(e.target.value)}
        placeholder="Search notebooks"
        className={`${inputCls} mb-2`}
      />
      <NavItem active={view.type === 'all'} onClick={() => pickView({ type: 'all' })} icon="▤" label="All notes" count={nb.counts.all} />
      <NavItem active={view.type === 'starred'} onClick={() => pickView({ type: 'starred' })} icon="★" label="Starred" count={nb.counts.starred} />

      <p className="px-3 pt-4 pb-1 text-[11px] font-extrabold uppercase tracking-widest text-text-tertiary">Notebooks</p>
      {shownNotebooks.map((n) => (
        <NavItem
          key={n._id}
          active={view.type === 'notebook' && view.id === n._id}
          onClick={() => pickView({ type: 'notebook', id: n._id })}
          icon="📓"
          label={n.name}
          count={n.count}
        />
      ))}
      {nbQuery && !shownNotebooks.length && <p className="px-3 py-1 text-xs text-text-tertiary">No notebook matches.</p>}
      {creatingNb ? (
        <NameInput placeholder="Notebook name" submitLabel="Create" onSubmit={addNotebook} onCancel={() => setCreatingNb(false)} />
      ) : (
        <button type="button" onClick={() => setCreatingNb(true)} className="w-full text-left px-3 py-2 text-sm font-semibold text-brand hover:text-brand-hover cursor-pointer">
          + New notebook
        </button>
      )}

      <div className="border-t border-border-default my-2" />
      <NavItem active={inBin} onClick={() => pickView({ type: 'bin' })} icon="🗑" label="Recently deleted" count={nb.counts.bin} />
    </nav>
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6">
      {/* Mobile: the sidebar folds into a dropdown above the list. */}
      <div className="md:hidden mb-4">
        <button
          type="button"
          onClick={() => setMobileNav((v) => !v)}
          className="w-full flex items-center justify-between bg-surface border border-border-default rounded-lg px-3 py-2 text-sm font-bold text-text-primary cursor-pointer"
          aria-expanded={mobileNav}
        >
          <span className="truncate">{viewTitle}</span>
          <span className="text-text-tertiary text-xs">{mobileNav ? '▲' : 'Notebooks ▼'}</span>
        </button>
        {mobileNav && <div className="mt-2 bg-surface border border-border-default rounded-xl p-2">{sidebar}</div>}
      </div>

      <div className="flex gap-6 items-start">
        {sidebarOpen && (
          <aside className="hidden md:block w-60 flex-shrink-0 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
            {sidebar}
          </aside>
        )}

        <main className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden md:flex w-8 h-8 items-center justify-center rounded-full border border-border-default text-text-secondary hover:bg-surface-raised cursor-pointer flex-shrink-0"
                aria-label={sidebarOpen ? 'Hide notebooks' : 'Show notebooks'}
                title={sidebarOpen ? 'Hide notebooks' : 'Show notebooks'}
              >
                {sidebarOpen ? '‹' : '›'}
              </button>
              {currentNb ? (
                <NotebookTitle key={currentNb._id} notebook={currentNb} onRename={doRenameNotebook} onDelete={doDeleteNotebook} />
              ) : (
                <h1 className="text-xl md:text-2xl font-extrabold text-text-primary tracking-tight truncate">{viewTitle}</h1>
              )}
              <span className="text-[11px] font-semibold text-text-tertiary bg-sunken rounded-full px-2 py-0.5 whitespace-nowrap">
                {total} item{total === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {canWrite && (
                <button type="button" onClick={() => setWriting(true)} className={btnGhost + ' py-2'}>
                  ✎ Write a note
                </button>
              )}
              {inBin ? (
                <button type="button" onClick={doEmptyBin} disabled={!nb.counts.bin} className={btnGhost + ' py-2 hover:text-status-danger-text'}>
                  Empty bin
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!items.length}
                  onClick={() => setRevising(true)}
                  className={btnPrimary}
                  title="Go through the items below one by one"
                >
                  ↻ Revise {items.length ? `(${items.length}${total > items.length ? '+' : ''})` : ''}
                </button>
              )}
            </div>
          </div>
          {inBin && (
            <p className="text-sm text-text-tertiary mt-2">
              Deleted notes stay here for {nb.binDays} days, then they’re gone for good. Removed bookmarks don’t come here — just star the question again.
            </p>
          )}

          {tabs.length > 0 && (
            <div className="mt-4 flex gap-5 border-b border-border-default overflow-x-auto">
              <Tab active={!section} onClick={() => pickSection('')}>All</Tab>
              {tabs.map(([key, label]) => (
                <Tab key={key} active={section === key} onClick={() => pickSection(key)}>
                  {label} <span className="text-text-tertiary font-normal">{counts[key] || 0}</span>
                </Tab>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions, quotes and your notes…"
              className={`${inputCls} flex-1`}
            />
            {counts.subjects.length > 1 && (
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={`${inputCls} sm:w-auto`}
                aria-label="Subject"
              >
                <option value="">All subjects</option>
                {counts.subjects.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
              </select>
            )}
          </div>

          {notice && (
            <div className="mt-4 flex items-center justify-between gap-3 bg-sunken border border-border-default rounded-lg px-3 py-2 text-sm text-text-secondary" role="status">
              <span>{notice.text}</span>
              {notice.undo && (
                <button type="button" onClick={() => restore(notice.undo, { fromUndo: true })} className="text-xs font-bold text-brand hover:text-brand-hover cursor-pointer">
                  Undo
                </button>
              )}
            </div>
          )}
          {error && <p className="mt-4 text-sm text-status-danger-text">{error}</p>}

          {loading ? (
            <div className="py-16 flex justify-center"><LoadingSpinner text="Loading your notes..." /></div>
          ) : items.length === 0 ? (
            <div className="mt-6 bg-surface border border-border-default rounded-2xl p-10 text-center">
              {filtered ? (
                <p className="text-sm text-text-tertiary">Nothing matches these filters.</p>
              ) : (
                <EmptyView view={view} onWrite={() => setWriting(true)} />
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-8">
              {grouped.map((g) => (
                <section key={g.subject}>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-text-tertiary mb-3">{g.subject}</h2>
                  <div className="space-y-5">
                    {g.topics.map((t) => (
                      <div key={t.topic}>
                        {t.topic && <h3 className="text-sm font-bold text-text-primary mb-2">{t.topic}</h3>}
                        <div className="space-y-2.5">
                          {t.list.map((it) => (
                            <NoteCard
                              key={it._id}
                              item={it}
                              notebooks={nb.notebooks}
                              notebookName={view.type === 'notebook' ? '' : nbNames.get(it.notebook) || ''}
                              onPatch={patchItem}
                              onDelete={removeItem}
                              onMove={moveItem}
                              onRestore={restore}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              {items.length < total && (
                <div className="flex justify-center">
                  <button onClick={loadMore} disabled={loadingMore} className={btnGhost + ' px-5 py-2'}>
                    {loadingMore ? 'Loading…' : `Load more (${total - items.length})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {writing && (
        <NoteModal
          studyRef={{ refType: 'own' }}
          notebookId={view.type === 'notebook' ? view.id : undefined}
          onClose={() => setWriting(false)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function EmptyView({ view, onWrite }) {
  if (view.type === 'bin') return <p className="text-sm text-text-tertiary">Nothing here. Notes you delete wait here for 30 days.</p>;
  if (view.type === 'starred') {
    return <p className="text-sm text-text-tertiary">Tap ☆ on a question, a topper’s copy, a PYQ or an MCQ and it shows up here.</p>;
  }
  if (view.type === 'notebook') {
    return (
      <>
        <p className="font-bold text-text-primary">This notebook is empty</p>
        <p className="text-sm text-text-tertiary mt-2 max-w-md mx-auto">
          Pick this notebook when you “Add to notes” while reading, move items here from All notes, or write a note of your own.
        </p>
        <button type="button" onClick={onWrite} className={btnPrimary + ' mt-4'}>✎ Write a note</button>
      </>
    );
  }
  return (
    <>
      <p className="font-bold text-text-primary">Nothing saved yet</p>
      <p className="text-sm text-text-tertiary mt-2 max-w-md mx-auto">
        Tap ☆ on a question, a topper’s copy or a PYQ to bookmark it. Select any text in an AI analysis,
        a model answer or an MCQ and hit “Add to notes” to save it here with your own comment, or write a note of your own.
      </p>
    </>
  );
}

// A small "name + Save/Cancel" form, for creating and renaming notebooks.
function NameInput({ initial = '', placeholder, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { onCancel(); return; }
    if (name.trim() === initial) { onCancel(); return; }
    setBusy(true);
    setErr('');
    try {
      await onSubmit(name.trim());
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="px-1 py-1 space-y-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
        maxLength={60}
        autoFocus
        placeholder={placeholder}
        aria-label={placeholder}
        className={inputCls}
      />
      {err && <p className="text-xs text-status-danger-text">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary + ' py-1.5'}>{busy ? 'Saving…' : submitLabel}</button>
        <button type="button" onClick={onCancel} className={btnGhost}>Cancel</button>
      </div>
    </form>
  );
}

function NotebookTitle({ notebook, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(false);
  if (renaming) {
    return (
      <div className="w-72 max-w-full">
        <NameInput
          initial={notebook.name}
          placeholder="Notebook name"
          submitLabel="Rename"
          onSubmit={async (name) => { await onRename(name); setRenaming(false); }}
          onCancel={() => setRenaming(false)}
        />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 min-w-0">
      <h1 className="text-xl md:text-2xl font-extrabold text-text-primary tracking-tight truncate">{notebook.name}</h1>
      <button type="button" onClick={() => setRenaming(true)} className="text-[11px] font-bold text-text-tertiary hover:text-text-primary cursor-pointer px-2 py-1">
        Rename
      </button>
      <button type="button" onClick={onDelete} className="text-[11px] font-bold text-text-tertiary hover:text-status-danger-text cursor-pointer px-1 py-1">
        Delete
      </button>
    </div>
  );
}

function ItemMeta({ item, notebookName }) {
  const own = item.context?.section === 'own';
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-text-tertiary">
      <span className={`font-bold ${item.kind === 'bookmark' ? 'text-status-warning-text' : 'text-brand'}`}>
        {item.kind === 'bookmark' ? '★ Bookmark' : '✎ Note'}
      </span>
      {!own && <span className="uppercase tracking-wide">{SECTION_LABEL[item.context?.section]} · {REF_LABEL[item.refType]}</span>}
      {item.context?.subtitle && <span>{item.context.subtitle}</span>}
      {notebookName && <span className="text-text-secondary">📓 {notebookName}</span>}
      <span>· {item.deletedAt ? `deleted ${relTime(item.deletedAt)}` : relTime(item.createdAt)}</span>
      {item.revisedCount > 0 && (
        <span className="text-brand">· revised {item.revisedCount}× (last {relTime(item.lastRevisedAt)})</span>
      )}
    </div>
  );
}

function NoteCard({ item, notebooks, notebookName, onPatch, onDelete, onMove, onRestore }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body || '');
  const [titleDraft, setTitleDraft] = useState(item.context?.title || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showMcq, setShowMcq] = useState(false);
  const isTc = OPENABLE.includes(item.context?.section);
  const own = item.refType === 'own';
  const deleted = !!item.deletedAt;

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const { item: updated } = await updateNote(item._id, own ? { body: draft, title: titleDraft } : { body: draft });
      onPatch(item._id, { body: updated.body, context: updated.context, updatedAt: updated.updatedAt });
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const action = 'text-[11px] font-bold cursor-pointer px-2 py-1';

  return (
    <article className={`bg-surface border border-border-default rounded-2xl p-4 space-y-2.5 ${deleted ? 'opacity-80' : ''}`}>
      <ItemMeta item={item} notebookName={notebookName} />

      {editing && own ? (
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          maxLength={200}
          placeholder="Title"
          aria-label="Title"
          className={`${inputCls} font-semibold`}
        />
      ) : (
        <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-3">
          {item.context?.title || (own ? 'Untitled note' : 'Untitled')}
        </p>
      )}

      {!isTc && showMcq && item.mcq && <McqReveal mcq={item.mcq} />}
      {item.refType === 'qb_question' && !item.mcq && (
        <p className="text-[11px] italic text-text-tertiary">This question has since been removed from the bank.</p>
      )}

      {item.quote && (
        <blockquote className="font-reading text-sm text-text-primary leading-relaxed border-l-2 border-brand pl-3 whitespace-pre-line">
          {item.quote}
          {item.quoteFrom && <span className="block text-[11px] text-text-tertiary not-italic mt-1">— {item.quoteFrom}</span>}
        </blockquote>
      )}

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={own ? 8 : 4}
            maxLength={10000}
            autoFocus={!own}
            className={`${inputCls} resize-y`}
          />
          {err && <p className="text-xs text-status-danger-text">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className={btnGhost}>Cancel</button>
            <button onClick={save} disabled={saving} className={btnPrimary + ' py-1.5'}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : item.body ? (
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line bg-sunken rounded-lg px-3 py-2">{item.body}</p>
      ) : null}

      {!editing && (
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          {deleted ? <span /> : (
            <select
              value={item.notebook || ''}
              onChange={(e) => onMove(item, e.target.value)}
              className="text-[11px] font-semibold bg-surface border border-border-default rounded-md px-2 py-1 text-text-secondary max-w-[12rem] cursor-pointer focus:outline-none focus:border-brand"
              aria-label="Notebook"
              title="File in a notebook"
            >
              <option value="">📓 No notebook</option>
              {notebooks.map((n) => <option key={n._id} value={n._id}>📓 {n.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {deleted ? (
              <>
                <button onClick={() => onRestore(item)} className={`${action} text-brand hover:text-brand-hover`}>Restore</button>
                <button onClick={() => onDelete(item)} className={`${action} text-text-tertiary hover:text-status-danger-text`}>Delete forever</button>
              </>
            ) : (
              <>
                {isTc && (
                  <button onClick={() => openSource(item)} className={`${action} text-brand hover:text-brand-hover`}>Open →</button>
                )}
                {item.mcq && (
                  <button onClick={() => setShowMcq((v) => !v)} className={`${action} text-brand hover:text-brand-hover`}>
                    {showMcq ? 'Hide answer' : 'Show answer'}
                  </button>
                )}
                {item.kind === 'note' && (
                  <button
                    onClick={() => { setDraft(item.body || ''); setTitleDraft(item.context?.title || ''); setEditing(true); }}
                    className={`${action} text-text-secondary hover:text-text-primary`}
                  >
                    Edit
                  </button>
                )}
                <button onClick={() => onDelete(item)} className={`${action} text-text-tertiary hover:text-status-danger-text`} aria-label="Delete">
                  {item.kind === 'bookmark' ? 'Unstar' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// An MCQ with its answer shown — or, in practice mode, pick first then reveal.
// `onPick` lets the parent hold back anything else that would give the answer away.
function McqReveal({ mcq, practice = false, onPick }) {
  const [picked, setPicked] = useState(null);
  const revealed = !practice || !!picked;
  return (
    <div className="border border-border-default rounded-xl p-3 space-y-2.5 bg-sunken/40">
      {mcq.matchLists ? <MatchListsView stem="" matchLists={mcq.matchLists} /> : null}
      {mcq.statements?.length > 0 && (
        <ul className="flex flex-col gap-1 border-l-2 border-border-default">
          {mcq.statements.map((s, i) => <li key={i} className="text-sm text-text-secondary leading-relaxed pl-3 whitespace-pre-line">{s}</li>)}
        </ul>
      )}
      <div className="grid sm:grid-cols-2 gap-2">
        {mcq.options.map((o) => {
          const isCorrect = o.key === mcq.correctKey;
          const cls = revealed
            ? isCorrect ? 'border-status-success-text/40 bg-status-success-bg'
              : o.key === picked ? 'border-status-danger-text/40 bg-status-danger-bg' : 'border-border-default opacity-60'
            : 'border-border-default hover:border-brand cursor-pointer';
          return (
            <button
              key={o.key}
              type="button"
              disabled={revealed}
              onClick={() => { setPicked(o.key); onPick?.(o.key); }}
              className={`flex items-start gap-2 p-2.5 rounded-lg border text-left text-sm ${cls}`}
            >
              <span className="font-bold text-text-tertiary flex-none">{o.key}.</span>
              <span className="text-text-primary leading-snug">{o.text}</span>
            </button>
          );
        })}
      </div>
      {revealed && (
        <div>
          <p className={`text-[11px] font-extrabold uppercase tracking-widest ${!practice || picked === mcq.correctKey ? 'text-status-success-text' : 'text-status-danger-text'}`}>
            {practice ? (picked === mcq.correctKey ? '✓ Correct' : `✗ Correct answer: ${mcq.correctKey}`) : `Answer: ${mcq.correctKey}`}
          </p>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line mt-1">{mcq.whyCorrect || 'Explanation coming soon.'}</p>
        </div>
      )}
    </div>
  );
}

// One saved item at a time. MCQs are answered before the key shows; everything else shows
// its quote + note. "Mark revised" bumps the item's revision count and moves on.
function RevisionMode({ items, onExit, onRevised }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(() => new Set());
  const [answered, setAnswered] = useState(() => new Set()); // MCQ items the student has picked on
  const item = items[i];
  const isTc = OPENABLE.includes(item?.context?.section);
  // An MCQ's saved quote/note is usually the explanation — keep it hidden until they answer.
  const hideExtras = !isTc && !!item?.mcq && !answered.has(item._id);
  const last = i >= items.length - 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') setI((n) => Math.min(items.length - 1, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onExit]);

  const revised = async () => {
    setBusy(true);
    try {
      const r = await markRevised(item._id);
      onRevised(item._id, r);
      setDone((s) => new Set(s).add(item._id));
      if (!last) setI(i + 1);
    } catch {
      /* leave it — the student can press again */
    } finally {
      setBusy(false);
    }
  };

  if (!item) return null;
  const pct = Math.round(((i + 1) / items.length) * 100);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <button onClick={onExit} className="text-sm font-bold text-text-secondary hover:text-text-primary cursor-pointer">← My Notes</button>
        <span className="text-[11px] font-bold tabular-nums text-text-tertiary">
          {i + 1} / {items.length} · {done.size} revised
        </span>
      </div>
      <div className="h-1.5 bg-sunken rounded-full overflow-hidden mb-5">
        <div className="h-full bg-brand rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <article key={item._id} className="bg-surface border border-border-default rounded-2xl p-5 md:p-6 space-y-4">
        <ItemMeta item={item} />
        <p className="text-base font-semibold text-text-primary leading-snug">{item.context?.title}</p>
        {!isTc && item.mcq && (
          <McqReveal mcq={item.mcq} practice onPick={() => setAnswered((s) => new Set(s).add(item._id))} />
        )}
        {hideExtras && (item.quote || item.body) && (
          <p className="text-[11px] italic text-text-tertiary">Pick an answer to see your note.</p>
        )}
        {!hideExtras && item.quote && (
          <blockquote className="font-reading text-sm text-text-primary leading-relaxed border-l-2 border-brand pl-3 whitespace-pre-line">
            {item.quote}
          </blockquote>
        )}
        {!hideExtras && item.body && <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line bg-sunken rounded-lg px-3 py-2">{item.body}</p>}
        {isTc && (
          <button onClick={() => openSource(item)} className="text-xs font-bold text-brand hover:text-brand-hover cursor-pointer">
            Open in {SECTION_LABEL[item.context?.section]} →
          </button>
        )}
      </article>

      <div className="flex items-center justify-between gap-2 mt-5">
        <button
          onClick={() => setI(i - 1)}
          disabled={i === 0}
          className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised disabled:opacity-40 rounded-lg px-4 py-2 cursor-pointer"
        >
          ← Previous
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={revised}
            disabled={busy}
            className={`text-xs font-bold rounded-lg px-5 py-2 cursor-pointer disabled:opacity-40 ${
              done.has(item._id) ? 'border border-brand text-brand' : 'bg-brand hover:bg-brand-hover text-text-on-accent'
            }`}
          >
            {done.has(item._id) ? '✓ Revised' : 'Mark revised'}
          </button>
          {last ? (
            <button onClick={onExit} className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised rounded-lg px-4 py-2 cursor-pointer">
              Done
            </button>
          ) : (
            <button onClick={() => setI(i + 1)} className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised rounded-lg px-4 py-2 cursor-pointer">
              Skip →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
