import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import PdfAnswerViewer from '../components/PdfAnswerViewer';

// ---------------------------------------------------------------------------
// Admin: "Value addition" for one topic (Manage / Publish → ➕ Value addition).
// Each entry = a title + optional notes + optional PDF. Students open them from the
// "Value addition" tab of the Related PYQs drawer. Unpublished entries stay hidden.
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
  'w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-lg px-2 py-1 text-[11px] focus:outline-none';

const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function ValueAdditionManager({ topicId, topicName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(null); // entry id, or 'new'
  const [previewId, setPreviewId] = useState(null);

  const load = useCallback(async () => {
    const { ok, data } = await api(`/api/toppers-copy/admin/${topicId}/value-additions`);
    if (!ok) throw new Error(data.error || 'Failed to load value additions');
    setItems(data.valueAdditions || []);
  }, [topicId]);

  useEffect(() => {
    load().catch((e) => setMsg(e.message)).finally(() => setLoading(false));
  }, [load]);

  const patch = async (item, fields) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    const { ok, data } = await api(`/api/toppers-copy/admin/value-additions/${item._id}`, { method: 'PATCH', body: fd });
    if (!ok) { setMsg(data.error || 'Save failed'); return null; }
    setItems((xs) => xs.map((x) => (x._id === item._id ? data.valueAddition : x)));
    return data.valueAddition;
  };

  const move = async (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    await Promise.all(next.map((x, i) => (x.order === i ? null : patch(x, { order: i }))));
  };

  const remove = async (item) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    const { ok, data } = await api(`/api/toppers-copy/admin/value-additions/${item._id}`, { method: 'DELETE' });
    if (!ok) return setMsg(data.error || 'Delete failed');
    setItems((xs) => xs.filter((x) => x._id !== item._id));
  };

  if (loading) return <div className="px-4 py-4"><LoadingSpinner text="Loading value additions…" /></div>;

  return (
    <div className="px-4 py-4 bg-sunken border-t border-border-default">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-xs font-extrabold text-text-primary flex-grow">
          ➕ Value addition — {topicName}
          <span className="ml-2 font-semibold text-text-tertiary">{items.filter((x) => x.published).length}/{items.length} published</span>
        </p>
        <button className={btnPrimary} disabled={editing === 'new'} onClick={() => setEditing('new')}>+ Add</button>
        <button className={btnGhost} onClick={onClose}>Close</button>
      </div>
      {msg && <p className="text-[11px] font-semibold text-status-info-text mb-2">{msg}</p>}

      {editing === 'new' && (
        <EntryForm
          topicId={topicId}
          onCancel={() => setEditing(null)}
          onSaved={(v) => { setItems((xs) => [...xs, v]); setEditing(null); setMsg('Added.'); }}
          onError={setMsg}
        />
      )}

      {!items.length && editing !== 'new' && (
        <p className="text-[11px] text-text-tertiary italic">No value addition for this topic yet. Add notes, a PDF, or both.</p>
      )}

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item._id} className="bg-surface border border-border-default rounded-xl overflow-hidden">
            <div className="px-3 py-2 flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <button className="text-[10px] text-text-tertiary hover:text-text-primary cursor-pointer disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button className="text-[10px] text-text-tertiary hover:text-text-primary cursor-pointer disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)}>▼</button>
              </div>
              <div className="flex-grow min-w-[200px]">
                <p className="text-[12px] font-bold text-text-primary">{item.title}</p>
                <p className="text-[10px] text-text-tertiary">
                  {item.hasPdf ? `📄 ${item.pdfName || 'PDF'}${item.pdfSize ? ` · ${fmtSize(item.pdfSize)}` : ''}` : 'No PDF'}
                  {item.body?.trim() ? ' · has notes' : ''}
                </p>
              </div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-text-secondary cursor-pointer">
                <input type="checkbox" checked={item.published} onChange={(e) => patch(item, { published: e.target.checked })} />
                Published
              </label>
              {item.hasPdf && (
                <button className={previewId === item._id ? btnPrimary : btnGhost} onClick={() => setPreviewId((c) => (c === item._id ? null : item._id))}>
                  {previewId === item._id ? 'Hide PDF' : 'Preview PDF'}
                </button>
              )}
              <button className={editing === item._id ? btnPrimary : btnGhost} onClick={() => setEditing((c) => (c === item._id ? null : item._id))}>
                {editing === item._id ? 'Cancel edit' : 'Edit'}
              </button>
              <button className="text-[11px] font-bold text-status-danger-text cursor-pointer px-1" onClick={() => remove(item)}>Delete</button>
            </div>
            {editing === item._id && (
              <EntryForm
                item={item}
                onCancel={() => setEditing(null)}
                onSaved={(v) => { setItems((xs) => xs.map((x) => (x._id === v._id ? v : x))); setEditing(null); setMsg('Saved.'); }}
                onError={setMsg}
              />
            )}
            {previewId === item._id && item.hasPdf && (
              <div className="relative h-[70vh] border-t border-border-default">
                <PdfAnswerViewer fileUrl={`/api/toppers-copy/value-additions/${item._id}/pdf`} token={token()} key={item.updatedAt} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Create (no `item`) or edit an entry. Sent as multipart so the PDF rides along.
function EntryForm({ topicId, item, onSaved, onCancel, onError }) {
  const [title, setTitle] = useState(item?.title || '');
  const [body, setBody] = useState(item?.body || '');
  const [published, setPublished] = useState(item ? item.published : true);
  const [file, setFile] = useState(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [saving, setSaving] = useState(false);

  const willHavePdf = !!file || (item?.hasPdf && !removePdf);
  const canSave = title.trim() && (body.trim() || willHavePdf) && !saving;

  const save = async () => {
    setSaving(true);
    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('body', body);
    fd.append('published', String(published));
    if (file) fd.append('pdf', file);
    else if (removePdf) fd.append('removePdf', 'true');
    const url = item
      ? `/api/toppers-copy/admin/value-additions/${item._id}`
      : `/api/toppers-copy/admin/${topicId}/value-additions`;
    const { ok, data } = await api(url, { method: item ? 'PATCH' : 'POST', body: fd });
    setSaving(false);
    if (!ok) return onError(data.error || 'Save failed');
    onSaved(data.valueAddition);
  };

  return (
    <div className="p-3 space-y-2 border-t border-border-default bg-surface">
      <input className={inputClass} placeholder="Title, e.g. Latest data — NFHS-6 highlights" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        className={`${inputClass} min-h-[110px] font-reading`}
        placeholder="Notes (optional) — facts, data, reports, quotes, examples. Blank lines separate paragraphs; lines starting with - become bullets."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-secondary">
        <label className="font-bold">
          {item?.hasPdf ? 'Replace PDF: ' : 'PDF (optional): '}
          <input type="file" accept="application/pdf" className="text-[11px]" onChange={(e) => { setFile(e.target.files?.[0] || null); setRemovePdf(false); }} />
        </label>
        {item?.hasPdf && !file && (
          <label className="flex items-center gap-1 font-bold text-status-danger-text cursor-pointer">
            <input type="checkbox" checked={removePdf} onChange={(e) => setRemovePdf(e.target.checked)} />
            Remove current PDF ({item.pdfName || 'PDF'})
          </label>
        )}
        <label className="flex items-center gap-1 font-bold cursor-pointer">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
      </div>
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={!canSave} onClick={save}>{saving ? (file ? 'Uploading…' : 'Saving…') : 'Save'}</button>
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
