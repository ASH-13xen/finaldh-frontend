import { useCallback, useEffect, useMemo, useState } from 'react';
import { displaySubjectName } from '../lib/mcqSubjects';

// Admin → MCQ Test Data → Syllabus. Upload a subject's syllabus as a Word file, then see where each
// question of a test or Question Bank sits under it. Uploading test questions places them
// automatically; here the admin can place the rest, or correct any one by hand.

const api = async (path, opts = {}) => {
  const res = await fetch(`/api/syllabus${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const inputClass = 'bg-sunken border border-border-default focus:border-brand text-text-primary rounded-xl px-3 py-2 text-xs focus:outline-none';
const btnPrimary = 'px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold cursor-pointer disabled:cursor-not-allowed';
const btnGhost = 'px-3 py-2 bg-surface border border-border-default hover:bg-surface-raised text-text-secondary rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50';

export default function AdminSyllabus({ tests }) {
  const [syllabi, setSyllabi] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/admin').then((d) => setSyllabi(d.syllabi)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {error && <p className="p-3 bg-status-danger-bg text-status-danger-text rounded-xl text-xs font-semibold">{error}</p>}
      <UploadCard syllabi={syllabi || []} onChanged={load} />
      {syllabi?.length > 0 && <PlacementCard syllabi={syllabi} tests={tests} />}
    </div>
  );
}

function UploadCard({ syllabi, onChanged }) {
  const [subject, setSubject] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [openSubject, setOpenSubject] = useState(null);

  const upload = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('subject', subject.trim());
      fd.append('file', file);
      const { syllabus } = await api('/admin', { method: 'POST', body: fd });
      setMsg(`${displaySubjectName(syllabus.subject)}: ${syllabus.chapters.length} chapters saved.`);
      setOpenSubject(syllabus.subject);
      setFile(null);
      e.target.reset();
      onChanged();
    } catch (err) {
      setMsg(err.message);
    }
    setBusy(false);
  };

  const remove = async (s) => {
    if (!confirm(`Remove the ${s.subject} syllabus? Questions keep their placements, but solutions go back to test order until you upload it again.`)) return;
    try {
      await api(`/admin/${encodeURIComponent(s.subject)}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-extrabold text-text-primary">Subject syllabus</h2>
        <p className="text-xs text-text-tertiary mt-1">
          Word file: a numbered heading per chapter ("5. Money and Banking") with bullets under it for its sub-topics.
          Uploading again for the same subject replaces it. The subject name then appears when you create a test.
        </p>
      </div>
      <form onSubmit={upload} className="flex flex-wrap items-center gap-2">
        <input className={`${inputClass} w-56`} placeholder="Subject, e.g. Economy" value={subject} onChange={(e) => setSubject(e.target.value)} list="syllabus-subjects" />
        <datalist id="syllabus-subjects">{syllabi.map((s) => <option key={s.subject} value={s.subject} />)}</datalist>
        <input type="file" accept=".docx" className="text-xs text-text-secondary" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button className={btnPrimary} disabled={!subject.trim() || !file || busy}>{busy ? 'Reading…' : 'Upload syllabus'}</button>
      </form>
      {msg && <p className="text-xs font-semibold text-status-info-text">{msg}</p>}

      <div className="divide-y divide-border-default">
        {syllabi.map((s) => (
          <div key={s.subject} className="py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-bold text-text-primary flex-grow">
                {displaySubjectName(s.subject)}
                <span className="ml-2 font-medium text-text-tertiary">{s.chapters.length} chapters · {s.fileName}</span>
              </p>
              <button className={btnGhost} onClick={() => setOpenSubject((c) => (c === s.subject ? null : s.subject))}>{openSubject === s.subject ? 'Hide' : 'View'}</button>
              <button className="text-xs font-bold text-status-danger-text cursor-pointer" onClick={() => remove(s)}>Remove</button>
            </div>
            {openSubject === s.subject && (
              <ol className="mt-3 space-y-2">
                {s.chapters.map((c) => (
                  <li key={c.key} className="text-xs">
                    <p className="font-bold text-text-primary">{c.number}. {c.title}</p>
                    <ul className="mt-0.5 pl-4 list-disc text-text-secondary">{c.subtopics.map((t) => <li key={t}>{t}</li>)}</ul>
                  </li>
                ))}
                {s.studyOrder && <li className="text-xs text-text-tertiary pt-1">Suggested study order: {s.studyOrder}</li>}
              </ol>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlacementCard({ syllabi, tests }) {
  const subjects = useMemo(() => new Set(syllabi.map((s) => s.subject)), [syllabi]);
  const sources = useMemo(() => [
    ...tests.filter((t) => subjects.has(t.subject)).map((t) => ({ id: `test|${t._id}`, label: `Test: ${t.title} (${t.questionCount} Qs)` })),
    ...syllabi.filter((s) => s.bankQuestions > 0).map((s) => ({ id: `bank|${s.subject}`, label: `Question Bank: ${s.subject} (${s.bankQuestions} PYQs)` })),
  ], [tests, syllabi, subjects]);

  const [source, setSource] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('all'); // all | review

  const [kind, ref] = source ? source.split('|') : [];
  const load = useCallback(async () => {
    if (!source) { setData(null); return; }
    try {
      setData(await api(`/admin/placement?kind=${kind}&ref=${encodeURIComponent(ref)}`));
      setError('');
    } catch (e) { setError(e.message); }
  }, [source, kind, ref]);
  useEffect(() => { setData(null); load(); }, [load]);

  // While the AI works, follow its progress.
  const running = !!data?.job?.running;
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [running, load]);

  const run = async (opts = {}) => {
    const unplaced = data.questions.filter((q) => !q.by).length;
    if (kind === 'bank' && !confirm(`Use AI to place ${unplaced} PYQs? This uses AI credits.`)) return;
    try {
      await api('/admin/placement/run', { method: 'POST', body: JSON.stringify({ kind, ref, ...opts }) });
      await load();
    } catch (e) { setError(e.message); }
  };
  const stop = () => api('/admin/placement/stop', { method: 'POST', body: JSON.stringify({ kind, ref }) }).then(load).catch((e) => setError(e.message));

  const save = async (q, chapter, subtopic) => {
    setData((d) => ({ ...d, questions: d.questions.map((x) => (x._id === q._id ? { ...x, chapter, subtopic, by: 'admin', confidence: null } : x)) }));
    try {
      await api(`/admin/placement/${kind}/${q._id}`, { method: 'PATCH', body: JSON.stringify({ chapter, subtopic }) });
    } catch (e) { setError(e.message); load(); }
  };

  const needsReview = (q) => q.by !== 'admin' && (!q.chapter || (q.confidence ?? 0) < 0.6);
  const shown = (data?.questions || []).filter((q) => view === 'all' || needsReview(q));
  const groups = data ? [
    ...data.chapters.map((c) => ({ key: c.key, title: `${c.number}. ${c.title}`, rows: shown.filter((q) => q.chapter === c.key) })),
    { key: '', title: 'Not placed yet', rows: shown.filter((q) => !data.chapters.some((c) => c.key === q.chapter)) },
  ].filter((g) => g.rows.length) : [];
  const unplaced = data?.questions.filter((q) => !q.by).length || 0;
  const reviewCount = data?.questions.filter(needsReview).length || 0;

  return (
    <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-extrabold text-text-primary">Where the questions sit</h2>
        <p className="text-xs text-text-tertiary mt-1">Test questions are placed by AI as soon as they are uploaded. Change a chapter here and the AI will not overwrite it.</p>
      </div>
      <select className={`${inputClass} w-full`} value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="">{sources.length ? 'Select a test or Question Bank…' : 'No test in a subject with a syllabus yet'}</option>
        {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      {error && <p className="p-3 bg-status-danger-bg text-status-danger-text rounded-xl text-xs font-semibold">{error}</p>}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-text-secondary flex-grow">
              {data.questions.length - unplaced}/{data.questions.length} checked by AI or admin · {reviewCount} to review
            </p>
            {running ? (
              <>
                <span className="text-xs font-bold text-status-info-text">Placing… {data.job.done}/{data.job.total}</span>
                <button className={btnGhost} onClick={stop}>Stop</button>
              </>
            ) : unplaced > 0 && (
              <button className={btnPrimary} onClick={() => run()}>Place {unplaced} with AI</button>
            )}
            <button className={view === 'review' ? btnPrimary : btnGhost} onClick={() => setView((v) => (v === 'all' ? 'review' : 'all'))}>To review only</button>
          </div>
          {data.job?.errors?.length > 0 && <p className="text-xs font-semibold text-status-danger-text">Last AI error: {data.job.errors[data.job.errors.length - 1]}</p>}
          {!groups.length && <p className="text-xs text-text-tertiary italic">Nothing to show here.</p>}
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="text-xs font-extrabold text-text-primary border-b border-border-default pb-1 mb-2">{g.title} <span className="font-semibold text-text-tertiary">({g.rows.length})</span></h3>
              <div className="space-y-2">
                {g.rows.map((q) => <PlacementRow key={q._id} q={q} chapters={data.chapters} flagged={needsReview(q)} onSave={save} />)}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function PlacementRow({ q, chapters, flagged, onSave }) {
  const chapter = chapters.find((c) => c.key === q.chapter);
  return (
    <div className={`p-2.5 rounded-xl border ${flagged ? 'border-status-warning-text/50 bg-status-warning-bg' : 'border-border-default bg-sunken'}`}>
      <p className="text-xs text-text-primary leading-snug"><b>Q{q.no}.</b> {q.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select aria-label={`Chapter for question ${q.no}`} className={`${inputClass} py-1 max-w-xs`} value={q.chapter} onChange={(e) => onSave(q, e.target.value, '')}>
          <option value="">Not placed</option>
          {chapters.map((c) => <option key={c.key} value={c.key}>{c.number}. {c.title}</option>)}
        </select>
        {chapter?.subtopics.length > 0 && (
          <select aria-label={`Sub-topic for question ${q.no}`} className={`${inputClass} py-1 max-w-xs`} value={q.subtopic} onChange={(e) => onSave(q, q.chapter, e.target.value)}>
            <option value="">No sub-topic</option>
            {chapter.subtopics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <span className="text-[11px] font-semibold text-text-tertiary">
          {q.by === 'admin' ? 'Set by admin' : q.by === 'ai' ? `AI${q.confidence != null ? ` · ${Math.round(q.confidence * 100)}% sure` : ''}` : 'Not placed yet'}
        </span>
      </div>
    </div>
  );
}
