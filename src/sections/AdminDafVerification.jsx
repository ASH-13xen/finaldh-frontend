// Admin -> DAF Checks: students' uploaded DAFs waiting for verification. Open the file, then Verify (the
// student's practice, 15 free AI uses and credit purchases unlock) or Reject with a reason (the student is
// asked to send it again). Files stay viewable after review; Delete removes an entry (a waiting one can be sent
// again).
import { Fragment, useCallback, useEffect, useState } from 'react';

const api = async (path, { method = 'GET', body } = {}) => {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/interview${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status}).`);
  return data;
};

// Where the Gemini key's billing is managed (credits, the monthly spending cap).
const AI_SPEND_URL = 'https://ai.studio/spend';

// "Redo with AI": re-reads an upload AI couldn't read when it was sent. { ok, aiOff, data }.
const redoRead = async (item) => {
  const res = await fetch(`/api/interview/admin/daf/${item.id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
  return { ok: res.ok, aiOff: res.status === 503, data: await res.json().catch(() => null) };
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

// A DAF filled in by hand: what the student typed, for the admin to check (there is no DAF file).
const FORM_FIELDS = [
  ['homeState', 'Home state'], ['homeDistrict', 'Home district'], ['hometown', 'Town or city'], ['education', 'Education'],
  ['work', 'Work'], ['optional', 'Optional subject'], ['hobbies', 'Hobbies'], ['achievements', 'Achievements'],
  ['servicePreference', 'Service preference'], ['familyBackground', 'Family background'], ['languages', 'Languages'], ['otherNotes', 'Other notes']
];
const lines = (v) => (Array.isArray(v)
  ? v.map((x) => (x && typeof x === 'object' ? Object.values(x).filter(Boolean).join(' · ') : String(x || ''))).filter(Boolean)
  : (v ? [String(v)] : []));

function FormDetails({ item, onClose }) {
  const rows = FORM_FIELDS.map(([k, label]) => [label, lines(item.fields?.[k])]).filter(([, v]) => v.length);
  return (
    <div className="fixed inset-0 z-[120] bg-ink-950/70 backdrop-blur-sm p-3 md:p-8 flex" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative m-auto w-full max-w-2xl max-h-full bg-surface rounded-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border-default flex items-center justify-between gap-3">
          <p className="font-semibold text-text-primary truncate">{item.userName || item.userEmail} — DAF filled in by hand</p>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border-default text-sm font-semibold cursor-pointer shrink-0">Close</button>
        </div>
        <div className="overflow-auto px-5 py-4">
          <p className="text-xs text-text-tertiary mb-4">There is no DAF file: check these details{item.rollNo ? ', and the roll number against its proof' : ''}.</p>
          <dl className="space-y-3">
            <div className="grid grid-cols-[9rem_1fr] gap-3 text-sm">
              <dt className="font-semibold text-text-secondary">Roll number</dt>
              <dd className="text-text-primary">{item.rollNo || <span className="text-text-tertiary">Not given</span>}</dd>
            </div>
            {rows.map(([label, v]) => (
              <div key={label} className="grid grid-cols-[9rem_1fr] gap-3 text-sm">
                <dt className="font-semibold text-text-secondary">{label}</dt>
                <dd className="text-text-primary">{v.map((x, i) => <p key={i}>{x}</p>)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

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

// What AI read from an upload, collapsed by default so the list stays short. Fields AI wasn't sure of are
// marked. Students never edit their DAF, so an admin corrects a missed or misread entry here (before or after
// verifying) - or types the details in from the file when AI couldn't read it at all.
const TEXT_FIELDS = [['homeState', 'Home state'], ['homeDistrict', 'Home district'], ['hometown', 'Hometown'], ['optional', 'Optional subject'], ['familyBackground', 'Family (parents’ occupations)']];
const LIST_FIELDS = [['hobbies', 'Hobbies'], ['achievements', 'Achievements / ECA'], ['servicePreference', 'Service preferences'], ['languages', 'Languages']];
const textLines = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
const parts = (l, n) => { const p = l.split('|').map((x) => x.trim()); return Array.from({ length: n }, (_, i) => p[i] || ''); };
const eduText = (list) => (list || []).map((e) => [e.degree, e.discipline, e.institution, e.year].map((x) => x || '').join(' | ')).join('\n');
const workText = (list) => (list || []).map((w) => [w.role, w.organization, w.duration].map((x) => x || '').join(' | ')).join('\n');

function ReadDetails({ item, onSaved }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const f = item.fields || {};
  const unsure = new Set(item.unsure || []);
  const rows = [
    ['homeState', 'Home state', f.homeState],
    ['homeDistrict', 'Home district', f.homeDistrict],
    ['hometown', 'Hometown', f.hometown],
    ['education', 'Education', (f.education || []).map((e) => [[e.degree, e.discipline].filter(Boolean).join(', '), e.institution, e.year].filter(Boolean).join(' · ')).join('; ')],
    ['work', 'Work', (f.work || []).map((w) => [w.role, w.organization, w.duration].filter(Boolean).join(' · ')).join('; ')],
    ['optional', 'Optional subject', f.optional],
    ['hobbies', 'Hobbies', (f.hobbies || []).join('; ')],
    ['achievements', 'Achievements / ECA', (f.achievements || []).join('; ')],
    ['servicePreference', 'Service preferences', (f.servicePreference || []).join(', ')],
    ['familyBackground', 'Family', f.familyBackground],
    ['languages', 'Languages', (f.languages || []).join(', ')],
    ['rollNo', 'Roll number (read)', f.rollNo]
  ].filter(([, , v]) => v);
  const edit = () => setDraft({
    ...Object.fromEntries(TEXT_FIELDS.map(([k]) => [k, f[k] || ''])),
    education: eduText(f.education),
    work: workText(f.work),
    ...Object.fromEntries(LIST_FIELDS.map(([k]) => [k, (f[k] || []).join('\n')]))
  });
  const save = async () => {
    const fields = {
      ...Object.fromEntries(TEXT_FIELDS.map(([k]) => [k, draft[k]])),
      education: textLines(draft.education).map((l) => { const [degree, discipline, institution, year] = parts(l, 4); return { degree, discipline, institution, year }; }),
      work: textLines(draft.work).map((l) => { const [role, organization, duration] = parts(l, 3); return { role, organization, duration }; }),
      ...Object.fromEntries(LIST_FIELDS.map(([k]) => [k, textLines(draft[k])]))
    };
    setSaving(true);
    try {
      await api(`/admin/daf/${item.id}/fields`, { method: 'PUT', body: { fields } });
      setDraft(null);
      onSaved();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setSaving(false);
    }
  };
  const input = 'w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-text-primary';
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-xs font-semibold text-brand hover:underline cursor-pointer">
        {open ? '▾' : '▸'} What AI read{unsure.size ? ` · ${unsure.size} unsure` : ''}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-border-default bg-sunken/40 px-4 py-3 text-sm">
          {!draft ? (
            <>
              {rows.length ? (
                <dl className="grid sm:grid-cols-[11rem_1fr] gap-x-4 gap-y-1.5">
                  {rows.map(([k, label, value]) => (
                    <Fragment key={k}>
                      <dt className={unsure.has(k) ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-text-tertiary'}>{label}{unsure.has(k) ? ' · AI unsure' : ''}</dt>
                      <dd className={`text-text-primary break-words ${unsure.has(k) ? 'rounded bg-amber-100 dark:bg-amber-400/15 px-1' : ''}`}>{value}</dd>
                    </Fragment>
                  ))}
                </dl>
              ) : <p className="text-text-tertiary">Nothing has been read from this DAF yet.</p>}
              {item.status !== 'rejected' && (
                <button type="button" onClick={edit} className="mt-3 px-3 py-1.5 rounded-lg border border-border-default text-xs font-semibold cursor-pointer hover:bg-sunken">
                  {rows.length ? 'Correct details' : 'Type in the details from the file'}
                </button>
              )}
            </>
          ) : (
            <div className="grid gap-2.5">
              {TEXT_FIELDS.map(([k, label]) => (
                <label key={k} className="grid gap-0.5">
                  <span className={`text-xs ${unsure.has(k) ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-text-tertiary'}`}>{label}{unsure.has(k) ? ' · AI unsure' : ''}</span>
                  <input value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} className={input} />
                </label>
              ))}
              {[['education', 'Education — one per line: degree | subject | institution | year'], ['work', 'Work — one per line: role | organisation | duration'], ...LIST_FIELDS.map(([k, l]) => [k, `${l} — one per line`])].map(([k, label]) => (
                <label key={k} className="grid gap-0.5">
                  <span className={`text-xs ${unsure.has(k) ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-text-tertiary'}`}>{label}{unsure.has(k) ? ' · AI unsure' : ''}</span>
                  <textarea rows={3} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} className={input} />
                </label>
              ))}
              <p className="text-xs text-text-tertiary">{item.kind === 'change' && item.status === 'pending' ? 'These replace the student’s details when you verify this DAF.' : 'These become the student’s details now.'}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving} onClick={save} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-text-on-accent text-sm font-bold cursor-pointer disabled:opacity-50">{saving ? 'Saving…' : 'Save details'}</button>
                <button type="button" disabled={saving} onClick={() => setDraft(null)} className="px-4 py-2 rounded-xl border border-border-default text-sm font-semibold cursor-pointer hover:bg-sunken">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDafVerification() {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [details, setDetails] = useState(null); // a filled-in DAF's details
  const [tick, setTick] = useState(0);
  const [rolls, setRolls] = useState({}); // roll numbers the admin typed, by upload
  const [note, setNote] = useState(''); // what the last Redo with AI did
  const [redoingAll, setRedoingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/admin/daf?status=${status}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError('');
        // Keeps the count on the navbar's "DAF Checks" link in step after a verify / reject.
        window.dispatchEvent(new CustomEvent('daf-pending', { detail: d.counts?.pending || 0 }));
        // ...and the AI warning every admin page shows (AI off / DAFs waiting to be read).
        window.dispatchEvent(new CustomEvent('daf-ai', { detail: { unread: d.counts?.unread || 0, ai: d.ai || null } }));
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [status, tick]);

  // Deleting an entry: a waiting one is undone (the student can send it again); a reviewed one leaves the
  // student's verification as it is.
  const remove = useCallback(async (item) => {
    const who = item.userName || item.userEmail;
    const what = item.kind === 'roll' ? 'roll number request' : item.kind === 'change' ? 'DAF change' : 'DAF';
    const question = item.status === 'pending'
      ? `Delete ${who}'s waiting ${what}? It is removed with its file, and the student can send it again.`
      : `Delete this ${item.status} ${what} of ${who}? Only this record and its file are removed: the student stays ${item.status === 'verified' ? 'verified' : 'as they are'}.`;
    if (!window.confirm(question)) return;
    setBusy(item.id);
    try {
      await api(`/admin/daf/${item.id}`, { method: 'DELETE' });
      setTick((k) => k + 1);
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusy(null);
    }
  }, []);

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
      let question;
      if (item.kind === 'roll') {
        // A verified student adding a missing roll number with proof.
        if (!roll) { window.alert('Enter the roll number shown on the proof to approve it.'); return; }
        question = `Approve roll number ${roll} for ${who}? Their interview date and countdown show on their Home.\n\nThe student can't change it later.`;
      } else {
        const unlocks = item.kind === 'change' ? 'Their new DAF replaces the old one.' : 'Their practice, the full question bank and 15 free credits unlock.';
        question = roll
          ? `Verify ${who}'s DAF with roll number ${roll}? ${unlocks}\n\nThe student can't change the roll number later.`
          : `Verify ${who}'s DAF WITHOUT a roll number? ${unlocks}\n\nThey won't see their interview date until they send their roll number with proof (free), which you check here.`;
      }
      if (!window.confirm(question)) return;
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

  // Re-read one flagged upload with AI (once AI works again, say after adding credits).
  const redo = useCallback(async (item) => {
    setBusy(item.id);
    setNote('');
    try {
      const r = await redoRead(item);
      if (r.ok) {
        const roll = r.data?.rollNo && item.status === 'pending' ? ` Roll number read: ${r.data.rollNo} — check it against the DAF before verifying.` : '';
        setNote(`Read ${item.userName || item.userEmail}’s DAF: ${r.data?.applied ? 'their details are in place, for them to check once.' : 'done (they had already saved their details, so nothing was changed).'}${roll}`);
      } else if (r.aiOff) {
        setNote(r.data?.error || 'AI is still off.');
      } else {
        window.alert(r.data?.error || 'Could not read that DAF.');
      }
    } finally {
      setBusy(null);
      setTick((k) => k + 1);
    }
  }, []);

  // Re-read every flagged upload, one by one; stops if AI is still off.
  const redoAll = useCallback(async () => {
    setRedoingAll(true);
    setNote('');
    let done = 0;
    let failed = 0;
    try {
      const list = (await api('/admin/daf?status=unread')).items || [];
      for (const item of list) {
        setNote(`Reading ${done + failed + 1} of ${list.length}…`);
        const r = await redoRead(item);
        if (r.aiOff) { setNote(`${done ? `Read ${done}. ` : ''}${r.data?.error || 'AI is still off.'}`); return; }
        if (r.ok) done++; else failed++;
      }
      setNote(`Read ${done} of ${list.length} DAFs${failed ? ` — ${failed} couldn’t be read (open them to check)` : ''}.`);
    } catch (e) {
      setNote(e.message);
    } finally {
      setRedoingAll(false);
      setTick((k) => k + 1);
    }
  }, []);

  const counts = data?.counts || {};
  const aiOff = !!(data?.ai?.configured && !data.ai.available);
  const unread = counts.unread || 0;
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-display text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">DAF Checks</h1>
      <p className="mt-2 text-sm text-text-secondary max-w-2xl">Students upload their DAF in Abhivyakti (Interview Prep). Verify a genuine DAF to unlock their practice, the full question bank, 15 free credits and credit purchases; reject anything else with a reason. Files stay here after you decide; Delete removes an entry. A “Paid change” is a verified student’s new DAF (₹50): verifying it replaces their old details. Check the roll number against the DAF before verifying: it decides which interview date the student sees, and they can’t change it afterwards. A “Roll number” is a verified student adding a missing roll number with proof (free): approve it only if the proof shows that number. A DAF “Filled in” by hand has no file: check the details, and any roll number against its proof. If AI couldn’t read an upload (AI off or out of credits), it is flagged here and the student just waits: once AI works again, press Redo with AI.</p>

      {(aiOff || unread > 0) && (
        // Uploads AI couldn't read wait here; their students see "We're reading your DAF" until an admin re-reads them.
        <div className="mt-6 rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-400/10 dark:border-rose-400/30 px-5 py-4" role="alert">
          {aiOff && (
            <>
              <p className="font-semibold text-status-danger-text">AI is off: uploaded DAFs can’t be read automatically</p>
              <p className="text-sm text-text-secondary mt-1">
                Students whose DAF couldn’t be read see “We’re reading your DAF” and wait — there is nothing for them to do. AI answers and feedback don’t work either.
                {data.ai.billingBlocked && <> Google is refusing requests for billing reasons: {/spending cap/i.test(data.ai.reason) ? 'the project’s monthly spending cap is reached' : 'the account needs credit'}.</>}
                {' '}Add credits, then press Redo with AI.
              </p>
              {data.ai.reason && <p className="text-xs text-text-tertiary mt-1 break-words">Google: {data.ai.reason}</p>}
            </>
          )}
          {unread > 0 && <p className={`${aiOff ? 'mt-3 ' : ''}font-semibold text-text-primary`}>{unread} DAF{unread === 1 ? '' : 's'} couldn’t be read by AI — {unread === 1 ? 'that student is' : 'those students are'} waiting for their details.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {aiOff && <a href={AI_SPEND_URL} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-text-on-accent text-sm font-bold">Add credits in Google AI Studio</a>}
            {unread > 0 && <button type="button" disabled={redoingAll} onClick={redoAll} className="px-4 py-2 rounded-xl border border-status-danger-text/40 text-status-danger-text text-sm font-bold cursor-pointer disabled:opacity-50">{redoingAll ? 'Reading…' : `Redo all with AI (${unread})`}</button>}
            {unread > 0 && status !== 'unread' && <button type="button" onClick={() => setStatus('unread')} className="px-4 py-2 rounded-xl border border-border-default text-sm font-semibold cursor-pointer hover:bg-sunken">Show them</button>}
          </div>
        </div>
      )}
      {note && <p className="mt-3 text-sm font-semibold text-text-primary" role="status">{note}</p>}

      <ScheduleBox info={data?.schedule} onUploaded={() => setTick((k) => k + 1)} />

      <div className="mt-6 flex flex-wrap gap-2">
        {['pending', 'verified', 'rejected', 'unread'].map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border cursor-pointer ${status === s ? 'bg-brand text-text-on-accent border-brand' : s === 'unread' && unread > 0 ? 'border-status-danger-text/40 text-status-danger-text' : 'border-border-default text-text-secondary hover:text-text-primary'}`}>
            {s === 'pending' ? 'Waiting' : s === 'verified' ? 'Verified' : s === 'rejected' ? 'Rejected' : 'Couldn’t read'} <span className="opacity-70">{counts[s] || 0}</span>
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
                {item.source === 'form' && <span className="ml-2 align-middle inline-flex px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 dark:bg-amber-400/10 dark:border-amber-400/30 dark:text-amber-200 text-[10px] font-extrabold uppercase tracking-wider">Filled in</span>}
                {item.detailsUpload && <span className="ml-2 align-middle inline-flex px-2 py-0.5 rounded-full bg-sunken border border-border-default text-text-secondary text-[10px] font-extrabold uppercase tracking-wider" title="A verified student who had no DAF details gave them once (verified before uploads were kept)">Details only</span>}
                {item.kind === 'roll' && <span className="ml-2 align-middle inline-flex px-2 py-0.5 rounded-full bg-sky-50 border border-sky-300 text-sky-800 dark:bg-sky-400/10 dark:border-sky-400/30 dark:text-sky-200 text-[10px] font-extrabold uppercase tracking-wider">Roll number</span>}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                {item.source === 'form' ? 'Filled in' : 'Uploaded'} {when(item.createdAt)}{item.hasFile ? ` · ${item.source === 'form' ? 'proof: ' : ''}${item.fileName} · ${size(item.size)}` : ''}
                {item.reviewedAt ? ` · ${item.status} ${when(item.reviewedAt)}${item.reviewedBy ? ` by ${item.reviewedBy}` : ''}` : ''}
              </p>
              {item.status === 'pending' && (
                <RollCheck item={item} roll={rolls[item.id] ?? item.rollNo ?? ''} onChange={(v) => setRolls((x) => ({ ...x, [item.id]: v }))} />
              )}
              {item.status === 'verified' && <ScheduleMatch item={item} />}
              {item.needsRead && (
                <p className="text-xs mt-1 font-semibold text-status-danger-text">
                  AI couldn’t read this DAF{item.readError ? ` (${item.readError.slice(0, 160)})` : ''}. The student is waiting for its details — press Redo with AI once AI works.
                </p>
              )}
              {!item.needsRead && item.detailsMissing && <p className="text-xs mt-1 font-semibold text-amber-700 dark:text-amber-300">The student hasn’t filled in their DAF details yet. Once verified, they can fill them in from My DAF.</p>}
              {item.reason && <p className="text-xs text-status-danger-text mt-1">Reason: {item.reason}</p>}
              {item.kind !== 'roll' && item.source !== 'form' && <ReadDetails item={item} onSaved={() => setTick((k) => k + 1)} />}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {item.source === 'form' && <button type="button" onClick={() => setDetails(item)} className="px-4 py-2 rounded-xl border border-border-default text-sm font-semibold cursor-pointer hover:bg-sunken">View details</button>}
              {item.needsRead && <button type="button" disabled={busy === item.id || redoingAll} onClick={() => redo(item)} className="px-4 py-2 rounded-xl border border-status-danger-text/40 text-status-danger-text text-sm font-bold cursor-pointer disabled:opacity-50">{busy === item.id ? 'Reading…' : 'Redo with AI'}</button>}
              {item.hasFile && <button type="button" onClick={() => setViewing(item)} className="px-4 py-2 rounded-xl border border-border-default text-sm font-semibold cursor-pointer hover:bg-sunken">{item.kind === 'roll' || item.source === 'form' ? 'View proof' : 'View DAF'}</button>}
              {item.status === 'pending' && (
                <>
                  <button type="button" disabled={busy === item.id} onClick={() => act(item, 'verify')} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-text-on-accent text-sm font-bold cursor-pointer disabled:opacity-50">{item.kind === 'roll' ? 'Approve' : 'Verify'}</button>
                  <button type="button" disabled={busy === item.id} onClick={() => act(item, 'reject')} className="px-4 py-2 rounded-xl border border-status-danger-text/40 text-status-danger-text text-sm font-bold cursor-pointer disabled:opacity-50">Reject</button>
                </>
              )}
              <button type="button" disabled={busy === item.id} onClick={() => remove(item)} title="Delete this entry"
                className="px-3 py-2 rounded-xl text-sm font-semibold text-text-tertiary hover:text-status-danger-text hover:bg-sunken cursor-pointer disabled:opacity-50">Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {viewing && <Viewer item={viewing} onClose={() => setViewing(null)} />}
      {details && <FormDetails item={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
