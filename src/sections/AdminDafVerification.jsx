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
// "2026-12-07" -> "Mon 7 Dec 2026" (the schedule's dates are Indian dates)
const day = (iso) => (iso ? new Date(`${iso}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');

// A roll number checked against UPSC's interview schedule.
function ScheduleMatch({ item }) {
  const s = item.schedule || {};
  if (s.found) {
    return (
      <p className="text-xs mt-1 font-semibold text-brand">
        Roll {item.rollNo} → {s.name} · {day(s.date)} · {s.session} (report {s.reportingTime})
      </p>
    );
  }
  if (s.noRoll) return <p className="text-xs mt-1 text-text-tertiary">Verified without a roll number: this student sees no interview date.</p>;
  if (!s.loaded) return <p className="text-xs mt-1 text-text-tertiary">Roll {item.rollNo} · upload UPSC’s interview schedule to check it.</p>;
  return <p className="text-xs mt-1 font-semibold text-status-danger-text">⚠ Roll {item.rollNo} is not in the interview schedule — check this DAF carefully.</p>;
}

const fullRoll = (v) => (v.length === 6 ? `0${v}` : v); // a leading zero left off

// A waiting upload's roll number: read from the DAF or typed by the student, for the admin to check against
// the file and correct. Verifying saves it, and the student can never change it afterwards.
function RollCheck({ item, roll, onChange }) {
  const r = fullRoll(roll);
  const known = r === item.rollNo; // the list already has its schedule match
  const [lookup, setLookup] = useState({ roll: '', data: null });
  useEffect(() => {
    if (known || r.length !== 7) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/admin/schedule/roll/${r}`).then((d) => { if (!cancelled) setLookup({ roll: r, data: d }); }).catch(() => {});
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [r, known]);
  const schedule = known ? item.schedule : lookup.roll === r ? lookup.data : null;
  let note;
  if (!roll) note = <p className="text-xs mt-1 font-semibold text-status-danger-text">No roll number — type it from the DAF before verifying.</p>;
  else if (r.length !== 7) note = <p className="text-xs mt-1 text-text-tertiary">A roll number has 7 digits.</p>;
  else if (!schedule) note = <p className="text-xs mt-1 text-text-tertiary">Checking…</p>;
  else note = <ScheduleMatch item={{ rollNo: r, schedule }} />;
  return (
    <div className="mt-2">
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary">
        Roll no.
        <input value={roll} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 7))} inputMode="numeric" placeholder="7 digits" maxLength={7}
          className="w-28 h-8 rounded-lg border border-border-default bg-surface px-2 text-sm tabular-nums text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-primary" />
      </label>
      {note}
    </div>
  );
}

// UPSC's interview schedule: what is loaded, and uploading the PDF UPSC publishes (a new one replaces it).
function ScheduleBox({ info, onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setMsg('');
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const res = await fetch('/api/interview/admin/schedule', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status}).`);
      setMsg(`Loaded ${data.rows.toLocaleString('en-IN')} candidates.`);
      onUploaded();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-6 bg-surface border border-border-default rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text-primary">UPSC interview schedule</p>
        <p className="text-xs text-text-tertiary mt-0.5">
          {info?.count
            ? `${info.count.toLocaleString('en-IN')} candidates · ${day(info.firstDate)} – ${day(info.lastDate)} · uploaded ${when(info.uploadedAt)}${info.fileName ? ` (${info.fileName})` : ''}`
            : 'Not uploaded yet. Upload the schedule PDF UPSC publishes to check roll numbers and show students their interview date.'}
        </p>
        {msg && <p className="text-xs mt-1 font-semibold text-text-secondary">{msg}</p>}
      </div>
      <label className={`px-4 py-2 rounded-xl border border-border-default text-sm font-semibold cursor-pointer hover:bg-sunken shrink-0 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
        {busy ? 'Reading…' : info?.count ? 'Upload a new schedule PDF' : 'Upload schedule PDF'}
        <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
    </div>
  );
}
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
  const [rolls, setRolls] = useState({}); // roll numbers the admin typed, by upload

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
    } else {
      // The roll number decides whose interview date the student sees, and they can't change it later.
      const roll = fullRoll(rolls[item.id] ?? item.rollNo ?? '');
      if (roll && roll.length !== 7) { window.alert('A roll number has 7 digits.'); return; }
      const who = item.userName || item.userEmail;
      const unlocks = item.kind === 'change' ? 'Their new DAF replaces the old one.' : 'Their practice, the full question bank and 15 free credits unlock.';
      const ok = window.confirm(roll
        ? `Verify ${who}'s DAF with roll number ${roll}? ${unlocks}\n\nThe student can't change the roll number later.`
        : `Verify ${who}'s DAF WITHOUT a roll number? ${unlocks}\n\nThey won't see their interview date, and they can't add a roll number later.`);
      if (!ok) return;
      body = { rollNo: roll };
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
  }, [rolls]);

  const counts = data?.counts || {};
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-display text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">DAF Checks</h1>
      <p className="mt-2 text-sm text-text-secondary max-w-2xl">Students upload their DAF in Abhivyakti (Interview Prep). Verify a genuine DAF to unlock their practice, the full question bank, 15 free credits and credit purchases; reject anything else with a reason. The file is deleted once you decide. A “Paid change” is a verified student’s new DAF (₹50): verifying it replaces their old details. Check the roll number against the DAF before verifying: it decides which interview date the student sees, and they can’t change it afterwards.</p>

      <ScheduleBox info={data?.schedule} onUploaded={() => setTick((k) => k + 1)} />

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
              <p className="font-semibold text-text-primary">
                {item.userName || '—'} <span className="font-normal text-text-tertiary">· {item.userEmail}</span>
                {item.kind === 'change' && <span className="ml-2 align-middle inline-flex px-2 py-0.5 rounded-full bg-accent-soft-bg border border-accent-soft-border text-brand text-[10px] font-extrabold uppercase tracking-wider">Paid change</span>}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Uploaded {when(item.createdAt)}{item.hasFile ? ` · ${item.fileName} · ${size(item.size)}` : ''}
                {item.reviewedAt ? ` · ${item.status} ${when(item.reviewedAt)}${item.reviewedBy ? ` by ${item.reviewedBy}` : ''}` : ''}
              </p>
              {item.status === 'pending' && (
                <RollCheck item={item} roll={rolls[item.id] ?? item.rollNo ?? ''} onChange={(v) => setRolls((x) => ({ ...x, [item.id]: v }))} />
              )}
              {item.status === 'verified' && <ScheduleMatch item={item} />}
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
