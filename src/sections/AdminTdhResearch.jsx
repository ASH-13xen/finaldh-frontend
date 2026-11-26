import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  adminSets, adminCreateSet, adminUploadFiles, adminUpdateSet, adminDeleteSet, adminQuestions, adminUpdateQuestion,
  adminRunPractice, adminStopPractice, adminApproveAll, adminGenerateOne, adminAddPractice, adminUpdatePractice, adminDeletePractice,
} from '../lib/tdhApi';
import { TypeChip, QuestionBody, Blocks, NoteBox } from '../components/tdh/TdhParts';

// Admin → PYQ & TDH Research. Upload a subject's Questions file + its Solutions (Explanations & TDH
// Research) file; questions and solutions are matched by their number ("1.1"). Fix missing answers
// or types, let the AI write practice MCQs from the TDH Research (try a few first), then approve them.
// Students see a set once it is published, and only approved practice MCQs.

const inputClass = 'bg-sunken border border-border-default focus:border-brand text-text-primary rounded-xl px-3 py-2 text-xs focus:outline-none';
const btnPrimary = 'px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold cursor-pointer disabled:cursor-not-allowed';
const btnGhost = 'px-3 py-1.5 bg-surface border border-border-default hover:bg-surface-raised text-text-secondary rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50';
const KEYS = ['a', 'b', 'c', 'd'];

const jobLabel = (job) => {
  if (!job) return '';
  if (job.state === 'running') return `Writing practice MCQs… ${job.done}/${job.total} PYQs`;
  if (job.state === 'failed') return `Failed: ${job.error}`;
  if (job.state === 'stopped') return `Stopped after ${job.done} PYQs (${job.made} MCQs)`;
  return `Done: ${job.made} MCQs for ${job.total} PYQs — review them below`;
};

const reportText = (r) => [
  r.questions ? `${r.questions} questions read${r.added ? ` (${r.added} new)` : ''}` : '',
  r.solutions ? `${r.solutions} solutions matched` : '',
  r.orphanSolutions?.length ? `${r.orphanSolutions.length} solutions had no question (${r.orphanSolutions.slice(0, 6).join(', ')})` : '',
  r.warnings?.length ? `${r.warnings.length} warnings: ${r.warnings.slice(0, 4).join('; ')}` : '',
].filter(Boolean).join(' · ');

