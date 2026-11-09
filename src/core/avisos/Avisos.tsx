import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { activarAvisos, desactivarAvisos, estadoAvisos, type Estado } from './avisos';

// Avisos: en el Perfil del paciente (este móvil, mensajes, recordatorio de entrenamiento)
// y en el panel del coach (este ordenador y la configuración de las claves).

export function AvisosDispositivo({ supabase, texto }: { supabase: SupabaseClient; texto: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { estadoAvisos().then(setEstado); }, []);
  if (!estado) return null;
  return (
    <div className="flex flex-col gap-2">
      {estado === 'activo' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm"><b className="text-petroleo">Avisos activados</b> {texto}.</span>
          <button disabled={ocupado} onClick={async () => { setOcupado(true); await desactivarAvisos(supabase); setOcupado(false); setEstado(await estadoAvisos()); }} className="text-sm font-semibold text-texto-suave px-2">Desactivar</button>
        </div>
      )}
      {estado === 'inactivo' && (
        <button disabled={ocupado} onClick={async () => { setOcupado(true); setError(''); const e = await activarAvisos(supabase); setOcupado(false); if (e) setError(e); setEstado(await estadoAvisos()); }}
          className="bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl disabled:opacity-60">{ocupado ? 'Activando…' : `Activar avisos ${texto}`}</button>
      )}
      {estado === 'instalar-primero' && <p className="text-sm bg-fondo rounded-xl p-3">En iPhone, los avisos solo funcionan con la app instalada. En Safari: tres puntos (···) → Compartir → «Añadir a pantalla de inicio». Abre la app desde el icono y vuelve aquí.</p>}
      {estado === 'bloqueado' && <p className="text-sm bg-fondo rounded-xl p-3">Los avisos están bloqueados para esta app. Actívalos en los ajustes del navegador o del móvil (Notificaciones) y vuelve aquí.</p>}
      {estado === 'no-soportado' && <p className="text-sm text-texto-suave">Este navegador no admite avisos. Te llegará un email cuando tengas un mensaje nuevo.</p>}
      {error && <p role="alert" className="text-sm font-semibold text-[#8A2C1D]">{error}</p>}
    </div>
  );
}

type Prefs = { reminder_enabled: boolean; reminder_time: string | null; notify_messages: boolean };

/** Perfil del paciente. */
export function AvisosPaciente({ supabase, pacienteId, conEntreno }: { supabase: SupabaseClient; pacienteId: string; conEntreno: boolean }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [estado, setEstado] = useState('');
  useEffect(() => {
    supabase.from('patient_settings').select('reminder_enabled, reminder_time, notify_messages').eq('patient_id', pacienteId).maybeSingle()
      .then(({ data }) => setPrefs((data as Prefs | null) ?? { reminder_enabled: false, reminder_time: null, notify_messages: true }));
  }, [supabase, pacienteId]);
  if (!prefs) return null;

  async function guardar(cambio: Partial<Prefs>) {
    const nuevo = { ...prefs!, ...cambio };
    if (nuevo.reminder_enabled && !nuevo.reminder_time) nuevo.reminder_time = '18:00';
    setPrefs(nuevo); setEstado('');
    const { error } = await supabase.from('patient_settings').upsert({ patient_id: pacienteId, ...nuevo }, { onConflict: 'patient_id' });
    setEstado(error ? 'No se ha podido guardar.' : 'Guardado.');
  }

  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-4" aria-labelledby="avisos">
      <div>
        <h2 id="avisos" className="font-bold">Avisos</h2>
        <p className="text-xs text-texto-suave">Los avisos solo dicen que hay algo nuevo, nunca el contenido de los mensajes.</p>
      </div>
      <AvisosDispositivo supabase={supabase} texto="en este móvil" />
      <label className="flex items-center justify-between gap-3">
        <span><span className="block font-semibold">Mensajes de Rubén</span><span className="block text-xs text-texto-suave">Si no tienes avisos en el móvil, te llega un email.</span></span>
        <input type="checkbox" checked={prefs.notify_messages} onChange={(e) => guardar({ notify_messages: e.target.checked })} className="w-6 h-6 accent-[#374949]" />
      </label>
      {conEntreno && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3">
            <span><span className="block font-semibold">Recordatorio de entrenamiento</span><span className="block text-xs text-texto-suave">Solo los días que tengas sesión y no la hayas hecho.</span></span>
            <input type="checkbox" checked={prefs.reminder_enabled} onChange={(e) => guardar({ reminder_enabled: e.target.checked })} className="w-6 h-6 accent-[#374949]" />
          </label>
          {prefs.reminder_enabled && (
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              A las
              <input type="time" step={900} value={prefs.reminder_time?.slice(0, 5) ?? '18:00'} onChange={(e) => e.target.value && guardar({ reminder_time: e.target.value })} className="text-lg font-normal px-3 py-2 border border-borde rounded-xl" />
            </label>
          )}
        </div>
      )}
      {estado && <p role="status" className="text-xs text-texto-suave">{estado}</p>}
    </section>
  );
}

