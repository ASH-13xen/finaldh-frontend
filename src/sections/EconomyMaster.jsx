import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import BookmarkButton from '../components/study/BookmarkButton';
import NoteModal from '../components/study/NoteModal';
import SelectionToNote from '../components/study/SelectionToNote';
import TopicBody from '../components/economy/TopicBody';
import SourcePageModal from '../components/economy/SourcePageModal';
import QuizRunner from './quiz/QuizRunner';
import QuizSummary from './quiz/QuizSummary';
import useBookmarks from '../lib/useBookmarks';
import { listItems, deleteItem } from '../lib/studyApi';
import { peekJump, clearJump } from '../lib/studyJump';
import {
  listThemes, getTheme, getThemePyqs, getTopic, searchTopics, getRevision, setProgress, SOURCE_LABEL,
} from '../lib/economyApi';

// ---------------------------------------------------------------------------
// Economy Master File — the 144-page master PDF turned into a theme-wise study module.
//   Home   : theme cards with my progress, "continue", revision due, search across topics
//   Theme  : sticky bar (Topics · PYQs · Progress · Notes · Bookmarks) over topic cards that
//            keep the PDF's bold / highlights / ✓✕ marks, with read→revised→mastered tracking,
//            bookmarks + notes (shared with My Notes) and the original PDF page on demand.
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'topics', label: 'Topics', icon: '☰' },
  { key: 'pyqs', label: 'PYQs', icon: '✎' },
  { key: 'progress', label: 'Progress', icon: '◔' },
  { key: 'notes', label: 'Notes', icon: '🗒' },
  { key: 'bookmarks', label: 'Bookmarks', icon: '★' },
];

const STATUS = {
  read: { label: 'Read', cls: 'bg-status-info-bg text-status-info-text border-status-info-text/30' },
  revised: { label: 'Revised', cls: 'bg-status-warning-bg text-status-warning-text border-status-warning-text/30' },
  mastered: { label: 'Mastered', cls: 'bg-status-success-bg text-status-success-text border-status-success-text/30' },
};

const PREFS_KEY = 'economy_prefs_v1';
const loadPrefs = () => {
  try { return { plain: false, outline: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { plain: false, outline: false }; }
};
const savePrefs = (p) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private mode */ } };

const emRef = (topicId) => ({ refType: 'em_topic', economyTopicId: topicId });
const isDue = (p) => p && p.status !== 'mastered' && p.nextReviewAt && new Date(p.nextReviewAt) <= new Date();
const relDays = (d) => {
  const days = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
};

