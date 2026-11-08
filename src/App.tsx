import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Acceso from './core/acceso/Acceso';
import PanelCoach from './core/coach/PanelCoach';
import AppPaciente from './core/paciente/AppPaciente';
import { limpiarCuenta } from './modules/entrenamiento/paciente/datos';

type Perfil = { full_name: string; role: 'coach' | 'patient'; status: 'active' | 'paused' | 'archived' };

function Pie() {
  return (
    <footer className="px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-xs leading-relaxed text-texto-suave">
      Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433
      <br />Versión {__APP_VERSION__}
    </footer>
  );
}

function Cabecera({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),3rem)] pb-8">
      <img src="/marca/logotipo-blanco.png" alt="Vitaltrain · Health balance, training, nutrition" className="h-20 w-auto" />
      <h1 className="mt-3 text-3xl font-bold leading-tight">{titulo}</h1>
      <p className="mt-2 text-base text-[#E3E8E8]">{texto}</p>
    </header>
  );
}

function Mensaje({ titulo, texto, onSalir }: { titulo: string; texto: string; onSalir?: () => void }) {
  return (
    <div className="min-h-full flex flex-col">
      <Cabecera titulo={titulo} texto={texto} />
      <main className="flex-1 px-5 py-6 flex flex-col gap-4">
        {onSalir && (
          <button onClick={onSalir} className="bg-white text-petroleo border-2 border-petroleo text-base font-bold py-3.5 rounded-2xl">
            Cerrar sesión
          </button>
        )}
      </main>
      <Pie />
    </div>
  );
}

function Inicio({ supabase, session }: { supabase: SupabaseClient; session: Session }) {
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('full_name, role, status').eq('id', session.user.id).maybeSingle();
      if (!vivo) return;
      if (error) {
        // Sin conexión: usar la última copia del perfil
        let copia: Perfil | null = null;
        try { copia = JSON.parse(localStorage.getItem('vt.perfil') ?? 'null'); } catch { /* sin copia */ }
        setPerfil(copia);
      } else {
        setPerfil((data as Perfil | null) ?? null);
        try { localStorage.setItem('vt.perfil', JSON.stringify(data)); } catch { /* sin almacenamiento */ }
      }
    })();
    return () => { vivo = false; };
  }, [supabase, session.user.id]);

  const salir = () => supabase.auth.signOut();

  if (perfil === undefined) return <Mensaje titulo="Cargando…" texto="Un momento." />;
  if (perfil === null)
    return <Mensaje titulo="Tu cuenta aún no está activada" texto="Rubén tiene que terminar tu alta. Te avisará cuando esté lista." onSalir={salir} />;
  if (perfil.status !== 'active')
    return <Mensaje titulo="Tu acceso está en pausa" texto="Si crees que es un error, escribe a Rubén." onSalir={salir} />;

  const nombre = perfil.full_name.split(' ')[0];
  if (perfil.role === 'coach') return <PanelCoach supabase={supabase} nombre={nombre} />;
  return <AppPaciente supabase={supabase} userId={session.user.id} nombre={nombre} email={session.user.email ?? ''} />;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    let anterior: string | null = null;
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      // Al cerrar sesión se borra del móvil lo guardado de esa cuenta (salvo lo que falta por enviar)
      if (evento === 'SIGNED_OUT' && anterior) limpiarCuenta(anterior);
      anterior = s?.user.id ?? null;
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase)
    return <Mensaje titulo="Tu app está en camino" texto="Estamos terminando de conectar la app. Vuelve a abrirla en unos días." />;
  if (session === undefined) return <Mensaje titulo="Cargando…" texto="Un momento." />;
  if (!session) return <Acceso supabase={supabase} />;
  return <Inicio supabase={supabase} session={session} />;
}
