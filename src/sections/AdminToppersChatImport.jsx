import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { AnalysisView } from './ToppersCopy';

// ---------------------------------------------------------------------------
// Admin: put a question's analysis on the site from a Claude CHAT session
// (claude.ai), with no API call (Manage / Publish → 💬 From Claude chat).
//   1. Download the question's answer pages + copy the prompt → paste both into Claude.
//   2. Paste Claude's reply, or upload it as .json / .txt / .md / .pdf.
//   3. Check → preview exactly as students will see it → Save.
// The server shapes it like an API analysis, so everything downstream (student view,
// PDF export) treats it the same.
// ---------------------------------------------------------------------------

const token = () => localStorage.getItem('token');
const api = async (url, opts = {}) => {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const btnGhost =
  'px-2.5 py-1 bg-surface border border-border-default hover:bg-surface-raised text-text-secondary rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary =
  'px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const inputClass =
  'w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-lg px-2 py-1.5 text-[11px] focus:outline-none';

const ACCEPT = '.json,.txt,.md,.pdf';

export default function ChatImportManager({ topicId, topicName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const { ok, data } = await api(`/api/toppers-copy/${topicId}`);
    if (!ok) throw new Error(data.error || 'Failed to load the topic');
    setQuestions(data.toppersCopy?.questions || []);
  }, [topicId]);

  useEffect(() => {
    load().catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [load]);

  return (
    <div className="px-4 py-4 bg-sunken border-t border-border-default space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-xs font-extrabold text-text-primary flex-grow">
          💬 From Claude chat — <span className="font-semibold">{topicName}</span>
        </p>
        <button className={btnGhost} onClick={onClose}>Close</button>
      </div>
      <p className="text-[11px] text-text-tertiary">
        For each question: download its answer pages and copy the prompt, give both to Claude in a chat, then paste the reply (or upload it as a .json, .txt, .md or .pdf file). Saving replaces the question&apos;s current analysis.
      </p>
      {err && <p className="text-[11px] font-semibold text-status-danger-text">{err}</p>}
      {loading ? <LoadingSpinner text="Loading questions…" /> : (
        <div className="divide-y divide-border-default bg-surface border border-border-default rounded-xl">
          {questions.length === 0 && <p className="p-3 text-[11px] text-text-tertiary italic">No questions in this topic.</p>}
          {questions.map((q, i) => (
            <div key={q._id} className="p-3">
              <div className="flex items-start gap-3">
                <p className="text-[11px] font-bold text-text-primary flex-grow">
                  Q{i + 1}. {q.questionText}
                  <span className="block mt-0.5 text-[10px] font-semibold text-text-tertiary">
                    {q.answers?.length || 0} topper answer(s) ·{' '}
                    {q.aiAnalysis?.generatedAt
                      ? `analysis: ${q.aiAnalysis.aiModel || 'AI'} · ${new Date(q.aiAnalysis.generatedAt).toLocaleDateString()}`
                      : 'no analysis yet'}
                  </span>
                </p>
                <button
                  className={openId === q._id ? btnPrimary : btnGhost}
                  onClick={() => setOpenId((cur) => (cur === q._id ? null : q._id))}
                >
                  {openId === q._id ? 'Close' : 'Import'}
                </button>
              </div>
              {openId === q._id && (
                <QuestionImport
                  topicId={topicId}
                  question={q}
                  qNo={i + 1}
                  onSaved={async () => { await load().catch(() => {}); setOpenId(null); }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionImport({ topicId, question, qNo, onSaved }) {
  const base = `/api/toppers-copy/admin/${topicId}/questions/${question._id}`;
  const [prompt, setPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('Claude chat (manual import)');
  const [preview, setPreview] = useState(null); // { aiAnalysis, warnings }
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ kind: '', text: '' });

  const say = (kind, t) => setMsg({ kind, text: t });

  const getPrompt = async () => {
    if (prompt) return prompt;
    const { ok, data } = await api(`${base}/chat-prompt`);
    if (!ok) throw new Error(data.error || 'Could not build the prompt');
    setPrompt(data.prompt);
    return data.prompt;
  };

  const copyPrompt = async () => {
    setBusy('prompt'); say('', '');
    try {
      const p = await getPrompt();
      try {
        await navigator.clipboard.writeText(p);
        say('ok', 'Prompt copied. Paste it into Claude together with the answer-pages PDF.');
      } catch {
        setShowPrompt(true);
        say('info', 'Could not copy automatically — select the prompt below and copy it.');
      }
    } catch (e) { say('err', e.message); } finally { setBusy(''); }
  };

  const downloadPages = async () => {
    setBusy('pages'); say('', '');
    try {
      const res = await fetch(`${base}/export-pages`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not export the pages');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `Q${qNo}-answer-pages.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { say('err', e.message); } finally { setBusy(''); }
  };

  const send = async (isPreview) => {
    const fd = new FormData();
    if (file) fd.append('file', file);
    else fd.append('text', text);
    fd.append('label', label);
    if (isPreview) fd.append('preview', '1');
    return api(`${base}/import-analysis`, { method: 'POST', body: fd });
  };

  const check = async () => {
    setBusy('check'); say('', ''); setPreview(null);
    try {
      const { ok, data } = await send(true);
      if (!ok) throw new Error(data.error || 'Could not read it');
      setPreview({ aiAnalysis: data.aiAnalysis, warnings: data.warnings || [] });
    } catch (e) { say('err', e.message); } finally { setBusy(''); }
  };

  const save = async () => {
    if (question.aiAnalysis?.generatedAt && !confirm('This question already has an analysis. Replace it with the imported one?')) return;
    setBusy('save'); say('', '');
    try {
      const { ok, data } = await send(false);
      if (!ok) throw new Error(data.error || 'Save failed');
      say('ok', 'Saved — students will see it once the topic is published.');
      await onSaved();
    } catch (e) { say('err', e.message); } finally { setBusy(''); }
  };

  const hasInput = !!file || !!text.trim();
  const msgClass = { err: 'text-status-danger-text', ok: 'text-status-success-text', info: 'text-status-info-text' }[msg.kind] || '';

  return (
    <div className="mt-3 space-y-3 border-t border-border-default pt-3">
      {/* Step 1 */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary mb-1.5">1 · Give Claude the question</p>
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} disabled={!!busy || !question.answers?.length} onClick={downloadPages}>
            {busy === 'pages' ? 'Preparing…' : '⬇ Answer pages PDF'}
          </button>
          <button className={btnGhost} disabled={!!busy} onClick={copyPrompt}>
            {busy === 'prompt' ? '…' : '📋 Copy prompt'}
          </button>
          <button className={btnGhost} disabled={!!busy} onClick={async () => { try { await getPrompt(); setShowPrompt((s) => !s); } catch (e) { say('err', e.message); } }}>
            {showPrompt ? 'Hide prompt' : 'Show prompt'}
          </button>
        </div>
        {showPrompt && prompt && (
          <textarea readOnly className={`${inputClass} mt-2 font-mono h-40`} value={prompt} onFocus={(e) => e.target.select()} />
        )}
      </div>

      {/* Step 2 */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary mb-1.5">2 · Paste Claude&apos;s reply or upload it</p>
        <textarea
          className={`${inputClass} font-mono h-40 disabled:opacity-50`}
          placeholder={'Paste the reply here — the JSON, with or without ```json fences or text around it.'}
          value={text}
          disabled={!!file}
          onChange={(e) => { setText(e.target.value); setPreview(null); }}
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <label className={btnGhost}>
            📎 {file ? 'Change file' : 'Or choose a file'}
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); e.target.value = ''; }}
            />
          </label>
          {file && (
            <span className="text-[11px] text-text-secondary">
              {file.name} <button className="ml-1 font-bold text-status-danger-text cursor-pointer" onClick={() => { setFile(null); setPreview(null); }}>✕</button>
            </span>
          )}
          <span className="text-[10px] text-text-tertiary">.json · .txt · .md · .pdf</span>
        </div>
        <div className="mt-2 max-w-xs">
          <p className="text-[10px] font-bold text-text-tertiary mb-1">Source label (admin only)</p>
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      {/* Step 3 */}
      <div className="flex flex-wrap items-center gap-2">
        <button className={btnGhost} disabled={!!busy || !hasInput} onClick={check}>
          {busy === 'check' ? 'Reading…' : '3 · Check & preview'}
        </button>
        <button className={btnPrimary} disabled={!!busy || !preview} onClick={save} title={preview ? '' : 'Check & preview first'}>
          {busy === 'save' ? 'Saving…' : 'Save to website'}
        </button>
        {msg.text && <span className={`text-[11px] font-semibold ${msgClass}`}>{msg.text}</span>}
      </div>

      {preview && (
        <div className="space-y-2">
          {preview.warnings.length > 0 ? (
            <ul className="text-[11px] text-status-warning-text bg-status-warning-bg rounded-lg px-3 py-2 list-disc list-inside">
              {preview.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          ) : (
            <p className="text-[11px] font-semibold text-status-success-text">All parts found — {preview.aiAnalysis?.modelAnswer?.totalWordCount ?? 0} words in the model answer.</p>
          )}
          <div className="bg-surface border border-border-default rounded-xl p-4 max-h-[70vh] overflow-y-auto">
            <AnalysisView analysis={preview.aiAnalysis} />
          </div>
        </div>
      )}
    </div>
  );
}
