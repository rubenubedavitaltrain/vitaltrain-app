import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import SelectorEjercicio, { type EjercicioMini } from '../biblioteca/SelectorEjercicio';
import { miniatura } from '../biblioteca/youtube';
import { desdeIso, hoyIso } from '../../../lib/fechas';
import { comoLista } from '../paciente/datos';

// Cambiar un ejercicio por otro en todas las sesiones pendientes de un paciente (replace_exercise).
// Solo toca sesiones pendientes y ejercicios sin series ni notas registradas.

type Fila = {
  scheduled_date: string;
  workout_blocks: { workout_items: { exercise_id: string; exercises: EjercicioMini; set_logs: { count: number }[] | { count: number } | null; workout_item_feedback: { count: number }[] | { count: number } | null }[] }[];
};
type Uso = { ejercicio: EjercicioMini; fechas: string[] };

export default function CambiarEjercicio({ supabase, pacienteId, onCerrar, onHecho }: {
  supabase: SupabaseClient; pacienteId: string; onCerrar: () => void; onHecho: (aviso: string) => void;
}) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [origen, setOrigen] = useState<string>('');
  const [destino, setDestino] = useState<EjercicioMini | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [desde, setDesde] = useState(hoyIso());
  const [carga, setCarga] = useState<'mantener' | 'quitar' | 'nueva'>('mantener');
  const [kg, setKg] = useState('');
  const [cambiarIndicacion, setCambiarIndicacion] = useState(false);
  const [indicacion, setIndicacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('workouts')
      .select('scheduled_date, workout_blocks(workout_items(exercise_id, exercises(id, name, video_id, duration_seconds, muscle_groups, equipment), set_logs(count), workout_item_feedback(count)))')
      .eq('patient_id', pacienteId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', hoyIso())
      .order('scheduled_date')
      .then(({ data }) => setFilas((data as unknown as Fila[]) ?? []));
  }, [supabase, pacienteId]);

  // Ejercicios que aparecen en sesiones pendientes (sin registros), con sus fechas
  const usos = useMemo(() => {
    const m = new Map<string, Uso>();
    for (const w of filas ?? []) {
      if (w.scheduled_date < desde) continue;
      for (const b of w.workout_blocks) for (const i of b.workout_items) {
        const conRegistros = (comoLista(i.set_logs)[0]?.count ?? 0) > 0 || (comoLista(i.workout_item_feedback)[0]?.count ?? 0) > 0;
        if (conRegistros) continue;
        const u = m.get(i.exercise_id) ?? { ejercicio: i.exercises, fechas: [] };
        if (!u.fechas.includes(w.scheduled_date)) u.fechas.push(w.scheduled_date);
        m.set(i.exercise_id, u);
      }
    }
    return [...m.values()].sort((a, b) => a.ejercicio.name.localeCompare(b.ejercicio.name, 'es'));
  }, [filas, desde]);

  const elegido = usos.find((u) => u.ejercicio.id === origen);
  const fmt = (f: string) => desdeIso(f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

  async function confirmar() {
    setError('');
    if (!elegido || !destino) return;
    if (carga === 'nueva' && !kg.trim()) return setError('Escribe la carga nueva o elige otra opción.');
    setEnviando(true);
    const { data, error } = await supabase.rpc('replace_exercise', {
      p_patient: pacienteId, p_from: elegido.ejercicio.id, p_to: destino.id, p_from_date: desde,
      p_load_kg: carga === 'nueva' ? Number(kg.replace(',', '.')) : null,
      p_clear_load: carga === 'quitar',
      p_instructions: cambiarIndicacion ? indicacion : null,
    });
    setEnviando(false);
    if (error) return setError('No se ha podido cambiar. Inténtalo de nuevo.');
    onHecho(`«${elegido.ejercicio.name}» cambiado por «${destino.name}» en ${data} ${data === 1 ? 'sitio' : 'sitios'} de sus sesiones pendientes.`);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Cambiar un ejercicio" className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6" onClick={onCerrar}>
      <div className="bg-fondo w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold leading-tight">Cambiar un ejercicio en todo su plan</h3>
            <p className="text-sm text-texto-suave">Solo en sesiones pendientes. Lo ya hecho o registrado no se toca.</p>
          </div>
          <button onClick={onCerrar} className="text-petroleo font-bold px-2">Cerrar</button>
        </div>

        {!filas && <p className="text-texto-suave">Cargando…</p>}
        {filas && usos.length === 0 && <p className="bg-white rounded-xl p-4 text-texto-suave">No tiene sesiones pendientes desde esa fecha.</p>}

        {usos.length > 0 && (
          <section className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">1. Qué ejercicio quieres quitar</h4>
            <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {usos.map((u) => (
                <li key={u.ejercicio.id}>
                  <label className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer ${origen === u.ejercicio.id ? 'bg-petroleo text-white' : 'bg-white'}`}>
                    <input type="radio" name="origen" checked={origen === u.ejercicio.id} onChange={() => setOrigen(u.ejercicio.id)} className="sr-only" />
                    <span className="flex-1 font-semibold leading-snug">{u.ejercicio.name}</span>
                    <span className={`text-xs ${origen === u.ejercicio.id ? 'text-[#E3E8E8]' : 'text-texto-suave'}`}>{u.fechas.length} {u.fechas.length === 1 ? 'sesión' : 'sesiones'}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {elegido && (
          <>
            <section className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">2. Por cuál</h4>
              {destino ? (
                <div className="bg-white rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-14 rounded-md overflow-hidden bg-gris-claro shrink-0">{destino.video_id && <img src={miniatura(destino.video_id)} alt="" className="w-full h-full object-cover" />}</div>
                  <span className="flex-1 font-semibold">{destino.name}</span>
                  <button onClick={() => setEligiendo(true)} className="text-petroleo font-bold text-sm">Cambiar</button>
                </div>
              ) : (
                <button onClick={() => setEligiendo(true)} className="self-start text-petroleo font-bold px-4 py-2.5 rounded-xl border-2 border-petroleo">Elegir de la biblioteca</button>
              )}
            </section>

            <section className="bg-white rounded-xl p-4 flex flex-col gap-3">
              <h4 className="text-sm font-semibold">3. Ajustes (series, repeticiones y descanso se mantienen)</h4>
              <div className="flex flex-wrap gap-2 items-center text-sm">
                <span className="font-semibold mr-1">Carga:</span>
                {(['mantener', 'quitar', 'nueva'] as const).map((c) => (
                  <button key={c} aria-pressed={carga === c} onClick={() => setCarga(c)} className={`px-3 py-1.5 rounded-lg font-semibold ${carga === c ? 'bg-petroleo text-white' : 'bg-fondo'}`}>
                    {c === 'mantener' ? 'Mantener' : c === 'quitar' ? 'Sin carga' : 'Nueva'}
                  </button>
                ))}
                {carga === 'nueva' && (
                  <label className="flex items-center gap-1">
                    <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="Carga nueva en kilos" className="w-20 px-2 py-1.5 border border-borde rounded-lg" /> kg
                  </label>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={cambiarIndicacion} onChange={(e) => setCambiarIndicacion(e.target.checked)} className="w-5 h-5 accent-[#374949]" />
                Cambiar la indicación para el paciente
              </label>
              {cambiarIndicacion && (
                <input value={indicacion} onChange={(e) => setIndicacion(e.target.value)} placeholder="Déjalo vacío para quitarla" className="px-3 py-2 border border-borde rounded-lg" />
              )}
              <label className="flex items-center gap-2 text-sm font-semibold">
                Desde
                <input type="date" min={hoyIso()} value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} className="font-normal px-2 py-1.5 border border-borde rounded-lg" />
              </label>
            </section>

            <p className="text-sm">
              Se cambiará en {elegido.fechas.length} {elegido.fechas.length === 1 ? 'sesión' : 'sesiones'}:{' '}
              <span className="text-texto-suave">{elegido.fechas.length <= 6 ? elegido.fechas.map(fmt).join(', ') : `del ${fmt(elegido.fechas[0])} al ${fmt(elegido.fechas[elegido.fechas.length - 1])}`}</span>
            </p>
            {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
            <button onClick={confirmar} disabled={!destino || enviando} className="self-end bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-50">
              {enviando ? 'Cambiando…' : 'Cambiar en todas'}
            </button>
          </>
        )}

        {eligiendo && (
          <SelectorEjercicio
            supabase={supabase}
            onCerrar={() => setEligiendo(false)}
            onElegir={(e) => { if (e.id === origen) { setError('Elige un ejercicio distinto.'); } else { setDestino(e); setError(''); } setEligiendo(false); }}
          />
        )}
      </div>
    </div>
  );
}
