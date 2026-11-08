import { useEffect, useState } from 'react';

// Instrucciones para añadir la app a la pantalla de inicio. Se ocultan si ya está instalada.

function esApple() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function instalada() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function Instalar() {
  const [yaInstalada, setYaInstalada] = useState(false);
  useEffect(() => setYaInstalada(instalada()), []);
  if (yaInstalada) return null;
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-2" aria-labelledby="instalar">
      <h2 id="instalar" className="text-lg font-bold">Añádela a tu pantalla de inicio</h2>
      {esApple() ? (
        <ol className="list-decimal pl-5 text-base leading-relaxed">
          <li>Abre esta página en Safari.</li>
          <li>Pulsa el botón Compartir, abajo.</li>
          <li>Elige «Añadir a pantalla de inicio».</li>
        </ol>
      ) : (
        <ol className="list-decimal pl-5 text-base leading-relaxed">
          <li>Abre esta página en Chrome.</li>
          <li>Pulsa el menú de los tres puntos, arriba.</li>
          <li>Elige «Instalar aplicación» o «Añadir a pantalla de inicio».</li>
        </ol>
      )}
    </section>
  );
}

