// Google Identity Services (our actual login mechanism, see App.jsx) deliberately blocks
// sign-in from embedded in-app browsers as an anti-abuse policy. There's no way to force a
// redirect out of these WebViews from JS - the best we can do is warn users proactively
// and point them to "open in browser" before they hit Google's own silent failure.
const PATTERNS = [
  { id: 'telegram', label: 'Telegram', test: (ua) => /Telegram/i.test(ua) },
  { id: 'instagram', label: 'Instagram', test: (ua) => /Instagram/i.test(ua) },
  { id: 'facebook', label: 'Facebook', test: (ua) => /FBAN|FBAV/i.test(ua) },
  { id: 'line', label: 'Line', test: (ua) => /\bLine\//i.test(ua) },
];

export const detectInAppBrowser = (ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) => {
  const match = PATTERNS.find((p) => p.test(ua || ''));
  return match ? { detected: true, id: match.id, label: match.label } : { detected: false, label: null };
};