// ---------------- Coach: configurar las claves (una sola vez) ----------------

const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Genera en este navegador las claves de los avisos. La clave pública se guarda en la base de datos;
 * la privada y el secreto del reloj solo se muestran aquí para pegarlos en los secretos de Supabase. No se guardan en la app.
 */
export function ConfigAvisos({ supabase, proyecto }: { supabase: SupabaseClient; proyecto: string }) {
  const [publica, setPublica] = useState<string | null | undefined>(undefined);
  const [claves, setClaves] = useState<{ publica: string; privada: string; cron: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { supabase.from('app_settings').select('value').eq('key', 'vapid_public_key').maybeSingle().then(({ data }) => setPublica((data as { value: string } | null)?.value ?? null)); }, [supabase]);

  async function generar() {
    if (publica && !window.confirm('Ya hay claves. Si generas otras, los móviles que tienen los avisos activados tendrán que activarlos de nuevo. ¿Seguir?')) return;
    setError('');
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = b64url(await crypto.subtle.exportKey('raw', par.publicKey));
    const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
    const cron = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const r1 = await supabase.from('app_settings').upsert({ key: 'vapid_public_key', value: pub, updated_at: new Date().toISOString() });
    const r2 = await supabase.rpc('guardar_secreto_avisos', { p_secreto: cron });
    if (r1.error || r2.error) return setError('No se han podido guardar. Inténtalo de nuevo.');
    setPublica(pub);
    setClaves({ publica: pub, privada: jwk.d!, cron });
  }

  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3 max-w-3xl" aria-labelledby="config-avisos">
      <div>
        <h3 id="config-avisos" className="text-lg font-bold">Claves de los avisos</h3>
        <p className="text-sm text-texto-suave">{publica ? 'Ya están configuradas.' : 'Falta configurarlas. Se hace una sola vez.'}</p>
      </div>
      {!claves && <button onClick={generar} className="self-start bg-petroleo text-white font-bold px-4 py-2.5 rounded-xl">{publica ? 'Generar claves nuevas' : 'Generar claves'}</button>}
      {claves && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-[#8A2C1D]">Estas claves solo se muestran ahora. No las envíes a nadie ni las pegues en un chat.</p>
          <ol className="text-sm list-decimal pl-5 flex flex-col gap-1">
            <li>Abre <a className="font-semibold text-petroleo underline" href={`https://supabase.com/dashboard/project/${proyecto}/functions/secrets`} target="_blank" rel="noopener">Supabase → Edge Functions → Secrets</a>.</li>
            <li>Añade estos tres secretos con el botón «Copiar» de cada uno.</li>
            <li>Añade también <code>MAILGUN_API_KEY</code> con la clave de envío de Mailgun (Mailgun → Sending → API keys).</li>
          </ol>
          {([['VAPID_PUBLIC_KEY', claves.publica], ['VAPID_PRIVATE_KEY', claves.privada], ['CRON_SECRET', claves.cron]] as const).map(([n, v]) => (
            <div key={n} className="flex items-center gap-2 bg-fondo rounded-xl p-2">
              <code className="font-mono text-sm font-bold w-44 shrink-0">{n}</code>
              <code className="font-mono text-xs truncate flex-1">{v.slice(0, 6)}••••••</code>
              <button onClick={() => navigator.clipboard.writeText(v)} className="text-sm font-bold text-petroleo px-2">Copiar</button>
            </div>
          ))}
          <button onClick={() => setClaves(null)} className="self-start text-sm font-semibold text-texto-suave">Ya los he pegado: ocultar</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-[#8A2C1D]">{error}</p>}
    </section>
  );
}
