import { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import TopicBody from '../components/economy/TopicBody';
import { blocksToText, textToBlocks } from '../lib/economyMarkup';
import {
  adminStatus, adminListTopics, adminUpdateTopic, adminAiExtras, adminUpdateTheme, adminImport, adminUploadSourcePdf, SOURCE_LABEL,
} from '../lib/economyApi';

// ---------------------------------------------------------------------------
// Admin → Economy Data. Load the parsed Master File, publish themes, link them to Question
// Bank PYQs, fix anything the parser got wrong, and add the "Real-world link" / "Beyond the
// book" extras (hand-written or AI-drafted, then published per topic).
// ---------------------------------------------------------------------------

const card = 'bg-surface border border-border-default rounded-2xl p-5';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-brand text-text-on-accent hover:bg-brand-hover`;
const btnGhost = `${btn} border border-border-default text-text-secondary hover:text-text-primary hover:border-brand`;
const input = 'w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand';

export default function AdminEconomyMaster() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('themes'); // themes | topics | setup

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
          {[['themes', 'Themes'], ['topics', 'Topics'], ['setup', 'Import & PDF']].map(([k, l]) => (
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
  return (
    <div className="space-y-2">
      {status.themes.map((t) => (
        <ThemeRow key={t.key} theme={t} banks={status.banks} open={editing === t.key} onToggle={() => setEditing(editing === t.key ? null : t.key)} onChanged={onChanged} />
      ))}
    </div>
  );
}

function ThemeRow({ theme: t, banks, open, onToggle, onChanged }) {
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
        <button disabled={busy} onClick={() => save({ isPublished: !t.isPublished })} className={t.isPublished ? `${btn} bg-status-success-bg text-status-success-text` : btnGhost}>
          {t.isPublished ? '● Published' : 'Publish'}
        </button>
        <button onClick={onToggle} className={btnGhost}>{open ? 'Close' : 'Edit'}</button>
      </div>
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
            <label className="text-[11px] font-bold uppercase text-text-tertiary">Real-world link · one per line</label>
            <textarea className={input} rows={5} value={facts} onChange={(e) => setFacts(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-text-tertiary">Beyond the book · “Label: text” per line</label>
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
