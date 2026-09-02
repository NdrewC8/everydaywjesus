import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

registerSW({
  immediate: false,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('ewj:update-available'));
  }
});

const root = document.getElementById('root');
if (!root) throw new Error('App root element not found');

createRoot(root).render(<StrictMode><App /></StrictMode>);
