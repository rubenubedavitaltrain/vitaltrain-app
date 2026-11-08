import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hoyIso, iso, lunes, sumarDias } from '../../../lib/fechas';

// Progreso del módulo de entrenamiento: entrenamientos por semana, carga por ejercicio y esfuerzo medio.
// Lo usan la pestaña «Progreso» del paciente y la sección «Progresión» de la ficha del coach.
// No añade tablas: lee las sesiones y las series ya registradas. Gráficas en SVG propio, sin librerías.

const SEMANAS = 12;
const PETROLEO = '#374949';
const PISTA = '#D2D6D4';
const REJILLA = '#E4E7E6';

type Sesion = { scheduled_date: string; status: string; rpe: number | null };
type Serie = { reps: number | null; load_kg: number | null; workout_items: unknown };
type Semana = { lunes: string; pautadas: number; hechas: number; rpe: number | null };
type Punto = { fecha: string; kg: number; reps: number | null };

const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
const fechaCorta = (f: string) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}`; };
const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const num = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });

export function useProgreso(supabase: SupabaseClient, pacienteId: string) {
  const [datos, setDatos] = useState<{ sesiones: Sesion[]; series: Serie[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const desde = iso(sumarDias(lunes(new Date()), -7 * (SEMANAS - 1)));
    Promise.all([
      supabase.from('workouts').select('scheduled_date, status, rpe').eq('patient_id', pacienteId).gte('scheduled_date', desde).lte('scheduled_date', hoyIso()),
      supabase.from('set_logs').select('reps, load_kg, workout_items(exercise_id, exercises(name), workout_blocks(workouts(scheduled_date)))')
        .eq('patient_id', pacienteId).eq('done', true).not('load_kg', 'is', null).gt('load_kg', 0).limit(5000),
    ]).then(([a, b]) => {
      if (a.error || b.error) return setError(true);
      setDatos({ sesiones: (a.data as Sesion[]) ?? [], series: (b.data as Serie[]) ?? [] });
    });
  }, [supabase, pacienteId]);
  return { datos, error };
}

export default function Progreso({ supabase, pacienteId, ancho = false }: { supabase: SupabaseClient; pacienteId: string; ancho?: boolean }) {
  const { datos, error } = useProgreso(supabase, pacienteId);
  const [ejercicio, setEjercicio] = useState('');

  const semanas = useMemo<Semana[]>(() => {
    const base = lunes(new Date());
    return Array.from({ length: SEMANAS }, (_, i) => {
      const l = iso(sumarDias(base, -7 * (SEMANAS - 1 - i)));
      const fin = iso(sumarDias(base, -7 * (SEMANAS - 1 - i) + 6));
      const ss = (datos?.sesiones ?? []).filter((s) => s.scheduled_date >= l && s.scheduled_date <= fin);
      const hechas = ss.filter((s) => s.status === 'completed');
      const rpes = hechas.map((s) => s.rpe).filter((r): r is number => r != null);
      return { lunes: l, pautadas: ss.length, hechas: hechas.length, rpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null };
    });
  }, [datos]);

  // Por ejercicio: carga máxima de cada día (con sus repeticiones)
  const ejercicios = useMemo(() => {
    const m = new Map<string, { nombre: string; puntos: Map<string, Punto> }>();
    for (const s of datos?.series ?? []) {
      const it = uno(s.workout_items as { exercise_id: string; exercises: unknown; workout_blocks: unknown } | null);
      const ex = uno(it?.exercises as { name: string } | null);
      const w = uno(uno(it?.workout_blocks as { workouts: unknown } | null)?.workouts as { scheduled_date: string } | null);
      if (!it || !ex || !w || s.load_kg == null) continue;
      const e = m.get(it.exercise_id) ?? { nombre: ex.name, puntos: new Map<string, Punto>() };
      const p = e.puntos.get(w.scheduled_date);
      const kg = Number(s.load_kg);
      if (!p || kg > p.kg || (kg === p.kg && (s.reps ?? 0) > (p.reps ?? 0))) e.puntos.set(w.scheduled_date, { fecha: w.scheduled_date, kg, reps: s.reps });
      m.set(it.exercise_id, e);
    }
    return [...m.entries()]
      .map(([id, e]) => ({ id, nombre: e.nombre, puntos: [...e.puntos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)) }))
      .sort((a, b) => b.puntos.length - a.puntos.length || a.nombre.localeCompare(b.nombre, 'es'));
  }, [datos]);

  const elegido = ejercicios.find((e) => e.id === ejercicio) ?? ejercicios[0];

  if (error) return <p className="bg-white rounded-2xl p-5 text-texto-suave">No se ha podido cargar el progreso. Comprueba la conexión.</p>;
  if (!datos) return <p className="bg-white rounded-2xl p-5 text-texto-suave">Cargando…</p>;

  const ultimas4 = semanas.slice(-4);
  const p4 = ultimas4.reduce((a, s) => a + s.pautadas, 0);
  const h4 = ultimas4.reduce((a, s) => a + s.hechas, 0);
  const rpes4 = ultimas4.map((s) => s.rpe).filter((r): r is number => r != null);
  const estaSemana = semanas[semanas.length - 1];
  const hayAlgo = datos.sesiones.length > 0;

  return (
    <div className={`grid gap-4 ${ancho ? 'lg:grid-cols-2' : ''}`}>
      <div className={`grid grid-cols-3 gap-2 ${ancho ? 'lg:col-span-2' : ''}`}>
        <Dato titulo="Esta semana" valor={`${estaSemana.hechas} de ${estaSemana.pautadas}`} />
        <Dato titulo="Últimas 4 semanas" valor={p4 ? `${Math.round((h4 / p4) * 100)} %` : '—'} nota={p4 ? `${h4} de ${p4} hechas` : undefined} />
        <Dato titulo="Esfuerzo medio" valor={rpes4.length ? num(rpes4.reduce((a, b) => a + b, 0) / rpes4.length) : '—'} nota="de 10, último mes" />
      </div>

      {!hayAlgo ? (
        <p className={`bg-white rounded-2xl p-5 text-texto-suave ${ancho ? 'lg:col-span-2' : ''}`}>Aún no hay entrenamientos. Las gráficas aparecerán con las primeras sesiones.</p>
      ) : (
        <>
          <Tarjeta titulo="Entrenamientos por semana" subtitulo="Hechos sobre los pautados, últimas 12 semanas">
            <Barras semanas={semanas} />
          </Tarjeta>
          <Tarjeta titulo="Esfuerzo medio por semana" subtitulo="Lo que anotas al terminar, de 1 a 10">
            <Linea
              puntos={semanas.filter((s) => s.rpe != null).map((s) => ({ x: s.lunes, y: s.rpe as number, etiqueta: `Semana del ${fechaLarga(s.lunes)}: ${num(s.rpe as number)} de 10` }))}
              dominioX={semanas.map((s) => s.lunes)} minY={1} maxY={10} unidad="" vacio="Sin esfuerzo anotado todavía."
            />
          </Tarjeta>
          <Tarjeta titulo="Carga por ejercicio" subtitulo="La serie más pesada de cada día">
            {ejercicios.length === 0 ? (
              <p className="text-sm text-texto-suave">Aparecerá cuando registres series con kilos.</p>
            ) : (
              <>
                <select aria-label="Ejercicio" value={elegido?.id ?? ''} onChange={(e) => setEjercicio(e.target.value)} className="w-full px-3 py-2.5 border border-borde rounded-xl bg-white font-semibold">
                  {ejercicios.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({e.puntos.length} {e.puntos.length === 1 ? 'día' : 'días'})</option>)}
                </select>
                {elegido && <ResumenCarga puntos={elegido.puntos} />}
                {elegido && (
                  <Linea
                    puntos={elegido.puntos.map((p) => ({ x: p.fecha, y: p.kg, etiqueta: `${fechaLarga(p.fecha)}: ${num(p.kg)} kg${p.reps != null ? ` × ${p.reps}` : ''}` }))}
                    dominioX={elegido.puntos.map((p) => p.fecha)} unidad=" kg" vacio=""
                  />
                )}
              </>
            )}
          </Tarjeta>
        </>
      )}
    </div>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="bg-white rounded-2xl p-3 sm:p-4">
      <div className="text-[11px] font-bold tracking-wide text-texto-suave uppercase leading-tight">{titulo}</div>
      <div className="text-2xl font-bold mt-1">{valor}</div>
      {nota && <div className="text-[11px] text-texto-suave leading-tight">{nota}</div>}
    </div>
  );
}

function Tarjeta({ titulo, subtitulo, className = '', children }: { titulo: string; subtitulo: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3 ${className}`}>
      <div>
        <h3 className="font-bold">{titulo}</h3>
        <p className="text-xs text-texto-suave">{subtitulo}</p>
      </div>
      {children}
    </section>
  );
}

