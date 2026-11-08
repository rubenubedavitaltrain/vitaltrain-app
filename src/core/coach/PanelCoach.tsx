import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Biblioteca from '../../modules/entrenamiento/biblioteca/Biblioteca';
import Pacientes from './Pacientes';
import Plantillas from '../../modules/entrenamiento/plantillas/Plantillas';

// Panel del coach. Cada módulo añade aquí su sección. De momento: inicio y biblioteca.

type Seccion = 'inicio' | 'pacientes' | 'plantillas' | 'biblioteca';

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
      className={`px-3 sm:px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${seccion === s ? 'bg-mostaza text-[#1F2424]' : 'text-white'}`}
    >
      {texto}
    </button>
  );

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-petroleo text-white px-4 sm:px-5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <img src="/marca/logotipo-blanco.png" alt="Vitaltrain" className="h-8 sm:h-10 w-auto" />
        <button onClick={() => supabase.auth.signOut()} className="order-2 sm:order-3 ml-auto text-sm font-semibold text-[#E3E8E8] px-2 py-2">
          Salir
        </button>
        <nav aria-label="Panel del coach" className="order-3 sm:order-2 w-full sm:w-auto sm:flex-1 flex gap-1 overflow-x-auto -mx-1 px-1">
          {pestaña('inicio', 'Inicio')}
          {pestaña('pacientes', 'Pacientes')}
          {pestaña('plantillas', 'Plantillas')}
          {pestaña('biblioteca', 'Biblioteca')}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {seccion === 'inicio' && (
          <section className="bg-white rounded-2xl p-6 flex flex-col gap-2">
            <h2 className="text-2xl font-bold">Hola, {nombre}</h2>
            <p className="text-texto-suave">
              El panel con la adherencia de tus pacientes llegará en las próximas tareas. Ya puedes dar de alta pacientes, crear plantillas y asignarlas en su calendario.
            </p>
          </section>
        )}
        {seccion === 'pacientes' && <Pacientes supabase={supabase} />}
        {seccion === 'plantillas' && <Plantillas supabase={supabase} />}
        {seccion === 'biblioteca' && <Biblioteca supabase={supabase} />}
      </main>

      <footer className="px-6 pb-4 text-center text-xs text-texto-suave">
        Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433 · Versión {__APP_VERSION__}
      </footer>
    </div>
  );
}
