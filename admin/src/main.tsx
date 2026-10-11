import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { initializeAuthSessions } from './shared/api';
import 'flag-icons/css/flag-icons.min.css';

await initializeAuthSessions();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
