// Board helpers: official photos (cropped from the members' bio-data PDFs on upsc.gov.in, kept in
// public/boards/) and the mood candidates reported (lib/interview/mood.js on the server).
const PHOTOS = {
  'Ajay Kumar': 'ajay-kumar',
  'Dinesh Dasa': 'dinesh-dasa',
  'Raj Shukla': 'raj-shukla',
  'Suman Sharma': 'suman-sharma',
  'B.B. Swain': 'bb-swain',
  'Sanjay Verma': 'sanjay-verma',
  'Sheel Vardhan Singh': 'sheel-vardhan-singh',
  'Anuradha Prasad': 'anuradha-prasad',
  'Sujatha Chaturvedi': 'sujatha-chaturvedi'
};
export const photoOf = (name) => (PHOTOS[name] ? `/boards/${PHOTOS[name]}.jpg` : null);

// Too few accounts to say anything below this many.
const MIN_MOOD = 15;
export const MOOD_KINDS = ['cordial', 'mixed', 'tough'];

// { kind: 'cordial' | 'mixed' | 'tough', cordial, neutral, tough (percent), n } or null.
export const moodOf = (b) => {
  const m = b?.mood;
  if (!m || m.n < MIN_MOOD) return null;
  const pct = (k) => Math.round(((m[k] || 0) / m.n) * 100);
  const cordial = pct('cordial');
  const tough = pct('tough');
  const kind = tough >= 12 ? 'tough' : cordial >= 80 ? 'cordial' : 'mixed';
  return { kind, cordial, neutral: Math.max(0, 100 - cordial - tough), tough, n: m.n };
};

export const MOOD_STYLE = {
  cordial: { color: '#0d7a56', bg: 'var(--prep-tier-certain-bg)' },
  mixed: { color: '#b45309', bg: 'var(--prep-tier-likely-bg)' },
  tough: { color: '#b91c1c', bg: 'rgba(185, 28, 28, 0.10)' }
};