// Height of the app's sticky navbar, so our bar can stick right under it.
const useNavHeight = () => {
  const [h, setH] = useState(64);
  useEffect(() => {
    const nav = document.querySelector('nav');
    if (!nav) return undefined;
    const update = () => setH(nav.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);
  return h;
};

const Chip = ({ active, onClick, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors whitespace-nowrap ${
      active ? 'bg-brand text-text-on-accent border-brand' : 'bg-surface text-text-secondary border-border-default hover:bg-surface-raised'
    }`}
  >
    {children}
  </button>
);

const ProgressBar = ({ parts, total, className = 'h-1.5' }) => (
  <div className={`w-full bg-sunken rounded-full overflow-hidden flex ${className}`}>
    {parts.map(([n, cls], i) => (
      <div key={i} className={cls} style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
    ))}
  </div>
);

export default function EconomyMaster() {
  const [view, setView] = useState(() => {
    const j = peekJump('economy_master');
    return j?.themeKey ? { kind: 'theme', key: j.themeKey, tab: 'topics', focus: j.topicId || null } : { kind: 'home' };
  });

  // A jump from My Notes may carry only the topic id — resolve its theme.
  useEffect(() => {
    const j = peekJump('economy_master');
    if (!j) return;
    clearJump();
    if (j.themeKey || !j.topicId) return;
    getTopic(j.topicId)
      .then(({ topic }) => setView({ kind: 'theme', key: topic.themeKey, tab: 'topics', focus: topic._id }))
      .catch(() => {});
  }, []);

  const openTheme = useCallback((key, extra = {}) => {
    setView({ kind: 'theme', key, tab: 'topics', focus: null, ...extra });
    window.scrollTo({ top: 0 });
  }, []);

  if (view.kind === 'theme') {
    return (
      <ThemeView
        key={view.key}
        themeKey={view.key}
        initialTab={view.tab}
        focus={view.focus}
        onBack={() => { setView({ kind: 'home' }); window.scrollTo({ top: 0 }); }}
      />
    );
  }
  return <HomeView onOpenTheme={openTheme} />;
}

// ============================================================================ home

function HomeView({ onOpenTheme }) {
  const [data, setData] = useState(null);
  const [due, setDue] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    Promise.all([listThemes(), getRevision()])
      .then(([t, r]) => { setData(t); setDue(r.due || []); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(null); return undefined; }
    const id = setTimeout(() => {
      searchTopics(q).then((d) => setResults(d.results)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  if (error) return <div className="max-w-5xl mx-auto p-6 text-sm text-status-danger-text">{error}</div>;
  if (!data) return <div className="py-24 flex justify-center"><LoadingSpinner /></div>;

  const totals = data.themes.reduce((a, t) => {
    a.topics += t.topicCount;
    a.done += t.progress.read + t.progress.revised + t.progress.mastered;
    a.mastered += t.progress.mastered;
    return a;
  }, { topics: 0, done: 0, mastered: 0 });

  const dueByTheme = due.reduce((m, d) => ({ ...m, [d.themeKey]: [...(m[d.themeKey] || []), d] }), {});

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand">Prelims · Economy</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-text-primary mt-1">Economy Master File</h1>
          <p className="text-sm text-text-secondary mt-1.5 max-w-xl">
            {totals.topics} topics across {data.themes.length} themes. Forum, Part B and Vision notes merged theme by theme.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-surface border border-border-default rounded-2xl px-4 py-3">
          <div>
            <p className="text-2xl font-bold text-text-primary tabular-nums">{totals.topics ? Math.round((totals.done / totals.topics) * 100) : 0}%</p>
            <p className="text-[11px] text-text-tertiary font-semibold">covered</p>
          </div>
          <div className="w-px h-9 bg-border-default" />
          <div className="text-[11px] text-text-secondary space-y-0.5">
            <p><span className="font-bold text-text-primary tabular-nums">{totals.done}</span> read</p>
            <p><span className="font-bold text-text-primary tabular-nums">{totals.mastered}</span> mastered</p>
          </div>
        </div>
      </header>

      {data.admin && data.themes.some((t) => !t.isPublished) && (
        <p className="text-xs text-status-warning-text bg-status-warning-bg rounded-xl px-4 py-2.5">
          Admin preview: themes marked “Draft” are hidden from students until you publish them in Economy Data.
        </p>
      )}

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all topics — e.g. SDF, Phillips curve, FRBM…"
          className="w-full bg-surface border border-border-default rounded-2xl pl-11 pr-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden="true">⌕</span>
        {results && (
          <div className="mt-2 bg-surface border border-border-default rounded-2xl divide-y divide-border-default max-h-[60vh] overflow-y-auto">
            {results.length === 0 && <p className="px-4 py-3 text-sm text-text-tertiary">No topics match “{query}”.</p>}
            {results.map((r) => (
              <button
                key={r._id}
                onClick={() => onOpenTheme(r.themeKey, { focus: r._id })}
                className="w-full text-left px-4 py-3 hover:bg-surface-raised cursor-pointer"
              >
                <p className="text-sm font-semibold text-text-primary">{r.title}</p>
                <p className="text-[11px] text-text-tertiary font-semibold mt-0.5">{r.themeTitle} · {SOURCE_LABEL[r.source]}</p>
                {r.snippet && !r.inTitle && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{r.snippet}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {(data.resume || due.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.resume && (
            <button
              onClick={() => onOpenTheme(data.resume.themeKey, { focus: data.resume.topicId })}
              className="text-left bg-brand text-text-on-accent rounded-2xl px-5 py-4 cursor-pointer hover:bg-brand-hover transition-colors"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Continue where you left off</p>
              <p className="font-semibold mt-1 line-clamp-1">{data.resume.title}</p>
              <p className="text-xs opacity-80 mt-0.5">{data.themes.find((t) => t.key === data.resume.themeKey)?.title}</p>
            </button>
          )}
          {due.length > 0 && (
            <div className="bg-surface border border-status-warning-text/30 rounded-2xl px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-status-warning-text">Due for revision today · {due.length}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(dueByTheme).map(([key, list]) => (
                  <button
                    key={key}
                    onClick={() => onOpenTheme(key, { tab: 'progress' })}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-status-warning-bg text-status-warning-text cursor-pointer hover:opacity-80"
                  >
                    {list[0].themeTitle} · {list.length}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.themes.map((t, i) => {
          const p = t.progress;
          const done = p.read + p.revised + p.mastered;
          return (
            <button
              key={t.key}
              onClick={() => onOpenTheme(t.key)}
              className="group text-left bg-surface border border-border-default rounded-2xl p-5 hover:border-brand hover:shadow-md transition-all cursor-pointer flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-text-tertiary tabular-nums">Theme {String(i + 1).padStart(2, '0')}</p>
                  <h2 className="font-display text-lg font-semibold text-text-primary leading-snug group-hover:text-brand transition-colors">{t.title}</h2>
                </div>
                {!t.isPublished && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-status-warning-bg text-status-warning-text">Draft</span>}
                {t.isPublished && t.due > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-status-warning-bg text-status-warning-text whitespace-nowrap">{t.due} due</span>}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-tertiary font-semibold">
                <span>{t.topicCount} topics</span>
                {t.pyqTopicCount > 0 && <span>· {t.pyqTopicCount} PYQ-tagged</span>}
                <span>· {Object.entries(t.bySource).map(([s, n]) => `${SOURCE_LABEL[s]} ${n}`).join(' / ')}</span>
              </div>
              <div className="mt-auto space-y-1.5">
                <ProgressBar
                  total={t.topicCount}
                  parts={[[p.mastered, 'bg-status-success-text'], [p.revised, 'bg-status-warning-text'], [p.read, 'bg-status-info-text']]}
                />
                <p className="text-[11px] text-text-secondary font-semibold tabular-nums">
                  {done ? `${done}/${t.topicCount} read · ${p.mastered} mastered` : 'Not started'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {data.themes.length === 0 && (
        <p className="text-sm text-text-tertiary text-center py-16">The Economy Master File isn’t published yet.</p>
      )}
    </div>
  );
}

// ============================================================================ theme

function ThemeView({ themeKey, initialTab, focus, onBack }) {
  const navH = useNavHeight();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(initialTab || 'topics');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [source, setSource] = useState('');
  const [show, setShow] = useState('all');        // all | todo | due | pyq
  const [expanded, setExpanded] = useState(() => new Set());
  const [noteFor, setNoteFor] = useState(null);   // { topic, quote }
  const [pageFor, setPageFor] = useState(null);   // topic
  const [deck, setDeck] = useState(null);         // topics being revised
  const [flash, setFlash] = useState('');
  const [notesVersion, setNotesVersion] = useState(0);
  const pendingFocus = useRef(focus);
  const bookmarks = useBookmarks('economy_master');

  useEffect(() => {
    getTheme(themeKey).then(setData).catch((e) => setError(e.message));
  }, [themeKey]);

  const updatePrefs = (patch) => setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });

  const scrollToTopic = useCallback((id) => {
    setTab('topics');
    setSource('');
    setShow('all');
    setExpanded((s) => new Set(s).add(String(id)));
    setTimeout(() => {
      const el = document.getElementById(`em-topic-${id}`);
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - navH - 120;
      window.scrollTo({ top: y, behavior: 'smooth' });
      el.classList.add('ring-2', 'ring-brand');
      setTimeout(() => el.classList.remove('ring-2', 'ring-brand'), 1800);
    }, 60);
  }, [navH]);

  useEffect(() => {
    if (data && pendingFocus.current) {
      scrollToTopic(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [data, scrollToTopic]);

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 1800); };

  const updateStatus = async (topicId, status) => {
    const prev = data.progress[topicId];
    setData((d) => ({ ...d, progress: { ...d.progress, [topicId]: status ? { ...(prev || {}), status } : undefined } }));
    try {
      const { progress } = await setProgress(topicId, status);
      setData((d) => ({ ...d, progress: { ...d.progress, [topicId]: progress || undefined } }));
      return progress;
    } catch (e) {
      setData((d) => ({ ...d, progress: { ...d.progress, [topicId]: prev } }));
      showFlash(e.message);
      return null;
    }
  };

  const topics = data?.topics || [];
  const progress = data?.progress || {};
  const counts = useMemo(() => {
    const c = { read: 0, revised: 0, mastered: 0, due: 0, bySource: {} };
    for (const t of topics) {
      const p = progress[t._id];
      const s = (c.bySource[t.source] ||= { total: 0, done: 0 });
      s.total++;
      if (p?.status) { c[p.status]++; s.done++; }
      if (isDue(p)) c.due++;
    }
    return c;
  }, [topics, progress]);
  const done = counts.read + counts.revised + counts.mastered;

  const visible = useMemo(() => topics.filter((t) => {
    if (source && t.source !== source) return false;
    const p = progress[t._id];
    if (show === 'todo') return !p?.status;
    if (show === 'due') return isDue(p);
    if (show === 'pyq') return t.pyqTags.length > 0;
    return true;
  }), [topics, progress, source, show]);

  const bookmarked = useMemo(() => topics.filter((t) => bookmarks.isBookmarked(emRef(t._id))), [topics, bookmarks]);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-3">
        <button onClick={onBack} className="text-xs font-bold text-brand cursor-pointer">← All themes</button>
        <p className="text-sm text-status-danger-text">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="py-24 flex justify-center"><LoadingSpinner /></div>;

  const outline = prefs.outline;
  const isOpen = (id) => !outline || expanded.has(String(id));
  const toggleOpen = (id) => setExpanded((s) => { const n = new Set(s); const k = String(id); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="min-h-screen">
      {/* Sticky study bar — always on top while reading */}
      <div className="sticky z-40 bg-page/95 backdrop-blur border-b border-border-default" style={{ top: navH }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border-default hover:bg-surface-raised cursor-pointer text-text-secondary flex-shrink-0" aria-label="All themes">←</button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg sm:text-xl font-semibold text-text-primary truncate leading-tight">{data.theme.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <ProgressBar
                  className="h-1 max-w-[220px]"
                  total={topics.length}
                  parts={[[counts.mastered, 'bg-status-success-text'], [counts.revised, 'bg-status-warning-text'], [counts.read, 'bg-status-info-text']]}
                />
                <span className="text-[11px] font-semibold text-text-tertiary tabular-nums whitespace-nowrap">{done}/{topics.length}</span>
                {counts.due > 0 && <span className="text-[10px] font-bold text-status-warning-text whitespace-nowrap">· {counts.due} due</span>}
              </div>
            </div>
          </div>
          <nav className="flex gap-1 mt-2.5 -mb-px overflow-x-auto no-scrollbar" aria-label="Theme sections">
            {TABS.map((t) => {
              const badge = t.key === 'bookmarks' ? bookmarked.length : t.key === 'progress' && counts.due ? counts.due : null;
              return (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); window.scrollTo({ top: 0 }); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 cursor-pointer whitespace-nowrap transition-colors ${
                    tab === t.key ? 'border-brand text-brand' : 'border-transparent text-text-tertiary hover:text-text-primary'
                  }`}
                >
                  <span aria-hidden="true">{t.icon}</span>{t.label}
                  {badge ? <span className="text-[10px] px-1.5 rounded-full bg-sunken text-text-secondary tabular-nums">{badge}</span> : null}
                </button>
              );
            })}
          </nav>
        </div>
        {tab === 'topics' && (
          <div className="border-t border-border-default">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <Chip active={!source} onClick={() => setSource('')}>All</Chip>
              {Object.keys(counts.bySource).map((s) => (
                <Chip key={s} active={source === s} onClick={() => setSource(s)}>{SOURCE_LABEL[s]}</Chip>
              ))}
              <span className="w-px h-5 bg-border-default mx-1 flex-shrink-0" />
              <Chip active={show === 'todo'} onClick={() => setShow(show === 'todo' ? 'all' : 'todo')}>Not read</Chip>
              {counts.due > 0 && <Chip active={show === 'due'} onClick={() => setShow(show === 'due' ? 'all' : 'due')}>Due</Chip>}
              <Chip active={show === 'pyq'} onClick={() => setShow(show === 'pyq' ? 'all' : 'pyq')}>PYQ-tagged</Chip>
              <span className="w-px h-5 bg-border-default mx-1 flex-shrink-0" />
              <Chip active={outline} onClick={() => updatePrefs({ outline: !outline })} title="Show titles only; tap a topic to open it">Outline</Chip>
              <Chip active={!prefs.plain} onClick={() => updatePrefs({ plain: !prefs.plain })} title="Show the PDF's highlights">Highlights</Chip>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-24">
        {data.theme.description && tab === 'topics' && <p className="text-sm text-text-secondary mb-4">{data.theme.description}</p>}

        {tab === 'topics' && (
          <div className="space-y-3">
            {visible.length === 0 && <p className="text-sm text-text-tertiary text-center py-12">Nothing matches these filters.</p>}
            {visible.map((t) => (
              <TopicCard
                key={t._id}
                topic={t}
                progress={progress[t._id]}
                open={isOpen(t._id)}
                collapsible={outline}
                onToggleOpen={() => toggleOpen(t._id)}
                plain={prefs.plain}
                bookmarked={bookmarks.isBookmarked(emRef(t._id))}
                onBookmark={() => bookmarks.toggle(emRef(t._id))}
                onStatus={(s) => updateStatus(t._id, s)}
                onNote={(quote = '') => setNoteFor({ topic: t, quote })}
                onOpenPage={() => setPageFor(t)}
              />
            ))}
          </div>
        )}

        {tab === 'pyqs' && <PyqsTab themeKey={themeKey} onOpenTopic={scrollToTopic} />}

        {tab === 'progress' && (
          <ProgressTab
            topics={topics}
            progress={progress}
            counts={counts}
            bookmarked={bookmarked}
            onOpenTopic={scrollToTopic}
            onRevise={(list) => setDeck(list)}
          />
        )}

        {tab === 'notes' && (
          <NotesTab
            key={notesVersion}
            topics={topics}
            onOpenTopic={scrollToTopic}
            onNew={() => setTab('topics')}
          />
        )}

        {tab === 'bookmarks' && (
          <div className="space-y-3">
            {bookmarked.length === 0 && (
              <p className="text-sm text-text-tertiary text-center py-12">Tap ☆ on any topic to keep it here for quick revision.</p>
            )}
            {bookmarked.length > 0 && (
              <div className="flex justify-end">
                <button onClick={() => setDeck(bookmarked)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand text-text-on-accent cursor-pointer">Revise bookmarks as flashcards</button>
              </div>
            )}
            {bookmarked.map((t) => (
              <TopicCard
                key={t._id}
                topic={t}
                progress={progress[t._id]}
                open
                plain={prefs.plain}
                bookmarked
                onBookmark={() => bookmarks.toggle(emRef(t._id))}
                onStatus={(s) => updateStatus(t._id, s)}
                onNote={(quote = '') => setNoteFor({ topic: t, quote })}
                onOpenPage={() => setPageFor(t)}
              />
            ))}
          </div>
        )}
      </div>

      {noteFor && (
        <NoteModal
          studyRef={emRef(noteFor.topic._id)}
          title={noteFor.topic.title}
          quote={noteFor.quote}
          quoteFrom={noteFor.quote ? 'Master File' : ''}
          onClose={() => setNoteFor(null)}
          onSaved={() => { showFlash('Saved to My Notes'); setNotesVersion((v) => v + 1); }}
        />
      )}
      {pageFor && <SourcePageModal pages={pageFor.pages} title={pageFor.title} onClose={() => setPageFor(null)} />}
      {deck && (
        <RevisionDeck
          topics={deck}
          progress={progress}
          plain={prefs.plain}
          onStatus={updateStatus}
          onClose={() => setDeck(null)}
        />
      )}
      {(flash || bookmarks.error) && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] bg-ink-900 text-paper-0 text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          {flash || bookmarks.error}
        </div>
      )}
    </div>
  );
}

