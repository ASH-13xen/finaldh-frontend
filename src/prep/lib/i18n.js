// Language for the Interview Prep section: English or Hindi, remembered on this device.
import { createContext, createElement, useCallback, useContext, useMemo, useState } from 'react';
import { STRINGS as BASE } from './strings';
import { STRINGS2 } from './strings2';
import { STRINGS3 } from './strings3';
import { STRINGS4 } from './strings4';
import { STRINGS5 } from './strings5';
import { STRINGS6 } from './strings6';

// One dictionary per language, merged from the per-phase files.
const STRINGS = {
  en: { ...BASE.en, ...STRINGS2.en, ...STRINGS3.en, ...STRINGS4.en, ...STRINGS5.en, ...STRINGS6.en },
  hi: { ...BASE.hi, ...STRINGS2.hi, ...STRINGS3.hi, ...STRINGS4.hi, ...STRINGS5.hi, ...STRINGS6.hi }
};

// Hindi is switched off for now (2026-11): the section shows English only and the language switch is
// hidden. The Hindi text stays in strings*.js; set this to true to bring the switch back.
export const HINDI_ENABLED = false;

const KEY = 'prep.lang';
const LangContext = createContext(null);

const readLang = () => {
  try { return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en'; } catch { return 'en'; }
};

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m)) : s);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => (HINDI_ENABLED ? readLang() : 'en'));
  const setLang = useCallback((next) => {
    if (!HINDI_ENABLED) return;
    setLangState(next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode: lasts for this visit */ }
  }, []);
  const t = useCallback((key, vars) => fill(STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key, vars), [lang]);
  // n === 1 uses "<key>.one" when it exists (English plurals); Hindi mostly reuses the same form.
  const tn = useCallback((key, n, vars) => {
    const one = n === 1 ? STRINGS[lang]?.[`${key}.one`] ?? STRINGS.en[`${key}.one`] : null;
    return fill(one ?? STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key, { n, ...vars });
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t, tn, hi: lang === 'hi' }), [lang, setLang, t, tn]);
  return createElement(LangContext.Provider, { value }, children);
}

export const useT = () => useContext(LangContext);

// Indian digit grouping (1,23,456) in both languages; Hindi readers are used to these digits in UPSC material.
export const fmt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-IN') : '');

export const yearsRange = (years = []) => {
  const ys = [...new Set(years)].sort();
  if (!ys.length) return '';
  return ys.length === 1 ? `${ys[0]}` : `${ys[0]}–${ys[ys.length - 1]}`;
};
