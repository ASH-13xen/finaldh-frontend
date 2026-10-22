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
//   { refType: 'em_topic',    economyTopicId }
//   { refType: 'own' }        — a note written from scratch in My Notes (createNote takes a title)
// refKeyOf mirrors the server's canonical key so a section can tell what's starred locally.
export const refKeyOf = (ref) => {
  switch (ref?.refType) {
    case 'tc_question': return `tc_question:${ref.toppersCopyId}:${ref.questionId}`;
    case 'tc_answer': return `tc_answer:${ref.toppersCopyId}:${ref.questionId}:${ref.answerIdx}`;
    case 'tc_pyq': return `tc_pyq:${ref.pyqId}`;
    case 'qb_question': return `qb_question:${ref.quizQuestionId}`;
    case 'em_topic': return `em_topic:${ref.economyTopicId}`;
    default: return '';
  }
};

export const listItems = (params = {}) => request(`/items${qs(params)}`);
export const listBookmarkKeys = (section) => request(`/bookmarks${qs({ section })}`);
export const toggleBookmark = (ref) => request('/bookmarks/toggle', { method: 'POST', body: ref });
export const createNote = (ref, { quote, quoteFrom, body, title, notebookId }) =>
  request('/notes', { method: 'POST', body: { ...ref, quote, quoteFrom, body, title, notebookId } });
export const updateNote = (id, patch) => request(`/items/${id}`, { method: 'PATCH', body: patch });
export const moveToNotebook = (id, notebookId) => updateNote(id, { notebookId: notebookId || null });
export const deleteItem = (id) => request(`/items/${id}`, { method: 'DELETE' });
export const restoreItem = (id) => request(`/items/${id}/restore`, { method: 'POST' });
export const emptyBin = () => request('/bin', { method: 'DELETE' });
export const markRevised = (id) => request(`/items/${id}/revised`, { method: 'POST' });

export const listNotebooks = () => request('/notebooks');
// With parentId it creates a sub-topic inside that notebook.
export const createNotebook = (name, parentId) => request('/notebooks', { method: 'POST', body: { name, parentId } });
export const renameNotebook = (id, name) => request(`/notebooks/${id}`, { method: 'PATCH', body: { name } });
export const deleteNotebook = (id) => request(`/notebooks/${id}`, { method: 'DELETE' });

// Notebooks in sidebar order — each top-level notebook followed by its sub-topics — with a
// `label` for pickers and badges ("Polity", "Polity › Parliament").
export const notebookOptions = (notebooks = []) => notebooks
  .filter((n) => !n.parent)
  .flatMap((t) => [
    { ...t, label: t.name },
    ...notebooks.filter((n) => n.parent === t._id).map((s) => ({ ...s, label: `${t.name} › ${s.name}` })),
  ]);

// The notebook "Add to notes" last saved into, so the next note defaults there.
const LAST_NB = 'study_last_notebook';
export const getLastNotebook = () => { try { return localStorage.getItem(LAST_NB) || ''; } catch { return ''; } };
export const setLastNotebook = (id) => { try { localStorage.setItem(LAST_NB, id || ''); } catch { /* private mode */ } };

export const getSeen = () => request('/tc-seen');
export const setSeen = (questionId, seen, topicId) =>
  request(`/tc-seen/${questionId}`, { method: 'PUT', body: { seen, topicId } });
export const importSeen = (seen) => request('/tc-seen/import', { method: 'POST', body: { seen } });
