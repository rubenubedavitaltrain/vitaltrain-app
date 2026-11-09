import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { diaSolar, horaMin } from './sol';
import { resumenComidas, resumenSueno, type Ajustes, type Comida, type Noche } from './datos';
import { cargarAsignados, tocaHoy, type Asignado } from '../habitos/datos';

// «Mi día»: línea temporal de hoy con las anclas del paciente.
// Las horas de despertar, acostarse y comidas son su media de las últimas dos semanas (lo que anota);
// amanecer, ventana UVB y atardecer salen de su ciudad; los hábitos pautados con un momento se colocan en su hora.
// Usa el motor genérico de hábitos (solo lectura): si el paciente no tiene hábitos, no aparecen.

type Hito = { min: number; titulo: string; detalle?: string; tipo: 'sol' | 'cuerpo' | 'habito' };

const aMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const deDate = (d: Date | null) => (d ? d.getHours() * 60 + d.getMinutes() : null);
const hm = (m: number) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

export default function MiDia({ supabase, pacienteId, ajustes, noches, comidas }: { supabase: SupabaseClient; pacienteId: string; ajustes: Ajustes; noches: Noche[]; comidas: Comida[] }) {
  const [habitos, setHabitos] = useState<Asignado[]>([]);
  useEffect(() => { cargarAsignados(supabase, pacienteId).then((a) => setHabitos(a.filter((x) => tocaHoy(x) && x.habit_definitions.anchor))); }, [supabase, pacienteId]);

  const recientes = noches.filter((n) => Date.now() - new Date(`${n.night_of}T12:00:00`).valueOf() < 14 * 86400000);
  const s = resumenSueno(recientes);
  const c = resumenComidas(comidas, recientes);
  const sol = ajustes.latitude != null && ajustes.longitude != null ? diaSolar(new Date(), ajustes.latitude, ajustes.longitude) : null;

  const anclas: Record<string, number | null> = {
    wake: s.levantarseMedio ? aMin(s.levantarseMedio) : null,
    bedtime: s.acostarseMedio ? aMin(s.acostarseMedio) : null,
    first_meal: c.primeraMedia ? aMin(c.primeraMedia) : null,
    last_meal: c.ultimaMedia ? aMin(c.ultimaMedia) : null,
    sunrise: deDate(sol?.amanecer ?? null),
    sunset: deDate(sol?.atardecer ?? null),
  };

  const hitos: Hito[] = [];
  if (anclas.wake != null) hitos.push({ min: anclas.wake, titulo: 'Te levantas', detalle: 'Tu media de las últimas dos semanas', tipo: 'cuerpo' });
  if (anclas.sunrise != null) hitos.push({ min: anclas.sunrise, titulo: 'Amanecer', tipo: 'sol' });
  if (sol?.uvb) hitos.push({ min: deDate(sol.uvb.desde)!, titulo: 'Se abre la ventana UVB', detalle: `Hasta las ${horaMin(sol.uvb.hasta)}`, tipo: 'sol' });
  if (anclas.first_meal != null) hitos.push({ min: anclas.first_meal, titulo: 'Primera comida', detalle: 'Tu media', tipo: 'cuerpo' });
  if (anclas.last_meal != null) hitos.push({ min: anclas.last_meal, titulo: 'Última comida', detalle: 'Tu media', tipo: 'cuerpo' });
  if (anclas.sunset != null) hitos.push({ min: anclas.sunset, titulo: 'Atardecer', tipo: 'sol' });
  if (anclas.bedtime != null) hitos.push({ min: anclas.bedtime + (anclas.bedtime < 12 * 60 ? 1440 : 0), titulo: 'Te acuestas', detalle: 'Tu media', tipo: 'cuerpo' });
  const sinAncla: string[] = [];
  for (const h of habitos) {
    const d = h.habit_definitions;
    const base = anclas[d.anchor!];
    if (base == null) { sinAncla.push(d.name); continue; }
    let m = base + (d.anchor_offset_minutes ?? 0);
    if (d.anchor === 'bedtime' && base < 12 * 60) m += 1440;
    hitos.push({ min: m, titulo: d.name, detalle: d.short_instruction ?? undefined, tipo: 'habito' });
  }
  hitos.sort((a, b) => a.min - b.min);
  const ahora = new Date().getHours() * 60 + new Date().getMinutes();
  const siguiente = hitos.findIndex((h) => h.min >= ahora);

  return (
    <section className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3" aria-labelledby="mi-dia">
      <div>
        <h2 id="mi-dia" className="font-bold">Mi día</h2>
        <p className="text-xs text-texto-suave">Tus momentos clave de hoy. Las horas de sueño y comidas son tu media: cuanto más anotes, más exactas.</p>
      </div>
      {hitos.length === 0 && <p className="text-sm text-texto-suave">Anota unas noches y comidas, y elige tu ciudad, para ver aquí tu día.</p>}
      <ol className="relative border-l-2 border-gris-claro ml-[3.25rem] flex flex-col gap-2.5">
        {hitos.map((h, i) => (
          <li key={i} className={`relative pl-4 ${i === siguiente ? 'font-semibold' : ''}`}>
            <span className="absolute -left-[3.6rem] top-0.5 w-11 text-right text-sm tabular-nums text-texto-suave">{hm(h.min)}</span>
            <span className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ${h.tipo === 'sol' ? 'bg-mostaza' : h.tipo === 'habito' ? 'bg-petroleo' : 'bg-white border-2 border-petroleo'} ${i === siguiente ? 'ring-4 ring-mostaza/30' : ''}`} aria-hidden="true" />
            <span className="block leading-tight">{h.titulo}{i === siguiente && <span className="ml-2 whitespace-nowrap text-[10px] font-bold uppercase bg-fondo rounded px-1.5 py-0.5 align-middle">Lo siguiente</span>}</span>
            {h.detalle && <span className="block text-xs font-normal text-texto-suave">{h.detalle}</span>}
          </li>
        ))}
      </ol>
      {sinAncla.length > 0 && <p className="text-xs text-texto-suave">Aparecerán en su hora cuando haya datos de tu sueño o tus comidas: {sinAncla.join(', ')}.</p>}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-mostaza" />Luz del día</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-petroleo" />Tu ritmo</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-petroleo" />Hábitos pautados</span>
      </p>
    </section>
  );
}
