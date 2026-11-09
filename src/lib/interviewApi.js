// Fetch wrapper for /api/interview, the same shape as mcqApi.js: token, JSON and error handling in one
// place. upload() sends multipart forms (DAF files, recorded answers).
export class InterviewApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

const handle = async (res) => {
  let data = null;
  try { data = await res.json(); } catch { /* empty / non-JSON body */ }
  if (!res.ok) throw new InterviewApiError(data?.error || `Something went wrong (${res.status}).`, res.status, data);
  return data;
};

export async function iv(path, { method = 'GET', body } = {}) {
  const headers = authHeader();
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api/interview${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new InterviewApiError('Could not reach the server. Check your internet connection and try again.', 0, null);
  }
  return handle(res);
}

export async function upload(path, field, blob, filename) {
  const form = new FormData();
  form.append(field, blob, filename);
  let res;
  try {
    res = await fetch(`/api/interview${path}`, { method: 'POST', headers: authHeader(), body: form });
  } catch {
    throw new InterviewApiError('Could not reach the server. Check your internet connection and try again.', 0, null);
  }
  return handle(res);
}

export const qs = (params) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => err?.message || fallback;

// The compilations are named by exam year ("2023" = CSE 2023, interviewed in early 2024).
export const cseLabel = (year) => `CSE ${year}`;

export const yearsRange = (years = []) => {
  const ys = [...new Set(years)].sort();
  if (!ys.length) return '';
  return ys.length === 1 ? `${ys[0]}` : `${ys[0]}–${ys[ys.length - 1]}`;
};

export const ASKER_LABEL = { chairman: 'Chairperson', m1: 'Member 1', m2: 'Member 2', m3: 'Member 3', m4: 'Member 4', m5: 'Member 5', member: 'Member', unknown: 'Board' };
export const askerShort = (a) => (a === 'chairman' ? 'CP' : /^m\d$/.test(a) ? a.toUpperCase() : 'M');

export const formatClock = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const wordCount = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
