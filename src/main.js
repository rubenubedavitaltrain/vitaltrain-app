import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import Fallo from './core/Fallo';
import { registerSW } from 'virtual:pwa-register';
// Al abrir la app se comprueba si hay versión nueva. Si la hay, se instala y la página se recarga sola,
// así nadie se queda con una versión antigua guardada en el móvil.
registerSW({ immediate: true });
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(Fallo, { children: _jsx(App, {}) }) }));
