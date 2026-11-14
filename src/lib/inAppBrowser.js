// Google Identity Services (our actual login mechanism, see App.jsx) deliberately blocks
// sign-in from embedded in-app browsers as an anti-abuse policy. On iPhone that shows up as a
// blank white accounts.google.com page. We can't sign in from inside those WebViews, so the login
// page warns students and offers a way out to Safari / Chrome.
const PATTERNS = [
  { id: 'telegram', label: 'Telegram', test: (ua) => /Telegram/i.test(ua) },
  { id: 'instagram', label: 'Instagram', test: (ua) => /Instagram/i.test(ua) },
  { id: 'facebook', label: 'Facebook', test: (ua) => /FBAN|FBAV/i.test(ua) },
  { id: 'line', label: 'Line', test: (ua) => /\bLine\//i.test(ua) },
  { id: 'linkedin', label: 'LinkedIn', test: (ua) => /LinkedInApp/i.test(ua) },
  { id: 'snapchat', label: 'Snapchat', test: (ua) => /Snapchat/i.test(ua) },
];

const hasWindow = typeof window !== 'undefined';

export const isIOS = (ua) =>
  /iPhone|iPad|iPod/i.test(ua) ||
  // iPadOS reports itself as a Mac; a touch screen gives it away
  (/Macintosh/i.test(ua) && hasWindow && navigator.maxTouchPoints > 1);

export const isAndroid = (ua) => /Android/i.test(ua);

// Telegram's in-app browser on iPhone doesn't always name itself in the user agent, but it injects its
// JS bridge into the pages it opens.
const hasTelegramBridge = () =>
  hasWindow && !!(window.TelegramWebviewProxy || window.TelegramWebview || window.Telegram?.WebView);

// Every real browser on iOS (Safari, Chrome, Firefox, Edge...) sends a "Safari/..." token; an app's
// built-in WKWebView leaves it out. A home-screen web app (navigator.standalone) is not a WebView.
const isIOSWebView = (ua) =>
  isIOS(ua) && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua) && !(hasWindow && navigator.standalone);

// Android's WebView marks itself with "; wv)"
const isAndroidWebView = (ua) => isAndroid(ua) && /;\s*wv\)/i.test(ua);

export const detectInAppBrowser = (ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) => {
  const text = ua || '';
  const match = PATTERNS.find((p) => p.test(text));
  if (match) return { detected: true, id: match.id, label: match.label };
  if (hasTelegramBridge()) return { detected: true, id: 'telegram', label: 'Telegram' };
  if (isIOSWebView(text) || isAndroidWebView(text)) return { detected: true, id: 'webview', label: null };
  return { detected: false, id: null, label: null };
};

// A link that asks the phone to open this page in its real browser. iOS 17+ opens Safari for the
// x-safari-https:// scheme; Android hands an intent:// link to the default browser. Apps don't all honour
// these, so the login page always pairs it with copy-link and menu instructions.
export const externalBrowserLink = (url = (hasWindow ? window.location.href : ''), ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) => {
  if (!url) return null;
  if (isIOS(ua)) return `x-safari-${url}`;
  if (isAndroid(ua)) {
    const withoutScheme = url.replace(/^https?:\/\//, '');
    return `intent://${withoutScheme}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  return null;
};

export const isMobileDevice = (ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) =>
  isIOS(ua) || isAndroid(ua);
