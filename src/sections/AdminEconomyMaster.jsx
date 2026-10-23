import { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import TopicBody from '../components/economy/TopicBody';
import { blocksToText, textToBlocks } from '../lib/economyMarkup';
import {
  adminStatus, adminListTopics, adminUpdateTopic, adminAiExtras, adminUpdateTheme,
  adminThemeAiExtras, adminStopThemeAiExtras, adminAiExtrasJobs, adminPublishThemeExtras, adminImport, adminUploadSourcePdf, SOURCE_LABEL,
  adminListPyqs, adminPlacePyq, adminStartPyqTagging, adminStopPyqTagging, adminPyqTagging,
} from '../lib/economyApi';

// ---------------------------------------------------------------------------
// Admin → Economy Data. Load the parsed Master File, publish themes, link them to Question
// Bank PYQs, fix anything the parser got wrong, and add the "Conceptual depth" / "Additional
// facts & peripheral knowledge" extras (hand-written or AI-drafted, then published per topic).
// PYQs tab: place Economy Question Bank PYQs under topics (AI first, then review by hand).
// ---------------------------------------------------------------------------

const card = 'bg-surface border border-border-default rounded-2xl p-5';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-brand text-text-on-accent hover:bg-brand-hover`;
const btnGhost = `${btn} border border-border-default text-text-secondary hover:text-text-primary hover:border-brand`;
const input = 'w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand';

export default function AdminEconomyMaster() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('themes'); // themes | topics | pyqs | setup

  const reload = useCallback(() => adminStatus().then(setStatus).catch((e) => setError(e.message)), []);
  useEffect(() => { reload(); }, [reload]);

  if (error) return <div className="max-w-6xl mx-auto p-6 text-sm text-status-danger-text">{error}</div>;
  if (!status) return <div className="py-24 flex justify-center"><LoadingSpinner /></div>;

  const totalTopics = status.themes.reduce((n, t) => n + t.topicCount, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">Economy Master File</h1>
          <p className="text-sm text-text-secondary">{totalTopics} topics · {status.themes.filter((t) => t.isPublished).length}/{status.themes.length} themes published</p>
        </div>
        <div className="flex gap-1 bg-sunken rounded-xl p-1">
          {[['themes', 'Themes'], ['topics', 'Topics'], ['pyqs', 'PYQs'], ['setup', 'Import & PDF']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${tab === k ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary'}`}>{l}</button>
          ))}
        </div>
      </header>

      {totalTopics === 0 && tab !== 'setup' && (
        <p className="text-sm bg-status-warning-bg text-status-warning-text rounded-xl px-4 py-3">
          No topics yet. Go to <button className="underline font-bold cursor-pointer" onClick={() => setTab('setup')}>Import & PDF</button> to load the parsed Master File.
        </p>
      )}

      {tab === 'setup' && <SetupPanel status={status} onChanged={reload} />}
      {tab === 'themes' && <ThemesPanel status={status} onChanged={reload} />}
      {tab === 'topics' && <TopicsPanel themes={status.themes} ai={status.ai} />}
      {tab === 'pyqs' && <PyqsPanel themes={status.themes} />}
    </div>
  );
}

// ============================================================================ setup

