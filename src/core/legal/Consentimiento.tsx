import { useCallback, useEffect, useState } from 'react';
import { exportarDatos } from './exportar';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FECHA_CONSENTIMIENTO, FRASE_ACEPTACION, SECCIONES, VERSION_CONSENTIMIENTO } from './textoConsentimiento';

// Consentimiento del paciente (núcleo): pantalla para aceptarlo, texto completo y sección de Privacidad del perfil.
// La base de datos no deja ver ni registrar nada sin un consentimiento en vigor (migración 0009).

export type Consentimiento = { version: string; accepted_at: string } | null;
type Estado = 'cargando' | 'vigente' | 'falta' | 'nueva-version';

const clave = (u: string) => `vt.${u}.consentimiento`;
function leerCopia(u: string): Consentimiento { try { return JSON.parse(localStorage.getItem(clave(u)) ?? 'null'); } catch { return null; } }
function guardarCopia(u: string, c: Consentimiento) { try { if (c) localStorage.setItem(clave(u), JSON.stringify(c)); else localStorage.removeItem(clave(u)); } catch { /* sin almacenamiento */ } }

export function useConsentimiento(supabase: SupabaseClient, userId: string) {
  const [actual, setActual] = useState<Consentimiento | undefined>(() => leerCopia(userId) ?? undefined);
  const [sinConexion, setSinConexion] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('consents')
      .select('version, accepted_at')
      .eq('patient_id', userId)
      .is('withdrawn_at', null)
      .is('replaced_at', null)
      .maybeSingle();
    if (error) {
      // Sin conexión: vale la última copia guardada en el móvil
      setSinConexion(true);
      setActual((a) => (a === undefined ? leerCopia(userId) : a));
      return;
    }
    setSinConexion(false);
    const c = (data as Consentimiento) ?? null;
    guardarCopia(userId, c);
    setActual(c);
  }, [supabase, userId]);

  useEffect(() => { cargar(); }, [cargar]);

  const estado: Estado = actual === undefined ? 'cargando' : !actual ? 'falta' : actual.version !== VERSION_CONSENTIMIENTO ? 'nueva-version' : 'vigente';
  return { estado, actual: actual ?? null, sinConexion, recargar: cargar };
}

