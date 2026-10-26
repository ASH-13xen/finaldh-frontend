// Fetch wrapper for /api/study — the student's bookmarks, notes and Toppers Copy progress.
// Same shape as quiz/quizApi.js: throws Error(message) on a non-2xx response.

const request = async (path, { method = 'GET', body } = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/study${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return s.toString() ? `?${s}` : '';
};

// A "ref" is what a bookmark/note points at — one of:
//   { refType: 'tc_question', toppersCopyId, questionId }
//   { refType: 'tc_answer',   toppersCopyId, questionId, answerIdx }
//   { refType: 'tc_pyq',      pyqId, toppersCopyId? }
//   { refType: 'qb_question', quizQuestionId }
// refKeyOf mirrors the server's canonical key so a section can tell what's starred locally.
export const refKeyOf = (ref) => {
  switch (ref?.refType) {
    case 'tc_question': return `tc_question:${ref.toppersCopyId}:${ref.questionId}`;
    case 'tc_answer': return `tc_answer:${ref.toppersCopyId}:${ref.questionId}:${ref.answerIdx}`;
    case 'tc_pyq': return `tc_pyq:${ref.pyqId}`;
    case 'qb_question': return `qb_question:${ref.quizQuestionId}`;
    default: return '';
  }
};

export const listItems = (params = {}) => request(`/items${qs(params)}`);
export const listBookmarkKeys = (section) => request(`/bookmarks${qs({ section })}`);
export const toggleBookmark = (ref) => request('/bookmarks/toggle', { method: 'POST', body: ref });
export const createNote = (ref, { quote, quoteFrom, body }) =>
  request('/notes', { method: 'POST', body: { ...ref, quote, quoteFrom, body } });
export const updateNote = (id, patch) => request(`/items/${id}`, { method: 'PATCH', body: patch });
export const deleteItem = (id) => request(`/items/${id}`, { method: 'DELETE' });
export const markRevised = (id) => request(`/items/${id}/revised`, { method: 'POST' });

export const getSeen = () => request('/tc-seen');
export const setSeen = (questionId, seen, topicId) =>
  request(`/tc-seen/${questionId}`, { method: 'PUT', body: { seen, topicId } });
export const importSeen = (seen) => request('/tc-seen/import', { method: 'POST', body: { seen } });
