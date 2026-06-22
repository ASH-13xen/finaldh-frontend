import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Intercept fetch to prefix relative URLs with VITE_API_URL if defined
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  let url = input;
  let baseUrl = import.meta.env.VITE_API_URL || '';
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    if (window.location.port !== '5000') {
      baseUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
    } else {
      baseUrl = '';
    }
  }
  if (baseUrl) {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    
    const shouldRewrite = (urlString) => {
      if (!urlString || typeof urlString !== 'string') return false;
      // Relative paths
      if (urlString.startsWith('/api/') || urlString.startsWith('api/') || 
          urlString.startsWith('/uploads/') || urlString.startsWith('uploads/')) {
        return true;
      }
      // Absolute URLs matching current origin
      const origin = window.location.origin;
      if (urlString.startsWith(origin + '/api/') || 
          urlString.startsWith(origin + 'api/') || 
          urlString.startsWith(origin + '/uploads/') || 
          urlString.startsWith(origin + 'uploads/')) {
        return true;
      }
      return false;
    };

    const getRewrittenUrl = (urlString) => {
      const origin = window.location.origin;
      let path = urlString;
      if (urlString.startsWith(origin)) {
        path = urlString.substring(origin.length);
      }
      if (!path.startsWith('/')) {
        path = '/' + path;
      }
      return `${cleanBaseUrl}${path}`;
    };

    if (typeof url === 'string') {
      if (shouldRewrite(url)) {
        url = getRewrittenUrl(url);
      }
    } else if (url instanceof URL) {
      if (shouldRewrite(url.href)) {
        url = new URL(getRewrittenUrl(url.href));
      }
    } else if (url && typeof url === 'object' && 'url' in url) {
      if (shouldRewrite(url.url)) {
        url = new Request(getRewrittenUrl(url.url), url);
      }
    }
  }
  return originalFetch(url, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

