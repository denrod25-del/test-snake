import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './contexts/AuthContext';
import { AuthModalProvider } from './components/AuthModal';
import './styles.css';

// HashRouter preserves the existing #/county/orange URL pattern from the
// legacy single-file site, and works on any static host (Netlify, S3, etc.)
// without needing a SPA-fallback redirect rule.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <AuthModalProvider>
          <App />
        </AuthModalProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
