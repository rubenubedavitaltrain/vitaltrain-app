import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hoyIso, iso, sumarDias } from '../../lib/fechas';
import { fechaLarga } from './datos';

// Panel de inicio: próximas revisiones según la última consulta de cada paciente.
// Necesita doble factor (son datos de la historia). Sin él, solo invita a activarlo.

type Fila = { patient_id: string; happened_at: string; next_review: string | null; profiles: { full_name: string } | { full_name: string }[] | null };

export default function Revisiones({ supabase, onAbrir }: { supabase: SupabaseClient; onAbrir: (id: string) => void }) {
  const [estado, setEstado] = useState<'cargando' | 'sin2fa' | 'ok'>('cargando');
  const [filas, setFilas] = useState<{ id: string; nombre: string; fecha: string; ultima: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== 'aal2') return setEstado('sin2fa');
      const { data } = await supabase.from('consultations').select('patient_id, happened_at, next_review, profiles(full_name)').eq('status', 'closed').order('happened_at', { ascending: false }).limit(1000);
      const ultimas = new Map<string, Fila>();
      for (const c of (data as Fila[]) ?? []) if (!ultimas.has(c.patient_id)) ultimas.set(c.patient_id, c);
      const desde = iso(sumarDias(new Date(), -14)), hasta = iso(sumarDias(new Date(), 21));
      setFilas([...ultimas.values()].filter((c) => c.next_review && c.next_review >= desde && c.next_review <= hasta)
        .map((c) => ({ id: c.patient_id, nombre: (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.full_name ?? '', fecha: c.next_review!, ultima: c.happened_at }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)));
      setEstado('ok');
    })();
  }, [supabase]);

  if (estado === 'cargando') return null;
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="revisiones">
      <h3 id="revisiones" className="text-lg font-bold">Próximas revisiones</h3>
      {estado === 'sin2fa' && <p className="text-sm text-texto-suave">Abre la historia clínica de cualquier paciente con tu segundo código y aquí verás las revisiones de las próximas tres semanas y las que se han pasado.</p>}
      {estado === 'ok' && filas.length === 0 && <p className="text-sm text-texto-suave">Ninguna revisión pendiente en las próximas tres semanas.</p>}
      <ul className="flex flex-col gap-1.5">
        {filas.map((f) => {
          const pasada = f.fecha < hoyIso();
          return (
            <li key={f.id}>
              <button onClick={() => onAbrir(f.id)} className={`w-full text-left rounded-xl px-4 py-2.5 flex flex-wrap justify-between gap-2 ${pasada ? 'bg-[#F4F1E4] border-l-4 border-mostaza' : 'bg-fondo'}`}>
                <span className="font-semibold">{f.nombre}</span>
                <span className="text-sm">{pasada ? 'Pasada: ' : ''}{fechaLarga(f.fecha)} <span className="text-texto-suave">· última consulta {fechaLarga(f.ultima)}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
