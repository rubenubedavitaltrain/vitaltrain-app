import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pauta } from './pautas';

// Módulo de respiración guiada, parte del coach: minutos por semana, pautas usadas y cambio de calma antes y después.

type Sesion = { pattern: string; started_at: string; seconds: number; calm_before: number | null; calm_after: number | null };

export default function RespiracionCoach({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [s, setS] = useState<Sesion[] | null>(null);
  useEffect(() => {
    const desde = new Date(Date.now() - 56 * 864e5).toISOString();
    supabase.from('breathing_sessions').select('pattern, started_at, seconds, calm_before, calm_after').eq('patient_id', pacienteId).gte('started_at', desde).order('started_at')
      .then(({ data }) => setS((data as Sesion[]) ?? []));
  }, [supabase, pacienteId]);
  if (!s) return null;
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const fin = Date.now() - (7 - i) * 7 * 864e5, ini = fin - 7 * 864e5;
    return Math.round(s.filter((x) => { const t = Date.parse(x.started_at); return t > ini && t <= fin; }).reduce((a, x) => a + x.seconds, 0) / 60);
  });
  const max = Math.max(10, ...semanas);
  const pares = s.filter((x) => x.calm_before && x.calm_after);
  const cambio = pares.length ? pares.reduce((a, x) => a + (x.calm_after! - x.calm_before!), 0) / pares.length : null;
  const usadas = Object.entries(s.reduce<Record<string, number>>((a, x) => ({ ...a, [x.pattern]: (a[x.pattern] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="respira-coach">
      <h3 id="respira-coach" className="text-lg font-bold px-1">Respiración guiada</h3>
      <div className="bg-white rounded-2xl p-4 sm:p-5 grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-texto-suave mb-2">Minutos por semana (8 semanas)</div>
          {s.length === 0 ? <p className="text-sm text-texto-suave">Aún no ha hecho ninguna sesión.</p> : (
            <div className="flex items-end gap-2 h-28" role="img" aria-label={`Minutos por semana: ${semanas.join(', ')}`}>
              {semanas.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-texto-suave">{m || ''}</span>
                  <div className="w-full rounded-t bg-petroleo" style={{ height: `${(m / max) * 88}px`, minHeight: m ? 3 : 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div><span className="text-texto-suave">Sesiones:</span> <b>{s.length}</b></div>
          {usadas.length > 0 && <div><span className="text-texto-suave">Pautas:</span> {usadas.map(([k, n]) => `${pauta(k).nombre} (${n})`).join(', ')}</div>}
          <div><span className="text-texto-suave">Calma antes → después:</span> <b>{cambio == null ? '—' : `${cambio > 0 ? '+' : ''}${cambio.toLocaleString('es-ES', { maximumFractionDigits: 1 })} puntos de media`}</b>{pares.length ? <span className="text-texto-suave"> ({pares.length} sesiones con las dos respuestas)</span> : null}</div>
        </div>
      </div>
    </section>
  );
}
