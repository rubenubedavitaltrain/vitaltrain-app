import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MOTIVOS } from '../paciente/tipos';
import { desdeIso } from '../../../lib/fechas';

// Notas y avisos de "No puedo hacerlo" que el paciente deja en cada ejercicio.

type Fila = {
  id: string; note: string | null; cannot_do: boolean; reason: keyof typeof MOTIVOS | null; read_by_coach_at: string | null; created_at: string;
  workout_items: { exercises: { name: string }; workout_blocks: { workouts: { scheduled_date: string } } };
};

export default function NotasDelPaciente({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);

  async function cargar() {
    const { data } = await supabase
      .from('workout_item_feedback')
      .select('id, note, cannot_do, reason, read_by_coach_at, created_at, workout_items(exercises(name), workout_blocks(workouts(scheduled_date)))')
      .eq('patient_id', pacienteId)
      .order('created_at', { ascending: false })
      .limit(30);
    setFilas((data as unknown as Fila[]) ?? []);
  }
  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function marcarLeidas() {
    await supabase.from('workout_item_feedback').update({ read_by_coach_at: new Date().toISOString() }).eq('patient_id', pacienteId).is('read_by_coach_at', null);
    cargar();
  }

  const sinLeer = (filas ?? []).filter((f) => !f.read_by_coach_at).length;

  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="notas-paciente">
      <div className="flex items-center gap-2">
        <h3 id="notas-paciente" className="text-lg font-bold mr-auto">Notas del paciente</h3>
        {sinLeer > 0 && <button onClick={marcarLeidas} className="text-sm font-bold text-petroleo">Marcar {sinLeer} como leídas</button>}
      </div>
      {filas && filas.length === 0 && <p className="text-sm text-texto-suave">Todavía no ha dejado notas en sus ejercicios.</p>}
      <ul className="flex flex-col gap-2">
        {filas?.map((f) => (
          <li key={f.id} className={`text-sm rounded-xl p-3 ${f.read_by_coach_at ? 'bg-fondo' : 'bg-[#F4F1E4] border-l-4 border-mostaza'}`}>
            <div className="font-semibold">{f.workout_items.exercises.name}</div>
            <div className="text-xs text-texto-suave">{desdeIso(f.workout_items.workout_blocks.workouts.scheduled_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</div>
            {f.cannot_do && <div className="font-semibold text-[#8A2C1D]">No ha podido: {f.reason ? MOTIVOS[f.reason] : 'sin motivo'}</div>}
            {f.note && <div>«{f.note}»</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
