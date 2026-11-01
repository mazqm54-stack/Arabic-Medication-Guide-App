import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './services/swRegistration';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Automatically register service worker in browser environment
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  registerServiceWorker({
    onSuccess: (reg) => {
      console.log('[PWA] Service Worker registered with scope:', reg.scope);
    },
    onUpdate: () => {
      console.log('[PWA] New version ready for refresh.');
    },
    onError: (err) => {
      console.warn('[PWA] Service Worker registration failed:', err);
    }
  });
}
