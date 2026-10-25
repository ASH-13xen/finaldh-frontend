// Tiny fetch wrapper for /api/mcq so screens don't each re-implement token + JSON + error handling.
export class McqApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function mcq(path, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api/mcq${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new McqApiError('Could not reach the server. Check your internet connection and try again.', 0, null);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty / non-JSON body */ }
  if (!res.ok) throw new McqApiError(data?.error || `Something went wrong (${res.status}).`, res.status, data);
  return data;
}

export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => err?.message || fallback;

// "1:05:09" / "05:09"
export const formatClock = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

// "2 min 5 s" - for reading times in results, where a clock face is less friendly
export const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
