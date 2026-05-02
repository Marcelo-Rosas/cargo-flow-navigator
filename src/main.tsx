import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { GlobalErrorBoundary } from '@/components/ErrorBoundary';
import './index.css';
import { initSentry } from './lib/sentry';

initSentry();

// Reload the page when Vite fails to fetch a lazy chunk (stale deployment).
// The event fires before React even mounts, so a hard reload picks up the new index.html.
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
