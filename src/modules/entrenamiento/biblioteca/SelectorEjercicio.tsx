import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { duracion, miniatura } from './youtube';

export type EjercicioMini = { id: string; name: string; video_id: string | null; duration_seconds: number | null; muscle_groups: string[]; equipment: string[] };

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let cache: EjercicioMini[] | null = null;

/** Lista de ejercicios activos de la biblioteca, cargada una vez por sesión. */
export function useEjercicios(supabase: SupabaseClient) {
  const [lista, setLista] = useState<EjercicioMini[] | null>(cache);
  useEffect(() => {
    if (cache) return;
    supabase
      .from('exercises')
      .select('id, name, video_id, duration_seconds, muscle_groups, equipment')
      .eq('is_archived', false)
      .order('name')
      .then(({ data }) => { cache = (data as EjercicioMini[]) ?? []; setLista(cache); });
  }, [supabase]);
  return lista;
}

/** Ventana para elegir un ejercicio de la biblioteca. */
export default function SelectorEjercicio({ supabase, onElegir, onCerrar }: {
  supabase: SupabaseClient; onElegir: (e: EjercicioMini) => void; onCerrar: () => void;
}) {
  const lista = useEjercicios(supabase);
  const [q, setQ] = useState('');
  const vis = useMemo(() => {
    const n = normal(q.trim());
    return (lista ?? []).filter((e) => !n || normal(e.name).includes(n) || [...e.muscle_groups, ...e.equipment].some((t) => normal(t).includes(n)));
  }, [lista, q]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Elegir ejercicio" className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6" onClick={onCerrar}>
      <div className="bg-fondo w-full sm:max-w-2xl h-[90vh] sm:h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-xl font-bold">Elegir ejercicio</h3>
          <button onClick={onCerrar} className="text-petroleo font-bold px-2 py-1">Cerrar</button>
        </div>
        <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar ejercicio" className="text-base px-4 py-3 border border-borde rounded-xl bg-white mb-3" />
        <ul className="flex-1 overflow-y-auto flex flex-col gap-2">
          {!lista && <li className="text-texto-suave">Cargando…</li>}
          {vis.map((e) => (
            <li key={e.id}>
              <button onClick={() => onElegir(e)} className="w-full flex items-center gap-3 bg-white rounded-xl p-2 text-left">
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-gris-claro shrink-0">
                  {e.video_id && <img src={miniatura(e.video_id)} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <span className="flex-1 font-semibold leading-snug">{e.name}</span>
                <span className="text-xs text-texto-suave pr-2">{duracion(e.duration_seconds)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
