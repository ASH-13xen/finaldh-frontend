// The Interview Prep section's calls to /api/interview.
import { iv, upload, qs } from '../../lib/interviewApi';

export const api = {
  status: () => iv('/status'),
  profile: () => iv('/profile'),
  saveProfile: (body) => iv('/profile', { method: 'PUT', body }),
  deleteProfile: () => iv('/profile', { method: 'DELETE' }),
  extractDaf: (file) => upload('/profile/extract', 'file', file, file.name || 'daf'),
  dafSubmit: (file) => upload('/daf/submit', 'file', file, file.name || 'daf'),
  // Fill in the details from the DAF already uploaded (when they're empty).
  dafRead: () => iv('/daf/read', { method: 'POST' }),
  tours: () => iv('/tours'),
  tourSeen: (tab) => iv('/tours/seen', { method: 'POST', body: { tab } }),
  // A verified student's roll number with proof (free; an admin checks it).
  rollClaim: (rollNo, file) => upload('/daf/roll', 'file', file, file.name || 'proof', { rollNo }),
  // A DAF filled in by hand, sent for verification like an upload; the roll number (optional) needs a proof.
  dafForm: async (fields, rollNo = '', proof = null) => {
    const form = new FormData();
    form.append('fields', JSON.stringify(fields));
    if (rollNo) form.append('rollNo', rollNo);
    if (proof) form.append('file', proof, proof.name || 'proof');
    let res;
    try {
      res = await fetch('/api/interview/daf/form', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: form });
    } catch {
      throw new Error('Could not reach the server. Check your internet connection and try again.');
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) { const err = new Error(data?.error || `Something went wrong (${res.status}).`); err.status = res.status; err.data = data; throw err; }
    return data;
  },
  predictions: (lang) => iv(`/predictions${qs({ lang })}`),
  family: (id) => iv(`/bank/families/${id}`),
  approach: (id, lang) => iv(`/bank/families/${id}/approach${qs({ lang })}`, { method: 'POST' }),
  search: (params) => iv(`/bank/search${qs(params)}`),
  facets: () => iv('/bank/facets'),
  trends: () => iv('/bank/trends'),
  keywords: () => iv('/bank/keywords'),
  myDaf: () => iv('/bank/my-daf'),
  myInterview: () => iv('/my-interview'),
  prep: () => iv('/prep'),
  savePrep: (key, body) => iv(`/prep/items/${encodeURIComponent(key)}`, { method: 'PUT', body }),
  deletePrep: (key) => iv(`/prep/items/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  prepSettings: (body) => iv('/prep/settings', { method: 'PUT', body }),
  notes: (lang) => iv(`/notes${qs({ lang })}`),
  note: (slug, lang) => iv(`/notes/${encodeURIComponent(slug)}${qs({ lang })}`),
  guide: (lang) => iv(`/guide${qs({ lang })}`),
  admin: {
    notes: () => iv('/admin/notes'),
    note: (id) => iv(`/admin/notes/${id}`),
    createNote: (body) => iv('/admin/notes', { method: 'POST', body }),
    updateNote: (id, body) => iv(`/admin/notes/${id}`, { method: 'PATCH', body }),
    deleteNote: (id) => iv(`/admin/notes/${id}`, { method: 'DELETE' }),
    guide: () => iv('/admin/guide'),
    generateGuide: () => iv('/admin/guide/generate', { method: 'POST' }),
    updateGuide: (body) => iv('/admin/guide', { method: 'PATCH', body })
  },
  credits: () => iv('/credits'),
  draftAnswer: (body) => iv('/answers/draft', { method: 'POST', body }),
  attempts: (key) => iv(`/practice/attempts${qs({ key })}`),
  saveAttempt: (body) => iv('/practice/attempts', { method: 'POST', body }),
  analyzeAnswer: async (blob, fields) => {
    const form = new FormData();
    form.append('audio', blob, blob.type.includes('mp4') ? 'answer.m4a' : 'answer.webm');
    for (const [k, v] of Object.entries(fields)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    const res = await fetch('/api/interview/practice/analyze', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: form });
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) { const err = new Error(data?.error || `Something went wrong (${res.status}).`); err.status = res.status; err.data = data; throw err; }
    return data;
  }
};
