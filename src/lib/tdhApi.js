// Fetch wrapper for /api/tdh — PYQ & TDH Research. Throws Error(message) on non-2xx.

const request = async (path, { method = 'GET', body, form } = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/tdh${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return s.toString() ? `?${s}` : '';
};

const filesForm = (fields, { questions, solutions }) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (questions) form.append('questions', questions);
  if (solutions) form.append('solutions', solutions);
  return form;
};

// student
export const getOverview = () => request('/');
export const getSection = (setId, number) => request(`/sets/${setId}/sections/${number}`);
export const answerQuestion = (id, key) => request(`/questions/${id}/answer`, { method: 'POST', body: { key: key || '' } });
export const resetSection = (setId, section) => request(`/sets/${setId}/attempts${qs({ section })}`, { method: 'DELETE' });

// admin
export const adminSets = () => request('/admin/sets');
export const adminCreateSet = ({ subject, title, questions, solutions }) =>
  request('/admin/sets', { method: 'POST', form: filesForm({ subject, title }, { questions, solutions }) });
export const adminUploadFiles = (id, files) => request(`/admin/sets/${id}/files`, { method: 'POST', form: filesForm({}, files) });
export const adminUpdateSet = (id, patch) => request(`/admin/sets/${id}`, { method: 'PATCH', body: patch });
export const adminDeleteSet = (id) => request(`/admin/sets/${id}`, { method: 'DELETE' });
export const adminQuestions = (id, { section, filter } = {}) => request(`/admin/sets/${id}/questions${qs({ section, filter })}`);
export const adminUpdateQuestion = (id, patch) => request(`/admin/questions/${id}`, { method: 'PATCH', body: patch });
export const adminRunPractice = (id, opts) => request(`/admin/sets/${id}/practice/run`, { method: 'POST', body: opts || {} });
export const adminStopPractice = (id) => request(`/admin/sets/${id}/practice/stop`, { method: 'POST' });
export const adminApproveAll = (id, section) => request(`/admin/sets/${id}/practice/approve`, { method: 'POST', body: { section } });
export const adminGenerateOne = (qid) => request(`/admin/questions/${qid}/practice/generate`, { method: 'POST' });
export const adminAddPractice = (qid, p) => request(`/admin/questions/${qid}/practice`, { method: 'POST', body: p });
export const adminUpdatePractice = (qid, pid, patch) => request(`/admin/questions/${qid}/practice/${pid}`, { method: 'PATCH', body: patch });
export const adminDeletePractice = (qid, pid) => request(`/admin/questions/${qid}/practice/${pid}`, { method: 'DELETE' });
