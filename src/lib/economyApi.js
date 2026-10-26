// Fetch wrapper for /api/economy — the Economy Master File. Throws Error(message) on non-2xx,
// same as studyApi.js.

const request = async (path, { method = 'GET', body, form } = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/economy${path}`, {
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

export const SOURCE_LABEL = { forum: 'Forum', partB: 'Part B', vision: 'Vision' };

export const listThemes = () => request('/themes');
export const getTheme = (key) => request(`/themes/${encodeURIComponent(key)}`);
export const getTopic = (id) => request(`/topics/${id}`);
export const getThemePyqs = (key) => request(`/themes/${encodeURIComponent(key)}/pyqs`);
export const getTopicPyqs = (id) => request(`/topics/${id}/pyqs`);
export const checkPyq = (id, key) => request(`/pyqs/${id}/check`, { method: 'POST', body: { key } });
export const searchTopics = (q) => request(`/search${qs({ q })}`);
export const getRevision = () => request('/revision');
export const setProgress = (topicId, status) => request(`/progress/${topicId}`, { method: 'PUT', body: { status } });
export const sourcePageUrl = (page) => `/api/economy/source-page/${page}`;

export const adminStatus = () => request('/admin/status');
export const adminListTopics = (params = {}) => request(`/admin/topics${qs(params)}`);
export const adminUpdateTopic = (id, patch) => request(`/admin/topics/${id}`, { method: 'PATCH', body: patch });
export const adminAiExtras = (id) => request(`/admin/topics/${id}/ai-extras`, { method: 'POST' });
export const adminThemeAiExtras = (key, { redraft = false } = {}) => request(`/admin/themes/${encodeURIComponent(key)}/ai-extras`, { method: 'POST', body: { redraft } });
export const adminStopThemeAiExtras = (key) => request(`/admin/themes/${encodeURIComponent(key)}/ai-extras/stop`, { method: 'POST' });
export const adminAiExtrasJobs = () => request('/admin/ai-extras-jobs');
export const adminPublishThemeExtras = (key) => request(`/admin/themes/${encodeURIComponent(key)}/publish-extras`, { method: 'POST' });
export const adminUpdateTheme = (key, patch) => request(`/admin/themes/${encodeURIComponent(key)}`, { method: 'PATCH', body: patch });
export const adminImport = (file, { mode, dryRun, overwriteEdited }) => {
  const form = new FormData();
  form.append('file', file);
  return request(`/admin/import${qs({ mode, dryRun: dryRun ? 'true' : '', overwriteEdited: overwriteEdited ? 'true' : '' })}`, { method: 'POST', form });
};
export const adminListPyqs = (params = {}) => request(`/admin/pyqs${qs(params)}`);
export const adminPlacePyq = (id, topicIds) => request(`/admin/pyqs/${id}`, { method: 'PATCH', body: { topicIds } });
export const adminStartPyqTagging = ({ retag = false, limit = 0 } = {}) => request('/admin/pyq-tagging', { method: 'POST', body: { retag, limit } });
export const adminStopPyqTagging = () => request('/admin/pyq-tagging/stop', { method: 'POST' });
export const adminPyqTagging = () => request('/admin/pyq-tagging');
export const adminUploadSourcePdf = (file) => {
  const form = new FormData();
  form.append('file', file);
  return request('/admin/source-pdf', { method: 'POST', form });
};
