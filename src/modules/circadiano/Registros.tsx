import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { desdeIso, diaMes, hoyIso, iso, sumarDias } from '../../lib/fechas';
import { TIPOS_COMIDA, type Comida, type Noche, type TipoComida } from './datos';
import { Hoja } from '../../core/ui/Hoja';

export { Hoja };

// Registro de sueño (menos de 20 segundos) y de comidas (solo hora y tipo).
// Los usan el paciente y el coach (que puede anotar en consulta).

const LATENCIAS = [{ t: '< 10 min', v: 5 }, { t: '10-20', v: 15 }, { t: '20-30', v: 25 }, { t: '30-60', v: 45 }, { t: '> 1 h', v: 75 }];
const DESPERTARES = [{ t: '0', v: 0 }, { t: '1', v: 1 }, { t: '2', v: 2 }, { t: '3', v: 3 }, { t: '4+', v: 4 }];
const CALIDAD = ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'];
const DESCANSO = ['Agotado', 'Cansado', 'Normal', 'Descansado', 'Con energía'];

const hhmm = (isoTs: string | null) => (isoTs ? new Date(isoTs).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');
const diaIso = (d: Date) => (d.getDay() + 6) % 7 + 1; // 1 = lunes … 7 = domingo

/** Noche "de ayer" hasta las 18:00; después, la de hoy. */
export const nochePorDefecto = () => iso(sumarDias(new Date(), new Date().getHours() < 18 ? -1 : 0));

/** Une la fecha de la noche y las horas: acostarse antes de las 12:00 es ya el día siguiente; levantarse, siempre el día siguiente. */
export function aMomentos(noche: string, acostarse: string, levantarse: string) {
  const d = desdeIso(noche);
  const [ha, ma] = acostarse.split(':').map(Number);
  const [hl, ml] = levantarse.split(':').map(Number);
  const cama = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (ha < 12 ? 1 : 0), ha, ma);
  let arriba = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hl, ml);
  if (arriba <= cama) arriba = new Date(arriba.valueOf() + 86400000);
  return { cama, arriba };
}

