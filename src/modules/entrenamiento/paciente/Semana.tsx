import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DIAS_CORTOS, iso, lunes, rangoSemana, sumarDias } from '../../../lib/fechas';
import { cargarSemana, type SesionCorta } from './datos';

// Tarjeta de "Hoy" y pantalla "Mi semana" del módulo de entrenamiento (paciente).

const ESTADO = { scheduled: 'Pendiente', in_progress: 'En curso', completed: 'Hecho', skipped: 'No hecho' } as const;

export function useSemana(supabase: SupabaseClient, inicio: Date) {
  const [lista, setLista] = useState<SesionCorta[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setLista(null);
    cargarSemana(supabase, iso(inicio), iso(sumarDias(inicio, 6))).then(setLista).catch(() => setError(true));
  }, [supabase, inicio.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  return { lista, error };
}

/** Tarjeta para la pantalla Hoy: entrenamiento del día y semana resumida. */
export function TarjetaHoy({ supabase, onAbrir }: { supabase: SupabaseClient; onAbrir: (id: string) => void }) {
  const [inicio] = useState(() => lunes(new Date()));
  const { lista, error } = useSemana(supabase, inicio);
  const hoy = iso(new Date());
  const deHoy = (lista ?? []).filter((s) => s.scheduled_date === hoy);

  return (
    <div className="flex flex-col gap-3">
      {error && !lista && <p className="bg-white rounded-2xl p-4 text-texto-suave">Sin conexión. Abre la app con internet al menos una vez para tener tu semana guardada.</p>}
      {!lista && !error && <div className="bg-white rounded-2xl p-5 text-texto-suave">Cargando…</div>}
      {lista && deHoy.length === 0 && (
        <div className="bg-white rounded-2xl p-5">
          <div className="text-xs font-bold tracking-wide text-texto-suave">HOY</div>
          <p className="text-lg font-semibold mt-1">Hoy no tienes entrenamiento.</p>
          <p className="text-sm text-texto-suave">Descansar también forma parte del plan.</p>
        </div>
      )}
      {deHoy.map((s) => (
        <div key={s.id} className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          <div className="text-xs font-bold tracking-wide text-texto-suave">HOY · {s.ejercicios} EJERCICIOS</div>
          {s.programa && <div className="text-sm text-texto-suave -mt-2">{s.programa.nombre} · semana {s.programa.semana} de {s.programa.semanas}</div>}
          <h2 className="text-2xl font-bold leading-tight">{s.name}</h2>
          {s.coach_message && <p className="border-l-4 border-mostaza pl-3">{s.coach_message}</p>}
          <button onClick={() => onAbrir(s.id)} className={`py-4 rounded-2xl text-lg font-bold ${s.status === 'completed' ? 'bg-fondo text-petroleo' : 'bg-mostaza text-[#1F2424]'}`}>
            {s.status === 'completed' ? 'Hecho · ver registro' : s.status === 'in_progress' ? 'Continuar' : 'Empezar entrenamiento'}
          </button>
        </div>
      ))}
      {lista && (
        <div className="bg-white rounded-2xl p-4" aria-label="Tu semana">
          <div className="text-xs font-bold tracking-wide text-texto-suave mb-3">ESTA SEMANA</div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: 7 }, (_, i) => {
              const f = iso(sumarDias(inicio, i));
              const d = lista.filter((s) => s.scheduled_date === f);
              const hecho = d.length > 0 && d.every((s) => s.status === 'completed');
              return (
                <div key={f} className="flex flex-col items-center gap-1">
                  <span className={`text-[11px] font-semibold ${f === hoy ? 'text-petroleo' : 'text-texto-suave'}`}>{DIAS_CORTOS[i].charAt(0)}</span>
                  <span
                    aria-label={`${DIAS_CORTOS[i]}: ${d.length ? (hecho ? 'hecho' : 'pendiente') : 'descanso'}`}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${hecho ? 'bg-petroleo text-white' : d.length ? 'border-2 border-petroleo text-petroleo' : 'bg-fondo'} ${f === hoy ? 'ring-2 ring-mostaza' : ''}`}
                  >
                    {hecho ? '✓' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Pantalla "Mi semana". */
export function MiSemana({ supabase, onAbrir }: { supabase: SupabaseClient; onAbrir: (id: string) => void }) {
  const [inicio, setInicio] = useState(() => lunes(new Date()));
  const { lista } = useSemana(supabase, inicio);
  const hoy = iso(new Date());
  return (
    <div className="flex flex-col">
      <header className="bg-petroleo text-white px-3 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-center justify-between">
        <button aria-label="Semana anterior" onClick={() => setInicio(sumarDias(inicio, -7))} className="w-11 h-11 text-2xl font-bold">‹</button>
        <div className="text-center">
          <h1 className="text-xl font-bold">Mi semana</h1>
          <p className="text-sm text-[#E3E8E8]">{rangoSemana(inicio)}</p>
        </div>
        <button aria-label="Semana siguiente" onClick={() => setInicio(sumarDias(inicio, 7))} className="w-11 h-11 text-2xl font-bold">›</button>
      </header>
      <div className="p-4 flex flex-col gap-2">
        {!lista && <p className="text-texto-suave">Cargando…</p>}
        {lista && Array.from({ length: 7 }, (_, i) => {
          const d = sumarDias(inicio, i);
          const f = iso(d);
          const delDia = lista.filter((s) => s.scheduled_date === f);
          if (!delDia.length) {
            return (
              <div key={f} className="bg-[#F6F6F6] rounded-2xl px-4 py-3 flex items-center gap-4">
                <Dia i={i} d={d} apagado />
                <span className="text-texto-suave">Descanso</span>
              </div>
            );
          }
          return delDia.map((s) => (
            <button key={s.id} onClick={() => onAbrir(s.id)} className={`bg-white rounded-2xl px-4 py-3.5 flex items-center gap-4 text-left ${f === hoy ? 'ring-2 ring-petroleo' : ''}`}>
              <Dia i={i} d={d} />
              <span className="flex-1">
                <span className="block font-bold">{s.name}</span>
                <span className="block text-sm text-texto-suave">{s.ejercicios} ejercicios{s.programa ? ` · semana ${s.programa.semana} de ${s.programa.semanas}` : ''}</span>
              </span>
              {f === hoy && s.status !== 'completed' ? (
                <span className="text-xs font-bold bg-mostaza text-[#1F2424] px-2.5 py-1 rounded-full">HOY</span>
              ) : (
                <span className={`text-xs font-bold ${s.status === 'completed' ? 'text-petroleo' : 'text-texto-suave'}`}>{ESTADO[s.status]}</span>
              )}
            </button>
          ));
        })}
      </div>
    </div>
  );
}

function Dia({ i, d, apagado }: { i: number; d: Date; apagado?: boolean }) {
  return (
    <span className="w-11 flex flex-col items-center">
      <span className="text-xs font-semibold text-texto-suave">{DIAS_CORTOS[i]}</span>
      <span className={`text-xl font-bold ${apagado ? 'text-texto-suave' : ''}`}>{d.getDate()}</span>
    </span>
  );
}
