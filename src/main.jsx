import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Intercept fetch to prefix relative URLs with VITE_API_URL if defined
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  let url = input;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  if (baseUrl) {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    if (typeof url === 'string') {
      if (url.startsWith('/api/') || url.startsWith('api/') || url.startsWith('/uploads/') || url.startsWith('uploads/')) {
        const path = url.startsWith('/') ? url : `/${url}`;
        url = `${cleanBaseUrl}${path}`;
      }
    } else if (url instanceof URL) {
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('uploads/')) {
        const pathname = url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`;
        url = new URL(`${cleanBaseUrl}${pathname}${url.search}`);
      }
    } else if (url && typeof url === 'object' && 'url' in url) {
      if (url.url.startsWith('/api/') || url.url.startsWith('api/') || url.url.startsWith('/uploads/') || url.url.startsWith('uploads/')) {
        const path = url.url.startsWith('/') ? url.url : `/${url.url}`;
        const newUrl = `${cleanBaseUrl}${path}`;
        url = new Request(newUrl, url);
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

