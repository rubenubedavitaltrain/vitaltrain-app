import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import SelectorEjercicio, { type EjercicioMini } from '../biblioteca/SelectorEjercicio';
import { miniatura } from '../biblioteca/youtube';

// Plantillas de entrenamiento por bloques. El coach las crea aquí y luego las asigna a un día del paciente.
// Asignar hace una copia: cambiar la plantilla después no cambia lo ya asignado.

type TipoBloque = 'normal' | 'superset' | 'circuit';
export const TIPOS: Record<TipoBloque, string> = { normal: 'Normal', superset: 'Superserie', circuit: 'Circuito' };
export const DESCANSOS = [0, 30, 45, 60, 90, 120, 180, 240, 300];
export const textoDescanso = (d: number) => (d === 0 ? 'Sin descanso' : d < 60 ? `${d} s` : `${Math.floor(d / 60)} min${d % 60 ? ` ${d % 60} s` : ''}`);

type Item = { key: string; exercise: EjercicioMini; sets: number; target: string; load_kg: string; rest_seconds: number | null; instructions: string };
type Bloque = { key: string; name: string; type: TipoBloque; rounds: number; items: Item[] };
type Resumen = { id: string; name: string; description: string | null; updated_at: string; ejercicios: number };

const k = () => Math.random().toString(36).slice(2);

export default function Plantillas({ supabase }: { supabase: SupabaseClient }) {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [editando, setEditando] = useState<string | 'nueva' | null>(null);

  async function cargar() {
    const { data } = await supabase
      .from('templates')
      .select('id, name, description, updated_at, template_blocks(template_items(count))')
      .eq('is_archived', false)
      .order('name');
    setLista(
      ((data ?? []) as unknown as { id: string; name: string; description: string | null; updated_at: string; template_blocks: { template_items: { count: number }[] }[] }[]).map((t) => ({
        id: t.id, name: t.name, description: t.description, updated_at: t.updated_at,
        ejercicios: t.template_blocks.reduce((s, b) => s + (b.template_items[0]?.count ?? 0), 0)
      }))
    );
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (editando) {
    return <Editor supabase={supabase} id={editando === 'nueva' ? null : editando} onSalir={() => { setEditando(null); cargar(); }} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Plantillas de entrenamiento</h2>
          <p className="text-sm text-texto-suave">Entrenamientos por bloques que luego asignas a tus pacientes.</p>
        </div>
        <button onClick={() => setEditando('nueva')} className="bg-mostaza text-[#1F2424] font-bold px-4 py-3 rounded-xl">Nueva plantilla</button>
      </div>
      {!lista && <p className="text-texto-suave">Cargando…</p>}
      {lista && lista.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-texto-suave">Aún no tienes plantillas. Crea la primera con «Nueva plantilla».</div>
      )}
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lista?.map((t) => (
          <li key={t.id}>
            <button onClick={() => setEditando(t.id)} className="w-full text-left bg-white rounded-2xl p-5 flex flex-col gap-1">
              <span className="text-lg font-bold">{t.name}</span>
              <span className="text-sm text-texto-suave">{t.ejercicios} ejercicios{t.description ? ` · ${t.description}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Editor({ supabase, id, onSalir }: { supabase: SupabaseClient; id: string | null; onSalir: () => void }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [bloques, setBloques] = useState<Bloque[]>(id ? [] : [{ key: k(), name: 'Bloque principal', type: 'normal', rounds: 1, items: [] }]);
  const [cargando, setCargando] = useState(!!id);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase
      .from('templates')
      .select('name, description, template_blocks(position, name, type, rounds, template_items(position, sets, target, load_kg, rest_seconds, instructions, exercises(id, name, video_id, duration_seconds, muscle_groups, equipment)))')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        type Fila = { name: string; description: string | null; template_blocks: { position: number; name: string | null; type: TipoBloque; rounds: number; template_items: { position: number; sets: number; target: string | null; load_kg: number | null; rest_seconds: number | null; instructions: string | null; exercises: EjercicioMini }[] }[] };
        const t = data as unknown as Fila | null;
        if (!t) return;
        setNombre(t.name);
        setDescripcion(t.description ?? '');
        setBloques(
          [...t.template_blocks].sort((a, b) => a.position - b.position).map((b) => ({
            key: k(), name: b.name ?? '', type: b.type, rounds: b.rounds,
            items: [...b.template_items].sort((x, y) => x.position - y.position).map((i) => ({
              key: k(), exercise: i.exercises, sets: i.sets, target: i.target ?? '', load_kg: i.load_kg == null ? '' : String(i.load_kg),
              rest_seconds: i.rest_seconds, instructions: i.instructions ?? ''
            }))
          }))
        );
        setCargando(false);
      });
  }, [id, supabase]);

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

  async function guardar() {
    setError('');
    setMensaje('');
    if (!nombre.trim()) return setError('Ponle un nombre a la plantilla.');
    if (!bloques.some((b) => b.items.length)) return setError('Añade al menos un ejercicio.');
    const p = {
      id, name: nombre, description: descripcion,
      blocks: bloques.filter((b) => b.items.length).map((b) => ({
        name: b.name, type: b.type, rounds: b.type === 'normal' ? 1 : b.rounds,
        items: b.items.map((i) => ({
          exercise_id: i.exercise.id, sets: i.sets, target: i.target,
          load_kg: i.load_kg.replace(',', '.'), rest_seconds: i.rest_seconds, instructions: i.instructions
        }))
      }))
    };
    setGuardando(true);
    const { error } = await supabase.rpc('save_template', { p });
    setGuardando(false);
    if (error) return setError('No se ha podido guardar. Revisa los datos e inténtalo de nuevo.');
    onSalir();
  }

  async function archivar() {
    if (!id) return onSalir();
    const { error } = await supabase.from('templates').update({ is_archived: true }).eq('id', id);
    if (error) setError('No se ha podido archivar.');
    else onSalir();
  }

  if (cargando) return <p className="text-texto-suave">Cargando…</p>;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <button onClick={onSalir} className="self-start text-petroleo font-bold">← Plantillas</button>
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Nombre de la plantilla
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Fuerza A · Tren inferior" className="font-normal text-lg px-3 py-2.5 border border-borde rounded-xl" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Descripción (opcional, solo para ti)
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl" />
        </label>
      </div>

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

      <button onClick={() => setBloques((bs) => [...bs, { key: k(), name: '', type: 'normal', rounds: 1, items: [] }])} className="self-start bg-white text-petroleo font-bold px-4 py-3 rounded-xl">
        + Añadir bloque
      </button>

      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex gap-2 justify-end z-40">
        {id && <button onClick={archivar} className="mr-auto text-texto-suave font-semibold px-3">Archivar</button>}
        <button onClick={onSalir} className="px-4 py-3 font-bold text-petroleo">Cancelar</button>
        <button onClick={guardar} disabled={guardando} className="bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-xl disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar plantilla'}</button>
      </div>

      {eligiendo && (
        <SelectorEjercicio
          supabase={supabase}
          onCerrar={() => setEligiendo(null)}
          onElegir={(e) => {
            setBloques((bs) => bs.map((b) => (b.key === eligiendo ? { ...b, items: [...b.items, { key: k(), exercise: e, sets: 3, target: '10', load_kg: '', rest_seconds: 60, instructions: '' }] } : b)));
            setEligiendo(null);
          }}
        />
      )}
    </div>
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