export default function AdminTdhResearch() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openSet, setOpenSet] = useState(null);

  const load = useCallback(() => adminSets().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const running = data?.sets.some((s) => s.job?.state === 'running');
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [running, load]);

  if (!data && !error) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-display font-semibold text-text-primary">PYQ &amp; TDH Research</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload the Questions file and the Solutions (Explanations &amp; TDH Research) file. Students attempt each PYQ, then read the
          explanation, the TDH Research and the practice MCQs you approve.
        </p>
      </header>
      {error && <p className="p-3 bg-status-danger-bg text-status-danger-text rounded-xl text-xs font-semibold">{error}</p>}
      {data && (
        <>
          {!data.aiReady && (
            <p className="p-3 bg-status-warning-bg text-status-warning-text rounded-xl text-xs font-semibold">
              No AI key is configured on the server — files can be uploaded, but practice MCQs can only be added by hand.
            </p>
          )}
          <UploadCard onDone={load} />
          <div className="space-y-3">
            {data.sets.length === 0 && <p className="text-sm text-text-tertiary">Nothing uploaded yet.</p>}
            {data.sets.map((s) => (
              <SetRow key={s._id} s={s} open={openSet === s._id} onToggle={() => setOpenSet(openSet === s._id ? null : s._id)} onChanged={load} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilePick({ label, accept, onPick }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-bold text-text-tertiary">
      {label}
      <input type="file" accept={accept} onChange={(e) => onPick(e.target.files?.[0] || null)} className="text-xs text-text-secondary font-normal" />
    </label>
  );
}

function UploadCard({ onDone }) {
  const [subject, setSubject] = useState('Economy');
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState(null);
  const [solutions, setSolutions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !title.trim() || !questions) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await adminCreateSet({ subject: subject.trim(), title: title.trim(), questions, solutions });
      setMsg(`Uploaded. ${reportText(r.report)}`);
      setTitle('');
      setQuestions(null);
      setSolutions(null);
      e.target.reset();
      onDone();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-surface border border-border-default rounded-2xl p-5 space-y-3">
      <p className="text-sm font-bold text-text-primary">Upload a new set</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-bold text-text-tertiary">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${inputClass} w-36`} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-text-tertiary">
          Title students see
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Economy PYQs 1995–2026" className={`${inputClass} w-60`} />
        </label>
        <FilePick label="Questions (.docx or .json)" accept=".docx,.json" onPick={setQuestions} />
        <FilePick label="Solutions + TDH Research (.docx)" accept=".docx" onPick={setSolutions} />
        <button disabled={busy || !questions || !title.trim() || !subject.trim()} className={btnPrimary}>{busy ? 'Uploading…' : 'Upload'}</button>
      </div>
      <p className="text-[11px] text-text-tertiary leading-5">
        Both files use "Section 1 | Title" and numbered questions ("1.1 (2024)"). Answers come from the ✓ / "Answer: (b)" lines and the type from
        "[Conceptual]" — if the file has none, fill them in below or upload a file that has them (nothing already set is wiped).
      </p>
      {msg && <p className="text-xs font-semibold text-text-secondary">{msg}</p>}
    </form>
  );
}

function Stat({ n, label, warn }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${warn && n > 0 ? 'bg-status-warning-bg text-status-warning-text' : 'bg-sunken text-text-secondary'}`}>
      {n} {label}
    </span>
  );
}

function SetRow({ s, open, onToggle, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [replace, setReplace] = useState(false);
  const [files, setFiles] = useState({ questions: null, solutions: null });
  const st = s.stats || {};
  const running = s.job?.state === 'running';
  const needPractice = (st.total || 0) - (st.hidden || 0) - (st.withPractice || 0);

  const act = async (fn, ok) => {
    setBusy(true);
    setMsg('');
    try { const r = await fn(); if (ok) setMsg(ok(r)); onChanged(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="bg-surface border border-border-default rounded-2xl">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className="text-left min-w-0 flex-1 cursor-pointer">
          <p className="text-sm font-bold text-text-primary">
            {open ? '▾' : '▸'} {s.title}
            <span className="ml-2 text-[11px] font-semibold text-text-tertiary">{s.subject} · {s.sections.length} sections</span>
          </p>
          <p className="text-[11px] text-text-tertiary mt-0.5 truncate">{s.questionsFile}{s.solutionsFile ? ` + ${s.solutionsFile}` : ' · no Solutions file yet'}</p>
        </button>
        <label className="flex items-center gap-1.5 text-xs font-bold text-text-secondary cursor-pointer">
          <input type="checkbox" checked={s.isPublished} disabled={busy} onChange={(e) => act(() => adminUpdateSet(s._id, { isPublished: e.target.checked }))} />
          Published
        </label>
        <button onClick={() => setReplace(!replace)} className={btnGhost}>Update files</button>
        <button
          disabled={busy}
          onClick={() => window.confirm(`Delete "${s.title}", its ${st.total} questions, practice MCQs and every student's progress?`) && act(() => adminDeleteSet(s._id))}
          className={`${btnGhost} text-status-danger-text`}
        >
          Delete
        </button>
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        <Stat n={st.total || 0} label="PYQs" />
        <Stat n={st.noAnswer || 0} label="without answer" warn />
        <Stat n={st.noType || 0} label="without type" warn />
        <Stat n={st.noSolution || 0} label="without solution" warn />
        <Stat n={st.hidden || 0} label="hidden" />
        <Stat n={st.drafts || 0} label="practice drafts" warn />
        <Stat n={st.approved || 0} label="practice approved" />
      </div>

      <div className="px-4 pb-3 flex flex-wrap items-center gap-2 border-t border-border-default pt-3">
        <span className="text-xs font-bold text-text-primary mr-1">Practice MCQs (AI, 2 per PYQ):</span>
        {running ? (
          <button disabled={busy} onClick={() => act(() => adminStopPractice(s._id))} className={btnGhost}>Stop</button>
        ) : (
          <>
            <button disabled={busy || !needPractice} onClick={() => act(() => adminRunPractice(s._id, { limit: 3 }))} className={btnGhost} title="Write them for the next 3 PYQs only, to check the quality">Try on 3</button>
            <button
              disabled={busy || !needPractice}
              onClick={() => window.confirm(`Write practice MCQs for all ${needPractice} remaining PYQs? About ${Math.ceil(needPractice / 4)} AI calls.`) && act(() => adminRunPractice(s._id, {}))}
              className={btnGhost}
            >
              All remaining ({needPractice})
            </button>
          </>
        )}
        <button
          disabled={busy || !st.drafts}
          onClick={() => window.confirm(`Approve all ${st.drafts} draft practice MCQs? Students will see them.`) && act(() => adminApproveAll(s._id), (r) => `Approved drafts on ${r.questions} PYQs`)}
          className={btnGhost}
        >
          Approve all drafts
        </button>
        {s.job && <span className={`text-[11px] font-semibold ${s.job.state === 'failed' ? 'text-status-danger-text' : 'text-brand'}`}>{jobLabel(s.job)}</span>}
      </div>

      {replace && (
        <div className="px-4 pb-3 flex flex-wrap items-end gap-3 border-t border-border-default pt-3">
          <FilePick label="Questions (.docx or .json)" accept=".docx,.json" onPick={(f) => setFiles((x) => ({ ...x, questions: f }))} />
          <FilePick label="Solutions + TDH Research (.docx)" accept=".docx" onPick={(f) => setFiles((x) => ({ ...x, solutions: f }))} />
          <button
            disabled={busy || (!files.questions && !files.solutions)}
            onClick={() => act(() => adminUploadFiles(s._id, files), (r) => { setReplace(false); setFiles({ questions: null, solutions: null }); return `Updated. ${reportText(r.report)}`; })}
            className={btnPrimary}
          >
            Upload
          </button>
          <p className="basis-full text-[11px] text-text-tertiary">Matched by question number. Answers, types, practice MCQs and student progress are kept.</p>
        </div>
      )}
      {msg && <p className="px-4 pb-3 text-xs font-semibold text-text-secondary">{msg}</p>}
      {open && <QuestionList set={s} refreshKey={`${s.job?.state}-${s.job?.done}-${st.drafts}-${st.approved}`} onChanged={onChanged} />}
    </div>
  );
}

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'noanswer', label: 'Without answer' },
  { key: 'notype', label: 'Without type' },
  { key: 'nosolution', label: 'Without solution' },
  { key: 'drafts', label: 'Practice to review' },
  { key: 'nopractice', label: 'No practice yet' },
  { key: 'hidden', label: 'Hidden' },
];

