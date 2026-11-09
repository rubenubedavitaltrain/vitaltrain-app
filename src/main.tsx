import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import Fallo from './core/Fallo';
import { iniciarActualizacion } from './core/actualizar';

// Busca versión nueva al abrir, al volver a primer plano y cada 30 minutos (ver core/actualizar.ts).
iniciarActualizacion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fallo><App /></Fallo>
  </StrictMode>
);