export function RegistroSueno({ supabase, pacienteId, previas, workdays, onCerrar, onHecho }: {
  supabase: SupabaseClient; pacienteId: string; previas: Noche[]; workdays: number[]; onCerrar: () => void; onHecho: () => void;
}) {
  const [noche, setNoche] = useState(nochePorDefecto());
  const existente = previas.find((n) => n.night_of === noche);
  const modelo = existente ?? previas.find((n) => n.bedtime && n.wake_time);
  const [acostarse, setAcostarse] = useState(hhmm(modelo?.bedtime ?? null) || '23:30');
  const [levantarse, setLevantarse] = useState(hhmm(modelo?.wake_time ?? null) || '07:30');
  const [latencia, setLatencia] = useState<number | null>(existente?.sleep_latency_minutes ?? null);
  const [despertares, setDespertares] = useState<number | null>(existente?.awakenings ?? null);
  const [calidad, setCalidad] = useState<number | null>(existente?.quality ?? null);
  const [descanso, setDescanso] = useState<number | null>(existente?.rested ?? null);
  const librePorDefecto = (n: string) => !workdays.includes(diaIso(sumarDias(desdeIso(n), 1)));
  const [libre, setLibre] = useState<boolean>(existente?.is_free_day ?? librePorDefecto(noche));
  const [nota, setNota] = useState(existente?.note ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function cambiarNoche(n: string) {
    setNoche(n);
    const e = previas.find((x) => x.night_of === n);
    if (e) {
      setAcostarse(hhmm(e.bedtime) || acostarse); setLevantarse(hhmm(e.wake_time) || levantarse);
      setLatencia(e.sleep_latency_minutes); setDespertares(e.awakenings); setCalidad(e.quality); setDescanso(e.rested);
      setLibre(e.is_free_day ?? librePorDefecto(n)); setNota(e.note ?? '');
    } else setLibre(librePorDefecto(n));
  }

  const { cama, arriba } = aMomentos(noche, acostarse, levantarse);
  const horas = (arriba.valueOf() - cama.valueOf()) / 3600000;

  async function guardar() {
    setError('');
    if (horas > 20) return setError('Revisa las horas: salen más de 20 horas en la cama.');
    if (arriba.valueOf() > Date.now() + 10 * 60000) return setError('La hora de levantarte aún no ha llegado. Anótalo cuando te levantes.');
    setGuardando(true);
    const { error } = await supabase.from('sleep_logs').upsert({
      patient_id: pacienteId, night_of: noche, bedtime: cama.toISOString(), wake_time: arriba.toISOString(),
      sleep_latency_minutes: latencia, awakenings: despertares, quality: calidad, rested: descanso, is_free_day: libre, note: nota.trim() || null,
    }, { onConflict: 'patient_id,night_of' });
    setGuardando(false);
    if (error) return setError(navigator.onLine ? 'No se ha podido guardar.' : 'Necesitas conexión para guardar.');
    onHecho();
  }

  const ayer = iso(sumarDias(new Date(), -1));
  return (
    <Hoja titulo="¿Cómo has dormido?" onCerrar={onCerrar}>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Noche del
        <input type="date" max={hoyIso()} value={noche} onChange={(e) => e.target.value && cambiarNoche(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" />
        <span className="font-normal text-xs text-texto-suave">{noche === ayer ? 'Anoche' : noche === hoyIso() ? 'Esta noche' : `Del ${diaMes(desdeIso(noche))} al ${diaMes(sumarDias(desdeIso(noche), 1))}`}{existente ? ' · ya anotada: se sustituye' : ''}</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">Me acosté<input type="time" value={acostarse} onChange={(e) => e.target.value && setAcostarse(e.target.value)} className="font-normal text-lg px-3 py-2.5 border border-borde rounded-xl bg-white" /></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Me levanté<input type="time" value={levantarse} onChange={(e) => e.target.value && setLevantarse(e.target.value)} className="font-normal text-lg px-3 py-2.5 border border-borde rounded-xl bg-white" /></label>
      </div>
      <p className="text-xs text-texto-suave -mt-2">{Math.floor(horas)} h {String(Math.round((horas % 1) * 60)).padStart(2, '0')} min en la cama.</p>
      <Chips titulo="Tardé en dormirme" opciones={LATENCIAS} valor={latencia} onCambio={setLatencia} />
      <Chips titulo="Me desperté" opciones={DESPERTARES} valor={despertares} onCambio={setDespertares} sufijo="veces" />
      <Escala titulo="Calidad del sueño" etiquetas={CALIDAD} valor={calidad} onCambio={setCalidad} />
      <Escala titulo="Al levantarme estaba" etiquetas={DESCANSO} valor={descanso} onCambio={setDescanso} />
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={libre} onChange={(e) => setLibre(e.target.checked)} className="w-5 h-5 accent-[#374949]" />
        Al día siguiente no trabajaba (día libre)
      </label>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-petroleo">Añadir una nota</summary>
        <textarea value={nota} onChange={(e) => setNota(e.target.value.slice(0, 500))} rows={2} placeholder="Ej.: cené tarde, me desperté con calor" className="mt-2 w-full text-base px-3 py-2 border border-borde rounded-xl bg-white" />
      </details>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <button onClick={guardar} disabled={guardando} className="bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar'}</button>
    </Hoja>
  );
}

export function RegistroComida({ supabase, pacienteId, onCerrar, onHecho }: { supabase: SupabaseClient; pacienteId: string; onCerrar: () => void; onHecho: () => void }) {
  const ahora = new Date();
  const [dia, setDia] = useState(hoyIso());
  const [hora, setHora] = useState(ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  const sugerido: TipoComida = ahora.getHours() < 11 ? 'breakfast' : ahora.getHours() < 17 ? 'lunch' : 'dinner';
  const [tipo, setTipo] = useState<TipoComida>(sugerido);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError('');
    const [h, m] = hora.split(':').map(Number);
    const d = desdeIso(dia); d.setHours(h, m, 0, 0);
    if (d.valueOf() > Date.now() + 10 * 60000) return setError('Esa hora aún no ha llegado.');
    if (d.valueOf() < Date.now() - 30 * 86400000) return setError('Solo se pueden anotar comidas de los últimos 30 días.');
    setGuardando(true);
    const { error } = await supabase.from('meal_events').insert({ patient_id: pacienteId, eaten_at: d.toISOString(), kind: tipo });
    setGuardando(false);
    if (error) return setError(navigator.onLine ? 'No se ha podido guardar.' : 'Necesitas conexión para guardar.');
    onHecho();
  }

  return (
    <Hoja titulo="Anotar una comida" onCerrar={onCerrar}>
      <p className="text-sm text-texto-suave -mt-2">Solo la hora. Sirve para ver tu ventana de alimentación.</p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(TIPOS_COMIDA) as TipoComida[]).filter((t) => t !== 'other').map((t) => (
          <button key={t} onClick={() => setTipo(t)} aria-pressed={tipo === t} className={`py-3 rounded-xl font-semibold ${tipo === t ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`}>{TIPOS_COMIDA[t]}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">Día<input type="date" max={hoyIso()} value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" /></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Hora<input type="time" value={hora} onChange={(e) => e.target.value && setHora(e.target.value)} className="font-normal text-lg px-3 py-2 border border-borde rounded-xl bg-white" /></label>
      </div>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <button onClick={guardar} disabled={guardando} className="bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar'}</button>
    </Hoja>
  );
}

/** Comidas de un día con su ventana, y botón para borrar una anotada por error. */
export function ComidasDelDia({ supabase, comidas, onCambio }: { supabase: SupabaseClient; comidas: Comida[]; onCambio: () => void }) {
  const hoy = comidas.filter((c) => iso(new Date(c.eaten_at)) === hoyIso());
  if (hoy.length === 0) return <p className="text-sm text-texto-suave">Hoy aún no has anotado ninguna comida.</p>;
  const primera = new Date(hoy[0].eaten_at), ultima = new Date(hoy[hoy.length - 1].eaten_at);
  const min = (ultima.valueOf() - primera.valueOf()) / 60000;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {hoy.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 border-t border-fondo py-1.5 text-sm">
            <span><b className="tabular-nums">{hhmm(c.eaten_at)}</b> · {TIPOS_COMIDA[c.kind]}</span>
            <button onClick={async () => { if (window.confirm('¿Borrar esta comida?')) { await supabase.from('meal_events').delete().eq('id', c.id); onCambio(); } }} className="text-xs font-semibold text-texto-suave px-2 py-1">Borrar</button>
          </li>
        ))}
      </ul>
      {hoy.length > 1 && <p className="text-sm">Ventana de hoy: <b>{Math.floor(min / 60)} h {String(Math.round(min % 60)).padStart(2, '0')} min</b>, de {hhmm(hoy[0].eaten_at)} a {hhmm(hoy[hoy.length - 1].eaten_at)}.</p>}
    </div>
  );
}

// ---------- Piezas ----------

function Chips({ titulo, opciones, valor, onCambio, sufijo }: { titulo: string; opciones: { t: string; v: number }[]; valor: number | null; onCambio: (v: number | null) => void; sufijo?: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-semibold mb-1.5">{titulo}{sufijo ? ` (${sufijo})` : ''}</legend>
      <div className="flex gap-1.5">
        {opciones.map((o) => (
          <button key={o.t} type="button" onClick={() => onCambio(valor === o.v ? null : o.v)} aria-pressed={valor === o.v} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${valor === o.v ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`}>{o.t}</button>
        ))}
      </div>
    </fieldset>
  );
}

function Escala({ titulo, etiquetas, valor, onCambio }: { titulo: string; etiquetas: string[]; valor: number | null; onCambio: (v: number | null) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-semibold mb-1.5">{titulo}{valor ? `: ${etiquetas[valor - 1].toLowerCase()}` : ''}</legend>
      <div className="flex gap-1.5">
        {etiquetas.map((e, i) => (
          <button key={e} type="button" onClick={() => onCambio(valor === i + 1 ? null : i + 1)} aria-pressed={valor === i + 1} aria-label={e} className={`flex-1 py-2.5 rounded-xl text-base font-bold ${valor === i + 1 ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`}>{i + 1}</button>
        ))}
      </div>
    </fieldset>
  );
}
