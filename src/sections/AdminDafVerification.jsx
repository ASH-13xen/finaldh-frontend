// Admin -> DAF Checks: students' uploaded DAFs waiting for verification. Open the file, then Verify (the
// student's practice, 15 free AI uses and credit purchases unlock) or Reject with a reason (the student is
// asked to upload again). The file is deleted once reviewed.
import { useCallback, useEffect, useState } from 'react';

const api = async (path, { method = 'GET', body } = {}) => {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/interview${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status}).`);
  return data;
};

const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const size = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Viewer({ item, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let revoke = null;
    let cancelled = false;
    fetch(`/api/interview/admin/daf/${item.id}/file`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'Could not open the file.');
        return r.blob();
      })
      .then((b) => { if (cancelled) return; revoke = URL.createObjectURL(b); setUrl(revoke); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [item.id]);
  return (
    <div className="fixed inset-0 z-[120] bg-ink-950/70 backdrop-blur-sm p-3 md:p-8 flex" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative m-auto w-full max-w-5xl h-full bg-surface rounded-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border-default flex items-center justify-between gap-3">
          <p className="font-semibold text-text-primary truncate">{item.userName || item.userEmail} — {item.fileName}</p>
          <div className="flex items-center gap-2 shrink-0">
            {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand hover:underline">Open in a new tab</a>}
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border-default text-sm font-semibold cursor-pointer">Close</button>
          </div>
        </div>
        <div className="flex-1 bg-sunken flex items-center justify-center overflow-auto">
          {error && <p className="text-status-danger-text font-semibold">{error}</p>}
          {!error && !url && <p className="text-text-tertiary">Loading…</p>}
          {url && (item.mimeType === 'application/pdf'
            ? <iframe title="DAF" src={url} className="w-full h-full bg-white" />
            : <img src={url} alt="DAF" className="max-w-full max-h-full object-contain" />)}
        </div>
      </div>
    </div>
  );
}

export default function AdminDafVerification() {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api(`/admin/daf?status=${status}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError('');
        // Keeps the count on the navbar's "DAF Checks" link in step after a verify / reject.
        window.dispatchEvent(new CustomEvent('daf-pending', { detail: d.counts?.pending || 0 }));
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [status, tick]);

  const act = useCallback(async (item, kind) => {
    let body;
    if (kind === 'reject') {
      const reason = window.prompt(`Why can't ${item.userName || item.userEmail}'s DAF be verified? (The student sees this.)`, 'This file is not a DAF.');
      if (!reason) return;
      body = { reason };
    } else if (!window.confirm(`Verify ${item.userName || item.userEmail}'s DAF? Their practice and 15 free AI uses unlock.`)) {
      return;
    }
    setBusy(item.id);
    try {
      await api(`/admin/daf/${item.id}/${kind}`, { method: 'POST', body: body || {} });
      setTick((k) => k + 1);
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusy(null);
    }
  }, []);

  const counts = data?.counts || {};
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-display text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">DAF Checks</h1>
      <p className="mt-2 text-sm text-text-secondary max-w-2xl">Students upload their DAF in Interview Prep. Verify a genuine DAF to unlock their practice, 15 free AI uses and credit purchases; reject anything else with a reason. The file is deleted once you decide.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {['pending', 'verified', 'rejected'].map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border cursor-pointer ${status === s ? 'bg-brand text-text-on-accent border-brand' : 'border-border-default text-text-secondary hover:text-text-primary'}`}>
            {s === 'pending' ? 'Waiting' : s === 'verified' ? 'Verified' : 'Rejected'} <span className="opacity-70">{counts[s] || 0}</span>
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-status-danger-text font-semibold">{error}</p>}
      {!data && !error && <p className="mt-6 text-text-tertiary">Loading…</p>}
      {data && data.items.length === 0 && <p className="mt-8 text-text-tertiary">Nothing here.</p>}

      <ul className="mt-6 space-y-3">
        {(data?.items || []).map((item) => (
          <li key={item.id} className="bg-surface border border-border-default rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-primary">{item.userName || '—'} <span className="font-normal text-text-tertiary">· {item.userEmail}</span></p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Uploaded {when(item.createdAt)}{item.hasFile ? ` · ${item.fileName} · ${size(item.size)}` : ''}
                {item.reviewedAt ? ` · ${item.status} ${when(item.reviewedAt)}${item.reviewedBy ? ` by ${item.reviewedBy}` : ''}` : ''}
              </p>
              {item.reason && <p className="text-xs text-status-danger-text mt-1">Reason: {item.reason}</p>}
            </div>
            {item.status === 'pending' && (
              <div className="flex flex-wrap gap-2 shrink-0">
                <button type="button" onClick={() => setViewing(item)} className="px-4 py-2 rounded-xl border border-border-default text-sm font-semibold cursor-pointer hover:bg-sunken">View DAF</button>
                <button type="button" disabled={busy === item.id} onClick={() => act(item, 'verify')} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-text-on-accent text-sm font-bold cursor-pointer disabled:opacity-50">Verify</button>
                <button type="button" disabled={busy === item.id} onClick={() => act(item, 'reject')} className="px-4 py-2 rounded-xl border border-status-danger-text/40 text-status-danger-text text-sm font-bold cursor-pointer disabled:opacity-50">Reject</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {viewing && <Viewer item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
