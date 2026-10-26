import { useState, useEffect, useCallback } from 'react';

// Admin portal for Question Banks: create a bank, bulk-import its questions from a PYQ JSON
// dump, and browse / edit / delete individual questions by topic.
// API: /api/question-banks/admin/*

const FIELD = 'w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-3 py-2 text-xs font-semibold transition-all';
const LABEL = 'block text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const api = async (path, { method, body, form } = {}) => {
  const res = await fetch(`/api/question-banks/admin${path}`, {
    method: method || (body || form ? 'POST' : 'GET'),
    headers: { ...authHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

const JSON_SAMPLE = `[
  {
    "exam_source": "CDS (I) 2015",
    "question_text": "Consider the following statements ...",
    "statements": ["1. ...", "2. ..."],
    "options": { "a": "1 only", "b": "2 only", "c": "Both", "d": "Neither" },
    "tick_answer": "c",
    "topic": "Drainage System",
    "type": "Factual",
    "correct_why": "Both statements are correct because ..."
  }
]`;

/* ------------------------------ Create bank ------------------------------ */
function CreateBank({ onCreated }) {
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !title.trim()) { setErr('Subject and title are required.'); return; }
    setBusy(true); setErr('');
    try {
      await api('/banks', { method: 'POST', body: { subject: subject.trim(), title: title.trim(), description: description.trim() } });
      setSubject(''); setTitle(''); setDescription('');
      onCreated();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-extrabold text-text-primary">Create a Question Bank</h2>
        <p className="text-xs text-text-tertiary mt-0.5">One bank per subject. The subject key ties it to its questions and can't be changed later.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Subject key</label>
          <input className={FIELD} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Indian Polity" />
        </div>
        <div>
          <label className={LABEL}>Display title</label>
          <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Indian Polity — Question Bank" />
        </div>
      </div>
      <div>
        <label className={LABEL}>Description (optional)</label>
        <input className={FIELD} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {err && <div className="p-2 bg-status-danger-bg border border-status-danger-text/30 rounded-lg text-status-danger-text text-[11px] font-semibold">{err}</div>}
      <button disabled={busy} className="px-5 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold cursor-pointer">
        {busy ? 'Creating…' : 'Create Bank'}
      </button>
    </form>
  );
}

/* ------------------------------ Import panel ------------------------------ */
function ImportPanel({ bank, onDone }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('replace');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) { setErr('Choose a JSON file.'); return; }
    setBusy(true); setErr(''); setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await api(`/banks/${bank._id}/import?mode=${mode}`, { form });
      setResult(data);
      setFile(null);
      onDone();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm space-y-4">
      <h3 className="text-sm font-extrabold text-text-primary">Import questions (JSON)</h3>
      <p className="text-xs text-text-tertiary">
        A JSON array of PYQ objects. Keys: <b className="text-text-secondary">question_text</b>, <b className="text-text-secondary">options</b> (a–d), <b className="text-text-secondary">tick_answer</b> (a–d). Optional: <b className="text-text-secondary">statements</b>, <b className="text-text-secondary">correct_why</b>, <b className="text-text-secondary">type</b> (Factual/Conceptual), <b className="text-text-secondary">exam_source</b>, <b className="text-text-secondary">topic</b>. Rows with no valid answer key or ≠4 options are skipped and listed back.
      </p>
      <pre className="text-[10px] bg-sunken border border-border-default rounded-xl p-3 overflow-x-auto text-text-tertiary leading-relaxed">{JSON_SAMPLE}</pre>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap gap-4">
          {[['replace', 'Replace all questions in this bank'], ['append', 'Append after existing']].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="impMode" checked={mode === v} onChange={() => setMode(v)} className="w-4 h-4 accent-brand cursor-pointer" />
              <span className="text-xs font-semibold text-text-secondary">{l}</span>
            </label>
          ))}
        </div>
        <input
          type="file" accept=".json,application/json"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-xs text-text-secondary bg-sunken border border-border-default rounded-xl px-4 py-2.5 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-brand file:text-text-on-accent file:text-xs file:font-bold file:cursor-pointer"
        />
        {err && <div className="p-2 bg-status-danger-bg border border-status-danger-text/30 rounded-lg text-status-danger-text text-[11px] font-semibold">{err}</div>}
        <button disabled={busy} className="px-5 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold cursor-pointer">
          {busy ? 'Importing…' : 'Import'}
        </button>
      </form>
      {result && (
        <div className="space-y-2">
          <div className="p-3 bg-status-success-bg border border-status-success-text/30 rounded-xl text-status-success-text text-xs font-semibold">
            {result.message} {result.duplicatesDropped ? `(${result.duplicatesDropped} duplicates dropped)` : ''}
          </div>
          {result.skippedRows?.length > 0 && (
            <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-[11px] space-y-1">
              <p className="font-bold uppercase text-[10px] tracking-wide">Skipped ({result.skippedRows.length})</p>
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {result.skippedRows.map((s, i) => <li key={i}>Row {s.row}: {s.reason}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Question editor ------------------------------ */
function QuestionRow({ q, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState(null);

  const openEdit = () => {
    setF({
      questionText: q.questionText,
      statements: (q.statements || []).join('\n'),
      options: ['A', 'B', 'C', 'D'].map((k) => q.options.find((o) => o.key === k)?.text || ''),
      correctKey: q.correctKey,
      questionType: q.questionType || 'conceptual',
      whyCorrect: q.whyCorrect || '',
      examSource: q.examSource || '',
      topic: q.topic || ''
    });
    setErr(''); setEditing(true);
  };

  const save = async () => {
    if (!f.questionText.trim()) { setErr('Question text required.'); return; }
    if (f.options.some((t) => !t.trim())) { setErr('All 4 options required.'); return; }
    setBusy(true); setErr('');
    try {
      const data = await api(`/questions/${q._id}`, {
        method: 'PATCH',
        body: {
          questionText: f.questionText.trim(),
          statements: f.statements.split('\n').map((s) => s.trim()).filter(Boolean),
          options: ['A', 'B', 'C', 'D'].map((k, i) => ({ key: k, text: f.options[i].trim() })),
          correctKey: f.correctKey,
          questionType: f.questionType,
          whyCorrect: f.whyCorrect.trim(),
          examSource: f.examSource.trim(),
          topic: f.topic.trim()
        }
      });
      setEditing(false);
      onSaved(data.question);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3 p-3 bg-sunken border border-border-default rounded-xl">
        <div className="min-w-0">
          <p className="text-xs font-bold text-text-primary">#{q.seq + 1}. {q.questionText}</p>
          <p className="text-[10px] text-text-tertiary mt-1">
            {q.topic} · ans {q.correctKey} · {q.questionType}
            {q.examSource ? ` · ${q.examSource}` : ''}
            {q.whyCorrect ? '' : ' · no explanation'}
            {q.statements?.length ? ` · ${q.statements.length} statement line(s)` : ''}
            {q.matchLists ? ' · match-list' : ''}
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-1.5">
          <button onClick={openEdit} className="px-2.5 py-1 bg-surface-raised hover:bg-surface text-text-secondary border border-border-default rounded-lg text-[10px] font-bold cursor-pointer">Edit</button>
          <button onClick={() => onDeleted(q._id)} className="px-2.5 py-1 bg-status-danger-bg hover:opacity-90 text-status-danger-text border border-status-danger-text/30 rounded-lg text-[10px] font-bold cursor-pointer">Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-sunken border border-brand/40 rounded-xl space-y-3">
      <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wide">Editing #{q.seq + 1}</p>
      <textarea value={f.questionText} onChange={(e) => setF({ ...f, questionText: e.target.value })} rows={2} className={FIELD} />
      <div>
        <label className={LABEL}>Statement lines (one per line)</label>
        <textarea value={f.statements} onChange={(e) => setF({ ...f, statements: e.target.value })} rows={3} placeholder={'1. ...\n2. ...'} className={FIELD} />
      </div>
      {q.matchLists && <p className="text-[10px] text-text-tertiary">This question has a parsed Match List I/II — edit its list items via re-import if needed.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {['A', 'B', 'C', 'D'].map((k, i) => (
          <div key={k} className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
              <input type="radio" name={`ck-${q._id}`} checked={f.correctKey === k} onChange={() => setF({ ...f, correctKey: k })} className="w-4 h-4 accent-brand cursor-pointer" />
              <span className="text-xs font-bold text-text-tertiary w-4">{k}</span>
            </label>
            <input value={f.options[i]} onChange={(e) => setF({ ...f, options: f.options.map((v, j) => j === i ? e.target.value : v) })} placeholder={`Option ${k}`} className={FIELD} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label className={LABEL}>Topic</label>
          <input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Type</label>
          <select value={f.questionType} onChange={(e) => setF({ ...f, questionType: e.target.value })} className={FIELD}>
            <option value="conceptual">Conceptual</option>
            <option value="factual">Factual</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Exam source</label>
          <input value={f.examSource} onChange={(e) => setF({ ...f, examSource: e.target.value })} className={FIELD} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Why this answer is correct</label>
        <textarea value={f.whyCorrect} onChange={(e) => setF({ ...f, whyCorrect: e.target.value })} rows={3} className={FIELD} />
      </div>
      {err && <div className="p-2 bg-status-danger-bg border border-status-danger-text/30 rounded-lg text-status-danger-text text-[11px] font-semibold">{err}</div>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="px-4 py-1.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-lg text-xs font-bold cursor-pointer">{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={() => setEditing(false)} className="px-4 py-1.5 bg-surface-raised hover:bg-surface text-text-secondary rounded-lg text-xs font-bold cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function QuestionBrowser({ bank }) {
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState('');
  const [q, setQ] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState({ total: 0, questions: [] });
  const [loading, setLoading] = useState(false);
  const LIMIT = 25;

  const loadTopics = useCallback(() => {
    api(`/topics?subject=${encodeURIComponent(bank.subject)}`).then((d) => setTopics(d.topics || [])).catch(() => {});
  }, [bank.subject]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ subject: bank.subject, skip: String(skip), limit: String(LIMIT) });
    if (topic) params.set('topic', topic);
    if (q.trim()) params.set('q', q.trim());
    if (aiStatus) params.set('aiStatus', aiStatus);
    api(`/questions?${params}`).then(setData).catch(() => setData({ total: 0, questions: [] })).finally(() => setLoading(false));
  }, [bank.subject, skip, topic, q, aiStatus]);

  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSkip(0); }, [topic, aiStatus]);

  const deleteQ = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    await api(`/questions/${id}`, { method: 'DELETE' }).catch(() => {});
    load(); loadTopics();
  };

  return (
    <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm space-y-4">
      <h3 className="text-sm font-extrabold text-text-primary">Questions ({data.total})</h3>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className={FIELD}>
          <option value="">All topics ({topics.reduce((s, t) => s + t.total, 0)})</option>
          {topics.map((t) => (
            <option key={t.topic} value={t.topic}>{t.topic} ({t.total}{t.withExplanation < t.total ? `, ${t.total - t.withExplanation} no expl.` : ''})</option>
          ))}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setSkip(0); load(); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search question text…" className={FIELD} />
        </form>
        <select value={aiStatus} onChange={(e) => setAiStatus(e.target.value)} className={FIELD}>
          <option value="">Any explanation state</option>
          <option value="done">Has explanation</option>
          <option value="pending">Missing explanation</option>
        </select>
      </div>

      {loading ? (
        <p className="text-xs text-text-tertiary">Loading…</p>
      ) : data.questions.length === 0 ? (
        <p className="text-xs text-text-tertiary">No questions match.</p>
      ) : (
        <div className="space-y-2">
          {data.questions.map((qq) => (
            <QuestionRow
              key={qq._id}
              q={qq}
              onSaved={(u) => setData((d) => ({ ...d, questions: d.questions.map((x) => x._id === u._id ? u : x) }))}
              onDeleted={deleteQ}
            />
          ))}
        </div>
      )}

      {data.total > LIMIT && (
        <div className="flex items-center justify-between text-xs">
          <button disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - LIMIT))} className="px-3 py-1.5 bg-sunken border border-border-default rounded-lg font-bold disabled:opacity-40 cursor-pointer">‹ Prev</button>
          <span className="text-text-tertiary">{skip + 1}–{Math.min(skip + LIMIT, data.total)} of {data.total}</span>
          <button disabled={skip + LIMIT >= data.total} onClick={() => setSkip(skip + LIMIT)} className="px-3 py-1.5 bg-sunken border border-border-default rounded-lg font-bold disabled:opacity-40 cursor-pointer">Next ›</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Root ------------------------------ */
export default function AdminQuestionBanks() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api('/banks');
      setBanks(data.banks || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const selected = banks.find((b) => b._id === selectedId) || null;

  const patchBank = async (id, body) => {
    try { await api(`/banks/${id}`, { method: 'PATCH', body }); refresh(); }
    catch (e) { alert(e.message); }
  };
  const deleteBank = async (b) => {
    const withQ = b.questionCount > 0 && window.confirm(`Also delete all ${b.questionCount} questions in "${b.title}"? OK = delete questions too, Cancel = keep questions (bank only).`);
    try {
      await api(`/banks/${b._id}${withQ ? '?deleteQuestions=true' : ''}`, { method: 'DELETE' });
      if (selectedId === b._id) setSelectedId(null);
      refresh();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-8 border-b border-border-default pb-5">
        <h1 className="text-2xl md:text-3xl font-display font-extrabold text-text-primary tracking-tight">Question Banks</h1>
        <p className="text-text-tertiary text-sm mt-1.5 font-medium">
          Create a subject bank, import its PYQs from JSON, then edit questions and their explanations. Students practise a bank by topic, as a random test, or all questions.
        </p>
      </div>

      {error && <div className="mb-4 p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>}

      {selected ? (
        <div className="space-y-6">
          <button onClick={() => setSelectedId(null)} className="text-xs font-bold text-text-tertiary hover:text-brand flex items-center gap-1">
            ‹ All banks
          </button>
          <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-text-primary">{selected.title}</p>
              <p className="text-[11px] text-text-tertiary mt-0.5">
                {selected.subject} · {selected.questionCount} questions · {selected.topicCount} topics · {selected.withExplanation}/{selected.questionCount} with explanation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${selected.isPublished ? 'bg-status-success-bg text-status-success-text border border-status-success-text/30' : 'bg-surface-raised text-text-tertiary border border-border-default'}`}>
                {selected.isPublished ? 'Published' : 'Draft'}
              </span>
              <button onClick={() => patchBank(selected._id, { isPublished: !selected.isPublished })} className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg text-[10px] font-bold cursor-pointer">
                {selected.isPublished ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => deleteBank(selected)} className="px-3 py-1.5 bg-status-danger-bg text-status-danger-text border border-status-danger-text/30 rounded-lg text-[10px] font-bold cursor-pointer">Delete</button>
            </div>
          </div>

          <ImportPanel bank={selected} onDone={refresh} />
          <QuestionBrowser bank={selected} />
        </div>
      ) : (
        <div className="space-y-6">
          <CreateBank onCreated={refresh} />
          <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-extrabold text-text-primary mb-4">Banks</h2>
            {loading ? (
              <p className="text-xs text-text-tertiary">Loading…</p>
            ) : banks.length === 0 ? (
              <p className="text-xs text-text-tertiary">No banks yet — create one above.</p>
            ) : (
              <div className="space-y-2">
                {banks.map((b) => (
                  <div key={b._id} className="flex items-center justify-between gap-3 p-3 bg-sunken border border-border-default rounded-xl">
                    <button onClick={() => setSelectedId(b._id)} className="min-w-0 text-left cursor-pointer">
                      <p className="text-xs font-bold text-text-primary truncate hover:text-brand">{b.title}</p>
                      <p className="text-[10px] text-text-tertiary mt-0.5">{b.subject} · {b.questionCount} Qs · {b.topicCount} topics · {b.withExplanation}/{b.questionCount} explained</p>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${b.isPublished ? 'bg-status-success-bg text-status-success-text border border-status-success-text/30' : 'bg-surface-raised text-text-tertiary border border-border-default'}`}>
                        {b.isPublished ? 'Published' : 'Draft'}
                      </span>
                      <button onClick={() => setSelectedId(b._id)} className="px-2.5 py-1 bg-surface-raised hover:bg-surface text-text-secondary border border-border-default rounded-lg text-[10px] font-bold cursor-pointer">Manage</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