function SetupPanel({ status, onChanged }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('merge');
  const [overwriteEdited, setOverwriteEdited] = useState(false);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const run = async (dryRun) => {
    if (!file) return;
    setBusy(dryRun ? 'check' : 'import');
    setErr('');
    try {
      const r = await adminImport(file, { mode, dryRun, overwriteEdited });
      setReport(r);
      if (!dryRun) onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const uploadPdf = async (f) => {
    if (!f) return;
    setBusy('pdf');
    setErr('');
    try {
      await adminUploadSourcePdf(f);
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold text-text-primary">1 · Import parsed topics</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Parse the PDF on a machine with poppler installed, then upload the JSON here:
        </p>
        <pre className="text-[11px] bg-sunken rounded-lg p-3 overflow-x-auto text-text-secondary">node scripts/parse_economy_master.mjs --file "Economy_Master_File.pdf" --out economy_master.json</pre>
        <input type="file" accept=".json,application/json" onChange={(e) => { setFile(e.target.files?.[0] || null); setReport(null); }} className="text-xs" />
        <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
          <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge (add / update)</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace (hide topics not in this file)</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={overwriteEdited} onChange={(e) => setOverwriteEdited(e.target.checked)} /> Overwrite hand-edited topics</label>
        </div>
        <div className="flex gap-2">
          <button disabled={!file || !!busy} onClick={() => run(true)} className={btnGhost}>{busy === 'check' ? 'Checking…' : 'Check first'}</button>
          <button disabled={!file || !!busy} onClick={() => run(false)} className={btnPrimary}>{busy === 'import' ? 'Importing…' : 'Import'}</button>
        </div>
        {report && (
          <div className="text-xs bg-sunken rounded-lg p-3 space-y-1 text-text-secondary">
            <p className="font-bold text-text-primary">{report.dryRun ? 'Check result — nothing written yet' : 'Imported'}</p>
            <p>{report.parsed} topics · {report.created} new · {report.updated} updated · {report.keptEdited} hand-edited kept · {report.hidden} hidden</p>
            <p>Bookmarks, notes, progress and the extras are kept for updated topics.</p>
            {report.errors?.length > 0 && (
              <details><summary className="cursor-pointer text-status-danger-text">{report.errors.length} rows skipped</summary>
                <ul className="mt-1 space-y-0.5">{report.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold text-text-primary">2 · Source PDF</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Powers the <b>Original page</b> button on every topic (for tables and charts). Students get one page at a time and never the full file.
        </p>
        {status.sourcePdf ? (
          <p className="text-xs text-status-success-text bg-status-success-bg rounded-lg px-3 py-2">
            {status.sourcePdf.originalName} · {status.sourcePdf.pageCount} pages · {(status.sourcePdf.size / 1048576).toFixed(1)} MB
          </p>
        ) : (
          <p className="text-xs text-status-warning-text bg-status-warning-bg rounded-lg px-3 py-2">Not uploaded yet.</p>
        )}
        <label className={`${btnGhost} inline-block`}>
          {busy === 'pdf' ? 'Uploading…' : status.sourcePdf ? 'Replace PDF' : 'Upload PDF'}
          <input type="file" accept="application/pdf" className="hidden" disabled={!!busy} onChange={(e) => uploadPdf(e.target.files?.[0])} />
        </label>
        <p className="text-[11px] text-text-tertiary">AI drafts use {status.ai}.</p>
      </section>

      {err && <p className="lg:col-span-2 text-sm text-status-danger-text">{err}</p>}
    </div>
  );
}

// ============================================================================ themes

function ThemesPanel({ status, onChanged }) {
  const [editing, setEditing] = useState(null); // theme key
  const [jobs, setJobs] = useState({});
  const anyRunning = Object.values(jobs).some((j) => j.running);

  const pollJobs = useCallback(() => adminAiExtrasJobs().then((d) => setJobs(d.jobs)).catch(() => {}), []);
  useEffect(() => { pollJobs(); }, [pollJobs]);
  // While a draft job runs, poll its progress and refresh the theme counts as drafts land.
  useEffect(() => {
    if (!anyRunning) return undefined;
    const id = setInterval(() => { pollJobs(); onChanged(); }, 3000);
    return () => { clearInterval(id); onChanged(); };
  }, [anyRunning, pollJobs, onChanged]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-tertiary">
        <b>Draft extras</b> asks the AI ({status.ai}) for the “Conceptual depth” and “Additional facts &amp; peripheral knowledge” on every topic that has none yet.
        Drafts stay hidden from students until you publish them, so spot-check a few in <b>Topics</b> first.
      </p>
      {status.themes.map((t) => (
        <ThemeRow key={t.key} theme={t} banks={status.banks} job={jobs[t.key]} onJobsChanged={pollJobs} open={editing === t.key} onToggle={() => setEditing(editing === t.key ? null : t.key)} onChanged={onChanged} />
      ))}
    </div>
  );
}

function ThemeRow({ theme: t, banks, job, onJobsChanged, open, onToggle, onChanged }) {
  const [form, setForm] = useState({ title: t.title, description: t.description || '', subject: t.pyq?.subject || '', topics: t.pyq?.topics || [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const bank = banks.find((b) => b.subject === form.subject);

  const save = async (patch) => {
    setBusy(true);
    setErr('');
    try {
      await adminUpdateTheme(t.key, patch);
      await onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      await Promise.all([onJobsChanged(), onChanged()]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const empty = t.topicCount - (t.extras.published || 0) - (t.extras.draft || 0);
  const drafts = t.extras.draft || 0;
  const publishDrafts = () => {
    if (!window.confirm(`Publish the AI extras on ${drafts} topic(s) in “${t.title}”? Students will see them straight away.`)) return;
    run(() => adminPublishThemeExtras(t.key));
  };

  return (
    <div className={`${card} !p-0`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <p className="font-semibold text-text-primary">{t.title}</p>
          <p className="text-[11px] text-text-tertiary font-semibold">
            {t.topicCount} topics{t.hiddenCount ? ` · ${t.hiddenCount} hidden` : ''} · extras: {t.extras.published || 0} published, {t.extras.draft || 0} draft
            {t.pyq?.topics?.length ? ` · PYQs: ${t.pyq.subject} (${t.pyq.topics.length} topics)` : ''}
          </p>
        </button>
        {job?.running ? (
          <span className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
            ✨ Drafting {job.done + job.failed}/{job.total}{job.failed ? ` (${job.failed} failed)` : ''}
            <button disabled={busy} onClick={() => run(() => adminStopThemeAiExtras(t.key))} className={btnGhost}>Stop</button>
          </span>
        ) : (
          <>
            {empty > 0 && (
              <button disabled={busy} onClick={() => run(() => adminThemeAiExtras(t.key))} className={btnGhost} title="AI-draft facts + research for topics that have none">
                ✨ Draft extras ({empty})
              </button>
            )}
            {drafts > 0 && (
              <button disabled={busy} onClick={publishDrafts} className={btnGhost}>Publish {drafts} drafts</button>
            )}
          </>
        )}
        <button disabled={busy} onClick={() => save({ isPublished: !t.isPublished })} className={t.isPublished ? `${btn} bg-status-success-bg text-status-success-text` : btnGhost}>
          {t.isPublished ? '● Published' : 'Publish'}
        </button>
        <button onClick={onToggle} className={btnGhost}>{open ? 'Close' : 'Edit'}</button>
      </div>
      {(err || (!job?.running && job?.failed > 0)) && !open && (
        <p className="px-4 pb-3 -mt-1 text-xs text-status-danger-text">
          {err || `Last draft run: ${job.failed} topic(s) failed (${job.errors[job.errors.length - 1]?.error || 'unknown error'}) — click Draft extras again to retry them.`}
        </p>
      )}
      {open && (
        <div className="border-t border-border-default px-4 py-4 grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase text-text-tertiary">Title</label>
            <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <label className="block text-[11px] font-bold uppercase text-text-tertiary">Short description (shown on the theme page)</label>
            <textarea className={input} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase text-text-tertiary">PYQs tab — Question Bank</label>
            <select className={input} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, topics: [] })}>
              <option value="">— none (shows “coming soon”) —</option>
              {banks.map((b) => <option key={b.subject} value={b.subject}>{b.subject}</option>)}
            </select>
            {bank && (
              <div className="max-h-48 overflow-y-auto border border-border-default rounded-lg p-2 space-y-1">
                {bank.topics.map((tp) => (
                  <label key={tp} className="flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={form.topics.includes(tp)}
                      onChange={(e) => setForm({ ...form, topics: e.target.checked ? [...form.topics, tp] : form.topics.filter((x) => x !== tp) })}
                    />
                    {tp}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              disabled={busy}
              onClick={() => save({ title: form.title, description: form.description, pyq: { subject: form.subject, topics: form.topics } })}
              className={btnPrimary}
            >
              {busy ? 'Saving…' : 'Save theme'}
            </button>
            {err && <span className="text-xs text-status-danger-text">{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================ topics

function TopicsPanel({ themes, ai }) {
  const [filters, setFilters] = useState({ theme: themes[0]?.key || '', source: '', extras: '', hidden: '', q: '' });
  const [topics, setTopics] = useState(null);
  const [selected, setSelected] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      setTopics(null);
      adminListTopics(filters).then((d) => setTopics(d.topics)).catch((e) => setErr(e.message));
    }, filters.q ? 300 : 0);
    return () => clearTimeout(id);
  }, [filters]);

  const sel = topics?.find((t) => t._id === selected) || null;
  const replace = (t) => setTopics((list) => list.map((x) => (x._id === t._id ? { ...x, ...t } : x)));

  return (
    <div className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-4 items-start">
      <div className={`${card} !p-3 space-y-2 lg:sticky lg:top-24`}>
        <select className={input} value={filters.theme} onChange={(e) => setFilters({ ...filters, theme: e.target.value })}>
          <option value="">All themes</option>
          {themes.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-1.5">
          <select className={input} value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
            <option value="">All parts</option>
            {Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className={input} value={filters.extras} onChange={(e) => setFilters({ ...filters, extras: e.target.value })}>
            <option value="">Extras: any</option>
            <option value="none">No extras</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <select className={input} value={filters.hidden} onChange={(e) => setFilters({ ...filters, hidden: e.target.value })}>
            <option value="">Visible</option>
            <option value="only">Hidden</option>
            <option value="all">Both</option>
          </select>
        </div>
        <input className={input} placeholder="Search title or text…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        {err && <p className="text-xs text-status-danger-text">{err}</p>}
        <div className="max-h-[60vh] overflow-y-auto -mx-1">
          {!topics && <div className="py-8 flex justify-center"><LoadingSpinner /></div>}
          {topics?.length === 0 && <p className="text-xs text-text-tertiary p-3">No topics.</p>}
          {topics?.map((t) => (
            <button
              key={t._id}
              onClick={() => setSelected(t._id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg cursor-pointer ${selected === t._id ? 'bg-accent-soft-bg' : 'hover:bg-surface-raised'}`}
            >
              <p className="text-[13px] text-text-primary leading-snug">{t.number != null ? `${t.number}. ` : ''}{t.title}</p>
              <p className="text-[10px] font-semibold text-text-tertiary">
                {SOURCE_LABEL[t.source]} · p.{t.pages.join(',')}
                {t.blocks.length === 0 && <span className="text-status-warning-text"> · empty</span>}
                {t.extrasStatus !== 'none' && <span className={t.extrasStatus === 'published' ? 'text-status-success-text' : 'text-status-warning-text'}> · extras {t.extrasStatus}</span>}
                {t.editedAt && ' · edited'}
                {t.hidden && ' · hidden'}
              </p>
            </button>
          ))}
        </div>
      </div>
      {sel ? <TopicEditor key={sel._id} topic={sel} themes={themes} ai={ai} onSaved={replace} /> : (
        <p className={`${card} text-sm text-text-tertiary`}>Pick a topic to edit its text, move it to another theme, or add the extras.</p>
      )}
    </div>
  );
}

function TopicEditor({ topic, themes, ai, onSaved }) {
  const [title, setTitle] = useState(topic.title);
  const [themeKey, setThemeKey] = useState(topic.themeKey);
  const [body, setBody] = useState(() => blocksToText(topic.blocks));
  const [facts, setFacts] = useState((topic.facts || []).join('\n'));
  const [research, setResearch] = useState(topic.research || '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const preview = useMemo(() => textToBlocks(body), [body]);
  const bodyChanged = body !== blocksToText(topic.blocks);

  const save = async (patch, label) => {
    setBusy(label);
    setMsg('');
    try {
      const { topic: t } = await adminUpdateTopic(topic._id, patch);
      onSaved(t);
      setMsg('Saved');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy('');
    }
  };

  const saveAll = (extra = {}) => save({
    title,
    themeKey,
    ...(bodyChanged ? { blocks: preview } : {}),
    facts: facts.split('\n').map((f) => f.trim()).filter(Boolean),
    research,
    ...extra,
  }, 'save');

  const draftAi = async () => {
    setBusy('ai');
    setMsg('');
    try {
      const { topic: t } = await adminAiExtras(topic._id);
      setFacts((t.facts || []).join('\n'));
      setResearch(t.research || '');
      onSaved(t);
      setMsg('AI draft ready — check it, then publish');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-start gap-2 justify-between">
        <p className="text-[11px] font-semibold text-text-tertiary">
          {SOURCE_LABEL[topic.source]} · “{topic.sourceTheme}” · #{topic.number ?? '—'} · p.{topic.pages.join(', ')}
          {topic.pyqTags.length > 0 && ` · ${topic.pyqTags.join(', ')}`}
        </p>
        <button disabled={!!busy} onClick={() => save({ hidden: !topic.hidden }, 'hide')} className={btnGhost}>{topic.hidden ? 'Unhide' : 'Hide topic'}</button>
      </div>

      <div className="grid sm:grid-cols-[1fr_220px] gap-2">
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className={input} value={themeKey} onChange={(e) => setThemeKey(e.target.value)}>
          {themes.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
        </select>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase text-text-tertiary">Text</label>
          <textarea className={`${input} font-mono text-xs leading-relaxed`} rows={16} value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
          <p className="text-[10px] text-text-tertiary leading-relaxed">
            One line per point. <code>- </code> bullet, two spaces per indent level, <code># </code> sub-heading.
            <code> **bold**</code> <code>{'{g:green}'}</code> <code>{'{c:cyan}'}</code> <code>{'{y:yellow}'}</code> <code>[ok]</code> ✓ <code>[no]</code> ✕
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase text-text-tertiary">Preview</label>
          <div className="border border-border-default rounded-lg p-3 max-h-[26rem] overflow-y-auto">
            <TopicBody blocks={preview} />
          </div>
        </div>
      </div>

      <div className="border-t border-border-default pt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-text-primary text-sm">Extras</p>
            <p className="text-[11px] text-text-tertiary">Status: <b>{topic.extrasStatus}</b>. Students only see published extras.</p>
          </div>
          <button disabled={!!busy} onClick={draftAi} className={btnGhost} title={`Uses ${ai}`}>{busy === 'ai' ? 'Drafting…' : '✨ Draft with AI'}</button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-text-tertiary">Conceptual depth (green) · one per line</label>
            <textarea className={input} rows={5} value={facts} onChange={(e) => setFacts(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-text-tertiary">Additional facts &amp; peripheral knowledge (blue) · “Label: text” per line</label>
            <textarea className={input} rows={5} value={research} onChange={(e) => setResearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button disabled={!!busy} onClick={() => saveAll()} className={btnPrimary}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        {topic.extrasStatus !== 'published' ? (
          <button disabled={!!busy || (!facts.trim() && !research.trim())} onClick={() => saveAll({ extrasStatus: 'published' })} className={btnGhost}>Save & publish extras</button>
        ) : (
          <button disabled={!!busy} onClick={() => saveAll({ extrasStatus: 'draft' })} className={btnGhost}>Unpublish extras</button>
        )}
        {msg && <span className={`text-xs ${msg.startsWith('Saved') || msg.startsWith('AI') ? 'text-status-success-text' : 'text-status-danger-text'}`}>{msg}</span>}
      </div>
    </div>
  );
}

// ============================================================================ PYQ placement

const PYQ_STATUS = [
  ['', 'All'],
  ['placed', 'Placed'],
  ['low', 'AI — low confidence'],
  ['unplaced', 'No topic found'],
  ['untagged', 'Not tagged yet'],
  ['admin', 'Placed by hand'],
];

function PyqsPanel({ themes }) {
  const [filters, setFilters] = useState({ status: '', section: '', q: '' });
  const [data, setData] = useState(null);
  const [tagging, setTagging] = useState(null);   // { job, summary, model }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const themeTitle = useMemo(() => Object.fromEntries(themes.map((t) => [t.key, t.title])), [themes]);

  const load = useCallback(() => adminListPyqs(filters).then(setData).catch((e) => setErr(e.message)), [filters]);
  useEffect(() => {
    const id = setTimeout(() => { setData(null); load(); }, filters.q ? 300 : 0);
    return () => clearTimeout(id);
  }, [filters, load]);

  const loadTagging = useCallback(() => adminPyqTagging().then(setTagging).catch((e) => setErr(e.message)), []);
  useEffect(() => { loadTagging(); }, [loadTagging]);
  const running = !!tagging?.job?.running;
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(loadTagging, 2500);
    return () => clearInterval(id);
  }, [running, loadTagging]);
  // refresh the list once a job finishes
  useEffect(() => { if (tagging?.job && !running) load(); }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (opts, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setErr('');
    try {
      await adminStartPyqTagging(opts);
      await loadTagging();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sum = tagging?.summary || data?.summary;
  const replace = (id, patch) => setData((d) => ({ ...d, pyqs: d.pyqs.map((q) => (q._id === id ? { ...q, ...patch } : q)) }));

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-text-primary">Economy PYQs → Master File topics</p>
            {sum && (
              <p className="text-[11px] text-text-tertiary font-semibold">
                {sum.total} PYQs · {sum.placed} placed · {sum.unplaced} no topic found · {sum.untagged} not tagged yet · {sum.byAdmin} by hand
              </p>
            )}
            {sum?.total === 0 && (
              <p className="text-xs text-status-warning-text mt-1">
                No Economy bank yet — run <code>scripts/import_bank_questions.mjs --subject Economy</code> first.
              </p>
            )}
          </div>
          {running ? (
            <span className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              ✨ Placing {tagging.job.done + tagging.job.failed}/{tagging.job.total}{tagging.job.failed ? ` (${tagging.job.failed} failed)` : ''}
              <button disabled={busy} onClick={() => adminStopPyqTagging().then(loadTagging)} className={btnGhost}>Stop</button>
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <button disabled={busy || !sum?.untagged} onClick={() => start({ limit: 3 })} className={btnGhost} title="Tag 3 questions to check the quality first">Try 3</button>
              <button
                disabled={busy || !sum?.untagged}
                onClick={() => start({}, `AI-place ${sum.untagged} untagged PYQ(s) with ${tagging?.model}? Runs in batches of 15.`)}
                className={btnPrimary}
              >
                ✨ AI-place {sum?.untagged || 0} untagged
              </button>
              <button
                disabled={busy || !sum?.total}
                onClick={() => start({ retag: true }, 'Redo every AI placement? Questions you placed by hand are kept.')}
                className={btnGhost}
              >
                Redo AI placements
              </button>
            </div>
          )}
        </div>
        {tagging?.job && !running && tagging.job.finishedAt && (
          <p className="text-[11px] text-text-tertiary">
            Last run: {tagging.job.placed}/{tagging.job.total} placed{tagging.job.failed ? `, ${tagging.job.failed} failed` : ''}.
            {tagging.job.errors?.map((e, i) => <span key={i} className="block text-status-danger-text">{e.error}</span>)}
          </p>
        )}
        <div className="grid sm:grid-cols-[180px_220px_1fr] gap-1.5">
          <select className={input} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            {PYQ_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className={input} value={filters.section} onChange={(e) => setFilters({ ...filters, section: e.target.value })}>
            <option value="">All sections</option>
            {data?.sections?.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input className={input} placeholder="Search question, year or ref (econ-pyq:6.14)…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
        {err && <p className="text-xs text-status-danger-text">{err}</p>}
      </div>

      {!data && <div className="py-10 flex justify-center"><LoadingSpinner /></div>}
      {data?.pyqs.length === 0 && <p className={`${card} text-sm text-text-tertiary`}>No PYQs match.</p>}
      {data?.pyqs.length === 500 && <p className="text-[11px] text-text-tertiary">Showing the first 500 — narrow the filters to see the rest.</p>}
      <div className="space-y-2">
        {data?.pyqs.map((q) => <PyqRow key={q._id} q={q} themeTitle={themeTitle} onChanged={(patch) => replace(q._id, patch)} />)}
      </div>
    </div>
  );
}

function PyqRow({ q, themeTitle, onChanged }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const correct = q.options.find((o) => o.key === q.correctKey);
  const conf = q.econTag?.confidence;

  const place = async (topics) => {
    setBusy(true);
    setErr('');
    try {
      const d = await adminPlacePyq(q._id, topics.map((t) => t._id));
      onChanged({ topics: d.pyq.topics, econTag: d.pyq.econTag });
      setAdding(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${card} !p-3.5`}>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
        <span className="text-text-tertiary">{q.sourceRef?.replace('econ-pyq:', '#') || '—'}</span>
        <span className="px-1.5 py-0.5 rounded-md bg-accent-soft-bg text-brand">{q.examSource}</span>
        <span className="text-text-tertiary uppercase tracking-wide">{q.section}</span>
        {q.econTag?.by === 'admin' && <span className="px-1.5 py-0.5 rounded-md bg-status-success-bg text-status-success-text">by hand</span>}
        {q.econTag?.by === 'ai' && conf != null && (
          <span className={`px-1.5 py-0.5 rounded-md ${conf < 0.75 ? 'bg-status-warning-bg text-status-warning-text' : 'bg-sunken text-text-tertiary'}`}>AI {Math.round(conf * 100)}%</span>
        )}
        {!q.econTag?.by && <span className="px-1.5 py-0.5 rounded-md bg-sunken text-text-tertiary">not tagged</span>}
      </div>
      <button onClick={() => setOpen(!open)} className="block w-full text-left mt-1.5 cursor-pointer">
        <p className={`text-sm text-text-primary leading-snug ${open ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
          {[q.questionText, ...(open ? q.statements : [])].join('\n')}
        </p>
      </button>
      {open && (
        <ul className="mt-1 text-[13px] text-text-secondary">
          {q.options.map((o) => <li key={o.key} className={o.key === q.correctKey ? 'font-semibold text-status-success-text' : ''}>({o.key.toLowerCase()}) {o.text}</li>)}
        </ul>
      )}
      {!open && correct && <p className="text-[11px] text-text-tertiary mt-0.5">Answer: ({q.correctKey.toLowerCase()}) {correct.text}</p>}

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {q.topics.length === 0 && <span className="text-[11px] text-text-tertiary">No topic.</span>}
        {q.topics.map((t) => (
          <span key={t._id} className="inline-flex items-center gap-1 text-[11px] font-semibold pl-2 pr-1 py-0.5 rounded-md border border-border-default bg-surface text-text-primary">
            <span className="text-text-tertiary">{themeTitle[t.themeKey] || t.themeKey} ·</span> {t.title}
            <span className="text-[9px] text-text-tertiary uppercase">{SOURCE_LABEL[t.source]}</span>
            <button disabled={busy} onClick={() => place(q.topics.filter((x) => x._id !== t._id))} className="px-1 text-text-tertiary hover:text-status-danger-text cursor-pointer" aria-label={`Remove ${t.title}`}>×</button>
          </span>
        ))}
        {!adding && <button disabled={busy} onClick={() => setAdding(true)} className={btnGhost}>+ Topic</button>}
      </div>
      {adding && <TopicPicker exclude={q.topics} themeTitle={themeTitle} onPick={(t) => place([...q.topics, t])} onClose={() => setAdding(false)} />}
      {err && <p className="text-xs text-status-danger-text mt-1">{err}</p>}
    </div>
  );
}

function TopicPicker({ exclude, themeTitle, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const id = setTimeout(() => adminListTopics({ q }).then((d) => setResults(d.topics.slice(0, 30))).catch(() => setResults([])), 250);
    return () => clearTimeout(id);
  }, [q]);
  const taken = new Set(exclude.map((t) => t._id));

  return (
    <div className="mt-2 rounded-xl border border-border-default bg-sunken p-2 space-y-1.5">
      <div className="flex gap-1.5">
        <input autoFocus className={input} placeholder="Search Master File topics…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={onClose} className={btnGhost}>Cancel</button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {results.filter((t) => !taken.has(t._id)).map((t) => (
          <button key={t._id} onClick={() => onPick(t)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface cursor-pointer">
            <span className="text-[13px] text-text-primary">{t.title}</span>
            <span className="text-[10px] font-semibold text-text-tertiary"> · {themeTitle[t.themeKey] || t.themeKey} · {SOURCE_LABEL[t.source]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
