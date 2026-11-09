import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Biblioteca from '../../modules/entrenamiento/biblioteca/Biblioteca';
import Pacientes from './Pacientes';
import Inicio from './Inicio';
import Mensajes from './Mensajes';
import { contarNoLeidos } from '../mensajes/Conversacion';
import Programas from '../../modules/entrenamiento/programas/Programas';
import Plantillas from '../../modules/entrenamiento/plantillas/Plantillas';
import { AvisosDispositivo, ConfigAvisos } from '../avisos/Avisos';
import ConDobleFactor from '../historia/DobleFactor';
import { PlanesWoo } from '../suscripciones/Suscripciones';

// Panel del coach: inicio (resumen de la semana), pacientes, programas, plantillas y biblioteca.

type Seccion = 'inicio' | 'pacientes' | 'mensajes' | 'programas' | 'plantillas' | 'biblioteca' | 'ajustes';

export default function PanelCoach({ supabase, nombre, userId }: { supabase: SupabaseClient; nombre: string; userId: string }) {
  const [seccion, setSeccion] = useState<Seccion>(() => {
    try { return (localStorage.getItem('vt.coach.seccion') as Seccion) || 'inicio'; } catch { return 'inicio'; }
  });
  const [abrir, setAbrir] = useState<string | null>(null);
  const [noLeidos, setNoLeidos] = useState(0);
  useEffect(() => {
    const contar = () => contarNoLeidos(supabase, userId).then(setNoLeidos);
    contar();
    const t = window.setInterval(contar, 60000);
    return () => window.clearInterval(t);
  }, [supabase, userId]);
  const ir = (s: Seccion) => {
    setSeccion(s);
    try { localStorage.setItem('vt.coach.seccion', s); } catch { /* sin almacenamiento */ }
  };

  const pestaña = (s: Seccion, texto: string, aviso = 0) => (
    <button
      onClick={() => ir(s)}
      aria-current={seccion === s ? 'page' : undefined}
      className={`px-3 sm:px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${seccion === s ? 'bg-mostaza text-[#1F2424]' : 'text-white'}`}
    >
      {texto}
      {aviso > 0 && <span className="ml-1.5 inline-flex min-w-5 h-5 px-1.5 rounded-full bg-white text-[#1F2424] text-xs font-bold items-center justify-center" aria-label={`${aviso} sin leer`}>{aviso}</span>}
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
          {pestaña('mensajes', 'Mensajes', noLeidos)}
          {pestaña('programas', 'Programas')}
          {pestaña('plantillas', 'Plantillas')}
          {pestaña('biblioteca', 'Biblioteca')}
          {pestaña('ajustes', 'Ajustes')}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {seccion === 'inicio' && <Inicio supabase={supabase} nombre={nombre} onAbrir={(id) => { setAbrir(id); ir('pacientes'); }} />}
        {seccion === 'mensajes' && <Mensajes supabase={supabase} yo={userId} onAbrirFicha={(id) => { setAbrir(id); ir('pacientes'); }} />}
        {seccion === 'pacientes' && <Pacientes supabase={supabase} abrirId={abrir} onAbierto={() => setAbrir(null)} />}
        {seccion === 'programas' && <Programas supabase={supabase} />}
        {seccion === 'plantillas' && <Plantillas supabase={supabase} />}
        {seccion === 'biblioteca' && <Biblioteca supabase={supabase} />}
        {seccion === 'ajustes' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Ajustes</h2>
            <section className="max-w-3xl" aria-label="Doble factor">
              <ConDobleFactor supabase={supabase}>
                <div className="bg-white rounded-2xl p-5">
                  <h3 className="text-lg font-bold">Doble factor activo</h3>
                  <p className="text-sm text-texto-suave">Tu cuenta pide el código de la app de autenticación para abrir historias clínicas y autorizar borrados.</p>
                </div>
              </ConDobleFactor>
            </section>
            <section className="bg-white rounded-2xl p-5 flex flex-col gap-3 max-w-3xl">
              <div>
                <h3 className="text-lg font-bold">Avisos en este ordenador o móvil</h3>
                <p className="text-sm text-texto-suave">Te avisa cuando un paciente te escribe. Si no los activas, te llega un email.</p>
              </div>
              <AvisosDispositivo supabase={supabase} texto="en este dispositivo" />
            </section>
            <PlanesWoo supabase={supabase} />
            <ConfigAvisos supabase={supabase} proyecto={(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/^https:\/\/([^.]+)\..*$/, '$1')} />
          </div>
        )}
      </main>

      <footer className="px-6 pb-4 text-center text-xs text-texto-suave">
        Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433 · Versión {__APP_VERSION__}
      </footer>
    </div>
  );
}
