import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DIAS_CORTOS, desdeIso, iso, lunes, rangoSemana, sumarDias } from '../../../lib/fechas';
import { MOTIVOS } from '../paciente/tipos';
import { comoLista } from '../paciente/datos';
import SesionAMedida from './SesionAMedida';
import CambiarEjercicio from './CambiarEjercicio';

// Sección de entrenamiento en la ficha del paciente: semana, crear una sesión a medida o asignar una plantilla,
// editar o duplicar sesiones, copiar la semana anterior, ver lo que ha registrado y borrar sesiones pendientes.

type Sesion = { id: string; scheduled_date: string; name: string; status: 'scheduled' | 'in_progress' | 'completed' | 'skipped'; rpe: number | null; coach_message: string | null };
const ESTADO: Record<Sesion['status'], string> = { scheduled: 'Pendiente', in_progress: 'En curso', completed: 'Hecho', skipped: 'No hecho' };

type ModoSesion = { tipo: 'nueva'; fecha: string } | { tipo: 'editar'; id: string } | { tipo: 'duplicar'; id: string };

export default function SemanaCoach({ supabase, pacienteId, nombrePaciente }: { supabase: SupabaseClient; pacienteId: string; nombrePaciente: string }) {
  const [inicio, setInicio] = useState(() => lunes(new Date()));
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [asignarDia, setAsignarDia] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Sesion | null>(null);
  const [aviso, setAviso] = useState('');
  const [aMedida, setAMedida] = useState<ModoSesion | null>(null);
  const [cambiando, setCambiando] = useState(false);

  async function cargar() {
    const { data } = await supabase
      .from('workouts')
      .select('id, scheduled_date, name, status, rpe, coach_message')
      .eq('patient_id', pacienteId)
      .gte('scheduled_date', iso(inicio))
      .lte('scheduled_date', iso(sumarDias(inicio, 6)))
      .order('scheduled_date');
    setSesiones((data as Sesion[]) ?? []);
  }
  useEffect(() => { cargar(); setAviso(''); }, [inicio, pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function copiarAnterior() {
    if (sesiones.length && !window.confirm('Esta semana ya tiene sesiones. ¿Añadir también las de la semana anterior?')) return;
    const { data, error } = await supabase.rpc('copy_week', { p_patient: pacienteId, p_from_monday: iso(sumarDias(inicio, -7)), p_to_monday: iso(inicio) });
    if (error) return setAviso('No se ha podido copiar la semana.');
    setAviso(data ? `Copiadas ${data} sesiones de la semana anterior.` : 'La semana anterior no tenía sesiones.');
    cargar();
  }

  const hoy = iso(new Date());
  const hechas = sesiones.filter((s) => s.status === 'completed').length;

  return (
    <section className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3" aria-labelledby="semana">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="semana" className="text-lg font-bold mr-auto">Entrenamiento</h3>
        <button aria-label="Semana anterior" onClick={() => setInicio(sumarDias(inicio, -7))} className="px-3 py-2 rounded-lg bg-fondo font-bold">‹</button>
        <span className="font-semibold min-w-32 text-center">{rangoSemana(inicio)}</span>
        <button aria-label="Semana siguiente" onClick={() => setInicio(sumarDias(inicio, 7))} className="px-3 py-2 rounded-lg bg-fondo font-bold">›</button>
        <button onClick={copiarAnterior} className="px-3 py-2 rounded-lg border-2 border-petroleo text-petroleo font-bold text-sm">Copiar semana anterior</button>
        <button onClick={() => setCambiando(true)} className="px-3 py-2 rounded-lg border-2 border-petroleo text-petroleo font-bold text-sm">Cambiar un ejercicio</button>
      </div>
      <p className="text-sm text-texto-suave">{sesiones.length ? `${hechas} de ${sesiones.length} sesiones hechas` : 'Sin sesiones esta semana'}</p>
      {aviso && <p role="status" className="text-sm font-semibold">{aviso}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => {
          const d = sumarDias(inicio, i);
          const f = iso(d);
          const delDia = sesiones.filter((s) => s.scheduled_date === f);
          return (
            <div key={f} className={`rounded-xl p-2 flex flex-col gap-2 min-h-24 ${f === hoy ? 'bg-[#F4F1E4] ring-2 ring-mostaza' : 'bg-fondo'}`}>
              <div className="text-xs font-semibold text-texto-suave">{DIAS_CORTOS[i]} {d.getDate()}</div>
              {delDia.map((s) => (
                <button key={s.id} onClick={() => setDetalle(s)} className={`text-left rounded-lg px-2 py-1.5 text-sm font-semibold leading-tight ${s.status === 'completed' ? 'bg-petroleo text-white' : s.status === 'skipped' ? 'bg-gris-claro text-texto-suave line-through' : 'bg-white'}`}>
                  {s.name}
                  <span className="block text-[11px] font-normal opacity-80">{ESTADO[s.status]}{s.rpe ? ` · esfuerzo ${s.rpe}` : ''}</span>
                </button>
              ))}
              <div className="mt-auto flex flex-col gap-1">
                <button onClick={() => setAMedida({ tipo: 'nueva', fecha: f })} className="text-xs font-bold text-[#1F2424] bg-mostaza rounded-lg px-2 py-1.5 text-left">+ Crear sesión</button>
                <button onClick={() => setAsignarDia(f)} className="text-xs font-bold text-petroleo text-left px-2">+ De plantilla</button>
              </div>
            </div>
          );
        })}
      </div>
      {asignarDia && <Asignar supabase={supabase} pacienteId={pacienteId} fecha={asignarDia} onCerrar={() => setAsignarDia(null)} onHecho={() => { setAsignarDia(null); cargar(); }} />}
      {detalle && (
        <Detalle
          supabase={supabase} sesion={detalle} onCerrar={() => setDetalle(null)} onBorrada={() => { setDetalle(null); cargar(); }}
          onEditar={() => { setAMedida({ tipo: 'editar', id: detalle.id }); setDetalle(null); }}
          onDuplicar={() => { setAMedida({ tipo: 'duplicar', id: detalle.id }); setDetalle(null); }}
        />
      )}
      {cambiando && (
        <CambiarEjercicio supabase={supabase} pacienteId={pacienteId} onCerrar={() => setCambiando(false)} onHecho={(t) => { setCambiando(false); setAviso(t); cargar(); }} />
      )}
      {aMedida && (
        <SesionAMedida
          supabase={supabase} pacienteId={pacienteId} nombrePaciente={nombrePaciente} modo={aMedida}
          onCerrar={() => setAMedida(null)}
          onHecho={(t) => { setAMedida(null); setAviso(t); cargar(); }}
        />
      )}
    </section>
  );
}

function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6" onClick={onCerrar}>
      <div className="bg-fondo w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold leading-tight">{titulo}</h3>
          <button onClick={onCerrar} className="text-petroleo font-bold px-2">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Asignar({ supabase, pacienteId, fecha, onCerrar, onHecho }: { supabase: SupabaseClient; pacienteId: string; fecha: string; onCerrar: () => void; onHecho: () => void }) {
  const [plantillas, setPlantillas] = useState<{ id: string; name: string }[] | null>(null);
  const [elegida, setElegida] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.from('templates').select('id, name').eq('is_archived', false).order('name').then(({ data }) => setPlantillas((data as { id: string; name: string }[]) ?? []));
  }, [supabase]);

  async function asignar() {
    if (!elegida) return setError('Elige una plantilla.');
    setEnviando(true);
    const { error } = await supabase.rpc('assign_template', { p_template: elegida, p_patient: pacienteId, p_date: fecha, p_message: mensaje.trim() || null });
    setEnviando(false);
    if (error) setError('No se ha podido asignar.');
    else onHecho();
  }

  const d = desdeIso(fecha);
  return (
    <Ventana titulo={`Asignar el ${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`} onCerrar={onCerrar}>
      {!plantillas && <p className="text-texto-suave">Cargando…</p>}
      {plantillas && plantillas.length === 0 && <p className="text-texto-suave">Aún no tienes plantillas. Créalas en la sección Plantillas.</p>}
      <ul className="flex flex-col gap-2">
        {plantillas?.map((p) => (
          <li key={p.id}>
            <label className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer ${elegida === p.id ? 'bg-petroleo text-white' : 'bg-white'}`}>
              <input type="radio" name="plantilla" value={p.id} checked={elegida === p.id} onChange={() => setElegida(p.id)} className="sr-only" />
              <span className="font-semibold">{p.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Mensaje para el paciente (opcional)
        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} placeholder="Ej.: hoy controla la bajada en las sentadillas" className="font-normal text-base px-3 py-2 border border-borde rounded-xl bg-white" />
      </label>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <button onClick={asignar} disabled={enviando || !elegida} className="self-end bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60">{enviando ? 'Asignando…' : 'Asignar'}</button>
    </Ventana>
  );
}

type ItemDetalle = { id: string; position: number; sets: number; target: string | null; load_kg: number | null; exercises: { name: string }; set_logs: { set_number: number; reps: number | null; load_kg: number | null; done: boolean }[]; workout_item_feedback: { note: string | null; cannot_do: boolean; reason: string | null }[] };
type BloqueDetalle = { position: number; name: string | null; workout_items: ItemDetalle[] };

function Detalle({ supabase, sesion, onCerrar, onBorrada, onEditar, onDuplicar }: { supabase: SupabaseClient; sesion: Sesion; onCerrar: () => void; onBorrada: () => void; onEditar: () => void; onDuplicar: () => void }) {
  const [bloques, setBloques] = useState<BloqueDetalle[] | null>(null);
  const [extra, setExtra] = useState<{ feeling: string | null; patient_notes: string | null } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('workouts')
      .select('feeling, patient_notes, workout_blocks(position, name, workout_items(id, position, sets, target, load_kg, exercises(name), set_logs(set_number, reps, load_kg, done), workout_item_feedback(note, cannot_do, reason)))')
      .eq('id', sesion.id)
      .single()
      .then(({ data }) => {
        const w = data as unknown as { feeling: string | null; patient_notes: string | null; workout_blocks: BloqueDetalle[] } | null;
        setExtra(w ? { feeling: w.feeling, patient_notes: w.patient_notes } : null);
        const bs = (w?.workout_blocks ?? []).sort((a, b) => a.position - b.position);
        bs.forEach((b) => b.workout_items.forEach((i) => { i.set_logs = comoLista(i.set_logs); i.workout_item_feedback = comoLista(i.workout_item_feedback); }));
        setBloques(bs);
      });
  }, [sesion.id, supabase]);

  const tieneRegistros = (bloques ?? []).some((b) => b.workout_items.some((i) => i.set_logs.length));
  const tieneNotas = (bloques ?? []).some((b) => b.workout_items.some((i) => i.workout_item_feedback.length));
  const sePuedeBorrar = sesion.status === 'scheduled' && !tieneRegistros;
  const sePuedeEditar = bloques !== null && sePuedeBorrar && !tieneNotas;

  async function borrar() {
    if (!window.confirm('¿Quitar esta sesión del calendario del paciente?')) return;
    const { error } = await supabase.from('workouts').delete().eq('id', sesion.id);
    if (error) setError('No se ha podido quitar.');
    else onBorrada();
  }

  return (
    <Ventana titulo={sesion.name} onCerrar={onCerrar}>
      <p className="text-sm text-texto-suave">
        {desdeIso(sesion.scheduled_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} · {ESTADO[sesion.status]}
        {sesion.rpe ? ` · esfuerzo ${sesion.rpe}/10` : ''}
      </p>
      {sesion.coach_message && <p className="bg-white rounded-xl p-3 text-sm"><strong>Tu mensaje:</strong> {sesion.coach_message}</p>}
      {extra?.feeling && <p className="bg-white rounded-xl p-3 text-sm"><strong>Cómo se ha sentido:</strong> {extra.feeling}</p>}
      {extra?.patient_notes && <p className="bg-white rounded-xl p-3 text-sm"><strong>Sus notas:</strong> {extra.patient_notes}</p>}
      {!bloques && <p className="text-texto-suave">Cargando…</p>}
      {bloques?.map((b) => (
        <div key={b.position} className="bg-white rounded-xl p-3 flex flex-col gap-2">
          {b.name && <h4 className="text-sm font-bold text-texto-suave">{b.name}</h4>}
          {[...b.workout_items].sort((x, y) => x.position - y.position).map((i) => {
            const fb = i.workout_item_feedback[0];
            return (
              <div key={i.id} className="text-sm border-t border-fondo pt-2 first:border-0 first:pt-0">
                <div className="font-semibold">{i.exercises.name}</div>
                <div className="text-texto-suave">Pautado: {i.sets} × {i.target ?? '—'}{i.load_kg != null ? ` · ${i.load_kg} kg` : ''}</div>
                {i.set_logs.length > 0 && (
                  <div>Hecho: {[...i.set_logs].sort((a, c) => a.set_number - c.set_number).map((l) => `${l.reps ?? '—'}${l.load_kg != null ? `×${l.load_kg}kg` : ''}`).join(' · ')}</div>
                )}
                {fb?.cannot_do && <div className="font-semibold text-[#8A2C1D]">No ha podido: {MOTIVOS[fb.reason as keyof typeof MOTIVOS] ?? 'otro motivo'}</div>}
                {fb?.note && <div className="italic">«{fb.note}»</div>}
              </div>
            );
          })}
        </div>
      ))}
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {sePuedeEditar && <button onClick={onEditar} className="bg-petroleo text-white font-bold px-4 py-2.5 rounded-xl">Editar sesión</button>}
        {bloques && <button onClick={onDuplicar} className="border-2 border-petroleo text-petroleo font-bold px-4 py-2 rounded-xl">Duplicar</button>}
        {sePuedeBorrar && <button onClick={borrar} className="ml-auto text-[#8A2C1D] font-bold px-2 py-2">Quitar del calendario</button>}
      </div>
      {bloques && !sePuedeEditar && <p className="text-xs text-texto-suave">Ya tiene registros del paciente, así que no se edita. Puedes duplicarla para crear otra con cambios.</p>}
    </Ventana>
  );
}
