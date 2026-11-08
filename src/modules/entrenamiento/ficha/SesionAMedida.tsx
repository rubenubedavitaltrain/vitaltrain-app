import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DIAS_CORTOS, desdeIso, iso, lunes, sumarDias } from '../../../lib/fechas';
import EditorBloques, { type Bloque, COLUMNAS_ITEM, aGuardar, bloqueVacio, desdeFilas } from '../constructor/Bloques';

// Diseñar una sesión directamente para un paciente, sin pasar por plantillas.
// - nueva: desde un día del calendario; se puede repetir en varios días y semanas.
// - editar: cambia una sesión suya pendiente y sin registros.
// - duplicar: parte de una sesión suya (hecha o no) y crea otra nueva.

type Modo = { tipo: 'nueva'; fecha: string } | { tipo: 'editar'; id: string } | { tipo: 'duplicar'; id: string };
type FilaBloque = Parameters<typeof desdeFilas>[0][number];

export default function SesionAMedida({ supabase, pacienteId, nombrePaciente, modo, onCerrar, onHecho }: {
  supabase: SupabaseClient; pacienteId: string; nombrePaciente: string; modo: Modo; onCerrar: () => void; onHecho: (aviso: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [bloques, setBloques] = useState<Bloque[]>(modo.tipo === 'nueva' ? [bloqueVacio('Bloque principal')] : []);
  const [fecha, setFecha] = useState(modo.tipo === 'nueva' ? modo.fecha : '');
  const [dias, setDias] = useState<number[]>(modo.tipo === 'nueva' ? [(desdeIso(modo.fecha).getDay() + 6) % 7] : []);
  const [semanas, setSemanas] = useState(1);
  const [comoPlantilla, setComoPlantilla] = useState(false);
  const [plantillas, setPlantillas] = useState<{ id: string; name: string }[]>([]);
  const [cargando, setCargando] = useState(modo.tipo !== 'nueva');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('templates').select('id, name').eq('is_archived', false).order('name').then(({ data }) => setPlantillas((data as { id: string; name: string }[]) ?? []));
    if (modo.tipo === 'nueva') return;
    supabase
      .from('workouts')
      .select(`name, coach_message, scheduled_date, workout_blocks(position, name, type, rounds, workout_items(${COLUMNAS_ITEM}))`)
      .eq('id', modo.id)
      .single()
      .then(({ data }) => {
        const w = data as unknown as { name: string; coach_message: string | null; scheduled_date: string; workout_blocks: (FilaBloque & { workout_items: FilaBloque['items'] })[] } | null;
        if (!w) return setError('No se ha encontrado la sesión.');
        setNombre(w.name);
        setMensaje(w.coach_message ?? '');
        setBloques(desdeFilas(w.workout_blocks.map((b) => ({ ...b, items: b.workout_items }))));
        setFecha(w.scheduled_date);
        if (modo.tipo === 'duplicar') setDias([(desdeIso(w.scheduled_date).getDay() + 6) % 7]);
        setCargando(false);
      });
  }, [modo, supabase]);

  async function partirDePlantilla(id: string) {
    if (!id) return;
    if (bloques.some((b) => b.items.length) && !window.confirm('Se sustituirán los ejercicios que ya has puesto. ¿Seguir?')) return;
    const { data } = await supabase
      .from('templates')
      .select(`name, template_blocks(position, name, type, rounds, template_items(${COLUMNAS_ITEM}))`)
      .eq('id', id)
      .single();
    const t = data as unknown as { name: string; template_blocks: (FilaBloque & { template_items: FilaBloque['items'] })[] } | null;
    if (!t) return;
    setBloques(desdeFilas(t.template_blocks.map((b) => ({ ...b, items: b.template_items }))));
    if (!nombre.trim()) setNombre(t.name);
  }

  // Fechas en las que se creará la sesión (nueva o duplicada)
  const lunesBase = useMemo(() => lunes(desdeIso(fecha || iso(new Date()))), [fecha]);
  // Los días ya pasados no se incluyen: se diseña hacia delante
  const hoy = iso(new Date());
  const todas = useMemo(
    () => (modo.tipo === 'editar' ? [] : Array.from({ length: semanas }, (_, w) => [...dias].sort().map((d) => iso(sumarDias(lunesBase, w * 7 + d)))).flat()),
    [modo.tipo, semanas, dias, lunesBase]
  );
  const fechas = todas.filter((f) => f >= hoy);
  const pasadas = todas.length - fechas.length;

  async function guardar() {
    setError('');
    if (!nombre.trim()) return setError('Ponle un nombre a la sesión.');
    if (!bloques.some((b) => b.items.length)) return setError('Añade al menos un ejercicio.');
    if (modo.tipo !== 'editar' && fechas.length === 0) return setError('Elige al menos un día.');
    const blocks = aGuardar(bloques);
    const p = modo.tipo === 'editar'
      ? { id: modo.id, name: nombre, coach_message: mensaje, date: fecha, blocks }
      : { patient_id: pacienteId, name: nombre, coach_message: mensaje, dates: fechas, blocks };
    setGuardando(true);
    const { error } = await supabase.rpc('save_workout', { p });
    if (error) {
      setGuardando(false);
      return setError(error.message.includes('registros') ? 'El paciente ya ha registrado algo en esta sesión. Duplícala y quita esta si quieres cambiarla.' : 'No se ha podido guardar. Revisa los datos e inténtalo de nuevo.');
    }
    let extra = '';
    if (comoPlantilla && modo.tipo !== 'editar') {
      const r = await supabase.rpc('save_template', { p: { id: null, name: nombre, description: `Creada para ${nombrePaciente}`, blocks } });
      extra = r.error ? ' No se ha podido guardar como plantilla.' : ' También guardada como plantilla.';
    }
    setGuardando(false);
    onHecho(modo.tipo === 'editar' ? `Sesión actualizada.${extra}` : `${fechas.length === 1 ? 'Creada 1 sesión' : `Creadas ${fechas.length} sesiones`}.${extra}`);
  }

  const titulo = modo.tipo === 'editar' ? 'Editar sesión' : modo.tipo === 'duplicar' ? 'Duplicar sesión' : 'Nueva sesión';
  const fmt = (f: string) => desdeIso(f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 bg-fondo overflow-y-auto">
      <header className="sticky top-0 z-10 bg-petroleo text-white px-4 sm:px-8 py-3 flex items-center gap-3">
        <h2 className="text-lg font-bold flex-1 truncate">{titulo} · {nombrePaciente}</h2>
        <button onClick={onCerrar} className="font-bold px-2">Cerrar</button>
      </header>

      {cargando ? <p className="p-6 text-texto-suave">Cargando…</p> : (
        <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-4 pb-28 flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-5 grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
              Nombre de la sesión
              <input autoFocus={modo.tipo === 'nueva'} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Fuerza · tren inferior" className="font-normal text-lg px-3 py-2.5 border border-borde rounded-xl" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
              Mensaje para el paciente (opcional)
              <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} placeholder="Ej.: hoy controla la bajada en las sentadillas" className="font-normal text-base px-3 py-2 border border-borde rounded-xl" />
            </label>
            {plantillas.length > 0 && (
              <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
                Partir de una plantilla (opcional)
                <select value="" onChange={(e) => partirDePlantilla(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white">
                  <option value="">Empezar desde cero</option>
                  {plantillas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
          </div>

          <EditorBloques supabase={supabase} bloques={bloques} setBloques={setBloques} />

          <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-label="Cuándo">
            <h3 className="text-lg font-bold">Cuándo</h3>
            {modo.tipo === 'editar' ? (
              <label className="flex flex-col gap-1 text-sm font-semibold max-w-60">
                Día
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="font-normal text-base px-3 py-2 border border-borde rounded-xl" />
              </label>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">Días de la semana</span>
                  <div className="flex flex-wrap gap-1.5">
                    {DIAS_CORTOS.map((d, i) => {
                      const on = dias.includes(i);
                      return (
                        <button key={d} aria-pressed={on} onClick={() => setDias((ds) => (on ? ds.filter((x) => x !== i) : [...ds, i]))} className={`w-14 py-2.5 rounded-xl font-bold ${on ? 'bg-petroleo text-white' : 'bg-fondo text-texto-suave'}`}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold">Durante</span>
                  <button aria-label="Una semana menos" onClick={() => setSemanas((n) => Math.max(1, n - 1))} className="w-11 h-11 rounded-xl bg-fondo text-xl font-bold">−</button>
                  <span className="min-w-24 text-center font-semibold">{semanas} {semanas === 1 ? 'semana' : 'semanas'}</span>
                  <button aria-label="Una semana más" onClick={() => setSemanas((n) => Math.min(12, n + 1))} className="w-11 h-11 rounded-xl bg-fondo text-xl font-bold">+</button>
                  <label className="text-sm text-texto-suave flex items-center gap-2">
                    a partir de la semana del
                    <input type="date" value={iso(lunesBase)} onChange={(e) => e.target.value && setFecha(e.target.value)} className="text-base px-2 py-1.5 border border-borde rounded-lg text-[#4A4A4C]" />
                  </label>
                </div>
                <p className="text-sm">
                  {fechas.length === 0 ? (pasadas ? 'Esos días ya han pasado. Elige otros o empieza la semana siguiente.' : 'Elige al menos un día.') : <>Se {fechas.length === 1 ? 'creará 1 sesión' : `crearán ${fechas.length} sesiones`}: <span className="text-texto-suave">{fechas.length <= 6 ? fechas.map(fmt).join(', ') : `del ${fmt(fechas[0])} al ${fmt(fechas[fechas.length - 1])}`}</span></>}
                  {pasadas > 0 && <span className="text-texto-suave"> ({pasadas === 1 ? 'se omite 1 día que ya ha pasado' : `se omiten ${pasadas} días que ya han pasado`})</span>}
                </p>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={comoPlantilla} onChange={(e) => setComoPlantilla(e.target.checked)} className="w-5 h-5 accent-[#374949]" />
                  Guardar también como plantilla para reutilizarla
                </label>
              </>
            )}
          </section>

          {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex gap-2 justify-end z-20">
        <button onClick={onCerrar} className="px-4 py-3 font-bold text-petroleo">Cancelar</button>
        <button onClick={guardar} disabled={guardando || cargando} className="bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-xl disabled:opacity-60">
          {guardando ? 'Guardando…' : modo.tipo === 'editar' ? 'Guardar cambios' : fechas.length > 1 ? `Crear ${fechas.length} sesiones` : 'Crear sesión'}
        </button>
      </div>
    </div>
  );
}