export function TextoCompleto() {
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed">
      {SECCIONES.map((s) => (
        <section key={s.titulo} className="flex flex-col gap-1.5">
          <h3 className="font-bold">{s.titulo}</h3>
          {s.parrafos.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
      <p className="text-xs text-texto-suave">Versión {VERSION_CONSENTIMIENTO} · {FECHA_CONSENTIMIENTO}</p>
    </div>
  );
}

/** Pantalla que bloquea la app hasta que el paciente acepta. */
export function PantallaConsentimiento({ supabase, nombre, nuevaVersion, onAceptado, onSalir }: {
  supabase: SupabaseClient; nombre: string; nuevaVersion: boolean; onAceptado: () => void; onSalir: () => void;
}) {
  const [completo, setCompleto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [rechazado, setRechazado] = useState(false);

  async function aceptar() {
    setError('');
    setEnviando(true);
    const { error } = await supabase.rpc('accept_consent', { p_version: VERSION_CONSENTIMIENTO, p_user_agent: navigator.userAgent.slice(0, 300) });
    setEnviando(false);
    if (error) return setError(navigator.onLine ? 'No se ha podido guardar. Inténtalo de nuevo.' : 'Necesitas conexión a internet para aceptar.');
    onAceptado();
  }

  if (rechazado) {
    return (
      <div className="min-h-full flex flex-col bg-fondo">
        <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
          <h1 className="text-2xl font-bold">Sin consentimiento no podemos guardar tus datos</h1>
        </header>
        <div className="p-5 flex flex-col gap-4">
          <p>Lo entendemos. Sin tu consentimiento la app no puede registrar tus entrenamientos.</p>
          <p>Tu acompañamiento puede seguir por otras vías. Habla con Rubén para acordarlo.</p>
          <button onClick={() => setRechazado(false)} className="bg-mostaza text-[#1F2424] font-bold py-4 rounded-2xl">Volver</button>
          <button onClick={onSalir} className="bg-white text-petroleo border-2 border-petroleo font-bold py-3.5 rounded-2xl">Cerrar sesión</button>
        </div>
      </div>
    );
  }

  if (completo) {
    return (
      <div className="min-h-full flex flex-col bg-fondo">
        <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-5">
          <button onClick={() => setCompleto(false)} className="text-[#E3E8E8] font-semibold mb-2">← Volver</button>
          <h1 className="text-2xl font-bold">Condiciones</h1>
        </header>
        <div className="p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] flex flex-col gap-4 max-w-2xl w-full mx-auto">
          <section className="bg-white rounded-2xl p-5"><TextoCompleto /></section>
          <button onClick={() => setCompleto(false)} className="bg-mostaza text-[#1F2424] font-bold py-4 rounded-2xl text-lg">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-fondo">
      <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
        <img src="/marca/logotipo-blanco.png" alt="Vitaltrain" className="h-10 w-auto mb-3" />
        <h1 className="text-2xl font-bold leading-tight">{nuevaVersion ? 'Hemos actualizado las condiciones' : `Bienvenido, ${nombre}`}</h1>
      </header>
      <div className="p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] flex flex-col gap-4 max-w-2xl w-full mx-auto">
        <section className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          <p className="leading-snug">{FRASE_ACEPTACION}</p>
          <button onClick={() => setCompleto(true)} className="self-start text-petroleo font-bold underline underline-offset-4">
            Leer las condiciones
          </button>
        </section>

        {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
        <button onClick={aceptar} disabled={enviando} className="bg-mostaza text-[#1F2424] font-bold py-4 rounded-2xl text-lg disabled:opacity-50">
          {enviando ? 'Guardando…' : 'Acepto'}
        </button>
        <button onClick={() => setRechazado(true)} className="text-texto-suave font-semibold py-2">No acepto</button>
        <p className="text-center text-xs text-texto-suave">Versión {VERSION_CONSENTIMIENTO} · {FECHA_CONSENTIMIENTO}</p>
      </div>
    </div>
  );
}

/** Sección «Privacidad» del perfil del paciente. */
export function Privacidad({ supabase, actual, onRetirado }: { supabase: SupabaseClient; actual: Consentimiento; onRetirado: () => void }) {
  const [verTexto, setVerTexto] = useState(false);
  const [error, setError] = useState('');

  async function retirar() {
    if (!window.confirm('Si retiras tu consentimiento, dejarás de poder ver tu plan y registrar entrenamientos en la app. Tus datos quedarán bloqueados cinco años y después se borrarán. ¿Retirarlo?')) return;
    const { error } = await supabase.rpc('withdraw_consent');
    if (error) return setError('No se ha podido retirar. Comprueba la conexión.');
    onRetirado();
  }

  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="privacidad">
      <h2 id="privacidad" className="text-lg font-bold">Privacidad</h2>
      {actual && (
        <p className="text-sm text-texto-suave">
          Aceptaste la versión {actual.version} el {new Date(actual.accepted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      )}
      <button onClick={() => setVerTexto((v) => !v)} aria-expanded={verTexto} className="self-start text-petroleo font-bold">
        {verTexto ? 'Ocultar las condiciones' : 'Leer las condiciones'}
      </button>
      {verTexto && <div className="border-t border-gris-claro pt-3"><TextoCompleto /></div>}
      <button
        onClick={async () => {
          setError('');
          const { data } = await supabase.auth.getUser();
          if (!data.user) return setError('Vuelve a entrar para descargar tus datos.');
          const fallos = await exportarDatos(supabase, data.user.id, false);
          if (fallos.length) setError(`Descargado, salvo: ${fallos.join(', ')}. Escribe a Rubén si los necesitas.`);
        }}
        className="self-start bg-white border-2 border-petroleo text-petroleo font-bold px-4 py-2 rounded-xl"
      >
        Descargar mis datos
      </button>
      <p className="text-sm text-texto-suave">Es un archivo con todo lo que has registrado en la app. Para corregir o borrar datos, o pedir tu historia clínica, escribe a Rubén.</p>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <button onClick={retirar} className="self-start text-[#8A2C1D] font-bold py-1">Retirar mi consentimiento</button>
    </section>
  );
}
