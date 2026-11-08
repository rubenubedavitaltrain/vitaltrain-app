import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Conversacion from '../mensajes/Conversacion';

// Bandeja de mensajes del coach: una conversación por paciente, con los no leídos arriba.

type Paciente = { id: string; full_name: string; status: string };
type Ultimo = { patient_id: string; sender_id: string; body: string; read_at: string | null; created_at: string };
type Fila = { p: Paciente; ultimo: Ultimo | null; sinLeer: number; ultimaSesion: string | null };

const cuando = (f: string) => {
  const d = new Date(f);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export default function Mensajes({ supabase, yo, abrirId, onAbrirFicha }: { supabase: SupabaseClient; yo: string; abrirId?: string | null; onAbrirFicha: (id: string) => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(abrirId ?? null);

  const cargar = useCallback(async () => {
    const [p, m, w] = await Promise.all([
      supabase.from('profiles').select('id, full_name, status').eq('role', 'patient').neq('status', 'archived').order('full_name'),
      supabase.from('messages').select('patient_id, sender_id, body, read_at, created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('workouts').select('patient_id, scheduled_date').eq('status', 'completed').order('scheduled_date', { ascending: false }).limit(500),
    ]);
    const ms = (m.data as Ultimo[]) ?? [];
    const ws = (w.data as { patient_id: string; scheduled_date: string }[]) ?? [];
    const fs = ((p.data as Paciente[]) ?? []).map((pac) => ({
      p: pac,
      ultimo: ms.find((x) => x.patient_id === pac.id) ?? null,
      sinLeer: ms.filter((x) => x.patient_id === pac.id && x.sender_id === pac.id && !x.read_at).length,
      ultimaSesion: ws.find((x) => x.patient_id === pac.id)?.scheduled_date ?? null,
    }));
    fs.sort((a, b) => (b.sinLeer > 0 ? 1 : 0) - (a.sinLeer > 0 ? 1 : 0) || (b.ultimo?.created_at ?? '').localeCompare(a.ultimo?.created_at ?? '') || a.p.full_name.localeCompare(b.p.full_name, 'es'));
    setFilas(fs);
  }, [supabase]);

  useEffect(() => {
    cargar();
    const t = window.setInterval(cargar, 30000);
    return () => window.clearInterval(t);
  }, [cargar]);

  const actual = filas?.find((f) => f.p.id === abierto) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">Mensajes</h2>
      <div className="bg-white rounded-2xl overflow-hidden grid md:grid-cols-[18rem_1fr] h-[calc(100dvh-13rem)] min-h-[28rem]">
        <ul className={`border-r border-fondo overflow-y-auto ${actual ? 'hidden md:block' : ''}`} aria-label="Conversaciones">
          {!filas && <li className="p-4 text-texto-suave">Cargando…</li>}
          {filas?.length === 0 && <li className="p-4 text-texto-suave">Aún no tienes pacientes.</li>}
          {filas?.map((f) => (
            <li key={f.p.id}>
              <button onClick={() => setAbierto(f.p.id)} className={`w-full text-left px-4 py-3 border-b border-fondo flex gap-3 items-start ${abierto === f.p.id ? 'bg-[#F4F1E4]' : ''}`}>
                <span className="w-9 h-9 rounded-full bg-petroleo text-white font-bold flex items-center justify-center shrink-0">{f.p.full_name.charAt(0).toUpperCase()}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex justify-between gap-2">
                    <span className={`truncate ${f.sinLeer ? 'font-bold' : 'font-semibold'}`}>{f.p.full_name}</span>
                    {f.ultimo && <span className="text-[11px] text-texto-suave shrink-0">{cuando(f.ultimo.created_at)}</span>}
                  </span>
                  <span className="flex justify-between gap-2">
                    <span className={`text-sm truncate ${f.sinLeer ? 'text-[#4A4A4C]' : 'text-texto-suave'}`}>{f.ultimo ? `${f.ultimo.sender_id === yo ? 'Tú: ' : ''}${f.ultimo.body}` : 'Sin mensajes'}</span>
                    {f.sinLeer > 0 && <span className="shrink-0 bg-mostaza text-[#1F2424] text-xs font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">{f.sinLeer}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className={`flex flex-col min-h-0 bg-fondo ${actual ? '' : 'hidden md:flex'}`}>
          {actual ? (
            <>
              <div className="bg-white px-4 py-3 border-b border-fondo flex items-center gap-3">
                <button onClick={() => setAbierto(null)} className="md:hidden text-petroleo font-bold" aria-label="Volver a la lista">←</button>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{actual.p.full_name}</span>
                  <span className="block text-xs text-texto-suave">
                    {actual.ultimaSesion ? `Última sesión hecha: ${new Date(`${actual.ultimaSesion}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Aún no ha hecho ninguna sesión'}
                    {actual.p.status !== 'active' ? ' · en pausa' : ''}
                  </span>
                </span>
                <button onClick={() => onAbrirFicha(actual.p.id)} className="text-sm font-bold text-petroleo border-2 border-petroleo rounded-xl px-3 py-1.5">Ver ficha</button>
              </div>
              <Conversacion key={actual.p.id} supabase={supabase} pacienteId={actual.p.id} yo={yo} esCoach alto="flex-1" onLeidos={cargar} />
            </>
          ) : (
            <p className="m-auto text-texto-suave">Elige un paciente para ver la conversación.</p>
          )}
        </div>
      </div>
    </div>
  );
}
