import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import MatchListsView from './quiz/MatchListsView';
import { listItems, updateNote, deleteItem, markRevised } from '../lib/studyApi';
import { jumpTo } from '../lib/studyJump';

// ---------------------------------------------------------------------------
// "My Notes" — every bookmark and note the student saved in Toppers Copy and the Question
// Bank, in one place. Filter by type / section / subject, search, edit or delete a note,
// jump back to the source, or step through the filtered list in Revision mode.
// ---------------------------------------------------------------------------

const PAGE = 50;

const SECTION_LABEL = { toppers_copy: 'Toppers Copy', question_bank: 'Question Bank' };
const REF_LABEL = {
  tc_question: 'Question',
  tc_answer: 'Topper copy',
  tc_pyq: 'PYQ',
  qb_question: 'MCQ',
};

const relTime = (d) => {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(d).toLocaleDateString();
};

// Where "Open" goes for a Toppers Copy item (Question Bank items are shown in place).
const openSource = (item) => {
  const r = item.ref || {};
  jumpTo('toppers_copy', {
    subject: item.context?.subject,
    toppersCopyId: r.toppersCopy || null,
    questionId: item.refType === 'tc_pyq' ? null : r.question,
    answerIdx: item.refType === 'tc_answer' ? r.answerIdx : null,
    pyqId: item.refType === 'tc_pyq' ? r.pyq : null,
  });
};

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors whitespace-nowrap ${
      active ? 'bg-brand text-text-on-accent border-brand' : 'bg-surface text-text-secondary border-border-default hover:bg-surface-raised'
    }`}
  >
    {children}
  </button>
);

export default function MyNotes() {
  const [kind, setKind] = useState('');         // '' | 'bookmark' | 'note'
  const [section, setSection] = useState('');   // '' | 'toppers_copy' | 'question_bank'
  const [subject, setSubject] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [revising, setRevising] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const params = useMemo(
    () => ({ kind, section, subject, q: debouncedQuery }),
    [kind, section, subject, debouncedQuery]
  );

  // (Re)load the first page whenever a filter changes. reqId drops stale responses.
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
  }, [params]);

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

  const counts = useMemo(() => {
    const c = { all: 0, bookmark: 0, note: 0, toppers_copy: 0, question_bank: 0 };
    const subjects = new Map();
    for (const f of facets) {
      c.all += f.count;
      c[f.kind] += f.count;
      c[f.section] += f.count;
      if (f.subject && (!section || f.section === section)) subjects.set(f.subject, (subjects.get(f.subject) || 0) + f.count);
    }
    return { ...c, subjects: [...subjects].sort((a, b) => a[0].localeCompare(b[0])) };
  }, [facets, section]);

  // subject -> topic -> items, keeping the server's newest-first order inside each group
  const grouped = useMemo(() => {
    const bySubject = new Map();
    for (const it of items) {
      const s = it.context?.subject || 'Other';
      const t = (it.context?.topic || 'General') + (it.subtopic ? ` › ${it.subtopic}` : '');
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

  const removeItem = useCallback(async (item) => {
    const what = item.kind === 'bookmark' ? 'this bookmark' : 'this note';
    if (!window.confirm(`Delete ${what}?`)) return;
    try {
      await deleteItem(item._id);
      setItems((prev) => prev.filter((it) => it._id !== item._id));
      setTotal((n) => Math.max(0, n - 1));
      setFacets((prev) => prev.map((f) => (
        f.kind === item.kind && f.section === item.context?.section && f.subject === item.context?.subject
          ? { ...f, count: f.count - 1 } : f
      )).filter((f) => f.count > 0));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const pickSection = (s) => { setSection(s); setSubject(''); };

  if (revising) {
    return (
      <RevisionMode
        items={items}
        onExit={() => setRevising(false)}
        onRevised={(id, r) => patchItem(id, r)}
      />
    );
  }

  const filtered = !!(kind || section || subject || debouncedQuery);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-text-primary tracking-tight">My Notes</h1>
          <p className="text-text-secondary text-sm mt-1">
            Everything you bookmarked or noted in Toppers Copy and the Question Bank.
          </p>
        </div>
        <button
          type="button"
          disabled={!items.length}
          onClick={() => setRevising(true)}
          className="bg-brand hover:bg-brand-hover disabled:opacity-40 text-text-on-accent rounded-lg px-4 py-2 text-xs font-bold cursor-pointer"
          title="Go through the items below one by one"
        >
          ↻ Revise {items.length ? `(${items.length}${total > items.length ? '+' : ''})` : ''}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={!kind} onClick={() => setKind('')}>All ({counts.all})</Chip>
          <Chip active={kind === 'bookmark'} onClick={() => setKind('bookmark')}>★ Bookmarks ({counts.bookmark})</Chip>
          <Chip active={kind === 'note'} onClick={() => setKind('note')}>✎ Notes ({counts.note})</Chip>
          <span className="w-px bg-border-default mx-1 hidden sm:block" aria-hidden="true" />
          <Chip active={!section} onClick={() => pickSection('')}>Both sections</Chip>
          <Chip active={section === 'toppers_copy'} onClick={() => pickSection('toppers_copy')}>Toppers Copy ({counts.toppers_copy})</Chip>
          <Chip active={section === 'question_bank'} onClick={() => pickSection('question_bank')}>Question Bank ({counts.question_bank})</Chip>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, quotes and your notes…"
            className="flex-1 bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
          />
          {counts.subjects.length > 1 && (
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
              aria-label="Subject"
            >
              <option value="">All subjects</option>
              {counts.subjects.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
            </select>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-status-danger-text">{error}</p>}

      {loading ? (
        <div className="py-16 flex justify-center"><LoadingSpinner text="Loading your notes..." /></div>
      ) : items.length === 0 ? (
        <div className="mt-6 bg-surface border border-border-default rounded-2xl p-10 text-center">
          {filtered ? (
            <p className="text-sm text-text-tertiary">Nothing matches these filters.</p>
          ) : (
            <>
              <p className="font-bold text-text-primary">Nothing saved yet</p>
              <p className="text-sm text-text-tertiary mt-2 max-w-md mx-auto">
                Tap ☆ on a question, a topper's copy or a PYQ to bookmark it. Select any text in an AI analysis,
                a model answer or an MCQ and hit “Add to notes” to save it here with your own comment.
              </p>
            </>
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
                    <h3 className="text-sm font-bold text-text-primary mb-2">{t.topic}</h3>
                    <div className="space-y-2.5">
                      {t.list.map((it) => (
                        <NoteCard key={it._id} item={it} onPatch={patchItem} onDelete={removeItem} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {items.length < total && (
            <div className="flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-xs font-bold border border-border-default text-text-secondary hover:bg-surface-raised rounded-lg px-5 py-2 cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : `Load more (${total - items.length})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemMeta({ item }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-text-tertiary">
      <span className={`font-bold ${item.kind === 'bookmark' ? 'text-status-warning-text' : 'text-brand'}`}>
        {item.kind === 'bookmark' ? '★ Bookmark' : '✎ Note'}
      </span>
      <span className="uppercase tracking-wide">{SECTION_LABEL[item.context?.section]} · {REF_LABEL[item.refType]}</span>
      {item.context?.subtitle && <span>{item.context.subtitle}</span>}
      <span>· {relTime(item.createdAt)}</span>
      {item.revisedCount > 0 && (
        <span className="text-brand">· revised {item.revisedCount}× (last {relTime(item.lastRevisedAt)})</span>
      )}
    </div>
  );
}

