// Shared bits for the Notes screens and PDFs: who we are, category colours, dates.
export const BRAND = 'The Dark Horse UPSC';
export const TELEGRAM_URL = 'https://t.me/tdhadmin';
export const TELEGRAM_LABEL = 't.me/tdhadmin';
export const LOGO = '/logodh1.jpg';

export const CATEGORY_TONE = {
  polity: '#6d28d9',
  economy: '#0d7a56',
  international: '#0369a1',
  environment: '#15803d',
  science: '#0e7490',
  society: '#be185d',
  security: '#b91c1c',
  governance: '#b45309',
  culture: '#a16207',
  sports: '#c2410c'
};
export const toneOf = (category) => CATEGORY_TONE[category] || '#57534e';

export const noteDate = (d, lang, long = false) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' });
};

// Guide question types shown as filters (the AI labels each question with one of these).
export const GUIDE_TYPES = ['personal', 'motivation', 'factual', 'opinion', 'situational'];