function QuestionList({ set, refreshKey, onChanged }) {
  const [section, setSection] = useState(set.sections[0]?.number || '');
  const [filter, setFilter] = useState('');
  const [questions, setQuestions] = useState(null);
  const [err, setErr] = useState('');
  const [openQ, setOpenQ] = useState(null);

  const load = useCallback(() => adminQuestions(set._id, { section, filter }).then((d) => setQuestions(d.questions)).catch((e) => setErr(e.message)), [set._id, section, filter]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const replaceQ = (q) => { setQuestions((list) => list.map((x) => (x._id === q._id ? q : x))); onChanged(); };

  return (
    <div className="border-t border-border-default">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-sunken/50">
        <select value={section} onChange={(e) => setSection(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
          <option value="">All sections</option>
          {set.sections.map((s) => <option key={s.number} value={s.number}>{s.number}. {s.title}</option>)}
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={inputClass}>
          {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {section && (
          <button
            onClick={() => window.confirm('Approve every draft practice MCQ in this section?') && adminApproveAll(set._id, section).then(() => { load(); onChanged(); }).catch((e) => setErr(e.message))}
            className={btnGhost}
          >
            Approve drafts in this section
          </button>
        )}
        <span className="text-[11px] text-text-tertiary ml-auto">{questions ? `${questions.length} shown` : ''}</span>
      </div>
      {err && <p className="px-4 py-2 text-xs text-status-danger-text">{err}</p>}
      {!questions ? <div className="py-6 flex justify-center"><LoadingSpinner /></div> : (
        <div className="divide-y divide-border-default">
          {questions.length === 0 && <p className="px-4 py-6 text-sm text-text-tertiary">Nothing here.</p>}
          {questions.map((q) => (
            <QuestionRow key={q._id} q={q} open={openQ === q._id} onToggle={() => setOpenQ(openQ === q._id ? null : q._id)} onSaved={replaceQ} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionRow({ q, open, onToggle, onSaved }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const drafts = q.practice.filter((p) => p.status === 'draft').length;
  const approved = q.practice.length - drafts;

  const save = async (fn) => {
    setBusy(true);
    setErr('');
    try { const r = await fn(); onSaved(r.question); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  };

  return (
    <div className={q.hidden ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <button onClick={onToggle} className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer">
          <span className="text-xs font-extrabold text-text-tertiary w-10 tabular-nums">{open ? '▾' : '▸'} {q.ref}</span>
          <span className="text-[11px] font-bold text-text-tertiary w-10">{q.year}</span>
          <span className="text-sm text-text-primary truncate">{q.title || q.questionText}</span>
        </button>
        <select value={q.type} disabled={busy} onChange={(e) => save(() => adminUpdateQuestion(q._id, { type: e.target.value }))} className={`${inputClass} ${!q.type ? 'border-status-warning-text' : ''}`}>
          <option value="">— type —</option>
          <option value="Factual">Factual</option>
          <option value="Conceptual">Conceptual</option>
        </select>
        <select value={q.answer} disabled={busy} onChange={(e) => save(() => adminUpdateQuestion(q._id, { answer: e.target.value }))} className={`${inputClass} ${!q.answer ? 'border-status-warning-text' : ''}`} title="Correct answer">
          <option value="">— answer —</option>
          {KEYS.map((k) => <option key={k} value={k}>({k})</option>)}
        </select>
        <span className={`text-[11px] font-bold w-28 text-right ${drafts ? 'text-status-warning-text' : 'text-text-tertiary'}`}>
          {q.practice.length ? `${approved} approved${drafts ? ` · ${drafts} draft` : ''}` : 'no practice'}
        </span>
        <button disabled={busy} onClick={() => save(() => adminUpdateQuestion(q._id, { hidden: !q.hidden }))} className={btnGhost}>{q.hidden ? 'Show' : 'Hide'}</button>
      </div>
      {err && <p className="px-4 pb-2 text-xs text-status-danger-text">{err}</p>}
      {open && <QuestionDetail q={q} busy={busy} save={save} />}
    </div>
  );
}

function QuestionDetail({ q, busy, save }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <div className="px-4 sm:px-6 pb-5 pt-1 grid lg:grid-cols-2 gap-5 bg-sunken/30">
      <div className="space-y-4">
        <div className="bg-surface border border-border-default rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-text-tertiary">{q.examSource}</span>
            <TypeChip type={q.type} />
            <button onClick={() => setEditing(!editing)} className={`${btnGhost} ml-auto`}>{editing ? 'Close editor' : 'Edit question'}</button>
          </div>
          {editing ? <QuestionEditor q={q} busy={busy} onSave={(patch) => save(() => adminUpdateQuestion(q._id, patch)).then((ok) => ok && setEditing(false))} /> : (
            <>
              <QuestionBody text={q.questionText} lines={q.lines} size="sm" />
              <ul className="text-sm space-y-1">
                {q.options.map((o) => (
                  <li key={o.key} className={o.key === q.answer ? 'font-bold text-status-success-text' : 'text-text-secondary'}>({o.key}) {o.text}{o.key === q.answer ? '  ✓' : ''}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        {q.explanation.length > 0 && (
          <div className="bg-surface border border-border-default rounded-2xl p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300 mb-3">Explanation</p>
            <Blocks blocks={q.explanation} />
          </div>
        )}
        {q.research.length > 0 && (
          <div className="bg-surface border border-teal-200 dark:border-teal-900 rounded-2xl p-4 space-y-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-300">TDH Research</p>
            <Blocks blocks={q.research} tone="research" />
            <NoteBox note={q.note} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-text-primary">Practice MCQs</p>
          <button disabled={busy || !q.research.length} onClick={() => save(() => adminGenerateOne(q._id))} className={btnGhost} title="Replaces this PYQ's AI drafts; keeps approved and hand-made ones">
            {busy ? 'Working…' : q.practice.length ? 'Rewrite drafts with AI' : 'Write with AI'}
          </button>
          <button onClick={() => setAdding(!adding)} className={btnGhost}>{adding ? 'Cancel' : '+ Add by hand'}</button>
        </div>
        {adding && (
          <PracticeEditor
            p={{ type: 'Factual', questionText: '', statements: [], options: KEYS.map((key) => ({ key, text: '' })), answer: '', why: '' }}
            busy={busy}
            saveLabel="Add (approved)"
            onSave={(p) => save(() => adminAddPractice(q._id, { ...p, status: 'approved' })).then((ok) => ok && setAdding(false))}
          />
        )}
        {q.practice.length === 0 && !adding && <p className="text-xs text-text-tertiary">None yet.</p>}
        {q.practice.map((p) => <PracticeItem key={p._id} q={q} p={p} busy={busy} save={save} />)}
      </div>
    </div>
  );
}

function QuestionEditor({ q, busy, onSave }) {
  const [text, setText] = useState(q.questionText);
  const [lines, setLines] = useState(q.lines.join('\n'));
  const [opts, setOpts] = useState(KEYS.map((key) => ({ key, text: q.options.find((o) => o.key === key)?.text || '' })));
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={`${inputClass} w-full text-sm`} />
      <textarea value={lines} onChange={(e) => setLines(e.target.value)} rows={5} placeholder="Statements / pairs, one per line" className={`${inputClass} w-full text-sm`} />
      {opts.map((o, i) => (
        <input key={o.key} value={o.text} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder={`(${o.key})`} className={`${inputClass} w-full text-sm`} />
      ))}
      <button disabled={busy} onClick={() => onSave({ questionText: text, lines: lines.split('\n'), options: opts })} className={btnPrimary}>Save question</button>
    </div>
  );
}

function PracticeItem({ q, p, busy, save }) {
  const [editing, setEditing] = useState(false);
  const draft = p.status === 'draft';
  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${draft ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800' : 'border-border-default bg-surface'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <TypeChip type={p.type} />
        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${draft ? 'bg-status-warning-bg text-status-warning-text' : 'bg-status-success-bg text-status-success-text'}`}>{draft ? 'Draft' : 'Approved'}</span>
        <span className="text-[10px] font-bold text-text-tertiary uppercase">{p.by === 'admin' ? 'by you' : 'AI'}</span>
        <div className="ml-auto flex gap-1.5">
          {draft
            ? <button disabled={busy} onClick={() => save(() => adminUpdatePractice(q._id, p._id, { status: 'approved' }))} className={btnPrimary}>Approve</button>
            : <button disabled={busy} onClick={() => save(() => adminUpdatePractice(q._id, p._id, { status: 'draft' }))} className={btnGhost}>Unapprove</button>}
          <button onClick={() => setEditing(!editing)} className={btnGhost}>{editing ? 'Cancel' : 'Edit'}</button>
          <button disabled={busy} onClick={() => window.confirm('Delete this practice MCQ?') && save(() => adminDeletePractice(q._id, p._id))} className={`${btnGhost} text-status-danger-text`}>✕</button>
        </div>
      </div>
      {editing ? (
        <PracticeEditor p={p} busy={busy} saveLabel="Save" onSave={(patch) => save(() => adminUpdatePractice(q._id, p._id, patch)).then((ok) => ok && setEditing(false))} />
      ) : (
        <>
          <QuestionBody text={p.questionText} lines={p.statements} size="sm" />
          <ul className="text-sm space-y-0.5">
            {p.options.map((o) => (
              <li key={o.key} className={o.key === p.answer ? 'font-bold text-status-success-text' : 'text-text-secondary'}>({o.key}) {o.text}{o.key === p.answer ? '  ✓' : ''}</li>
            ))}
          </ul>
          {p.why && <p className="text-xs text-text-tertiary leading-5"><strong>Why:</strong> {p.why}</p>}
        </>
      )}
    </div>
  );
}

function PracticeEditor({ p, busy, saveLabel, onSave }) {
  const [type, setType] = useState(p.type);
  const [questionText, setQuestionText] = useState(p.questionText);
  const [statements, setStatements] = useState(p.statements.join('\n'));
  const [opts, setOpts] = useState(KEYS.map((key) => ({ key, text: p.options.find((o) => o.key === key)?.text || '' })));
  const [answer, setAnswer] = useState(p.answer);
  const [why, setWhy] = useState(p.why);
  const ready = questionText.trim() && opts.every((o) => o.text.trim()) && answer;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          <option value="Factual">Factual</option>
          <option value="Conceptual">Conceptual</option>
        </select>
        <select value={answer} onChange={(e) => setAnswer(e.target.value)} className={`${inputClass} ${!answer ? 'border-status-warning-text' : ''}`}>
          <option value="">— answer —</option>
          {KEYS.map((k) => <option key={k} value={k}>({k})</option>)}
        </select>
      </div>
      <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={2} placeholder="Question" className={`${inputClass} w-full text-sm`} />
      <textarea value={statements} onChange={(e) => setStatements(e.target.value)} rows={3} placeholder={'Statements, one per line (optional)\n1. …\n2. …'} className={`${inputClass} w-full text-sm`} />
      {opts.map((o, i) => (
        <input key={o.key} value={o.text} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder={`(${o.key})`} className={`${inputClass} w-full text-sm`} />
      ))}
      <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="Why this answer (one line)" className={`${inputClass} w-full text-sm`} />
      <button disabled={busy || !ready} onClick={() => onSave({ type, questionText, statements: statements.split('\n'), options: opts, answer, why })} className={btnPrimary}>{saveLabel}</button>
    </div>
  );
}