function NoteCard({ item, onPatch, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showMcq, setShowMcq] = useState(false);
  const isTc = item.context?.section === 'toppers_copy';

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const { item: updated } = await updateNote(item._id, { body: draft });
      onPatch(item._id, { body: updated.body, updatedAt: updated.updatedAt });
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="bg-surface border border-border-default rounded-2xl p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <ItemMeta item={item} />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isTc && (
            <button onClick={() => openSource(item)} className="text-[11px] font-bold text-brand hover:text-brand-hover cursor-pointer px-2 py-1">
              Open →
            </button>
          )}
          {!isTc && item.mcq && (
            <button onClick={() => setShowMcq((v) => !v)} className="text-[11px] font-bold text-brand hover:text-brand-hover cursor-pointer px-2 py-1">
              {showMcq ? 'Hide answer' : 'Show answer'}
            </button>
          )}
          {item.kind === 'note' && !editing && (
            <button onClick={() => { setDraft(item.body || ''); setEditing(true); }} className="text-[11px] font-bold text-text-secondary hover:text-text-primary cursor-pointer px-2 py-1">
              Edit
            </button>
          )}
          <button onClick={() => onDelete(item)} className="text-[11px] font-bold text-text-tertiary hover:text-status-danger-text cursor-pointer px-2 py-1" aria-label="Delete">
            Delete
          </button>
        </div>
      </div>

      <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-3">{item.context?.title || 'Untitled'}</p>

      {!isTc && showMcq && item.mcq && <McqReveal mcq={item.mcq} />}
      {!isTc && !item.mcq && <p className="text-[11px] italic text-text-tertiary">This question has since been removed from the bank.</p>}

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
            rows={4}
            maxLength={10000}
            autoFocus
            className="w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand resize-y"
          />
          {err && <p className="text-xs text-status-danger-text">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="text-xs font-bold border border-border-default text-text-secondary rounded-lg px-3 py-1.5 cursor-pointer">Cancel</button>
            <button onClick={save} disabled={saving} className="text-xs font-bold bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg px-4 py-1.5 cursor-pointer disabled:opacity-40">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : item.body ? (
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line bg-sunken rounded-lg px-3 py-2">{item.body}</p>
      ) : null}
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
  const isTc = item?.context?.section === 'toppers_copy';
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
            Open in Toppers Copy →
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
