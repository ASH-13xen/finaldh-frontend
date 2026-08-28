import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

// ---------------------------------------------------------------------------
// Admin console for the Toppers Copy section. Three sub-tabs:
//   1. Answer Copies — upload a scanned compendium PDF for ONE topic, let the AI
//      detect where each topper's answer starts/ends, review & fix the page
//      ranges, then commit -> ToppersCopy.
//   2. PYQs — upload a cross-subject PYQ compilation PDF, let the AI extract
//      question rows, review, commit -> ToppersPyq.
//   3. Manage — list committed topics: publish/unpublish, generate AI analysis,
//      delete.
// All ingestion is provider-agnostic on the backend (Gemini or Claude via the
// AI_PROVIDER env var).
// ---------------------------------------------------------------------------

const token = () => localStorage.getItem('token');
const authedJson = (url, opts = {}) =>
  fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(opts.headers || {}) },
  });
const authedForm = (url, formData) =>
  fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: formData });

const SUBJECTS = [
  'GS-1', 'GS-2', 'GS-3', 'GS-4', 'Essay',
  'OptionalSubjectAnthropology', 'OptionalSubjectSociology', 'OptionalSubjectPoliticalScienceAndInternationalRelations',
  'OptionalSubjectGeography', 'OptionalSubjectHistory', 'OptionalSubjectPublicAdministration', 'OptionalSubjectPhilosophy',
];

const inputClass =
  'w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand transition-all';
const labelClass = 'block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5';
const btnPrimary =
  'px-4 py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnGhost =
  'px-3 py-1.5 bg-surface border border-border-default hover:bg-surface-raised text-text-secondary rounded-lg text-[11px] font-bold transition-all cursor-pointer';

export default function AdminToppersCopy() {
  const [tab, setTab] = useState('copies');
  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-8">
      <h1 className="text-xl md:text-2xl font-extrabold text-text-primary tracking-tight">Toppers Copy — Admin</h1>
      <p className="text-text-secondary text-xs mt-1">Ingest topper answer copies & PYQs, review the AI output, then publish.</p>

      <div className="flex gap-2 mt-5 mb-6 border-b border-border-default flex-wrap">
        {[
          ['copies', 'Answer Copies'],
          ['pyqs', 'PYQ Ingest'],
          ['pyqdata', 'Manage PYQs'],
          ['manage', 'Manage / Publish'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
              tab === k ? 'text-text-primary border-b-2 border-brand' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'copies' && <CompendiumIngest />}
      {tab === 'pyqs' && <PyqIngest />}
      {tab === 'pyqdata' && <ManagePyqs />}
      {tab === 'manage' && <ManageTopics />}
    </div>
  );
}

// ===== shared job polling hook =====
function useJobPoll(jobId) {
  const [job, setJob] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      try {
        const res = await authedJson(`/api/toppers-copy/admin/jobs/${jobId}`);
        const data = await res.json();
        setJob(data);
        if (data.status !== 'done' && data.status !== 'error') {
          timer.current = setTimeout(poll, 2500);
        }
      } catch {
        timer.current = setTimeout(poll, 4000);
      }
    };
    poll();
    return () => clearTimeout(timer.current);
  }, [jobId]);

  return job;
}

function JobProgress({ job }) {
  if (!job) return null;
  const pct = job.totalChunks ? Math.round((job.chunksCompleted / job.totalChunks) * 100) : 0;
  return (
    <div className="mt-4 p-3 bg-surface-raised border border-border-default rounded-xl text-xs space-y-1.5">
      <div className="flex justify-between font-bold text-text-secondary">
        <span>Status: {job.status}{job.aiModelLabel ? ` · ${job.aiModelLabel}` : ''}</span>
        <span>{job.chunksCompleted}/{job.totalChunks} chunks</span>
      </div>
      <div className="h-1.5 bg-sunken rounded-full overflow-hidden">
        <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      {job.currentChunkRange && <p className="text-text-tertiary">Processing {job.currentChunkRange}…</p>}
      {job.chunksFailed > 0 && (
        <p className="text-status-warning-text">{job.chunksFailed} chunk(s) failed: {job.failedChunkRanges?.join(', ')}</p>
      )}
      {job.error && <p className="text-status-danger-text">{job.error}</p>}
    </div>
  );
}