function ResumenCarga({ puntos }: { puntos: Punto[] }) {
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const max = Math.max(...puntos.map((p) => p.kg));
  const dif = ultimo.kg - primero.kg;
  return (
    <p className="text-sm">
      Último: <strong>{num(ultimo.kg)} kg</strong>{ultimo.reps != null ? ` × ${ultimo.reps}` : ''} ({fechaLarga(ultimo.fecha)}). Máximo: {num(max)} kg.
      {puntos.length > 1 && <> {dif > 0 ? `+${num(dif)} kg` : dif < 0 ? `${num(dif)} kg` : 'Sin cambio'} desde el {fechaLarga(primero.fecha)}.</>}
    </p>
  );
}

/** Barras: pista gris = sesiones pautadas; relleno petróleo = hechas. Tocar una barra muestra el dato. */
function Barras({ semanas }: { semanas: Semana[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 320, H = 150, top = 12, bottom = 22, left = 4, right = 4;
  const max = Math.max(1, ...semanas.map((s) => Math.max(s.pautadas, s.hechas)));
  const paso = (W - left - right) / semanas.length;
  const ancho = Math.min(16, paso - 6);
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const elegida = sel != null ? semanas[sel] : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Entrenamientos hechos por semana: ${semanas.map((s) => `semana del ${fechaLarga(s.lunes)}, ${s.hechas} de ${s.pautadas}`).join('; ')}`}>
        <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke={REJILLA} strokeWidth={1} />
        {semanas.map((s, i) => {
          const cx = left + paso * i + paso / 2;
          const x = cx - ancho / 2;
          return (
            <g key={s.lunes} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
              <rect x={left + paso * i} y={top} width={paso} height={H - top} fill="transparent" />
              {s.pautadas > 0 && <rect x={x} y={y(s.pautadas)} width={ancho} height={y(0) - y(s.pautadas)} rx={4} fill={PISTA} />}
              {s.hechas > 0 && <rect x={x} y={y(s.hechas)} width={ancho} height={y(0) - y(s.hechas)} rx={4} fill={PETROLEO} opacity={sel == null || sel === i ? 1 : 0.45} />}
              {(i % 2 === 1 || i === semanas.length - 1) && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize={9} fill="#5A6464">{fechaCorta(s.lunes)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between gap-3 text-xs text-texto-suave min-h-5">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: PETROLEO }} />Hechos</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: PISTA }} />Pautados</span>
        </span>
        <span className="font-semibold text-[#4A4A4C]">{elegida ? `Semana del ${fechaLarga(elegida.lunes)}: ${elegida.hechas} de ${elegida.pautadas}` : 'Toca una barra'}</span>
      </div>
    </div>
  );
}

/** Línea de una serie con puntos. Tocar un punto muestra el dato; el último se etiqueta siempre. */
function Linea({ puntos, dominioX, minY, maxY, unidad, vacio }: {
  puntos: { x: string; y: number; etiqueta: string }[]; dominioX: string[]; minY?: number; maxY?: number; unidad: string; vacio: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  if (puntos.length === 0) return <p className="text-sm text-texto-suave">{vacio}</p>;
  const W = 320, H = 150, top = 16, bottom = 22, left = 30, right = 14;
  const ys = puntos.map((p) => p.y);
  let lo = minY ?? Math.min(...ys), hi = maxY ?? Math.max(...ys);
  if (minY == null && maxY == null) {
    // Márgenes y marcas redondas (0,5 · 1 · 2,5 · 5 · 10 kg…) para que el eje se lea fácil
    const rango = Math.max(hi - lo, hi * 0.2, 1);
    const paso = [0.5, 1, 2.5, 5, 10, 20, 50].find((x) => rango / x <= 4) ?? 100;
    lo = Math.max(0, Math.floor((lo - rango * 0.1) / paso) * paso);
    hi = Math.ceil((hi + rango * 0.1) / paso) * paso;
    if (hi === lo) hi = lo + paso;
  }
  const xs = [...new Set(dominioX)];
  const xi = (x: string) => (xs.length === 1 ? 0.5 : xs.indexOf(x) / (xs.length - 1));
  const px = (x: string) => left + (W - left - right) * xi(x);
  const py = (v: number) => top + (H - top - bottom) * (1 - (v - lo) / (hi - lo || 1));
  const marcas = minY != null ? [lo, (lo + hi) / 2, hi] : [lo, hi - (hi - lo) / 2, hi].map((m) => Math.round(m * 2) / 2);
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const ultimo = puntos[puntos.length - 1];
  const etiquetasX = xs.length <= 6 ? xs : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={puntos.map((p) => p.etiqueta).join('; ')}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={left} x2={W - right} y1={py(m)} y2={py(m)} stroke={REJILLA} strokeWidth={1} />
            <text x={left - 4} y={py(m) + 3} textAnchor="end" fontSize={9} fill="#5A6464">{num(m)}</text>
          </g>
        ))}
        {etiquetasX.map((x) => <text key={x} x={px(x)} y={H - 6} textAnchor="middle" fontSize={9} fill="#5A6464">{fechaCorta(x)}</text>)}
        {puntos.length > 1 && <path d={d} fill="none" stroke={PETROLEO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {puntos.map((p, i) => (
          <g key={p.x} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
            <circle cx={px(p.x)} cy={py(p.y)} r={14} fill="transparent" />
            <circle cx={px(p.x)} cy={py(p.y)} r={sel === i ? 6 : 4} fill={PETROLEO} stroke="#fff" strokeWidth={2} />
          </g>
        ))}
        <text x={Math.min(px(ultimo.x), W - right)} y={py(ultimo.y) - 9} textAnchor="end" fontSize={10} fontWeight={700} fill="#4A4A4C">{num(ultimo.y)}{unidad}</text>
      </svg>
      <p className="text-xs font-semibold text-right min-h-5">{sel != null ? puntos[sel].etiqueta : <span className="font-normal text-texto-suave">Toca un punto para ver el dato</span>}</p>
    </div>
  );
}
