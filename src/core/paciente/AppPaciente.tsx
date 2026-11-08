import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MiSemana, TarjetaHoy } from '../../modules/entrenamiento/paciente/Semana';
import Entrenamiento from '../../modules/entrenamiento/paciente/Entrenamiento';
import Progreso from '../../modules/entrenamiento/progreso/Progreso';
import Medidas from '../medidas/Medidas';
import Conversacion, { contarNoLeidos } from '../mensajes/Conversacion';
import Instalar from '../Instalar';
import { PantallaConsentimiento, Privacidad, useConsentimiento, type Consentimiento } from '../legal/Consentimiento';
import { descartarFallidos, fallidos, pendientes, usarCuenta, vaciarCola } from '../../modules/entrenamiento/paciente/datos';

// App del paciente (móvil). Menú inferior. Cada módulo activo aporta su tarjeta a "Hoy".

type Pilar = { slug: string; name: string; description: string | null };
type Pestaña = 'hoy' | 'semana' | 'progreso' | 'mensajes' | 'perfil';

// Qué pilar ilumina cada módulo
const PILAR_DE_MODULO: Record<string, string> = { training: 'movimiento-inteligente', circadian: 'ritmos-circadianos' };

function leer<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function escribir(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nada */ } }

export default function AppPaciente({ supabase, userId, nombre, email }: { supabase: SupabaseClient; userId: string; nombre: string; email: string }) {
  usarCuenta(userId);
  const [pestaña, setPestaña] = useState<Pestaña>('hoy');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pilares, setPilares] = useState<Pilar[]>(() => leer('vt.pilares') ?? []);
  const [modulos, setModulos] = useState<string[]>(() => leer('vt.modulos') ?? ['training']);
  const [recarga, setRecarga] = useState(0);
  const consentimiento = useConsentimiento(supabase, userId);
  const [noLeidos, setNoLeidos] = useState(0);

  const conConsentimiento = consentimiento.estado === 'vigente';
  useEffect(() => {
    if (!conConsentimiento) return;
    vaciarCola(supabase);
    supabase.from('pillars').select('slug, name, description').order('position').then(({ data }) => {
      if (data) { setPilares(data as Pilar[]); escribir('vt.pilares', data); }
    });
    supabase.from('patient_modules').select('module_slug').eq('patient_id', userId).then(({ data }) => {
      if (data) { const m = data.map((x) => x.module_slug as string); setModulos(m); escribir('vt.modulos', m); }
    });
    const contar = () => contarNoLeidos(supabase, userId).then(setNoLeidos).catch(() => {});
    contar();
    const t = window.setInterval(contar, 60000);
    const online = () => vaciarCola(supabase);
    window.addEventListener('online', online);
    return () => { window.removeEventListener('online', online); window.clearInterval(t); };
  }, [supabase, userId, conConsentimiento]);

  if (consentimiento.estado === 'cargando') return <div className="min-h-full flex items-center justify-center text-texto-suave">Cargando…</div>;
  if (!conConsentimiento) {
    return (
      <PantallaConsentimiento
        supabase={supabase} nombre={nombre} nuevaVersion={consentimiento.estado === 'nueva-version'}
        onAceptado={consentimiento.recargar} onSalir={() => supabase.auth.signOut()}
      />
    );
  }

  if (abierta) {
    return <Entrenamiento supabase={supabase} sesionId={abierta} pacienteId={userId} onSalir={() => { setAbierta(null); setRecarga((r) => r + 1); }} />;
  }

  const activos = new Set(modulos.map((m) => PILAR_DE_MODULO[m]).filter(Boolean));

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 pb-24" key={recarga}>
        {pestaña === 'hoy' && (
          <>
            <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
              <img src="/marca/logotipo-blanco.png" alt="Vitaltrain" className="h-12 w-auto mb-3" />
              <h1 className="text-3xl font-bold">Hola, {nombre}</h1>
              <p className="text-[#E3E8E8] mt-1">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </header>
            <main className="p-4 flex flex-col gap-4">
              {fallidos() > 0 && (
                <div role="alert" className="bg-white rounded-2xl p-4 border-l-4 border-[#8A2C1D] flex flex-col gap-2">
                  <p className="font-semibold">{fallidos() === 1 ? 'Un registro no se ha podido guardar' : `${fallidos()} registros no se han podido guardar`}</p>
                  <p className="text-sm text-texto-suave">Rubén cambió esa sesión mientras entrenabas sin conexión. Escríbele por Mensajes con lo que hiciste para que lo tenga en cuenta.</p>
                  <button onClick={() => { descartarFallidos(); setRecarga((r) => r + 1); }} className="self-start text-sm font-bold text-petroleo">Entendido</button>
                </div>
              )}
              {modulos.includes('training') && <TarjetaHoy supabase={supabase} onAbrir={setAbierta} />}
              {pilares.length > 0 && (
                <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="pilares">
                  <h2 id="pilares" className="text-xs font-bold tracking-wide text-texto-suave">TUS PILARES</h2>
                  <ul className="flex flex-col gap-3">
                    {pilares.map((p) => {
                      const on = activos.has(p.slug);
                      return (
                        <li key={p.slug} className={`flex gap-3 ${on ? '' : 'opacity-45'}`}>
                          <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${on ? 'bg-mostaza' : 'bg-borde'}`} aria-hidden="true" />
                          <span>
                            <span className="block font-semibold">{p.name}{on ? '' : ' · próximamente'}</span>
                            {p.description && <span className="block text-sm text-texto-suave leading-snug">{p.description}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </main>
          </>
        )}
        {pestaña === 'semana' && <MiSemana supabase={supabase} onAbrir={setAbierta} />}
        {pestaña === 'mensajes' && (
          <div className="flex flex-col h-[calc(100dvh-5.5rem)]">
            <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 shrink-0">
              <h1 className="text-2xl font-bold">Mensajes</h1>
              <p className="text-[#E3E8E8] text-sm">Con Rubén. Para urgencias, llama al 112.</p>
            </header>
            <Conversacion supabase={supabase} pacienteId={userId} yo={userId} esCoach={false} alto="flex-1" onLeidos={() => setNoLeidos(0)} />
          </div>
        )}
        {pestaña === 'progreso' && (
          <div className="flex flex-col">
            <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-6">
              <h1 className="text-2xl font-bold">Mi progreso</h1>
              <p className="text-[#E3E8E8] text-sm mt-1">Lo que has hecho, semana a semana.</p>
            </header>
            <div className="p-4 flex flex-col gap-4"><Progreso supabase={supabase} pacienteId={userId} /><Medidas supabase={supabase} pacienteId={userId} /></div>
          </div>
        )}
        {pestaña === 'perfil' && <Perfil supabase={supabase} nombre={nombre} email={email} consentimiento={consentimiento.actual} onRetirado={() => { setPestaña('hoy'); consentimiento.recargar(); }} />}
      </div>

      <nav aria-label="Navegación principal" className="fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro grid grid-cols-5 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] z-20">
        <Boton activo={pestaña === 'hoy'} onClick={() => setPestaña('hoy')} texto="Hoy" icono={<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />} />
        <Boton activo={pestaña === 'semana'} onClick={() => setPestaña('semana')} texto="Semana" icono={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>} />
        <Boton activo={pestaña === 'progreso'} onClick={() => setPestaña('progreso')} texto="Progreso" icono={<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />} />
        <Boton activo={pestaña === 'mensajes'} onClick={() => setPestaña('mensajes')} texto="Mensajes" aviso={noLeidos} icono={<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />} />
        <Boton activo={pestaña === 'perfil'} onClick={() => setPestaña('perfil')} texto="Perfil" icono={<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>} />
      </nav>
    </div>
  );
}

function Boton({ activo, onClick, texto, icono, aviso = 0 }: { activo: boolean; onClick: () => void; texto: string; icono: React.ReactNode; aviso?: number }) {
  return (
    <button onClick={onClick} aria-current={activo ? 'page' : undefined} className={`flex flex-col items-center gap-1 py-1.5 text-[13px] ${activo ? 'text-petroleo font-bold' : 'text-texto-suave font-medium'}`}>
      <span className="relative">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icono}</svg>
        {aviso > 0 && <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-mostaza text-[#1F2424] text-[10px] font-bold flex items-center justify-center" aria-label={`${aviso} sin leer`}>{aviso}</span>}
      </span>
      {texto}
    </button>
  );
}

function Perfil({ supabase, nombre, email, consentimiento, onRetirado }: { supabase: SupabaseClient; nombre: string; email: string; consentimiento: Consentimiento; onRetirado: () => void }) {
  return (
    <div className="flex flex-col">
      <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-6">
        <h1 className="text-2xl font-bold">Perfil</h1>
      </header>
      <div className="p-4 flex flex-col gap-3">
        <div className="bg-white rounded-2xl p-5">
          <div className="text-lg font-bold">{nombre}</div>
          <div className="text-sm text-texto-suave">{email}</div>
        </div>
        <Instalar />
        <Privacidad supabase={supabase} actual={consentimiento} onRetirado={onRetirado} />
        <div className="bg-white rounded-2xl p-5 text-sm text-texto-suave">
          Recordatorios y avisos llegarán en las próximas versiones.
        </div>
        <button
          onClick={() => {
            const n = pendientes();
            if (n && !window.confirm(`Tienes ${n} registros sin enviar porque no hay conexión. Se enviarán cuando vuelvas a entrar con esta cuenta. ¿Cerrar sesión igualmente?`)) return;
            supabase.auth.signOut();
          }}
          className="bg-white text-petroleo border-2 border-petroleo font-bold py-3.5 rounded-2xl"
        >
          Cerrar sesión
        </button>
        <p className="text-center text-xs text-texto-suave mt-2">
          Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433 · Versión {__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
