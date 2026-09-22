// Hand-off between My Notes and the section a note came from. The app has no router — a tab
// is just `activeTab` synced to the URL hash — so "open this question" is: stash where to go
// in sessionStorage, switch tab via the hash (App listens to popstate), and the target
// section consumes the stash on mount.

const KEY = 'study_jump_v1';

export const goToTab = (tab) => {
  if (window.location.hash === `#${tab}`) return;
  window.location.hash = tab;
};

// target: { section: 'toppers_copy', subject, toppersCopyId, questionId?, answerIdx?, pyqId? }
export const jumpTo = (tab, target) => {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...target, tab })); } catch { /* private mode */ }
  goToTab(tab);
};

// Returns the pending jump for `tab` (or null) without clearing it — safe to call from a
// lazy useState initializer, which StrictMode runs twice. Call clearJump() once it's used.
export const peekJump = (tab) => {
  try {
    const j = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return j?.tab === tab ? j : null;
  } catch {
    return null;
  }
};

export const clearJump = () => {
  try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
};
