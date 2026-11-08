import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import Fallo from './core/Fallo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fallo><App /></Fallo>
  </StrictMode>
);
