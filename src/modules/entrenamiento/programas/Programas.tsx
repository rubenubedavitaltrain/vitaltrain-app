import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DIAS_CORTOS } from '../../../lib/fechas';

// Programas de 1 a 12 semanas: qué plantilla toca cada día y la regla de progresión de cada semana.
// Asignarlo (desde la ficha del paciente) crea las sesiones como copias: editar un programa
// después no cambia lo que ya está asignado.

type Plantilla = { id: string; name: string };
type Semana = { pct: number; nota: string; dias: (string | null)[] }; // dias[0] = lunes
type Resumen = { id: string; name: string; description: string | null; weeks: number };

const PCTS = [-40, -30, -20, -10, -5, 0, 5, 10, 15, 20];
const semanaVacia = (): Semana => ({ pct: 0, nota: '', dias: Array(7).fill(null) });

export default function Programas({ supabase }: { supabase: SupabaseClient }) {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null);

  async function cargar() {
    const { data } = await supabase.from('programs').select('id, name, description, weeks').eq('is_archived', false).order('name');
    setLista((data as Resumen[]) ?? []);
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (editando) return <Editor supabase={supabase} id={editando === 'nuevo' ? null : editando} onSalir={() => { setEditando(null); cargar(); }} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Programas</h2>
          <p className="text-sm text-texto-suave">De 1 a 12 semanas, con una regla de progresión por semana. Se asignan desde la ficha del paciente.</p>
        </div>
        <button onClick={() => setEditando('nuevo')} className="bg-mostaza text-[#1F2424] font-bold px-4 py-3 rounded-xl">Nuevo programa</button>
      </div>
      {!lista && <p className="text-texto-suave">Cargando…</p>}
      {lista && lista.length === 0 && <div className="bg-white rounded-2xl p-6 text-texto-suave">Aún no tienes programas. Primero crea las plantillas y luego repártelas por semanas aquí.</div>}
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lista?.map((p) => (
          <li key={p.id}>
            <button onClick={() => setEditando(p.id)} className="w-full text-left bg-white rounded-2xl p-5 flex flex-col gap-1">
              <span className="text-lg font-bold">{p.name}</span>
              <span className="text-sm text-texto-suave">{p.weeks} {p.weeks === 1 ? 'semana' : 'semanas'}{p.description ? ` · ${p.description}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Editor({ supabase, id, onSalir }: { supabase: SupabaseClient; id: string | null; onSalir: () => void }) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [semanas, setSemanas] = useState<Semana[]>([semanaVacia(), semanaVacia(), semanaVacia(), semanaVacia()]);
  const [cargando, setCargando] = useState(!!id);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('templates').select('id, name').eq('is_archived', false).order('name').then(({ data }) => setPlantillas((data as Plantilla[]) ?? []));
    if (!id) return;
    supabase
      .from('programs')
      .select('name, description, weeks, program_weeks(week_number, load_change_pct, note), program_slots(week_number, day_of_week, template_id)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const p = data as unknown as { name: string; description: string | null; weeks: number; program_weeks: { week_number: number; load_change_pct: number; note: string | null }[]; program_slots: { week_number: number; day_of_week: number; template_id: string }[] } | null;
        if (!p) return;
        setNombre(p.name);
        setDescripcion(p.description ?? '');
        setSemanas(
          Array.from({ length: p.weeks }, (_, i) => {
            const r = p.program_weeks.find((w) => w.week_number === i + 1);
            const dias: (string | null)[] = Array(7).fill(null);
            p.program_slots.filter((s) => s.week_number === i + 1).forEach((s) => { dias[s.day_of_week - 1] = s.template_id; });
            return { pct: Number(r?.load_change_pct ?? 0), nota: r?.note ?? '', dias };
          })
        );
        setCargando(false);
      });
  }, [id, supabase]);

  const cambiarDuracion = (n: number) => {
    const m = Math.min(12, Math.max(1, n));
    setSemanas((s) => (m > s.length ? [...s, ...Array.from({ length: m - s.length }, () => ({ ...semanaVacia(), dias: [...(s[s.length - 1]?.dias ?? Array(7).fill(null))] }))] : s.slice(0, m)));
  };
  const cambiar = (i: number, c: Partial<Semana>) => setSemanas((s) => s.map((w, j) => (j === i ? { ...w, ...c } : w)));

  async function guardar() {
    setError('');
    if (!nombre.trim()) return setError('Ponle un nombre al programa.');
    if (!semanas.some((w) => w.dias.some(Boolean))) return setError('Asigna al menos una plantilla a algún día.');
    const p = {
      id, name: nombre, description: descripcion, weeks: semanas.length,
      week_rules: semanas.map((w, i) => ({ week_number: i + 1, load_change_pct: w.pct, note: w.nota })),
      slots: semanas.flatMap((w, i) => w.dias.map((t, d) => (t ? { week_number: i + 1, day_of_week: d + 1, template_id: t } : null)).filter(Boolean))
    };
    setGuardando(true);
    const { error } = await supabase.rpc('save_program', { p });
    setGuardando(false);
    if (error) return setError('No se ha podido guardar el programa.');
    onSalir();
  }

  async function archivar() {
    if (!id) return onSalir();
    const { error } = await supabase.from('programs').update({ is_archived: true }).eq('id', id);
    if (error) setError('No se ha podido archivar.');
    else onSalir();
  }

  if (cargando) return <p className="text-texto-suave">Cargando…</p>;
  const sesiones = semanas.reduce((n, w) => n + w.dias.filter(Boolean).length, 0);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <button onClick={onSalir} className="self-start text-petroleo font-bold">← Programas</button>
      <div className="bg-white rounded-2xl p-5 grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Nombre del programa
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Fuerza base · 8 semanas" className="font-normal text-lg px-3 py-2.5 border border-borde rounded-xl" />
        </label>
        <div className="flex flex-col gap-1 text-sm font-semibold">
          Duración
          <div className="flex items-center gap-2">
            <button aria-label="Una semana menos" onClick={() => cambiarDuracion(semanas.length - 1)} className="w-11 h-11 rounded-xl bg-fondo text-xl font-bold">−</button>
            <span className="min-w-24 text-center text-lg">{semanas.length} {semanas.length === 1 ? 'semana' : 'semanas'}</span>
            <button aria-label="Una semana más" onClick={() => cambiarDuracion(semanas.length + 1)} className="w-11 h-11 rounded-xl bg-fondo text-xl font-bold">+</button>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
          Descripción (opcional, solo para ti)
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl" />
        </label>
      </div>

      {plantillas.length === 0 && <p className="bg-white rounded-2xl p-4 text-texto-suave">Para repartir sesiones necesitas plantillas. Créalas en la sección Plantillas.</p>}

      <section className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold mr-auto">Semanas · {sesiones} sesiones</h3>
          {semanas.length > 1 && (
            <button onClick={() => setSemanas((s) => s.map((w, i) => (i === 0 ? w : { ...w, dias: [...s[0].dias] })))} className="text-sm font-bold text-petroleo border-2 border-petroleo rounded-xl px-3 py-2">
              Repetir los días de la semana 1 en todas
            </button>
          )}
        </div>
        <p className="text-xs text-texto-suave">«Carga» sube o baja los kilos de la plantilla esa semana (se redondea a 0,5 kg). La nota la verá el paciente en sus sesiones de esa semana.</p>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[1100px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr className="text-xs text-texto-suave">
                <th scope="col" className="text-left font-semibold w-16">Semana</th>
                {DIAS_CORTOS.map((d) => <th key={d} scope="col" className="font-semibold">{d}</th>)}
                <th scope="col" className="font-semibold w-24">Carga</th>
                <th scope="col" className="text-left font-semibold min-w-56">Nota para el paciente</th>
              </tr>
            </thead>
            <tbody>
              {semanas.map((w, i) => (
                <tr key={i}>
                  <th scope="row" className="text-left font-bold">{i + 1}</th>
                  {w.dias.map((t, d) => (
                    <td key={d}>
                      <select
                        aria-label={`Semana ${i + 1}, ${DIAS_CORTOS[d]}`}
                        title={plantillas.find((p) => p.id === t)?.name ?? 'Descanso'}
                        value={t ?? ''}
                        onChange={(e) => cambiar(i, { dias: w.dias.map((x, k) => (k === d ? e.target.value || null : x)) })}
                        className={`w-full px-1.5 py-2 rounded-lg border text-xs ${t ? 'bg-petroleo text-white border-petroleo font-semibold' : 'bg-fondo border-transparent text-texto-suave'}`}
                      >
                        <option value="">Descanso</option>
                        {plantillas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                  ))}
                  <td>
                    <select aria-label={`Carga semana ${i + 1}`} value={w.pct} onChange={(e) => cambiar(i, { pct: Number(e.target.value) })} className={`w-full px-1.5 py-2 rounded-lg border border-borde ${w.pct < 0 ? 'text-[#2E6B8A]' : w.pct > 0 ? 'text-petroleo font-bold' : ''}`}>
                      {PCTS.map((p) => <option key={p} value={p}>{p > 0 ? `+${p} %` : p < 0 ? `${p} %` : 'Igual'}</option>)}
                    </select>
                  </td>
                  <td>
                    <input aria-label={`Nota semana ${i + 1}`} value={w.nota} maxLength={300} onChange={(e) => cambiar(i, { nota: e.target.value })} placeholder={w.pct < 0 ? 'Semana de descarga' : ''} className="w-full px-2 py-2 rounded-lg border border-borde" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex gap-2 justify-end z-40">
        {id && <button onClick={archivar} className="mr-auto text-texto-suave font-semibold px-3">Archivar</button>}
        <button onClick={onSalir} className="px-4 py-3 font-bold text-petroleo">Cancelar</button>
        <button onClick={guardar} disabled={guardando} className="bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-xl disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar programa'}</button>
      </div>
    </div>
  );
}
