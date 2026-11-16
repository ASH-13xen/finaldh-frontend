// Shared state for the Interview Prep screens: the section status, the signed-in user, navigation, and the
// student's DAF (loaded once, refreshed after a save).
import { createContext, useContext } from 'react';

export const PrepContext = createContext(null);
export const usePrep = () => useContext(PrepContext);

// The screens, in navigation order. `ready: false` shows a "Soon" chip instead of opening it.
export const SCREENS = [
  { key: 'home', icon: 'home', label: 'nav.home', ready: true },
  { key: 'daf', icon: 'fileText', label: 'nav.daf', ready: true },
  { key: 'predictions', icon: 'target', label: 'nav.predictions', long: 'nav.predictionsLong', ready: true },
  { key: 'bank', icon: 'search', label: 'nav.bank', short: 'nav.bankShort', ready: true },
  { key: 'practice', icon: 'mic', label: 'nav.practice', long: 'nav.practiceLong', ready: true },
  { key: 'notes', icon: 'book', label: 'nav.notes', ready: true },
  { key: 'insights', icon: 'chart', label: 'nav.insights', ready: true },
  { key: 'me', icon: 'star', label: 'nav.me', ready: true }
];
export const SCREEN_KEYS = SCREENS.map((s) => s.key);
export const MOBILE_TABS = ['home', 'daf', 'predictions', 'bank', 'practice'];
