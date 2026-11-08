import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Biblioteca from '../../modules/entrenamiento/biblioteca/Biblioteca';

// Panel del coach. Cada módulo añade aquí su sección. De momento: inicio y biblioteca.

type Seccion = 'inicio' | 'biblioteca';

export default function PanelCoach({ supabase, nombre }: { supabase: SupabaseClient; nombre: string }) {
  const [seccion, setSeccion] = useState<Seccion>(() => {
    try { return (localStorage.getItem('vt.coach.seccion') as Seccion) || 'biblioteca'; } catch { return 'biblioteca'; }
  });
  const ir = (s: Seccion) => {
    setSeccion(s);
    try { localStorage.setItem('vt.coach.seccion', s); } catch { /* sin almacenamiento */ }
  };

  const pestaña = (s: Seccion, texto: string) => (
    <button
      onClick={() => ir(s)}
      aria-current={seccion === s ? 'page' : undefined}
      className={`px-3 sm:px-4 py-2 rounded-xl font-semibold ${seccion === s ? 'bg-mostaza text-[#1F2424]' : 'text-white'}`}
    >
      {texto}
    </button>
  );

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-petroleo text-white px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-3 flex items-center gap-2 sm:gap-3">
        <img src="/marca/logotipo-blanco.png" alt="Vitaltrain" className="h-8 sm:h-10 w-auto sm:mr-2" />
        <nav aria-label="Panel del coach" className="flex gap-1 flex-1">
          {pestaña('inicio', 'Inicio')}
          {pestaña('biblioteca', 'Biblioteca')}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="text-sm font-semibold text-[#E3E8E8] px-2 py-2">
          Salir
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {seccion === 'inicio' && (
          <section className="bg-white rounded-2xl p-6 flex flex-col gap-2">
            <h2 className="text-2xl font-bold">Hola, {nombre}</h2>
            <p className="text-texto-suave">
              El panel con la adherencia de tus pacientes llegará en las próximas tareas. Ya puedes ordenar tu biblioteca de ejercicios.
            </p>
          </section>
        )}
        {seccion === 'biblioteca' && <Biblioteca supabase={supabase} />}
      </main>

      <footer className="px-6 pb-4 text-center text-xs text-texto-suave">
        Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433 · Versión {__APP_VERSION__}
      </footer>
    </div>
  );
}
