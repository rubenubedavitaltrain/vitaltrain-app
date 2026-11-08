import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import SelectorEjercicio, { type EjercicioMini } from '../biblioteca/SelectorEjercicio';
import { miniatura } from '../biblioteca/youtube';

// Constructor por bloques común: lo usan las plantillas y las sesiones a medida de cada paciente.

export type TipoBloque = 'normal' | 'superset' | 'circuit';
export const TIPOS: Record<TipoBloque, string> = { normal: 'Normal', superset: 'Superserie', circuit: 'Circuito' };
export const DESCANSOS = [0, 30, 45, 60, 90, 120, 180, 240, 300];
export const textoDescanso = (d: number) => (d === 0 ? 'Sin descanso' : d < 60 ? `${d} s` : `${Math.floor(d / 60)} min${d % 60 ? ` ${d % 60} s` : ''}`);

export type Item = { key: string; exercise: EjercicioMini; sets: number; target: string; load_kg: string; rest_seconds: number | null; instructions: string };
export type Bloque = { key: string; name: string; type: TipoBloque; rounds: number; items: Item[] };

export const nuevaClave = () => Math.random().toString(36).slice(2);
export const bloqueVacio = (name = ''): Bloque => ({ key: nuevaClave(), name, type: 'normal', rounds: 1, items: [] });

/** Columnas que se piden a la base de datos para cargar bloques (plantilla o sesión). */
export const COLUMNAS_ITEM = 'position, sets, target, load_kg, rest_seconds, instructions, exercises(id, name, video_id, duration_seconds, muscle_groups, equipment)';

type FilaItem = { position: number; sets: number; target: string | null; load_kg: number | null; rest_seconds: number | null; instructions: string | null; exercises: EjercicioMini };
type FilaBloque = { position: number; name: string | null; type: TipoBloque; rounds: number; items: FilaItem[] };

/** Convierte bloques leídos de la base de datos al formato del editor. */
export function desdeFilas(filas: FilaBloque[]): Bloque[] {
  return [...filas].sort((a, b) => a.position - b.position).map((b) => ({
    key: nuevaClave(), name: b.name ?? '', type: b.type, rounds: b.rounds,
    items: [...b.items].sort((x, y) => x.position - y.position).map((i) => ({
      key: nuevaClave(), exercise: i.exercises, sets: i.sets, target: i.target ?? '',
      load_kg: i.load_kg == null ? '' : String(i.load_kg), rest_seconds: i.rest_seconds, instructions: i.instructions ?? ''
    }))
  }));
}

/** Convierte los bloques del editor al formato que guardan save_template y save_workout. */
export function aGuardar(bloques: Bloque[]) {
  return bloques.filter((b) => b.items.length).map((b) => ({
    name: b.name, type: b.type, rounds: b.type === 'normal' ? 1 : b.rounds,
    items: b.items.map((i) => ({
      exercise_id: i.exercise.id, sets: i.sets, target: i.target,
      load_kg: i.load_kg.replace(',', '.'), rest_seconds: i.rest_seconds, instructions: i.instructions
    }))
  }));
}

/** Copia profunda con claves nuevas (para duplicar ejercicios o bloques). */
const clonar = (b: Bloque): Bloque => ({ ...b, key: nuevaClave(), items: b.items.map((i) => ({ ...i, key: nuevaClave() })) });

