import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import ConDobleFactor from '../historia/DobleFactor';

// Pantalla de autorización del asistente (OAuth). Claude abre esta página para conectarse a la app.
// Solo el coach, con sesión y doble factor, puede autorizarlo. El paciente nunca llega a conectar nada.

type Detalle = { authorization_id: string; redirect_uri: string; client: { name: string }; scope?: string };

export default function Autorizar({ supabase, userId }: { supabase: SupabaseClient; userId: string }) {
  const [rol, setRol] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.from('profiles').select('role, status').eq('id', userId).maybeSingle()
      .then(({ data }) => setRol(data?.role === 'coach' && data?.status === 'active' ? 'coach' : null));
  }, [supabase, userId]);

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-6">
        <img src="/marca/logotipo-blanco.png" alt="Vitaltrain" className="h-14 w-auto" />
        <h1 className="mt-3 text-2xl font-bold">Conectar el asistente</h1>
      </header>
      <main className="flex-1 px-5 py-6">
        {rol === undefined && <p className="text-texto-suave">Comprobando…</p>}
        {rol === null && <Caja><p>Solo la cuenta del coach puede conectar el asistente.</p></Caja>}
        {rol === 'coach' && <ConDobleFactor supabase={supabase}><Detalles supabase={supabase} /></ConDobleFactor>}
      </main>
    </div>
  );
}

function Caja({ children }: { children: React.ReactNode }) {
  return <div className="max-w-md mx-auto bg-white rounded-2xl p-6 flex flex-col gap-4">{children}</div>;
}

function Detalles({ supabase }: { supabase: SupabaseClient }) {
  const autorizacion = new URLSearchParams(window.location.search).get('authorization_id') ?? '';
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!autorizacion) { setError('Falta la solicitud de conexión. Vuelve a conectar desde Claude.'); return; }
    supabase.auth.oauth.getAuthorizationDetails(autorizacion).then(({ data, error }) => {
      if (error || !data) return setError('La solicitud ha caducado o no es válida. Vuelve a conectar desde Claude.');
      if ('redirect_url' in data && !('authorization_id' in data)) { window.location.href = data.redirect_url; return; }
      setDetalle(data as unknown as Detalle);
    });
  }, [supabase, autorizacion]);

  async function decidir(aprobar: boolean) {
    setOcupado(true);
    const r = aprobar
      ? await supabase.auth.oauth.approveAuthorization(autorizacion, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(autorizacion, { skipBrowserRedirect: true });
    if (r.error || !r.data?.redirect_url) { setOcupado(false); return setError('No se ha podido completar. Vuelve a intentarlo desde Claude.'); }
    window.location.href = r.data.redirect_url;
  }

  if (error) return <Caja><p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p></Caja>;
  if (!detalle) return <Caja><p className="text-texto-suave">Cargando la solicitud…</p></Caja>;
  let destino = detalle.redirect_uri;
  try { destino = new URL(detalle.redirect_uri).host; } catch { /* se muestra tal cual */ }

  return (
    <Caja>
      <div>
        <p className="text-sm text-texto-suave">Solicitud de</p>
        <p className="text-xl font-bold">{detalle.client.name || 'Aplicación sin nombre'}</p>
        <p className="text-sm text-texto-suave mt-1">Volverá a: <strong>{destino}</strong></p>
      </div>
      {destino !== 'claude.ai' && (
        <p className="text-sm font-semibold text-[#8A2C1D]">Esta conexión no vuelve a claude.ai. Si no la has iniciado tú, cancélala.</p>
      )}
      <div className="text-sm leading-relaxed">
        <p className="font-semibold">Si la autorizas, el asistente podrá con tu cuenta de coach:</p>
        <ul className="list-disc pl-5 mt-1">
          <li>Leer los datos de tus pacientes en la app y su historia clínica. Cada lectura de la historia queda en el registro de accesos.</li>
          <li>Preparar propuestas: sesiones, cambios de ejercicio, mensajes y hábitos.</li>
          <li>Aplicar una propuesta cuando tú la apruebes.</li>
        </ul>
        <p className="mt-2">No puede borrar datos ni cambiar nada sin tu aprobación. Puedes retirar el acceso cuando quieras desde Claude.</p>
      </div>
      <div className="flex gap-3">
        <button disabled={ocupado} onClick={() => decidir(false)} className="flex-1 bg-white text-petroleo border-2 border-petroleo font-bold py-3 rounded-xl disabled:opacity-50">Cancelar</button>
        <button disabled={ocupado} onClick={() => decidir(true)} className="flex-1 bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl disabled:opacity-50">Autorizar</button>
      </div>
    </Caja>
  );
}
