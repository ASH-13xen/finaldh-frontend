// Shared state for the Interview Prep screens: the section status, the signed-in user, navigation, and the
// student's DAF (loaded once, refreshed after a save).
import { createContext, useContext } from 'react';

export const PrepContext = createContext(null);
export const usePrep = () => useContext(PrepContext);

// The screens. `nav` ones are the five main tabs (top bar on wide screens, bottom bar on phones); My DAF,
// My Prep and Insights open from the account menu and from links on the screens themselves.
export const SCREENS = [
  { key: 'home', icon: 'home', label: 'nav.home', ready: true, nav: true },
  { key: 'predictions', icon: 'target', label: 'nav.predictions', long: 'nav.predictionsLong', ready: true, nav: true },
  { key: 'bank', icon: 'search', label: 'nav.bank', short: 'nav.bankShort', ready: true, nav: true },
  { key: 'practice', icon: 'mic', label: 'nav.practice', long: 'nav.practiceLong', ready: true, nav: true },
  { key: 'notes', icon: 'book', label: 'nav.notes', ready: true, nav: true },
  { key: 'daf', icon: 'fileText', label: 'nav.daf', ready: true },
  { key: 'me', icon: 'star', label: 'nav.me', ready: true },
  { key: 'insights', icon: 'chart', label: 'nav.insights', ready: true }
];
export const SCREEN_KEYS = SCREENS.map((s) => s.key);
export const MOBILE_TABS = ['home', 'predictions', 'bank', 'practice', 'notes'];
