import { useEffect, useState } from 'react';

const PILARES = [
  'Alimentación consciente',
  'Movimiento inteligente',
  'Ritmos circadianos',
  'Regulación emocional',
  'Contacto con la naturaleza'
];

function esApple() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function instalada() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function App() {
  const [yaInstalada, setYaInstalada] = useState(false);
  useEffect(() => setYaInstalada(instalada()), []);

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),3rem)] pb-8">
        <img src="/marca/logotipo-blanco.png" alt="Vitaltrain · Health balance, training, nutrition" className="h-20 w-auto" />
        <h1 className="mt-3 text-3xl font-bold leading-tight">Tu app está en camino</h1>
        <p className="mt-2 text-base text-[#E3E8E8]">Estamos construyendo el espacio donde seguirás tu plan con Rubén.</p>
      </header>

      <main className="flex-1 px-5 py-6 flex flex-col gap-4">
        <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="pilares">
          <h2 id="pilares" className="text-[13px] font-semibold tracking-wider text-texto-suave">LOS CINCO PILARES</h2>
          <ul className="flex flex-col gap-2">
            {PILARES.map((p) => (
              <li key={p} className="text-base font-semibold">{p}</li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-2xl p-5 flex flex-col gap-2" aria-labelledby="instalar">
          <h2 id="instalar" className="text-lg font-bold">
            {yaInstalada ? 'App instalada' : 'Añádela a tu pantalla de inicio'}
          </h2>
          {yaInstalada ? (
            <p className="text-base text-texto-suave">Ya la tienes en tu móvil. Se abrirá como una app más.</p>
          ) : esApple() ? (
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
      </main>

      <footer className="px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-xs leading-relaxed text-texto-suave">
        Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433
        <br />Versión {__APP_VERSION__}
      </footer>
    </div>
  );
}
