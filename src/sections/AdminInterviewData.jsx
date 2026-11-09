import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/mcq/Icon';
import { ActionButton, Chip, ErrorBanner, EmptyState, Modal } from '../components/mcq/ui';
import { ToastProvider, useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { Panel, Segmented, StatTile } from '../components/interview/ui';
import { iv, qs, errorMessage, cseLabel, ASKER_LABEL } from '../lib/interviewApi';

const inputCls = 'rounded-xl border border-border-default bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand/40';

function Overview({ data }) {
  const totals = data.years.reduce((a, y) => ({ t: a.t + y.transcripts, r: a.r + y.reviewed }), { t: 0, r: 0 });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon="book" label="Transcripts" value={data.corpus.transcripts.toLocaleString('en-IN')} hint={`${totals.r} reviewed`} />
        <StatTile icon="message" label="Questions" value={data.corpus.questions.toLocaleString('en-IN')} />
        <StatTile icon="layers" label="Families" value={data.corpus.families.toLocaleString('en-IN')} hint={`${data.corpus.repeatedFamilies.toLocaleString('en-IN')} asked 2+ times`} />
        <StatTile icon="mic" label="Mock interviews" value={data.sessions.total} hint={`${data.sessions.withAi} with AI`} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel className="p-5">
          <h3 className="text-sm font-bold text-text-primary mb-3">By year</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-text-tertiary"><th className="pb-2">Year</th><th className="pb-2">Parsed by</th><th className="pb-2 text-right">Transcripts</th><th className="pb-2 text-right">Reviewed</th><th className="pb-2 text-right">Hidden</th></tr></thead>
            <tbody>
              {data.years.map((y) => (
                <tr key={`${y.year}-${y.engine}`} className="border-t border-border-subtle">
                  <td className="py-2 font-semibold text-text-primary">{cseLabel(y.year)}</td>
                  <td className="py-2"><Chip tone={y.engine === 'gemini' ? 'brand' : 'neutral'}>{y.engine === 'gemini' ? 'Gemini' : 'Keyword parser'}</Chip></td>
                  <td className="py-2 text-right tabular-nums">{y.transcripts}</td>
                  <td className="py-2 text-right tabular-nums">{y.reviewed}</td>
                  <td className="py-2 text-right tabular-nums">{y.hidden}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-text-tertiary mt-3">Semantic search: {data.corpus.semantic ? 'on (embeddings loaded)' : 'off — run the embed step'} · {data.templates} reusable “{'{X}'}” templates</p>
        </Panel>
        <Panel className="p-5">
          <h3 className="text-sm font-bold text-text-primary mb-2">AI (Gemini)</h3>
          <p className="text-sm">
            {data.ai.available ? <span className="text-status-success-text font-semibold">Working</span> : data.ai.configured ? <span className="text-status-danger-text font-semibold">Key rejected</span> : <span className="text-text-tertiary font-semibold">No key set</span>}
            {data.ai.lastError && <span className="block text-xs text-text-tertiary mt-1 break-words">{data.ai.lastError}</span>}
          </p>
          <h3 className="text-sm font-bold text-text-primary mt-5 mb-2">Re-parsing with Gemini</h3>
          <p className="text-xs text-text-secondary leading-relaxed">Once GEMINI_API_KEY works, run from <code className="font-mono">backend/</code>:</p>
          <pre className="mt-2 rounded-xl bg-sunken border border-border-subtle p-3 text-xs font-mono text-text-secondary overflow-x-auto">{`node scripts/interview/pipeline.mjs parse --engine gemini
node scripts/interview/pipeline.mjs embed
node scripts/interview/pipeline.mjs build
node scripts/interview/pipeline.mjs seed`}</pre>
          <p className="text-xs text-status-warning-text mt-2">Seeding replaces the corpus, including corrections made on this screen.</p>
        </Panel>
      </div>
    </div>
  );
}

function TranscriptEditor({ id, onClose, onSaved }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    iv(`/admin/transcripts/${id}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const p = d.transcript.profile || {};
        setMeta({ board: p.board || '', optional: p.optional || '', homeState: p.homeState || '', hobbies: (p.hobbies || []).join(', '), keywords: (p.keywords || []).join(', '), reviewed: d.transcript.reviewed, hidden: d.transcript.hidden });
      })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); });
    return () => { cancelled = true; };
  }, [id, reload]);

  const saveMeta = async (patch = {}) => {
    try {
      await iv(`/admin/transcripts/${id}`, { method: 'PATCH', body: { ...meta, ...patch } });
      toast.success('Transcript saved.');
      setReload((k) => k + 1);
      onSaved?.();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const saveQuestion = async (q, patch) => {
    try {
      await iv(`/admin/questions/${q.id}`, { method: 'PATCH', body: patch });
      setData((d) => ({ ...d, questions: d.questions.map((x) => (x.id === q.id ? { ...x, ...patch } : x)) }));
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const splitOut = async (q) => {
    try {
      await iv(`/admin/questions/${q.id}/move`, { method: 'POST', body: { familyId: null } });
      toast.success('Moved into its own family.');
      setReload((k) => k + 1);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm p-3 sm:p-6 flex" onClick={onClose} role="dialog" aria-modal="true" aria-label="Review transcript">
      <div className="bg-page border border-border-default rounded-3xl w-full max-w-7xl mx-auto flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle">
          <h2 className="text-base font-bold text-text-primary">{data ? `${cseLabel(data.transcript.year)} · transcript #${data.transcript.seq} · pages ${data.transcript.pageStart}–${data.transcript.pageEnd}` : 'Loading…'}</h2>
          <div className="flex items-center gap-2">
            {meta && <ActionButton size="sm" tone={meta.reviewed ? 'secondary' : 'primary'} icon="check" onClick={() => saveMeta({ reviewed: !meta.reviewed })}>{meta.reviewed ? 'Mark not reviewed' : 'Mark reviewed'}</ActionButton>}
            <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-raised cursor-pointer" aria-label="Close"><Icon name="x" className="w-5 h-5" /></button>
          </div>
        </div>
        {error && <div className="p-5"><ErrorBanner>{error}</ErrorBanner></div>}
        {!data && !error && <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>}
        {data && meta && (
          <div className="flex-1 grid lg:grid-cols-2 min-h-0">
            <pre className="overflow-auto p-5 text-xs leading-relaxed font-mono text-text-secondary whitespace-pre-wrap border-r border-border-subtle bg-surface-raised">{data.transcript.rawText}</pre>
            <div className="overflow-auto p-5 space-y-5">
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="text-xs font-semibold text-text-tertiary">Board<input value={meta.board} onChange={(e) => setMeta({ ...meta, board: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
                <label className="text-xs font-semibold text-text-tertiary">Optional<input value={meta.optional} onChange={(e) => setMeta({ ...meta, optional: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
                <label className="text-xs font-semibold text-text-tertiary">Home state<input value={meta.homeState} onChange={(e) => setMeta({ ...meta, homeState: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
                <label className="text-xs font-semibold text-text-tertiary sm:col-span-3">Hobbies<input value={meta.hobbies} onChange={(e) => setMeta({ ...meta, hobbies: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
                <label className="text-xs font-semibold text-text-tertiary sm:col-span-3">DAF keywords<input value={meta.keywords} onChange={(e) => setMeta({ ...meta, keywords: e.target.value })} className={`${inputCls} w-full mt-1`} /></label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ActionButton size="sm" tone="primary" icon="save" onClick={() => saveMeta()}>Save details</ActionButton>
                <label className="inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={meta.hidden} onChange={(e) => saveMeta({ hidden: e.target.checked })} /> Hide this transcript (not a real transcript / duplicate)
                </label>
              </div>
              <ol className="space-y-2">
                {data.questions.map((q) => (
                  <li key={q.id} className={`rounded-2xl border px-3 py-2.5 ${q.hidden ? 'border-dashed border-border-default opacity-60' : 'border-border-subtle bg-surface'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-text-tertiary w-6">{q.order}</span>
                      <select value={q.asker} onChange={(e) => saveQuestion(q, { asker: e.target.value })} className={`${inputCls} py-1 text-xs`} aria-label="Asked by">
                        {data.vocab.askers.map((a) => <option key={a} value={a}>{ASKER_LABEL[a] || a}</option>)}
                      </select>
                      <label className="inline-flex items-center gap-1 text-xs text-text-secondary"><input type="checkbox" checked={q.followUp} onChange={(e) => saveQuestion(q, { followUp: e.target.checked })} /> follow-up</label>
                      <label className="inline-flex items-center gap-1 text-xs text-text-secondary"><input type="checkbox" checked={q.hidden} onChange={(e) => saveQuestion(q, { hidden: e.target.checked })} /> hide</label>
                      {q.topics.map((t) => <Chip key={t}>{data.vocab.topics[t] || t}</Chip>)}
                      {q.hooks.map((h, i) => <Chip key={i} tone="brand">{h.type}{h.value ? `: ${h.value}` : ''}</Chip>)}
                    </div>
                    <textarea
                      defaultValue={q.text}
                      onBlur={(e) => { if (e.target.value.trim() && e.target.value !== q.text) saveQuestion(q, { text: e.target.value }); }}
                      rows={Math.min(4, Math.ceil(q.text.length / 90))}
                      className={`${inputCls} w-full mt-2 resize-y`}
                      aria-label="Question text"
                    />
                    {q.note && <p className="text-xs text-text-tertiary mt-1">Note: {q.note}</p>}
                    {q.family && (
                      <p className="text-xs text-text-tertiary mt-1 flex flex-wrap items-center gap-2">
                        Family: “{q.family.text}” · {q.family.timesAsked}×
                        {q.family.timesAsked > 1 && <button onClick={() => splitOut(q)} className="font-bold text-brand hover:underline cursor-pointer">Not the same question — split out</button>}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TranscriptsTab() {
  const [filters, setFilters] = useState({ year: '', reviewed: '', q: '', few: '', page: 1 });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    iv(`/admin/transcripts${qs(filters)}`).then((d) => { if (!cancelled) { setData(d); setError(''); } }).catch((err) => { if (!cancelled) setError(errorMessage(err)); });
    return () => { cancelled = true; };
  }, [filters, reload]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v, page: k === 'page' ? v : 1 }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={filters.year} onChange={(e) => setF('year', e.target.value)} className={inputCls} aria-label="Year">
          <option value="">All years</option>
          {[2024, 2023, 2022, 2021, 2020].map((y) => <option key={y} value={y}>{cseLabel(y)}</option>)}
        </select>
        <select value={filters.reviewed} onChange={(e) => setF('reviewed', e.target.value)} className={inputCls} aria-label="Reviewed">
          <option value="">Reviewed or not</option>
          <option value="no">Not reviewed</option>
          <option value="yes">Reviewed</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={filters.few === 'yes'} onChange={(e) => setF('few', e.target.checked ? 'yes' : '')} /> Few questions (likely mis-split)</label>
        <input value={filters.q} onChange={(e) => setF('q', e.target.value)} placeholder="Board, keyword, optional…" className={`${inputCls} flex-1 min-w-[12rem]`} aria-label="Search transcripts" />
      </div>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {!data ? <LoadingSpinner /> : data.items.length === 0 ? <EmptyState title="No transcripts match" /> : (
        <Panel className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-left text-xs text-text-tertiary">
              <tr><th className="px-4 py-2.5">Year</th><th className="px-4 py-2.5">Board</th><th className="px-4 py-2.5 hidden md:table-cell">DAF</th><th className="px-4 py-2.5 text-right">Questions</th><th className="px-4 py-2.5">Status</th></tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id} onClick={() => setOpenId(t.id)} className="border-t border-border-subtle hover:bg-surface-raised cursor-pointer">
                  <td className="px-4 py-2.5 font-semibold text-text-primary whitespace-nowrap">{cseLabel(t.year)} <span className="text-text-tertiary font-normal">#{t.seq}</span></td>
                  <td className="px-4 py-2.5 text-text-secondary">{t.board || <span className="text-text-tertiary">—</span>}</td>
                  <td className="px-4 py-2.5 text-text-tertiary hidden md:table-cell">{[t.optional, t.homeState, ...t.keywords].filter(Boolean).slice(0, 5).join(' · ')}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{t.questionCount}</td>
                  <td className="px-4 py-2.5">{t.hidden ? <Chip>Hidden</Chip> : t.reviewed ? <Chip tone="success">Reviewed</Chip> : <Chip tone="warning">To review</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle text-sm text-text-secondary">
            <span>{data.total.toLocaleString('en-IN')} transcripts</span>
            <span className="flex items-center gap-2">
              <ActionButton size="sm" icon="chevronLeft" disabled={filters.page <= 1} onClick={() => setF('page', filters.page - 1)}>Prev</ActionButton>
              <span className="tabular-nums">{filters.page} / {Math.max(1, Math.ceil(data.total / data.limit))}</span>
              <ActionButton size="sm" disabled={filters.page * data.limit >= data.total} onClick={() => setF('page', filters.page + 1)}>Next</ActionButton>
            </span>
          </div>
        </Panel>
      )}
      {openId && <TranscriptEditor id={openId} onClose={() => setOpenId(null)} onSaved={() => setReload((k) => k + 1)} />}
    </>
  );
}

function FamiliesTab() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState(null);
  const [editing, setEditing] = useState(null);

  const search = useCallback(async (text) => {
    if (text.trim().length < 2) { setItems([]); return; }
    try { setItems((await iv(`/admin/families${qs({ q: text })}`)).items); } catch (err) { toast.error(errorMessage(err)); }
  }, [toast]);

  useEffect(() => { const t = setTimeout(() => search(q), 300); return () => clearTimeout(t); }, [q, search]);

  const merge = async () => {
    try {
      await iv('/admin/families/merge', { method: 'POST', body: { targetId: target, sourceIds: selected.filter((id) => id !== target) } });
      toast.success('Merged.');
      setSelected([]);
      setTarget(null);
      search(q);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const saveFamily = async (id, patch) => {
    try {
      await iv(`/admin/families/${id}`, { method: 'PATCH', body: patch });
      toast.success('Saved.');
      setEditing(null);
      search(q);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <>
      <p className="text-sm text-text-secondary mb-3">Find questions that are really the same and merge them, so “asked N times” is right. Tick the ones to merge, pick which wording to keep, then merge.</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search question wording, e.g. “net neutrality”" className={`${inputCls} w-full`} aria-label="Search families" />
      {selected.length >= 2 && (
        <div className="sticky top-20 z-10 mt-3 rounded-2xl border border-brand bg-accent-soft-bg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-text-primary">{selected.length} selected · {target ? 'keeping the one marked “keep”' : 'choose which to keep'}</span>
          <ActionButton size="sm" tone="primary" icon="layers" disabled={!target} onClick={merge}>Merge into one</ActionButton>
        </div>
      )}
      <ul className="mt-4 space-y-2">
        {items.map((f) => {
          const on = selected.includes(f.id);
          return (
            <li key={f.id} className={`rounded-2xl border px-4 py-3 flex items-start gap-3 ${on ? 'border-brand bg-surface' : 'border-border-subtle bg-surface'} ${f.hidden ? 'opacity-60' : ''}`}>
              <input type="checkbox" checked={on} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id)))} className="mt-1" aria-label="Select" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">{f.text}</p>
                <p className="text-xs text-text-tertiary mt-1">{f.timesAsked}× · {f.years.join(', ')}{f.hidden ? ' · hidden' : ''}</p>
              </div>
              {on && (
                <label className="inline-flex items-center gap-1 text-xs font-semibold text-brand whitespace-nowrap"><input type="radio" name="target" checked={target === f.id} onChange={() => setTarget(f.id)} /> keep</label>
              )}
              <button onClick={() => setEditing(f)} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-raised cursor-pointer" aria-label="Edit"><Icon name="edit" className="w-4 h-4" /></button>
            </li>
          );
        })}
      </ul>
      {editing && (
        <Modal
          title="Edit question family"
          onClose={() => setEditing(null)}
          footer={<>
            <ActionButton tone="danger" onClick={() => saveFamily(editing.id, { hidden: !editing.hidden })}>{editing.hidden ? 'Unhide' : 'Hide from the bank'}</ActionButton>
            <ActionButton tone="primary" icon="save" onClick={() => saveFamily(editing.id, { text: editing.text })}>Save wording</ActionButton>
          </>}
        >
          <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={3} className={`${inputCls} w-full mb-3`} aria-label="Wording shown in the bank" />
        </Modal>
      )}
    </>
  );
}

function Screen() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    iv('/admin/overview').then((d) => { if (!cancelled) setOverview(d); }).catch((err) => { if (!cancelled) setError(errorMessage(err)); });
    return () => { cancelled = true; };
  }, [tab]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-default pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">Interview Data</h1>
          <p className="text-sm text-text-secondary mt-2 max-w-2xl">The transcript library behind the Mock Interview section. Review transcripts the parser split badly, fix boards, and merge duplicate questions.</p>
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Overview' }, { value: 'transcripts', label: 'Transcripts' }, { value: 'families', label: 'Questions' }]} ariaLabel="Section" />
      </div>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {tab === 'overview' && (overview ? <Overview data={overview} /> : !error && <LoadingSpinner text="Loading..." />)}
      {tab === 'transcripts' && <TranscriptsTab />}
      {tab === 'families' && <FamiliesTab />}
    </div>
  );
}

export default function AdminInterviewData() {
  return <ToastProvider><Screen /></ToastProvider>;
}
