import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Acceso from './core/acceso/Acceso';

type Perfil = { full_name: string; role: 'coach' | 'patient'; status: 'active' | 'paused' | 'archived' };
type Pilar = { slug: string; name: string; description: string | null };

function esApple() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function instalada() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function Pie() {
  return (
    <footer className="px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-xs leading-relaxed text-texto-suave">
      Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433
      <br />Versión {__APP_VERSION__}
    </footer>
  );
}

function Instalar() {
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
  const [pilares, setPilares] = useState<Pilar[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('profiles').select('full_name, role, status').eq('id', session.user.id).maybeSingle();
      if (!vivo) return;
      setPerfil((data as Perfil | null) ?? null);
      const p = await supabase.from('pillars').select('slug, name, description').order('position');
      if (vivo) setPilares((p.data as Pilar[] | null) ?? []);
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
  return (
    <div className="min-h-full flex flex-col">
      <Cabecera
        titulo={`Hola, ${nombre}`}
        texto={perfil.role === 'coach' ? 'Has entrado como coach. El panel llega en las próximas tareas.' : 'Tu plan con Rubén aparecerá aquí muy pronto.'}
      />
      <main className="flex-1 px-5 py-6 flex flex-col gap-4">
        <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="pilares">
          <h2 id="pilares" className="text-[13px] font-semibold tracking-wider text-texto-suave">LOS CINCO PILARES</h2>
          <ul className="flex flex-col gap-3">
            {pilares.map((p) => (
              <li key={p.slug} className="flex flex-col gap-0.5">
                <span className="text-base font-semibold">{p.name}</span>
                {p.description && <span className="text-sm text-texto-suave leading-snug">{p.description}</span>}
              </li>
            ))}
          </ul>
        </section>
        <Instalar />
        <button onClick={salir} className="bg-white text-petroleo border-2 border-petroleo text-base font-bold py-3.5 rounded-2xl">
          Cerrar sesión
        </button>
      </main>
      <Pie />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase)
    return <Mensaje titulo="Tu app está en camino" texto="Estamos terminando de conectar la app. Vuelve a abrirla en unos días." />;
  if (session === undefined) return <Mensaje titulo="Cargando…" texto="Un momento." />;
  if (!session) return <Acceso supabase={supabase} />;
  return <Inicio supabase={supabase} session={session} />;
}
