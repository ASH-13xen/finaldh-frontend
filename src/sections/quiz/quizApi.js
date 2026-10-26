// Thin fetch wrapper for the /api/quiz endpoints. Mirrors the auth pattern used across the
// other sections (Bearer token from localStorage). Every function throws Error(message) on a
// non-2xx response so callers can just try/catch.

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`/api/quiz${path}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

export const listTopics = (subject) =>
  request(`/topics${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`);

// { subject, mode: 'topic'|'random'|'all', topic?, size? }
export const startAttempt = (opts) => request('/attempts', { method: 'POST', body: opts });

export const getAttemptQuestions = (attemptId, from = 0, limit = 25) =>
  request(`/attempts/${attemptId}/questions?from=${from}&limit=${limit}`);

export const answerQuestion = (attemptId, index, selectedKey) =>
  request(`/attempts/${attemptId}/answer`, { method: 'POST', body: { index, selectedKey } });

export const completeAttempt = (attemptId) =>
  request(`/attempts/${attemptId}/complete`, { method: 'POST' });

export const getAttempt = (attemptId) => request(`/attempts/${attemptId}`);

export const listAttempts = (subject) =>
  request(`/attempts${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`);

export const reportQuestion = (questionId, reason) =>
  request(`/questions/${questionId}/report`, { method: 'POST', body: { reason } });