// ============================ 1. Compendium ingest ============================
const blankAnswer = () => ({ name: '', rank: '', year: '', marks: '', source: '', curatorNote: '', startPage: 1, endPage: 1 });
const blankQuestion = () => ({ questionText: '', year: '', marks: '', answers: [blankAnswer()] });
const blankTopic = () => ({ topic: '', questions: [blankQuestion()] });
const clone = (x) => JSON.parse(JSON.stringify(x));
const num = (v) => (v === '' || v == null ? null : Number(v));

function CompendiumIngest() {
  const [form, setForm] = useState({ subject: 'GS-1', syllabusSection: '' });
  const [file, setFile] = useState(null);
  const [startingTopic, setStartingTopic] = useState('');
  const [fromPage, setFromPage] = useState('');       // resume a rate-limited run
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [msg, setMsg] = useState('');
  const job = useJobPoll(jobId);

  const [appendToExisting, setAppendToExisting] = useState(false);
  const [published, setPublished] = useState(false);
  const [committing, setCommitting] = useState(false);

  // editable review tree: topics[] -> questions[] -> answers[]
  const [topics, setTopics] = useState([]);

  useEffect(() => {
    if (job?.status === 'done' && Array.isArray(job.detectedTopics)) {
      setTopics(
        job.detectedTopics.map((t) => ({
          topic: t.topic || '',
          questions: (t.questions || []).map((q) => ({
            questionText: q.questionText || '',
            year: q.year ?? '',
            marks: q.marks ?? '',
            answers: (q.answers || []).map((a) => ({
              name: a.name || '',
              rank: a.rank ?? '',
              year: a.year ?? '',
              marks: a.marks || '',
              source: a.source || '',
              curatorNote: a.curatorNote || '',
              startPage: a.startPage ?? 1,
              endPage: a.endPage ?? 1,
            })),
          })),
        }))
      );
      if (job.detectedSubject) setForm((f) => ({ ...f, subject: job.detectedSubject || f.subject }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const start = async () => {
    if (!file || !form.subject) {
      setMsg('Subject and a PDF file are required.');
      return;
    }
    setStarting(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      fd.append('subject', form.subject);
      fd.append('syllabusSection', form.syllabusSection);
      if (startingTopic.trim()) fd.append('startingTopic', startingTopic.trim());
      if (Number(fromPage) > 1) fd.append('fromPage', String(Number(fromPage)));
      const res = await authedForm('/api/toppers-copy/admin/compendium/start', fd);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      setJobId(data.jobId);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setStarting(false);
    }
  };

  // --- tree editing (topic -> question -> answer) ---
  const patch = (fn) => setTopics((ts) => { const next = clone(ts); fn(next); return next; });
  const updateTopic = (ti, val) => patch((ts) => { ts[ti].topic = val; });
  const removeTopic = (ti) => patch((ts) => ts.splice(ti, 1));
  const addTopic = () => patch((ts) => ts.push(blankTopic()));
  const updateQ = (ti, qi, key, val) => patch((ts) => { ts[ti].questions[qi][key] = val; });
  const removeQ = (ti, qi) => patch((ts) => ts[ti].questions.splice(qi, 1));
  const addQ = (ti) => patch((ts) => ts[ti].questions.push(blankQuestion()));
  const updateA = (ti, qi, ai, key, val) => patch((ts) => { ts[ti].questions[qi].answers[ai][key] = val; });
  const removeA = (ti, qi, ai) => patch((ts) => ts[ti].questions[qi].answers.splice(ai, 1));
  const addA = (ti, qi) => patch((ts) => ts[ti].questions[qi].answers.push(blankAnswer()));

  const totalQ = topics.reduce((n, t) => n + t.questions.length, 0);
  const totalA = topics.reduce((n, t) => n + t.questions.reduce((m, q) => m + q.answers.length, 0), 0);

  const commit = async () => {
    setCommitting(true);
    setMsg('');
    try {
      const res = await authedJson(`/api/toppers-copy/admin/compendium/${jobId}/commit`, {
        method: 'POST',
        body: JSON.stringify({
          subject: form.subject,
          syllabusSection: form.syllabusSection,
          published,
          appendToExisting,
          topics: topics.map((t) => ({
            topic: t.topic,
            questions: t.questions.map((q) => ({
              questionText: q.questionText,
              year: num(q.year),
              marks: num(q.marks),
              answers: q.answers.map((a) => ({
                name: a.name,
                rank: num(a.rank),
                year: num(a.year),
                marks: a.marks,
                source: a.source,
                curatorNote: a.curatorNote,
                startPage: Number(a.startPage),
                endPage: Number(a.endPage),
              })),
            })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Commit failed');
      setMsg(data.message || 'Saved.');
      setJobId(null);
      setTopics([]);
      setFile(null);
      setAppendToExisting(false);
      setStartingTopic('');
      setFromPage('');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Subject</label>
            <select className={inputClass} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Syllabus Section</label>
            <input className={inputClass} placeholder="e.g. History" value={form.syllabusSection}
              onChange={(e) => setForm({ ...form, syllabusSection: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Compendium PDF — several topics, each starting on a divider page; within a topic: question → its toppers' answers → next question</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand file:text-text-on-accent file:text-xs file:font-bold" />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-grow min-w-[220px]">
            <label className={labelClass}>Starting topic <span className="font-normal normal-case text-text-tertiary">(optional)</span></label>
            <input className={inputClass} placeholder="only if this PDF starts mid-topic, or has no divider pages" value={startingTopic}
              onChange={(e) => setStartingTopic(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Start from page</label>
            <input className={`${inputClass} w-28`} type="number" min="1" placeholder="1" value={fromPage}
              onChange={(e) => setFromPage(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-text-tertiary">
          Topics are read from the green divider pages — you don't type them. Uploading a follow-up chunk of the same
          section? Set “Starting topic” to the topic that chunk begins in and tick “Append” below when you commit. Rate
          limit mid-job → commit what came back, then resume with “Start from page”.
        </p>
        <button className={btnPrimary} disabled={starting || !!jobId} onClick={start}>
          {starting ? 'Uploading…' : jobId ? 'Job running…' : 'Upload & detect topics'}
        </button>
        {msg && <p className="text-xs font-semibold text-status-info-text">{msg}</p>}
      </div>

      {job && <JobProgress job={job} />}

      {job?.status === 'done' && (
        <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-extrabold text-text-primary">
              Review — {topics.length} topic(s), {totalQ} question(s), {totalA} answer(s)
            </h3>
            <button className={btnGhost} onClick={addTopic}>+ Add topic</button>
          </div>
          <p className="text-[11px] text-text-tertiary">
            {job.totalPages} pages. Check each answer's start/end page against the copy — a wrong end page bleeds into the
            next answer (or the back cover). Fix topic names, delete anything the AI invented.
          </p>

          <div className="space-y-5">
            {topics.map((t, ti) => (
              <div key={ti} className="border-2 border-border-default rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-text-tertiary uppercase flex-shrink-0">Topic</span>
                  <input className={`${inputClass} font-bold`} placeholder="Topic name (from the divider page)"
                    value={t.topic} onChange={(e) => updateTopic(ti, e.target.value)} />
                  <button className={btnGhost} onClick={() => addQ(ti)}>+ Q</button>
                  <button className="text-status-danger-text text-xs font-bold cursor-pointer px-1" title="Delete topic"
                    onClick={() => removeTopic(ti)}>✕</button>
                </div>

                {t.questions.map((q, qi) => (
                  <div key={qi} className="border border-border-default rounded-xl p-3 bg-surface-raised space-y-3 ml-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-extrabold text-text-tertiary mt-2 w-6 flex-shrink-0">Q{qi + 1}</span>
                      <div className="flex-grow space-y-2">
                        <textarea rows={2} className={inputClass} placeholder="Question text"
                          value={q.questionText} onChange={(e) => updateQ(ti, qi, 'questionText', e.target.value)} />
                        <div className="flex gap-2">
                          <input className={`${inputClass} w-24`} placeholder="Year" value={q.year}
                            onChange={(e) => updateQ(ti, qi, 'year', e.target.value)} />
                          <input className={`${inputClass} w-24`} placeholder="Marks" value={q.marks}
                            onChange={(e) => updateQ(ti, qi, 'marks', e.target.value)} />
                        </div>
                      </div>
                      <button className="text-status-danger-text text-xs font-bold cursor-pointer mt-2" title="Delete question"
                        onClick={() => removeQ(ti, qi)}>✕</button>
                    </div>

                    <div className="overflow-x-auto pl-8">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] font-bold uppercase text-text-tertiary text-left">
                            <th className="py-1 pr-2">Topper</th><th className="py-1 px-2">Rank</th><th className="py-1 px-2">Year</th>
                            <th className="py-1 px-2">Marks</th><th className="py-1 px-2">Source</th>
                            <th className="py-1 px-2">Start</th><th className="py-1 px-2">End</th><th />
                          </tr>
                        </thead>
                        <tbody>
                          {q.answers.map((a, ai) => (
                            <Fragment key={ai}>
                              <tr className="border-t border-border-default">
                                <td className="py-1 pr-2"><input className={inputClass} value={a.name} onChange={(e) => updateA(ti, qi, ai, 'name', e.target.value)} /></td>
                                <td className="py-1 px-2 w-16"><input className={inputClass} value={a.rank} onChange={(e) => updateA(ti, qi, ai, 'rank', e.target.value)} /></td>
                                <td className="py-1 px-2 w-20"><input className={inputClass} value={a.year} onChange={(e) => updateA(ti, qi, ai, 'year', e.target.value)} /></td>
                                <td className="py-1 px-2 w-20"><input className={inputClass} value={a.marks} onChange={(e) => updateA(ti, qi, ai, 'marks', e.target.value)} /></td>
                                <td className="py-1 px-2 w-28"><input className={inputClass} value={a.source} onChange={(e) => updateA(ti, qi, ai, 'source', e.target.value)} /></td>
                                <td className="py-1 px-2 w-16"><input className={inputClass} value={a.startPage} onChange={(e) => updateA(ti, qi, ai, 'startPage', e.target.value)} /></td>
                                <td className="py-1 px-2 w-16"><input className={inputClass} value={a.endPage} onChange={(e) => updateA(ti, qi, ai, 'endPage', e.target.value)} /></td>
                                <td className="py-1 pl-2"><button className="text-status-danger-text text-xs font-bold cursor-pointer" onClick={() => removeA(ti, qi, ai)}>✕</button></td>
                              </tr>
                              <tr>
                                <td colSpan={8} className="pb-2">
                                  <input className={inputClass} placeholder="Why this copy? (fed to the AI + shown to students — e.g. 'model intro', 'great Kalinga diagram')"
                                    value={a.curatorNote} onChange={(e) => updateA(ti, qi, ai, 'curatorNote', e.target.value)} />
                                </td>
                              </tr>
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                      <button className={`${btnGhost} mt-2`} onClick={() => addA(ti, qi)}>+ Add topper</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-bold text-text-secondary cursor-pointer">
              <input type="checkbox" checked={appendToExisting} onChange={(e) => setAppendToExisting(e.target.checked)} />
              Append to existing topics
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-text-secondary cursor-pointer">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              Publish immediately
            </label>
            <button className={btnPrimary} disabled={committing || topics.length === 0} onClick={commit}>
              {committing ? 'Saving…' : `Commit ${topics.length} topic(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================ 2. PYQ ingest ============================
function PyqIngest() {
  const [file, setFile] = useState(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [msg, setMsg] = useState('');
  const job = useJobPoll(jobId);

  const [rows, setRows] = useState([]);
  const [filterSubject, setFilterSubject] = useState('');
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (job?.status === 'done' && job.extractedPyqs) setRows(job.extractedPyqs.map((r) => ({ ...r })));
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (!file) { setMsg('A PDF file is required.'); return; }
    setStarting(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const res = await authedForm('/api/toppers-copy/admin/pyq/start', fd);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      setJobId(data.jobId);
    } catch (err) { setMsg(err.message); } finally { setStarting(false); }
  };

  const updateRow = (i, key, val) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const commit = async () => {
    setCommitting(true); setMsg('');
    try {
      const res = await authedJson(`/api/toppers-copy/admin/pyq/${jobId}/commit`, {
        method: 'POST',
        body: JSON.stringify({
          sourceLabel,
          pyqs: rows.map((r) => ({ ...r, year: Number(r.year), marks: r.marks === '' || r.marks == null ? null : Number(r.marks) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Commit failed');
      setMsg(`${data.message} ${data.skipped?.length ? `(${data.skipped.length} skipped)` : ''}`);
      setJobId(null); setRows([]); setFile(null);
    } catch (err) { setMsg(err.message); } finally { setCommitting(false); }
  };

  const shown = filterSubject ? rows.filter((r) => r.subject === filterSubject) : rows;
  const subjectsInRows = [...new Set(rows.map((r) => r.subject))].filter(Boolean).sort();

  return (
    <div className="space-y-5">
      <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
        <div>
          <label className={labelClass}>PYQ compilation PDF (all subjects)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand file:text-text-on-accent file:text-xs file:font-bold" />
        </div>
        <div>
          <label className={labelClass}>Source label (optional)</label>
          <input className={`${inputClass} max-w-sm`} placeholder="e.g. Civilsdaily Microthemes 2026" value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)} />
        </div>
        <button className={btnPrimary} disabled={starting || !!jobId} onClick={start}>
          {starting ? 'Uploading…' : jobId ? 'Job running…' : 'Upload & extract PYQs'}
        </button>
        {msg && <p className="text-xs font-semibold text-status-info-text">{msg}</p>}
      </div>

      {job && <JobProgress job={job} />}

      {job?.status === 'done' && (
        <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-extrabold text-text-primary">Review PYQs ({shown.length}{filterSubject ? ` of ${rows.length}` : ''})</h3>
            <select className={`${inputClass} w-auto`} value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              <option value="">All subjects</option>
              {subjectsInRows.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-[10px] font-bold uppercase text-text-tertiary text-left">
                  <th className="py-1 pr-2">Subj</th><th className="py-1 px-2">Section</th><th className="py-1 px-2">Topic</th><th className="py-1 px-2">Microtheme</th>
                  <th className="py-1 px-2">Question</th><th className="py-1 px-2">Yr</th><th className="py-1 px-2">Mk</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const i = rows.indexOf(r);
                  return (
                    <tr key={i} className="border-t border-border-default align-top">
                      <td className="py-1 pr-2 w-16"><input className={inputClass} value={r.subject || ''} onChange={(e) => updateRow(i, 'subject', e.target.value)} /></td>
                      <td className="py-1 px-2 w-28"><input className={inputClass} value={r.section || ''} onChange={(e) => updateRow(i, 'section', e.target.value)} /></td>
                      <td className="py-1 px-2 w-40"><input className={inputClass} value={r.topic || ''} onChange={(e) => updateRow(i, 'topic', e.target.value)} /></td>
                      <td className="py-1 px-2 w-28"><input className={inputClass} value={r.microtheme || ''} onChange={(e) => updateRow(i, 'microtheme', e.target.value)} /></td>
                      <td className="py-1 px-2 min-w-[240px]">
                        <textarea rows={2} className={inputClass} value={r.questionText || ''} onChange={(e) => updateRow(i, 'questionText', e.target.value)} />
                      </td>
                      <td className="py-1 px-2 w-14"><input className={inputClass} value={r.year ?? ''} onChange={(e) => updateRow(i, 'year', e.target.value)} /></td>
                      <td className="py-1 px-2 w-12"><input className={inputClass} value={r.marks ?? ''} onChange={(e) => updateRow(i, 'marks', e.target.value)} /></td>
                      <td className="py-1 pl-2"><button className="text-status-danger-text font-bold cursor-pointer" onClick={() => removeRow(i)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className={btnPrimary} disabled={committing || rows.length === 0} onClick={commit}>
            {committing ? 'Saving…' : `Commit ${rows.length} PYQ(s)`}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================ 3. Manage committed PYQs ============================
const PAGE = 100;

function ManagePyqs() {
  const [filters, setFilters] = useState({ subject: '', q: '', year: '' });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async (skip = 0, append = false) => {
    setLoading(true);
    setMsg('');
    try {
      const p = new URLSearchParams({ limit: String(PAGE), skip: String(skip) });
      if (filters.subject) p.set('subject', filters.subject);
      if (filters.q.trim()) p.set('q', filters.q.trim());
      if (filters.year.trim()) p.set('year', filters.year.trim());
      const res = await authedJson(`/api/toppers-copy/admin/pyqs?${p.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setRows((prev) => (append ? [...prev, ...data.pyqs] : data.pyqs).map((r) => ({ ...r, _dirty: false })));
      setTotal(data.total || 0);
      if (data.subjects?.length) setSubjects(data.subjects);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // debounce filter changes
  useEffect(() => {
    const t = setTimeout(() => load(0, false), 300);
    return () => clearTimeout(t);
  }, [load]);

  const editRow = (id, key, val) =>
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, [key]: val, _dirty: true } : r)));

  const save = async (row) => {
    setBusyId(row._id);
    setMsg('');
    try {
      const res = await authedJson(`/api/toppers-copy/admin/pyqs/${row._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          subject: row.subject,
          section: row.section,
          topic: row.topic,
          microtheme: row.microtheme,
          questionText: row.questionText,
          year: num(row.year),
          marks: row.marks === '' || row.marks == null ? null : num(row.marks),
          sourceLabel: row.sourceLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setRows((rs) => rs.map((r) => (r._id === row._id ? { ...data.pyq, _dirty: false } : r)));
      setMsg('Saved.');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row) => {
    if (!confirm('Delete this PYQ permanently?')) return;
    setBusyId(row._id);
    setMsg('');
    try {
      const res = await authedJson(`/api/toppers-copy/admin/pyqs/${row._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
      setRows((rs) => rs.filter((r) => r._id !== row._id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border-default rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>Subject</label>
          <select className={`${inputClass} w-auto`} value={filters.subject}
            onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))}>
            <option value="">All</option>
            {(subjects.length ? subjects : SUBJECTS).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Year</label>
          <input className={`${inputClass} w-24`} placeholder="any" value={filters.year}
            onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value.replace(/\D/g, '') }))} />
        </div>
        <div className="flex-grow min-w-[220px]">
          <label className={labelClass}>Search (question / topic / section / microtheme / source)</label>
          <input className={inputClass} placeholder="type to filter…" value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        </div>
        <button className={btnGhost} onClick={() => load(0, false)} disabled={loading}>Refresh</button>
      </div>

      {msg && <p className="text-xs font-semibold text-status-info-text">{msg}</p>}

      <p className="text-[11px] text-text-tertiary">
        {loading ? 'Loading…' : `Showing ${rows.length} of ${total} PYQ(s).`} Edits save per row. Deletes are permanent.
      </p>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r._id} className="border border-border-default rounded-xl p-3 bg-surface-raised space-y-2">
            <div className="flex flex-wrap gap-2">
              <select className={`${inputClass} w-28`} value={r.subject} onChange={(e) => editRow(r._id, 'subject', e.target.value)}>
                {[r.subject, ...SUBJECTS.filter((s) => s !== r.subject)].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className={`${inputClass} w-20`} placeholder="Year" value={r.year ?? ''} onChange={(e) => editRow(r._id, 'year', e.target.value)} />
              <input className={`${inputClass} w-20`} placeholder="Marks" value={r.marks ?? ''} onChange={(e) => editRow(r._id, 'marks', e.target.value)} />
              <input className={`${inputClass} flex-grow min-w-[120px]`} placeholder="Section" value={r.section || ''} onChange={(e) => editRow(r._id, 'section', e.target.value)} />
              <input className={`${inputClass} flex-grow min-w-[120px]`} placeholder="Topic" value={r.topic || ''} onChange={(e) => editRow(r._id, 'topic', e.target.value)} />
              <input className={`${inputClass} flex-grow min-w-[120px]`} placeholder="Microtheme" value={r.microtheme || ''} onChange={(e) => editRow(r._id, 'microtheme', e.target.value)} />
            </div>
            <textarea rows={2} className={inputClass} placeholder="Question text" value={r.questionText || ''}
              onChange={(e) => editRow(r._id, 'questionText', e.target.value)} />
            <div className="flex items-center gap-2">
              <input className={`${inputClass} flex-grow`} placeholder="Source label" value={r.sourceLabel || ''}
                onChange={(e) => editRow(r._id, 'sourceLabel', e.target.value)} />
              <button className={btnPrimary} disabled={busyId === r._id || !r._dirty} onClick={() => save(r)}>
                {busyId === r._id ? '…' : 'Save'}
              </button>
              <button className="px-3 py-1.5 text-[11px] font-bold text-status-danger-text cursor-pointer" disabled={busyId === r._id} onClick={() => remove(r)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && rows.length === 0 && (
        <p className="text-xs text-text-tertiary italic">No committed PYQs match. Use the “PYQ Ingest” tab to add some.</p>
      )}
      {rows.length < total && (
        <button className={btnGhost} disabled={loading} onClick={() => load(rows.length, true)}>
          Load more ({total - rows.length} left)
        </button>
      )}
    </div>
  );
}

// ============================ 4. Manage / Publish ============================
function ManageTopics() {
  const [subjects, setSubjects] = useState([]);
  const [bySubject, setBySubject] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedJson('/api/toppers-copy/subjects');
      const data = await res.json();
      setSubjects(data.subjects || []);
      const entries = await Promise.all(
        (data.subjects || []).map(async (s) => {
          const r = await authedJson(`/api/toppers-copy/topics?subject=${encodeURIComponent(s.subject)}`);
          const d = await r.json();
          return [s.subject, d.topics || []];
        })
      );
      setBySubject(Object.fromEntries(entries));
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  const togglePublish = async (t) => {
    setBusyId(t._id); setMsg('');
    try {
      await authedJson(`/api/toppers-copy/admin/${t._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ published: !t.published }),
      });
      await loadSubjects();
    } catch (err) { setMsg(err.message); } finally { setBusyId(null); }
  };

  // Analysis is per question — walk the topic's questions and analyze each. `only`
  // = 'missing' skips questions that already have one, 'all' regenerates every one.
  const analyze = async (t, only = 'missing') => {
    setBusyId(t._id); setMsg(`Loading "${t.topic}"…`);
    try {
      const d = await authedJson(`/api/toppers-copy/${t._id}`).then((r) => r.json());
      const qs = (d.toppersCopy?.questions || []);
      const targets = only === 'all' ? qs : qs.filter((q) => !q.aiAnalysis);
      if (targets.length === 0) { setMsg(`"${t.topic}" — nothing to analyze.`); setBusyId(null); return; }
      for (let i = 0; i < targets.length; i++) {
        setMsg(`Analyzing "${t.topic}" — question ${i + 1}/${targets.length}… (this can take a minute each)`);
        const res = await authedJson(`/api/toppers-copy/admin/${t._id}/questions/${targets[i]._id}/analyze`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Analysis failed');
      }
      setMsg(`Analyzed ${targets.length} question(s) for "${t.topic}".`);
      await loadSubjects();
    } catch (err) { setMsg(err.message); } finally { setBusyId(null); }
  };

  const remove = async (t) => {
    if (!confirm(`Delete "${t.topic}"? This removes the topic and all its questions (the PDF stays on R2).`)) return;
    setBusyId(t._id); setMsg('');
    try {
      await authedJson(`/api/toppers-copy/admin/${t._id}`, { method: 'DELETE' });
      await loadSubjects();
    } catch (err) { setMsg(err.message); } finally { setBusyId(null); }
  };

  if (loading) return <LoadingSpinner text="Loading topics…" />;

  if (subjects.length === 0) {
    return <p className="text-xs text-text-tertiary italic">No topics committed yet. Use the Answer Copies tab first.</p>;
  }

  return (
    <div className="space-y-6">
      {msg && <p className="text-xs font-semibold text-status-info-text">{msg}</p>}
      {subjects.map((s) => (
        <div key={s.subject} className="bg-surface border border-border-default rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-surface-raised border-b border-border-default text-xs font-extrabold text-text-primary">
            {s.subject} <span className="text-text-tertiary font-semibold">({s.topicCount})</span>
          </div>
          <div className="divide-y divide-border-default">
            {(bySubject[s.subject] || []).map((t) => (
              <div key={t._id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-grow min-w-[200px]">
                  <p className="text-xs font-bold text-text-primary">{t.topic}</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">
                    {t.syllabusSection || '—'} · {t.questionCount} questions · {t.answerCount} answers · {t.pdfPageCount} pages
                    {t.questionCount ? ` · ${t.analyzedCount}/${t.questionCount} analyzed` : ''}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  t.published ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text'
                }`}>
                  {t.published ? 'Published' : 'Draft'}
                </span>
                <button className={btnGhost} disabled={busyId === t._id} onClick={() => togglePublish(t)}>
                  {t.published ? 'Unpublish' : 'Publish'}
                </button>
                <button className={btnGhost} disabled={busyId === t._id} onClick={() => analyze(t, 'missing')}>
                  {busyId === t._id ? '…' : t.analyzedCount >= t.questionCount ? 'All analyzed' : `Analyze ${t.questionCount - t.analyzedCount} Q`}
                </button>
                <button className={btnGhost} disabled={busyId === t._id || !t.analyzedCount} onClick={() => analyze(t, 'all')}>
                  Re-analyze all
                </button>
                <button className="px-3 py-1.5 text-[11px] font-bold text-status-danger-text cursor-pointer" disabled={busyId === t._id} onClick={() => remove(t)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
