import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hoyIso } from '../../lib/fechas';
import { Linea, fechaLarga, num } from '../graficas';

// Mis medidas (núcleo): peso, cintura y cadera. Opcional, sin fotos. Una anotación por día.
// La usan el paciente (pestaña Progreso) y el coach (ficha), que también puede anotarlas en consulta.

type Medida = { id: string; measured_on: string; weight_kg: number | null; waist_cm: number | null; hip_cm: number | null };
type Campo = 'weight_kg' | 'waist_cm' | 'hip_cm';
const CAMPOS: { k: Campo; nombre: string; unidad: string }[] = [
  { k: 'weight_kg', nombre: 'Peso', unidad: 'kg' },
  { k: 'waist_cm', nombre: 'Cintura', unidad: 'cm' },
  { k: 'hip_cm', nombre: 'Cadera', unidad: 'cm' },
];

export default function Medidas({ supabase, pacienteId, esCoach = false }: { supabase: SupabaseClient; pacienteId: string; esCoach?: boolean }) {
  const [lista, setLista] = useState<Medida[] | null>(null);
  const [anotando, setAnotando] = useState(false);
  const [ver, setVer] = useState<Campo>('weight_kg');

  async function cargar() {
    const { data } = await supabase.from('body_measurements').select('id, measured_on, weight_kg, waist_cm, hip_cm').eq('patient_id', pacienteId).order('measured_on');
    setLista(((data as Medida[]) ?? []).map((m) => ({ ...m, weight_kg: m.weight_kg == null ? null : Number(m.weight_kg), waist_cm: m.waist_cm == null ? null : Number(m.waist_cm), hip_cm: m.hip_cm == null ? null : Number(m.hip_cm) })));
  }
  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const conDato = (k: Campo) => (lista ?? []).filter((m) => m[k] != null) as (Medida & Record<Campo, number>)[];
  const campo = CAMPOS.find((c) => c.k === ver)!;
  const puntos = conDato(ver);

  return (
    <section className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3" aria-labelledby={`medidas-${pacienteId}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`medidas-${pacienteId}`} className="font-bold">{esCoach ? 'Medidas' : 'Mis medidas'}</h3>
          <p className="text-xs text-texto-suave">Opcional. Mejor siempre a la misma hora, por ejemplo en ayunas.</p>
        </div>
        <button onClick={() => setAnotando(true)} className="shrink-0 bg-mostaza text-[#1F2424] font-bold px-4 py-2.5 rounded-xl">Anotar</button>
      </div>

      {!lista && <p className="text-sm text-texto-suave">Cargando…</p>}
      {lista && lista.length === 0 && <p className="text-sm text-texto-suave">{esCoach ? 'Aún no hay medidas anotadas.' : 'Aún no has anotado ninguna medida. Si quieres seguirlas, pulsa «Anotar».'}</p>}

      {lista && lista.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {CAMPOS.map((c) => {
              const d = conDato(c.k);
              const ultimo = d[d.length - 1];
              const dif = d.length > 1 ? ultimo[c.k] - d[0][c.k] : null;
              return (
                <button key={c.k} onClick={() => setVer(c.k)} aria-pressed={ver === c.k} className={`text-left rounded-xl p-3 ${ver === c.k ? 'bg-petroleo text-white' : 'bg-fondo'}`}>
                  <span className="block text-[11px] font-bold uppercase tracking-wide opacity-80">{c.nombre}</span>
                  <span className="block text-xl font-bold">{ultimo ? `${num(ultimo[c.k])} ${c.unidad}` : '—'}</span>
                  {dif != null && <span className="block text-[11px] opacity-80">{dif > 0 ? '+' : ''}{num(dif)} {c.unidad} desde el {fechaLarga(d[0].measured_on)}</span>}
                </button>
              );
            })}
          </div>
          {puntos.length > 0 ? (
            <Linea puntos={puntos.map((m) => ({ x: m.measured_on, y: m[ver], etiqueta: `${fechaLarga(m.measured_on)}: ${num(m[ver])} ${campo.unidad}` }))} dominioX={puntos.map((m) => m.measured_on)} unidad={` ${campo.unidad}`} vacio="" />
          ) : (
            <p className="text-sm text-texto-suave">Sin datos de {campo.nombre.toLowerCase()}.</p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-petroleo">Ver todas las anotaciones ({lista.length})</summary>
            <ul className="mt-2 flex flex-col">
              {[...lista].reverse().map((m) => (
                <li key={m.id} className="flex justify-between gap-2 border-t border-fondo py-1.5">
                  <span className="text-texto-suave">{fechaLarga(m.measured_on)}</span>
                  <span>{CAMPOS.map((c) => (m[c.k] != null ? `${c.nombre.toLowerCase()} ${num(m[c.k] as number)} ${c.unidad}` : null)).filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}

      {anotando && <Anotar supabase={supabase} pacienteId={pacienteId} previas={lista ?? []} onCerrar={() => setAnotando(false)} onHecho={() => { setAnotando(false); cargar(); }} />}
    </section>
  );
}

function Anotar({ supabase, pacienteId, previas, onCerrar, onHecho }: { supabase: SupabaseClient; pacienteId: string; previas: Medida[]; onCerrar: () => void; onHecho: () => void }) {
  const [fecha, setFecha] = useState(hoyIso());
  const delDia = previas.find((m) => m.measured_on === fecha);
  const [valores, setValores] = useState<Record<Campo, string>>(() => ({
    weight_kg: delDia?.weight_kg != null ? String(delDia.weight_kg).replace('.', ',') : '',
    waist_cm: delDia?.waist_cm != null ? String(delDia.waist_cm).replace('.', ',') : '',
    hip_cm: delDia?.hip_cm != null ? String(delDia.hip_cm).replace('.', ',') : '',
  }));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const aNum = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);

  async function guardar() {
    setError('');
    const fila = { patient_id: pacienteId, measured_on: fecha, weight_kg: aNum(valores.weight_kg), waist_cm: aNum(valores.waist_cm), hip_cm: aNum(valores.hip_cm) };
    if (fila.weight_kg == null && fila.waist_cm == null && fila.hip_cm == null) return setError('Anota al menos una medida.');
    if ([fila.weight_kg, fila.waist_cm, fila.hip_cm].some((v) => v != null && Number.isNaN(v))) return setError('Revisa los números.');
    if (fila.weight_kg != null && (fila.weight_kg < 20 || fila.weight_kg > 350)) return setError('El peso debe estar entre 20 y 350 kg.');
    if ([fila.waist_cm, fila.hip_cm].some((v) => v != null && (v < 30 || v > 250))) return setError('Cintura y cadera deben estar entre 30 y 250 cm.');
    setGuardando(true);
    const { error } = await supabase.from('body_measurements').upsert(fila, { onConflict: 'patient_id,measured_on' });
    setGuardando(false);
    if (error) return setError(navigator.onLine ? 'No se ha podido guardar.' : 'Necesitas conexión para guardar las medidas.');
    onHecho();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Anotar medidas" className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6" onClick={onCerrar}>
      <div className="bg-fondo w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold">Anotar medidas</h3>
          <button onClick={onCerrar} className="text-petroleo font-bold px-2">Cerrar</button>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Día
          <input type="date" max={hoyIso()} value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" />
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CAMPOS.map((c) => (
            <label key={c.k} className="flex flex-col gap-1 text-sm font-semibold">
              {c.nombre} ({c.unidad})
              <input inputMode="decimal" value={valores[c.k]} onChange={(e) => setValores((v) => ({ ...v, [c.k]: e.target.value.replace(/[^\d.,]/g, '') }))} className="w-full min-w-0 font-normal text-lg px-3 py-2.5 border border-borde rounded-xl bg-white" />
            </label>
          ))}
        </div>
        <p className="text-xs text-texto-suave">Rellena solo lo que quieras. Si ya anotaste ese día, se sustituye.</p>
        {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
        <button onClick={guardar} disabled={guardando} className="bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
}
