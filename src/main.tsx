import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { UserPreferencesProvider } from './components/UserPreferencesProvider.tsx';

// Đăng ký Service Worker cho PWA chế độ offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SW] Đăng ký Service Worker thành công:', registration.scope);
      })
      .catch((error) => {
        console.error('[SW] Đăng ký Service Worker thất bại:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserPreferencesProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </UserPreferencesProvider>
  </StrictMode>,
);
