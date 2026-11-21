// The Interview Prep section's calls to /api/interview.
import { iv, upload, qs } from '../../lib/interviewApi';

export const api = {
  status: () => iv('/status'),
  profile: () => iv('/profile'),
  saveProfile: (body) => iv('/profile', { method: 'PUT', body }),
  deleteProfile: () => iv('/profile', { method: 'DELETE' }),
  extractDaf: (file) => upload('/profile/extract', 'file', file, file.name || 'daf'),
  dafSubmit: (file) => upload('/daf/submit', 'file', file, file.name || 'daf'),
  predictions: (lang) => iv(`/predictions${qs({ lang })}`),
  family: (id) => iv(`/bank/families/${id}`),
  approach: (id, lang) => iv(`/bank/families/${id}/approach${qs({ lang })}`, { method: 'POST' }),
  search: (params) => iv(`/bank/search${qs(params)}`),
  facets: () => iv('/bank/facets'),
  trends: () => iv('/bank/trends'),
  keywords: () => iv('/bank/keywords'),
  myDaf: () => iv('/bank/my-daf'),
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
