// React.lazy for pages that load only when opened, so a visitor's first download stays small. After a
// deploy, a tab opened earlier may ask for page files that no longer exist; then the page reloads once
// to pick up the new ones instead of showing an error.
import { lazy } from 'react';

const RELOADED = 'lazy-page-reloaded';

export const lazyPage = (load) => lazy(() => load()
  .then((m) => {
    try { sessionStorage.removeItem(RELOADED); } catch { /* storage blocked */ }
    return m;
  })
  .catch((err) => {
    let reloaded = true;
    try { reloaded = !!sessionStorage.getItem(RELOADED); if (!reloaded) sessionStorage.setItem(RELOADED, '1'); } catch { /* storage blocked */ }
    if (!reloaded) {
      window.location.reload();
      return new Promise(() => {}); // the page is reloading
    }
    throw err;
  }));