// ============================================================================ topic card

function TopicCard({ topic: t, progress: p, open = true, collapsible = false, onToggleOpen, plain, bookmarked, onBookmark, onStatus, onNote, onOpenPage }) {
  const status = p?.status || null;
  const due = isDue(p);
  const hasExtras = t.facts?.length > 0 || !!t.research;

  return (
    <article id={`em-topic-${t._id}`} className="bg-surface border border-border-default rounded-2xl transition-shadow scroll-mt-40">
      <header
        className={`flex items-start gap-3 px-4 sm:px-5 pt-4 ${open ? 'pb-2' : 'pb-4'} ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={collapsible ? onToggleOpen : undefined}
      >
        <span className="font-display text-sm font-semibold text-text-tertiary tabular-nums pt-0.5 w-6 flex-shrink-0 text-right">{t.number ?? '•'}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text-primary leading-snug">{t.title}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">{SOURCE_LABEL[t.source]}</span>
            {t.pyqTags.map((tag) => (
              <span key={tag} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent-soft-bg text-brand border border-accent-soft-border">PYQ · {tag}</span>
            ))}
            {status && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${STATUS[status].cls}`}>{STATUS[status].label}</span>}
            {due && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-status-warning-bg text-status-warning-text">Revise today</span>}
          </div>
        </div>
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <BookmarkButton compact active={bookmarked} onToggle={onBookmark} />
        </div>
        {collapsible && <span className={`text-text-tertiary text-xs pt-1 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>}
      </header>

      {open && (
        <>
          <div className="px-4 sm:px-5 sm:pl-14 pb-3">
            <SelectionToNote onAdd={(text) => onNote(text)}>
              <TopicBody blocks={t.blocks} plain={plain} />
            </SelectionToNote>
          </div>

          {hasExtras && (
            <div className="mx-4 sm:ml-14 sm:mr-5 mb-3 grid gap-2 sm:grid-cols-2">
              {t.facts?.length > 0 && (
                <div className="rounded-xl bg-status-info-bg/60 border border-status-info-text/15 px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-status-info-text mb-1.5">Real-world link</p>
                  <ul className="space-y-1.5 text-[13px] text-text-secondary leading-relaxed">
                    {t.facts.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {t.research && (
                <div className="rounded-xl bg-accent-soft-bg border border-accent-soft-border px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand mb-1.5">Beyond the book</p>
                  <div className="space-y-1 text-[13px] text-text-secondary leading-relaxed">
                    {t.research.split('\n').filter(Boolean).map((line, i) => {
                      const m = line.match(/^([^:]{2,24}):\s*(.*)$/);
                      return <p key={i}>{m ? <><span className="font-semibold text-text-primary">{m[1]}:</span> {m[2]}</> : line}</p>;
                    })}
                  </div>
                </div>
              )}
              {t.extrasStatus === 'draft' && <p className="sm:col-span-2 text-[10px] font-bold text-status-warning-text">Admin preview — these add-ons are still a draft.</p>}
            </div>
          )}

          <footer className="flex flex-wrap items-center gap-1.5 px-4 sm:pl-14 sm:pr-5 py-3 border-t border-border-default">
            <div className="flex rounded-lg border border-border-default overflow-hidden" role="group" aria-label="Progress">
              {['read', 'revised', 'mastered'].map((s) => (
                <button
                  key={s}
                  onClick={() => onStatus(status === s ? null : s)}
                  aria-pressed={status === s}
                  className={`px-2.5 py-1.5 text-[11px] font-bold cursor-pointer transition-colors border-r last:border-r-0 border-border-default ${
                    status === s ? STATUS[s].cls : 'bg-surface text-text-tertiary hover:text-text-primary'
                  }`}
                >
                  {status === s ? '✓ ' : ''}{STATUS[s].label}
                </button>
              ))}
            </div>
            <button onClick={() => onNote('')} className="px-2.5 py-1.5 rounded-lg border border-border-default text-[11px] font-bold text-text-secondary hover:text-text-primary hover:border-brand cursor-pointer">✎ Note</button>
            {t.pages?.length > 0 && (
              <button onClick={onOpenPage} className="px-2.5 py-1.5 rounded-lg border border-border-default text-[11px] font-bold text-text-secondary hover:text-text-primary hover:border-brand cursor-pointer">
                Original page{t.pages.length > 1 ? 's' : ''} · p.{t.pages.join(', ')}
              </button>
            )}
            {p?.nextReviewAt && status !== 'mastered' && !due && (
              <span className="ml-auto text-[10px] font-semibold text-text-tertiary">Next revision {relDays(p.nextReviewAt)}</span>
            )}
          </footer>
        </>
      )}
    </article>
  );
}

// ============================================================================ PYQs

function PyqsTab({ themeKey, onOpenTopic }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [run, setRun] = useState(null);            // { subject, topic }
  const [summaryId, setSummaryId] = useState(null);

  useEffect(() => { getThemePyqs(themeKey).then(setData).catch((e) => setError(e.message)); }, [themeKey]);

  if (run && summaryId) {
    return (
      <QuizSummary
        attemptId={summaryId}
        onRetake={() => setSummaryId(null)}
        onBackToList={() => { setSummaryId(null); setRun(null); }}
      />
    );
  }
  if (run) {
    return (
      <QuizRunner
        subject={run.subject}
        config={{ mode: 'topic', topic: run.topic }}
        onExit={() => setRun(null)}
        onFinished={(id) => setSummaryId(id)}
      />
    );
  }
  if (error) return <p className="text-sm text-status-danger-text">{error}</p>;
  if (!data) return <div className="py-16 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2">Practise PYQs</h2>
        {data.linked?.topics?.length ? (
          <div className="grid sm:grid-cols-2 gap-2">
            {data.linked.topics.map((t) => (
              <button
                key={t.topic}
                onClick={() => setRun({ subject: data.linked.subject, topic: t.topic })}
                className="text-left bg-surface border border-border-default rounded-xl px-4 py-3 hover:border-brand cursor-pointer flex items-center justify-between gap-3"
              >
                <span className="text-sm font-semibold text-text-primary">{t.topic}</span>
                <span className="text-[11px] font-bold text-brand whitespace-nowrap">{t.count} Qs →</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary bg-surface border border-dashed border-border-default rounded-xl px-4 py-5 text-center">
            Theme-wise MCQ practice for this theme is coming soon.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-1">Asked in exams</h2>
        <p className="text-xs text-text-secondary mb-2">Topics the Master File marks with the paper they came from.</p>
        {data.tagged.length === 0 && <p className="text-sm text-text-tertiary">None in this theme.</p>}
        <div className="bg-surface border border-border-default rounded-2xl divide-y divide-border-default">
          {data.tagged.map((t) => (
            <button key={t._id} onClick={() => onOpenTopic(t._id)} className="w-full text-left px-4 py-3 hover:bg-surface-raised cursor-pointer flex items-center justify-between gap-3">
              <span className="text-sm text-text-primary font-semibold min-w-0">{t.title}</span>
              <span className="flex flex-wrap justify-end gap-1 flex-shrink-0">
                {t.pyqTags.map((tag) => <span key={tag} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent-soft-bg text-brand">{tag}</span>)}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================ progress

function ProgressTab({ topics, progress, counts, bookmarked, onOpenTopic, onRevise }) {
  const total = topics.length;
  const done = counts.read + counts.revised + counts.mastered;
  const due = topics.filter((t) => isDue(progress[t._id]));
  const readNotMastered = topics.filter((t) => progress[t._id] && progress[t._id].status !== 'mastered');
  const upcoming = topics
    .filter((t) => progress[t._id]?.nextReviewAt && !isDue(progress[t._id]) && progress[t._id].status !== 'mastered')
    .sort((a, b) => new Date(progress[a._id].nextReviewAt) - new Date(progress[b._id].nextReviewAt))
    .slice(0, 8);

  const Stat = ({ n, label, cls }) => (
    <div className="bg-surface border border-border-default rounded-2xl px-4 py-3">
      <p className={`text-2xl font-bold tabular-nums ${cls}`}>{n}</p>
      <p className="text-[11px] font-semibold text-text-tertiary">{label}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat n={total - done} label="Not started" cls="text-text-primary" />
        <Stat n={counts.read} label="Read once" cls="text-status-info-text" />
        <Stat n={counts.revised} label="Revised" cls="text-status-warning-text" />
        <Stat n={counts.mastered} label="Mastered" cls="text-status-success-text" />
      </div>

      <section className="bg-surface border border-border-default rounded-2xl p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">By source</h2>
        {Object.entries(counts.bySource).map(([s, v]) => (
          <div key={s} className="flex items-center gap-3">
            <span className="w-16 text-xs font-semibold text-text-secondary">{SOURCE_LABEL[s]}</span>
            <ProgressBar className="h-2 flex-1" total={v.total} parts={[[v.done, 'bg-brand']]} />
            <span className="w-16 text-right text-[11px] font-semibold text-text-tertiary tabular-nums">{v.done}/{v.total}</span>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Due for revision · {due.length}</h2>
          {due.length > 0 && <button onClick={() => onRevise(due)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand text-text-on-accent cursor-pointer">Start revision</button>}
        </div>
        {due.length === 0 ? (
          <p className="text-sm text-text-tertiary">Nothing due. Topics you mark Read come back after 1, 3, 7 and 21 days.</p>
        ) : (
          <TopicList topics={due} onOpenTopic={onOpenTopic} />
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Coming up</h2>
          <TopicList topics={upcoming} onOpenTopic={onOpenTopic} right={(t) => relDays(progress[t._id].nextReviewAt)} />
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        {readNotMastered.length > 0 && (
          <button onClick={() => onRevise(readNotMastered)} className="text-xs font-bold px-3 py-2 rounded-lg border border-border-default hover:border-brand cursor-pointer">Quick-revise everything read ({readNotMastered.length})</button>
        )}
        {bookmarked.length > 0 && (
          <button onClick={() => onRevise(bookmarked)} className="text-xs font-bold px-3 py-2 rounded-lg border border-border-default hover:border-brand cursor-pointer">Revise bookmarks ({bookmarked.length})</button>
        )}
      </section>
    </div>
  );
}

const TopicList = ({ topics, onOpenTopic, right }) => (
  <div className="bg-surface border border-border-default rounded-2xl divide-y divide-border-default">
    {topics.map((t) => (
      <button key={t._id} onClick={() => onOpenTopic(t._id)} className="w-full text-left px-4 py-2.5 hover:bg-surface-raised cursor-pointer flex items-center justify-between gap-3">
        <span className="text-sm text-text-primary min-w-0 truncate">{t.number != null ? `${t.number}. ` : ''}{t.title}</span>
        <span className="text-[11px] font-semibold text-text-tertiary whitespace-nowrap">{right ? right(t) : SOURCE_LABEL[t.source]}</span>
      </button>
    ))}
  </div>
);

// ============================================================================ notes

function NotesTab({ topics, onOpenTopic, onNew }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const byId = useMemo(() => new Map(topics.map((t) => [String(t._id), t])), [topics]);

  useEffect(() => {
    listItems({ section: 'economy_master', kind: 'note', limit: 200 })
      .then((d) => setItems(d.items.filter((n) => byId.has(String(n.ref?.economyTopic)))))
      .catch((e) => setError(e.message));
  }, [byId]);

  const remove = async (item) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await deleteItem(item._id);
      setItems((list) => list.filter((n) => n._id !== item._id));
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <p className="text-sm text-status-danger-text">{error}</p>;
  if (!items) return <div className="py-16 flex justify-center"><LoadingSpinner /></div>;
  if (!items.length) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-sm text-text-tertiary">No notes in this theme yet.</p>
        <p className="text-xs text-text-tertiary">Select any text in a topic, or tap ✎ Note, to add one. Every note also shows up in My Notes.</p>
        <button onClick={onNew} className="text-xs font-bold text-brand cursor-pointer">Go to topics →</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((n) => {
        const t = byId.get(String(n.ref.economyTopic));
        return (
          <article key={n._id} className="bg-surface border border-border-default rounded-2xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => onOpenTopic(t._id)} className="text-left text-sm font-semibold text-text-primary hover:text-brand cursor-pointer">{t.title}</button>
              <button onClick={() => remove(n)} className="text-[11px] font-bold text-text-tertiary hover:text-status-danger-text cursor-pointer">Delete</button>
            </div>
            {n.quote && <blockquote className="text-sm text-text-secondary border-l-2 border-brand pl-3 whitespace-pre-line">{n.quote}</blockquote>}
            {n.body && <p className="text-sm text-text-primary whitespace-pre-line">{n.body}</p>}
          </article>
        );
      })}
    </div>
  );
}

// ============================================================================ revision deck

// Flashcards: the title first, notes on tap, then Again / Got it / Mastered — which feeds
// the same 1-3-7-21 day ladder as the buttons on the cards.
function RevisionDeck({ topics, progress, plain, onStatus, onClose }) {
  const [list] = useState(topics);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState({ again: 0, got: 0, mastered: 0 });
  const t = list[i];
  const finished = i >= list.length;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' && !finished) { e.preventDefault(); setRevealed(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, finished]);

  const answer = async (kind) => {
    setBusy(true);
    const status = kind === 'again' ? 'read' : kind === 'got' ? 'revised' : 'mastered';
    await onStatus(t._id, status);
    setTally((x) => ({ ...x, [kind]: x[kind] + 1 }));
    setBusy(false);
    setRevealed(false);
    setI((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-page flex flex-col">
      <div className="border-b border-border-default">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="text-xs font-bold text-text-secondary hover:text-text-primary cursor-pointer">✕ Close</button>
          <div className="flex-1"><ProgressBar total={list.length} parts={[[Math.min(i, list.length), 'bg-brand']]} /></div>
          <span className="text-xs font-semibold text-text-tertiary tabular-nums">{Math.min(i + 1, list.length)}/{list.length}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {finished ? (
            <div className="text-center py-16 space-y-3">
              <p className="font-display text-2xl font-semibold text-text-primary">Revision done</p>
              <p className="text-sm text-text-secondary">{tally.got} got it · {tally.mastered} mastered · {tally.again} to see again tomorrow</p>
              <button onClick={onClose} className="mt-2 text-sm font-bold px-4 py-2 rounded-xl bg-brand text-text-on-accent cursor-pointer">Back to the theme</button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">{SOURCE_LABEL[t.source]}{progress[t._id]?.status ? ` · ${STATUS[progress[t._id].status].label}` : ''}</p>
                <h2 className="font-display text-2xl font-semibold text-text-primary mt-1">{t.title}</h2>
                {!revealed && <p className="text-sm text-text-secondary mt-3">Recall what you know about this topic, then reveal the notes.</p>}
              </div>
              {revealed ? (
                <div className="bg-surface border border-border-default rounded-2xl p-5">
                  <TopicBody blocks={t.blocks} plain={plain} />
                </div>
              ) : (
                <button onClick={() => setRevealed(true)} className="w-full py-10 rounded-2xl border-2 border-dashed border-border-default text-sm font-bold text-text-secondary hover:border-brand hover:text-brand cursor-pointer">
                  Show notes <span className="text-text-tertiary font-semibold">(space)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {!finished && revealed && (
        <div className="border-t border-border-default bg-surface">
          <div className="max-w-3xl mx-auto px-4 py-3 grid grid-cols-3 gap-2">
            <button disabled={busy} onClick={() => answer('again')} className="py-2.5 rounded-xl text-sm font-bold bg-status-danger-bg text-status-danger-text cursor-pointer disabled:opacity-50">Again</button>
            <button disabled={busy} onClick={() => answer('got')} className="py-2.5 rounded-xl text-sm font-bold bg-status-warning-bg text-status-warning-text cursor-pointer disabled:opacity-50">Got it</button>
            <button disabled={busy} onClick={() => answer('mastered')} className="py-2.5 rounded-xl text-sm font-bold bg-status-success-bg text-status-success-text cursor-pointer disabled:opacity-50">Mastered</button>
          </div>
        </div>
      )}
    </div>
  );
}
