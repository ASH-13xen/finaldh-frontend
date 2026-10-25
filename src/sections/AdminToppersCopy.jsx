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
  const [sourceType, setSourceType] = useState('pdf'); // 'pdf' | 'json'
  const [file, setFile] = useState(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [defaultSubject, setDefaultSubject] = useState('');
  const [defaultSection, setDefaultSection] = useState('');
  const [publishOnCommit, setPublishOnCommit] = useState(false);
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jsonJobResult, setJsonJobResult] = useState(null); // { mergedFragments, diagramReport } — json path only, resolves instantly
  const [msg, setMsg] = useState('');
  const job = useJobPoll(sourceType === 'pdf' ? jobId : null);

  const [rows, setRows] = useState([]);
  const [filterSubject, setFilterSubject] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null); // { message, conflicts }
  const [formatProgress, setFormatProgress] = useState(null); // { done, total } while auto-formatting newly-committed book answers

  useEffect(() => {
    if (job?.status === 'done' && job.extractedPyqs) setRows(job.extractedPyqs.map((r) => ({ ...r })));
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const jsonJobDone = sourceType === 'json' && rows.length > 0 && !!jobId;

  const start = async () => {
    if (!file) { setMsg(`A ${sourceType === 'pdf' ? 'PDF' : 'JSON'} file is required.`); return; }
    setStarting(true); setMsg(''); setCommitResult(null); setJsonJobResult(null);
    try {
      const fd = new FormData();
      fd.append(sourceType === 'pdf' ? 'pdf' : 'json', file);
      if (defaultSubject.trim()) fd.append('defaultSubject', defaultSubject.trim());
      if (sourceType === 'pdf' && defaultSection.trim()) fd.append('defaultSection', defaultSection.trim());
      const res = await authedForm(`/api/toppers-copy/admin/pyq/${sourceType === 'pdf' ? 'start' : 'start-json'}`, fd);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      setJobId(data.jobId);
      if (sourceType === 'json') {
        setJsonJobResult({ mergedFragments: data.mergedFragments, diagramReport: data.diagramReport || [] });
        // json jobs resolve synchronously — fetch the job doc once for its extractedPyqs
        const jr = await authedJson(`/api/toppers-copy/admin/jobs/${data.jobId}`);
        const jd = await jr.json();
        setRows((jd.extractedPyqs || []).map((r) => ({ ...r })));
      }
    } catch (err) { setMsg(err.message); } finally { setStarting(false); }
  };

  const updateRow = (i, key, val) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  // Runs the cheap reformat-only pass over every newly-committed/merged book
  // answer, one at a time (mirrors the admin "Analyze N Q" client-side loop
  // pattern elsewhere in this panel) so a bulk commit's HTTP request doesn't
  // block on dozens of AI calls. Fire-and-forget — admin can navigate away.
  const runFormatPending = async (ids) => {
    if (!ids?.length) return;
    setFormatProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try {
        await authedJson(`/api/toppers-copy/admin/pyqs/${ids[i]}/answer/format`, { method: 'POST', body: JSON.stringify({}) });
      } catch { /* one failure shouldn't stop the batch — re-run manually via the Reformat button */ }
      setFormatProgress({ done: i + 1, total: ids.length });
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  const commit = async () => {
    setCommitting(true); setMsg(''); setCommitResult(null);
    try {
      const res = await authedJson(`/api/toppers-copy/admin/pyq/${jobId}/commit`, {
        method: 'POST',
        body: JSON.stringify({
          sourceLabel,
          defaultSubject: defaultSubject.trim(),
          publish: publishOnCommit,
          pyqs: rows.map((r) => ({ ...r, year: Number(r.year), marks: r.marks === '' || r.marks == null ? null : Number(r.marks) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Commit failed');
      setCommitResult(data);
      setMsg(data.message);
      setJobId(null); setRows([]); setFile(null); setJsonJobResult(null);
      runFormatPending(data.formatPending); // don't await — runs in the background
    } catch (err) { setMsg(err.message); } finally { setCommitting(false); }
  };

  const shown = filterSubject ? rows.filter((r) => r.subject === filterSubject) : rows;
  const subjectsInRows = [...new Set(rows.map((r) => r.subject))].filter(Boolean).sort();
  const reviewReady = sourceType === 'pdf' ? job?.status === 'done' : jsonJobDone;

  return (
    <div className="space-y-5">
      <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
        <div className="flex gap-2">
          {[['pdf', 'PDF (AI-extracted questions)'], ['json', 'JSON (book already has answers)']].map(([k, label]) => (
            <button key={k}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${sourceType === k ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary border border-border-default'}`}
              onClick={() => { setSourceType(k); setFile(null); setJobId(null); setRows([]); setMsg(''); setJsonJobResult(null); }}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <label className={labelClass}>{sourceType === 'pdf' ? 'PYQ compilation PDF (all subjects)' : 'PYQ + answer JSON (subject/topic/subtopic/year/question/model_answer)'}</label>
          <input type="file" accept={sourceType === 'pdf' ? 'application/pdf' : 'application/json'} onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand file:text-text-on-accent file:text-xs file:font-bold" />
          {sourceType === 'json' && (
            <p className="text-[10px] text-text-tertiary mt-1">
              For a source book that already prints a model answer per question. The answer is used verbatim, never AI-rewritten. Marks/diagram-placeholder/page-footer cleanup runs automatically.
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>Source label (optional)</label>
          <input className={`${inputClass} max-w-sm`} placeholder="e.g. Civilsdaily Microthemes 2026" value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{sourceType === 'pdf' ? 'Force subject (optional)' : 'Subject'}</label>
            <select className={inputClass} value={defaultSubject} onChange={(e) => setDefaultSubject(e.target.value)}>
              <option value="">{sourceType === 'pdf' ? '— read from the PDF —' : '— choose —'}</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {sourceType === 'pdf' && (
              <p className="text-[10px] text-text-tertiary mt-1">Set this for a single-subject book that never prints its subject on the page.</p>
            )}
          </div>
          {sourceType === 'pdf' && (
            <div>
              <label className={labelClass}>Default section (optional)</label>
              <input className={inputClass} placeholder="only if the PDF has no section headings" value={defaultSection}
                onChange={(e) => setDefaultSection(e.target.value)} />
            </div>
          )}
        </div>
        <button className={btnPrimary} disabled={starting || !!jobId || (sourceType === 'json' && !defaultSubject.trim())} onClick={start}>
          {starting ? 'Uploading…' : jobId ? 'Loaded — review below' : sourceType === 'pdf' ? 'Upload & extract PYQs' : 'Upload & clean JSON'}
        </button>
        {msg && <p className="text-xs font-semibold text-status-info-text">{msg}</p>}
        {formatProgress && (
          <p className="text-[11px] text-text-tertiary">
            Formatting book answers for display: {formatProgress.done}/{formatProgress.total}
            {formatProgress.done === formatProgress.total ? ' — done.' : '… (safe to leave this tab)'}
          </p>
        )}
        {commitResult?.conflicts?.length > 0 && (
          <div className="border border-status-warning-text/40 bg-status-warning-bg rounded-lg p-2 space-y-1">
            <p className="text-[11px] font-bold text-status-warning-text">{commitResult.conflicts.length} question(s) already had a published answer — left untouched, review in Manage PYQs:</p>
            {commitResult.conflicts.map((c) => <p key={c.id} className="text-[11px] text-text-secondary">• {c.questionText.slice(0, 90)}</p>)}
          </div>
        )}
      </div>

      {job && <JobProgress job={job} />}
      {jsonJobResult && (
        <p className="text-[11px] text-text-tertiary">
          {jsonJobResult.mergedFragments} chunk-boundary fragment(s) auto-merged. {jsonJobResult.diagramReport.length} question(s) flag a diagram to re-upload after commit.
        </p>
      )}

      {reviewReady && (
        <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-extrabold text-text-primary">Review PYQs ({shown.length}{filterSubject ? ` of ${rows.length}` : ''})</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const blank = rows.filter((r) => !String(r.subject || '').trim()).length;
                return blank > 0 && defaultSubject.trim() ? (
                  <button
                    className="text-[11px] font-bold text-brand border border-brand/40 rounded-lg px-2 py-1 cursor-pointer"
                    onClick={() => setRows((rs) => rs.map((r) => (String(r.subject || '').trim() ? r : { ...r, subject: defaultSubject.trim() })))}
                  >
                    Set {blank} blank → “{defaultSubject.trim()}”
                  </button>
                ) : null;
              })()}
              <select className={`${inputClass} w-auto`} value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
                <option value="">All subjects</option>
                {subjectsInRows.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-[10px] font-bold uppercase text-text-tertiary text-left">
                  <th className="py-1 pr-2">Subj</th><th className="py-1 px-2">Section</th><th className="py-1 px-2">Topic</th><th className="py-1 px-2">Microtheme</th>
                  <th className="py-1 px-2">Question</th><th className="py-1 px-2">Yr</th><th className="py-1 px-2">Mk</th>
                  {sourceType === 'json' && <th className="py-1 px-2">Answer</th>}
                  <th />
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
                      {sourceType === 'json' && (
                        <td className="py-1 px-2 w-16 text-center">
                          {r.answerText ? <span className="text-[10px] font-bold text-status-success-text" title={r.answerText.slice(0, 200)}>✓ {r.answerText.length}ch</span> : <span className="text-text-tertiary">—</span>}
                        </td>
                      )}
                      <td className="py-1 pl-2"><button className="text-status-danger-text font-bold cursor-pointer" onClick={() => removeRow(i)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button className={btnPrimary} disabled={committing || rows.length === 0} onClick={commit}>
              {committing ? 'Saving…' : `Commit ${rows.length} PYQ(s)`}
            </button>
            <label className="flex items-center gap-2 text-xs font-bold text-text-secondary cursor-pointer">
              <input type="checkbox" checked={publishOnCommit} onChange={(e) => setPublishOnCommit(e.target.checked)} />
              Publish answers immediately
            </label>
            {publishOnCommit && sourceType === 'json' && (
              <span className="text-[10px] text-text-tertiary">Answers go live unformatted for a few seconds until the background format pass finishes.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- per-PYQ house-style model answer: generate / edit / images / publish ----
function PyqAnswerEditor({ pyqId, initial, initialStatus, onStatusChange }) {
  const [answer, setAnswer] = useState(initial || null);
  const [status, setStatus] = useState(initialStatus || 'none');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);

  const setField = (k, v) => { setAnswer((a) => ({ ...a, [k]: v })); setDirty(true); };
  const setSection = (i, patch) => {
    setAnswer((a) => ({ ...a, sections: a.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
    setDirty(true);
  };
  const setPoint = (si, pi, patch) => setSection(si, {
    points: answer.sections[si].points.map((p, idx) => (idx === pi ? { ...p, ...patch } : p)),
  });

  const pushStatus = (s) => { setStatus(s); onStatusChange?.(s); };

  const generate = async (force = false) => {
    setBusy('gen'); setMsg('');
    try {
      const res = await authedJson(`/api/toppers-copy/admin/pyqs/${pyqId}/answer`, {
        method: 'POST',
        body: JSON.stringify(force ? { force: true } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setAnswer(data.pyqAnswer); setDirty(false); pushStatus('draft');
      setMsg('Generated. Review, edit, then Publish.');
    } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };

  const formatAnswer = async (force = false) => {
    setBusy('format'); setMsg('');
    try {
      const res = await authedJson(`/api/toppers-copy/admin/pyqs/${pyqId}/answer/format`, {
        method: 'POST',
        body: JSON.stringify(force ? { force: true } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Formatting failed');
      setAnswer(data.pyqAnswer);
      setMsg('Formatted for display.');
    } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };

  const resolveDiagramPage = async (page) => {
    setBusy('save'); setMsg('');
    try {
      const res = await authedJson(`/api/toppers-copy/admin/pyqs/${pyqId}/answer`, {
        method: 'PATCH',
        body: JSON.stringify({ resolveDiagramPage: page }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setAnswer(data.pyqAnswer);
    } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };

  const savePatch = async (extra = {}) => {
    setBusy('save'); setMsg('');
    try {
      const res = await authedJson(`/api/toppers-copy/admin/pyqs/${pyqId}/answer`, {
        method: 'PATCH',
        body: JSON.stringify({
          rawText: answer.rawText,
          openingLine: answer.openingLine,
          closingLine: answer.closingLine,
          quote: answer.quote,
          sections: answer.sections,
          imageCaptions: Object.fromEntries((answer.images || []).map((im) => [im.id, im.caption || ''])),
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setAnswer(data.pyqAnswer); setDirty(false); pushStatus(data.pyqAnswer.published ? 'published' : 'draft');
      setMsg('Saved.');
    } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setBusy('img'); setMsg('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await authedForm(`/api/toppers-copy/admin/pyqs/${pyqId}/answer/images`, fd);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setAnswer(data.pyqAnswer);
      setMsg('Image added.');
    } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };

  const deleteImage = async (imageId) => {
    setBusy('img'); setMsg('');
    try {
      const res = await authedJson(`/api/toppers-copy/admin/pyqs/${pyqId}/answer/images/${imageId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setAnswer(data.pyqAnswer);
    } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };

  if (!answer) {
    return (
      <div className="border-t border-border-default pt-2 mt-1 flex items-center gap-3">
        <button className={btnGhost} disabled={busy === 'gen'} onClick={generate}>
          {busy === 'gen' ? 'Generating…' : 'Generate model answer (AI)'}
        </button>
        {msg && <span className="text-[11px] text-status-info-text">{msg}</span>}
      </div>
    );
  }

  const isFromBook = answer.source === 'pdf';

  return (
    <div className="border-t border-border-default pt-3 mt-1 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${status === 'published' ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text'}`}>
          {status === 'published' ? 'PUBLISHED' : 'DRAFT'}
        </span>
        {isFromBook && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-status-info-bg text-status-info-text">FROM BOOK</span>
        )}
        {isFromBook ? (
          <>
            <button className={btnGhost} disabled={busy === 'format'}
              onClick={() => formatAnswer(!!answer.sections?.length)}>
              {busy === 'format' ? 'Formatting…' : answer.sections?.length ? 'Reformat' : 'Format for display'}
            </button>
            <button className={btnGhost} disabled={busy === 'gen'}
              onClick={() => { if (confirm('This answer is verbatim from the source book. Replace it with an AI-written one instead? This cannot be undone here.')) generate(true); }}>
              {busy === 'gen' ? 'Generating…' : 'Replace with AI answer'}
            </button>
          </>
        ) : (
          <button className={btnGhost} disabled={busy === 'gen'} onClick={() => { if (confirm('Regenerate — discards unsaved edits, keeps images.')) generate(); }}>
            {busy === 'gen' ? 'Regenerating…' : 'Regenerate'}
          </button>
        )}
        <button className={btnPrimary} disabled={!dirty || busy === 'save'} onClick={() => savePatch()}>
          {busy === 'save' ? 'Saving…' : 'Save edits'}
        </button>
        <button
          className={status === 'published' ? btnGhost : btnPrimary}
          disabled={busy === 'save'}
          onClick={() => savePatch({ published: status !== 'published' })}
        >
          {status === 'published' ? 'Unpublish' : 'Save & Publish'}
        </button>
        {msg && <span className="text-[11px] text-status-info-text">{msg}</span>}
      </div>

      {isFromBook && (
        <details className="text-[11px]">
          <summary className="cursor-pointer font-bold text-text-tertiary uppercase tracking-wider">
            {answer.sections?.length ? 'View / edit original book text' : 'Answer (verbatim from source book)'}
          </summary>
          <textarea rows={12} className={`${inputClass} font-mono text-[11px] mt-1.5`} value={answer.rawText || ''}
            onChange={(e) => setField('rawText', e.target.value)} />
        </details>
      )}

      {(!isFromBook || answer.sections?.length > 0) ? (
        <>
          <div>
            <label className={labelClass}>Opening line</label>
            <textarea rows={2} className={inputClass} value={answer.openingLine || ''} onChange={(e) => setField('openingLine', e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Sections</label>
            {(answer.sections || []).map((s, si) => (
              <div key={si} className="border border-border-default rounded-lg p-2 space-y-1.5 bg-surface">
                <div className="flex gap-2">
                  <input className={`${inputClass} font-bold`} placeholder="Heading" value={s.heading}
                    onChange={(e) => setSection(si, { heading: e.target.value })} />
                  <button className="text-status-danger-text text-xs font-bold px-2 cursor-pointer"
                    onClick={() => { setAnswer((a) => ({ ...a, sections: a.sections.filter((_, i) => i !== si) })); setDirty(true); }}>✕</button>
                </div>
                {(s.points || []).map((p, pi) => (
                  <div key={pi} className="flex gap-1.5 items-start pl-2">
                    <span className="text-brand font-bold text-xs mt-1.5">•</span>
                    <input className={inputClass} placeholder="Claim" value={p.claim} onChange={(e) => setPoint(si, pi, { claim: e.target.value })} />
                    <input className={inputClass} placeholder="Eg: example" value={p.example} onChange={(e) => setPoint(si, pi, { example: e.target.value })} />
                    <button className="text-text-tertiary text-xs px-1 cursor-pointer"
                      onClick={() => setSection(si, { points: s.points.filter((_, i) => i !== pi) })}>✕</button>
                  </div>
                ))}
                <button className="text-[11px] font-bold text-brand pl-2 cursor-pointer"
                  onClick={() => setSection(si, { points: [...(s.points || []), { claim: '', example: '' }] })}>+ point</button>
              </div>
            ))}
            <button className="text-[11px] font-bold text-brand cursor-pointer"
              onClick={() => { setAnswer((a) => ({ ...a, sections: [...(a.sections || []), { heading: '', points: [{ claim: '', example: '' }] }] })); setDirty(true); }}>
              + section
            </button>
          </div>

          <div>
            <label className={labelClass}>Closing line</label>
            <textarea rows={2} className={inputClass} value={answer.closingLine || ''} onChange={(e) => setField('closingLine', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Quote (optional)</label>
            <input className={inputClass} value={answer.quote || ''} onChange={(e) => setField('quote', e.target.value)} />
          </div>
        </>
      ) : null}

      {isFromBook && (answer.pendingDiagramPages || []).length > 0 && (
        <div className="border border-status-warning-text/40 bg-status-warning-bg rounded-lg p-2 space-y-1">
          <p className="text-[11px] font-bold text-status-warning-text">
            Source has a diagram not yet re-uploaded ({answer.pendingDiagramPages.length}):
          </p>
          {answer.pendingDiagramPages.map((page) => (
            <div key={page} className="flex items-center gap-2 text-[11px]">
              <span>Page {page} of the source PDF</span>
              <button className="text-brand font-bold cursor-pointer" onClick={() => resolveDiagramPage(page)}>
                mark resolved (after uploading below)
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <label className={labelClass}>Images ({(answer.images || []).length}/6)</label>
        <div className="flex flex-wrap gap-2">
          {(answer.images || []).map((im) => (
            <div key={im.id} className="w-28 space-y-1">
              <div className="relative">
                <img src={`/api/toppers-copy/pyqs/${pyqId}/answer/image/${im.id}?token=${encodeURIComponent(token())}`}
                  alt="" className="w-28 h-20 object-cover rounded border border-border-default" />
                <button className="absolute -top-1.5 -right-1.5 bg-status-danger-text text-white rounded-full w-4 h-4 text-[10px] leading-none cursor-pointer"
                  onClick={() => deleteImage(im.id)}>✕</button>
              </div>
              <input className={`${inputClass} text-[10px]`} placeholder="caption" value={im.caption || ''}
                onChange={(e) => { setAnswer((a) => ({ ...a, images: a.images.map((x) => (x.id === im.id ? { ...x, caption: e.target.value } : x)) })); setDirty(true); }} />
            </div>
          ))}
          {(answer.images || []).length < 6 && (
            <label className="w-28 h-20 border-2 border-dashed border-border-default rounded flex items-center justify-center text-[11px] text-text-tertiary cursor-pointer hover:border-brand">
              {busy === 'img' ? '…' : '+ image'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
            </label>
          )}
        </div>
      </div>

      {answer.diagram?.kind && (
        <p className="text-[11px] text-text-tertiary">
          Diagram: <b>{answer.diagram.kind}</b>{answer.diagram.title ? ` — ${answer.diagram.title}` : ''}.{' '}
          <button className="text-brand font-bold cursor-pointer" onClick={() => savePatch({ clearDiagram: true })}>remove diagram</button>
          {' · '}<span>edit by Regenerate</span>
        </p>
      )}
    </div>
  );
}

// ============================ 3. Manage committed PYQs ============================
const PAGE = 300;

function ManagePyqs() {
  const [filters, setFilters] = useState({ subject: '', q: '', year: '' });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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
      if (!append) setSelected(new Set());
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
      // keep the (differently-shaped) answer status the list endpoint gave us
      setRows((rs) => rs.map((r) => (r._id === row._id
        ? { ...data.pyq, pyqAnswer: r.pyqAnswer, pyqAnswerStatus: r.pyqAnswerStatus, _dirty: false }
        : r)));
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
      setSelected((s) => { const n = new Set(s); n.delete(row._id); return n; });
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelected = (id) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleExpanded = (id) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const selectAllLoaded = () => setSelected(new Set(rows.map((r) => r._id)));
  const clearSelection = () => setSelected(new Set());

  const deleteSelected = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} selected PYQ(s) permanently? This cannot be undone.`)) return;
    setBulkBusy(true); setMsg('');
    try {
      const res = await authedJson('/api/toppers-copy/admin/pyqs/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk delete failed');
      setRows((rs) => rs.filter((r) => !selected.has(r._id)));
      setTotal((t) => Math.max(0, t - data.deletedCount));
      setSelected(new Set());
      setMsg(data.message);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const deleteAllMatching = async () => {
    const hasFilter = filters.subject || filters.year || filters.q.trim();
    const label = hasFilter
      ? `everything matching the current filter (${total} PYQ${total === 1 ? '' : 's'})`
      : `ALL ${total} PYQs in the database`;
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    if (!confirm('Really sure? This is permanent and cannot be recovered.')) return;
    setBulkBusy(true); setMsg('');
    try {
      const res = await authedJson('/api/toppers-copy/admin/pyqs/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ allMatching: true, filter: filters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk delete failed');
      setMsg(data.message);
      load(0, false);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBulkBusy(false);
    }
  };

  // Section -> Topic grouping of the currently loaded rows, so a subject with
  // hundreds of PYQs is browsable instead of one long flat always-expanded list.
  const groups = (() => {
    const bySection = new Map();
    for (const r of rows) {
      const sectionKey = r.section || '(no section)';
      if (!bySection.has(sectionKey)) bySection.set(sectionKey, new Map());
      const byTopic = bySection.get(sectionKey);
      const topicKey = r.topic || '(no topic)';
      if (!byTopic.has(topicKey)) byTopic.set(topicKey, []);
      byTopic.get(topicKey).push(r);
    }
    const out = [...bySection.entries()].map(([section, byTopic]) => {
      const topics = [...byTopic.entries()].map(([topic, topicRows]) => ({ topic, rows: topicRows }));
      return { section, topics, count: topics.reduce((n, t) => n + t.rows.length, 0) };
    });
    out.sort((a, b) => b.count - a.count);
    return out;
  })();

  const toggleGroup = (section) => setCollapsedGroups((s) => {
    const n = new Set(s);
    if (n.has(section)) n.delete(section); else n.add(section);
    return n;
  });

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

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-text-tertiary">
          {loading ? 'Loading…' : `Showing ${rows.length} of ${total} PYQ(s).`} Click a question to expand it.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button className={btnGhost} onClick={selectAllLoaded} disabled={!rows.length}>Select all loaded ({rows.length})</button>
          {total > 0 && (
            <button className="text-[11px] font-bold text-status-danger-text cursor-pointer" disabled={bulkBusy} onClick={deleteAllMatching}>
              Delete ALL {total} matching filter…
            </button>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-status-warning-bg border border-status-warning-text/40 rounded-xl p-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-status-warning-text">{selected.size} selected</span>
          <button className="text-[11px] font-bold text-status-danger-text cursor-pointer" disabled={bulkBusy} onClick={deleteSelected}>
            {bulkBusy ? 'Deleting…' : `Delete ${selected.size} selected`}
          </button>
          <button className="text-[11px] font-bold text-text-tertiary cursor-pointer" onClick={clearSelection}>Clear</button>
        </div>
      )}

      <div className="space-y-3">
        {groups.map(({ section, topics, count }) => (
          <div key={section} className="border border-border-default rounded-2xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 bg-surface-raised cursor-pointer"
              onClick={() => toggleGroup(section)}
            >
              <span className="text-xs font-extrabold text-text-primary">{section} <span className="text-text-tertiary font-semibold">({count})</span></span>
              <span className="text-text-tertiary text-xs">{collapsedGroups.has(section) ? '▸' : '▾'}</span>
            </button>
            {!collapsedGroups.has(section) && (
              <div className="p-2 space-y-3 bg-surface">
                {topics.map(({ topic, rows: topicRows }) => (
                  <div key={topic}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-1 mb-1">{topic} ({topicRows.length})</p>
                    <div className="space-y-1.5">
                      {topicRows.map((r) => {
                        const isExpanded = expanded.has(r._id);
                        return (
                          <div key={r._id} className="border border-border-default rounded-xl bg-surface-raised">
                            <div className="flex items-start gap-2 p-2">
                              <input type="checkbox" className="mt-1 cursor-pointer" checked={selected.has(r._id)} onChange={() => toggleSelected(r._id)} />
                              <button className="flex-grow text-left cursor-pointer" onClick={() => toggleExpanded(r._id)}>
                                <p className="text-xs font-semibold text-text-primary line-clamp-2">{r.questionText}</p>
                                <p className="text-[10px] text-text-tertiary mt-0.5">
                                  {r.subject} · {r.year}{r.marks ? ` · ${r.marks}m` : ''}
                                  {r.pyqAnswerStatus === 'published' && <span className="text-status-success-text font-bold"> · PUBLISHED</span>}
                                  {r.pyqAnswerStatus === 'draft' && <span className="text-status-warning-text font-bold"> · DRAFT</span>}
                                  {r.pyqAnswer?.source === 'pdf' && <span className="text-status-info-text font-bold"> · FROM BOOK</span>}
                                </p>
                              </button>
                              <span className="text-text-tertiary text-xs mt-1">{isExpanded ? '▾' : '▸'}</span>
                            </div>
                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2">
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
                                <PyqAnswerEditor
                                  pyqId={r._id}
                                  initial={r.pyqAnswer}
                                  initialStatus={r.pyqAnswerStatus}
                                  onStatusChange={(s) => setRows((rs) => rs.map((x) => (x._id === r._id ? { ...x, pyqAnswerStatus: s } : x)))}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