export default function EditorBloques({ supabase, bloques, setBloques }: { supabase: SupabaseClient; bloques: Bloque[]; setBloques: React.Dispatch<React.SetStateAction<Bloque[]>> }) {
  const [eligiendo, setEligiendo] = useState<string | null>(null);

  const cambiarBloque = (key: string, c: Partial<Bloque>) => setBloques((bs) => bs.map((b) => (b.key === key ? { ...b, ...c } : b)));
  const cambiarItem = (bk: string, ik: string, c: Partial<Item>) =>
    setBloques((bs) => bs.map((b) => (b.key === bk ? { ...b, items: b.items.map((i) => (i.key === ik ? { ...i, ...c } : i)) } : b)));
  const mover = <T,>(arr: T[], i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const c = [...arr];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };

  return (
    <>
      {bloques.map((b, bi) => (
        <section key={b.key} className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3 border-l-4 border-mostaza">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold flex-1 min-w-40">
              Bloque {bi + 1}
              <input value={b.name} onChange={(e) => cambiarBloque(b.key, { name: e.target.value })} placeholder="Calentamiento, principal…" className="font-semibold text-base px-3 py-2 border border-borde rounded-xl" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Tipo
              <select value={b.type} onChange={(e) => cambiarBloque(b.key, { type: e.target.value as TipoBloque })} className="text-base px-3 py-2 border border-borde rounded-xl bg-white">
                {Object.entries(TIPOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            {b.type !== 'normal' && (
              <label className="flex flex-col gap-1 text-xs font-semibold w-24">
                Vueltas
                <input type="number" min={1} max={20} value={b.rounds} onChange={(e) => cambiarBloque(b.key, { rounds: Math.max(1, Number(e.target.value) || 1) })} className="text-base px-3 py-2 border border-borde rounded-xl" />
              </label>
            )}
            <div className="flex gap-1">
              <button aria-label="Subir bloque" onClick={() => setBloques((bs) => mover(bs, bi, -1))} className="px-3 py-2 rounded-lg bg-fondo font-bold">↑</button>
              <button aria-label="Bajar bloque" onClick={() => setBloques((bs) => mover(bs, bi, 1))} className="px-3 py-2 rounded-lg bg-fondo font-bold">↓</button>
              <button aria-label="Duplicar bloque" title="Duplicar bloque" onClick={() => setBloques((bs) => [...bs.slice(0, bi + 1), clonar(b), ...bs.slice(bi + 1)])} className="px-3 py-2 rounded-lg bg-fondo font-bold">⧉</button>
              <button aria-label="Quitar bloque" onClick={() => setBloques((bs) => bs.filter((x) => x.key !== b.key))} className="px-3 py-2 rounded-lg bg-fondo font-bold text-[#8A2C1D]">✕</button>
            </div>
          </div>
          {b.type !== 'normal' && (
            <p className="text-xs text-texto-suave">
              {b.type === 'superset' ? 'Superserie: los ejercicios se hacen seguidos y se descansa al final de cada vuelta.' : 'Circuito: se pasa por todos los ejercicios y se repite el número de vueltas.'}
            </p>
          )}

          <ol className="flex flex-col gap-2">
            {b.items.map((i, ii) => (
              <li key={i.key} className="bg-fondo rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-14 rounded-md overflow-hidden bg-gris-claro shrink-0">
                    {i.exercise.video_id && <img src={miniatura(i.exercise.video_id)} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <span className="flex-1 font-semibold leading-snug">{i.exercise.name}</span>
                  <button aria-label="Subir" onClick={() => cambiarBloque(b.key, { items: mover(b.items, ii, -1) })} className="px-2 py-1 font-bold">↑</button>
                  <button aria-label="Bajar" onClick={() => cambiarBloque(b.key, { items: mover(b.items, ii, 1) })} className="px-2 py-1 font-bold">↓</button>
                  <button aria-label="Cambiar ejercicio" title="Cambiar por otro ejercicio" onClick={() => setEligiendo(`${b.key}|${i.key}`)} className="px-2 py-1 font-bold">⇄</button>
                  <button aria-label="Quitar" onClick={() => cambiarBloque(b.key, { items: b.items.filter((x) => x.key !== i.key) })} className="px-2 py-1 font-bold text-[#8A2C1D]">✕</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Num etiqueta="Series" valor={i.sets} onCambio={(v) => cambiarItem(b.key, i.key, { sets: Math.max(1, v) })} />
                  <Texto etiqueta="Reps o tiempo" valor={i.target} onCambio={(v) => cambiarItem(b.key, i.key, { target: v })} ejemplo="8-10 / 40 s" />
                  <Texto etiqueta="Carga (kg)" valor={i.load_kg} onCambio={(v) => cambiarItem(b.key, i.key, { load_kg: v.replace(/[^\d.,]/g, '') })} ejemplo="12" modo="decimal" />
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Descanso
                    <select value={i.rest_seconds ?? ''} onChange={(e) => cambiarItem(b.key, i.key, { rest_seconds: e.target.value === '' ? null : Number(e.target.value) })} className="text-base px-2 py-2 border border-borde rounded-lg bg-white">
                      <option value="">—</option>
                      {DESCANSOS.map((d) => <option key={d} value={d}>{textoDescanso(d)}</option>)}
                    </select>
                  </label>
                </div>
                <Texto etiqueta="Indicación para el paciente (opcional)" valor={i.instructions} onCambio={(v) => cambiarItem(b.key, i.key, { instructions: v })} ejemplo="Controla la bajada en 3 segundos" />
              </li>
            ))}
          </ol>
          <button onClick={() => setEligiendo(b.key)} className="self-start text-petroleo font-bold px-3 py-2 rounded-xl border-2 border-petroleo">+ Añadir ejercicio</button>
        </section>
      ))}

      <button onClick={() => setBloques((bs) => [...bs, bloqueVacio()])} className="self-start bg-white text-petroleo font-bold px-4 py-3 rounded-xl">
        + Añadir bloque
      </button>

      {eligiendo && (
        <SelectorEjercicio
          supabase={supabase}
          onCerrar={() => setEligiendo(null)}
          onElegir={(e) => {
            const [bk, ik] = eligiendo.split('|');
            if (ik) {
              // Cambiar el ejercicio manteniendo series, reps, carga y descanso
              cambiarItem(bk, ik, { exercise: e });
            } else {
              setBloques((bs) => bs.map((b) => {
                if (b.key !== bk) return b;
                const ultimo = b.items[b.items.length - 1];
                // El nuevo ejercicio hereda series, reps y descanso del anterior del bloque: menos tecleo
                const base = ultimo ? { sets: ultimo.sets, target: ultimo.target, rest_seconds: ultimo.rest_seconds } : { sets: 3, target: '10', rest_seconds: 60 };
                return { ...b, items: [...b.items, { key: nuevaClave(), exercise: e, load_kg: '', instructions: '', ...base }] };
              }));
            }
            setEligiendo(null);
          }}
        />
      )}
    </>
  );
}

function Num({ etiqueta, valor, onCambio }: { etiqueta: string; valor: number; onCambio: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      {etiqueta}
      <input type="number" inputMode="numeric" min={1} max={20} value={valor} onChange={(e) => onCambio(Number(e.target.value) || 1)} className="text-base px-2 py-2 border border-borde rounded-lg bg-white" />
    </label>
  );
}

function Texto({ etiqueta, valor, onCambio, ejemplo, modo }: { etiqueta: string; valor: string; onCambio: (v: string) => void; ejemplo?: string; modo?: 'decimal' }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      {etiqueta}
      <input inputMode={modo} value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={ejemplo} className="font-normal text-base px-2 py-2 border border-borde rounded-lg bg-white" />
    </label>
  );
}
