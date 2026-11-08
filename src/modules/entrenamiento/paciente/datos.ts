import type { SupabaseClient } from '@supabase/supabase-js';

// Datos del entrenamiento del paciente, con copia local para poder entrenar sin conexión.
// Lo que el paciente registra sin conexión se guarda en una cola y se envía al volver la red.

export type Estado = 'scheduled' | 'in_progress' | 'completed' | 'skipped';
export type SetLog = { set_number: number; reps: number | null; load_kg: number | null; done: boolean };
export type Feedback = { note: string | null; cannot_do: boolean; reason: 'pain' | 'no_equipment' | 'dont_know' | 'other' | null };
export type ItemSesion = {
  id: string; position: number; sets: number; target: string | null; load_kg: number | null; rest_seconds: number | null; instructions: string | null;
  exercises: { name: string; video_id: string | null; description: string | null };
  set_logs: SetLog[]; workout_item_feedback: Feedback[];
};
export type BloqueSesion = { id: string; position: number; name: string | null; type: 'normal' | 'superset' | 'circuit'; rounds: number; workout_items: ItemSesion[] };
export type Sesion = {
  id: string; scheduled_date: string; name: string; coach_message: string | null; status: Estado;
  rpe: number | null; feeling: string | null; patient_notes: string | null; started_at: string | null; completed_at: string | null;
  workout_blocks: BloqueSesion[];
};
export type SesionCorta = { id: string; scheduled_date: string; name: string; status: Estado; coach_message: string | null; ejercicios: number };

const CLAVE_SESION = (id: string) => `vt.sesion.${id}`;
const CLAVE_COLA = 'vt.cola';
const CLAVE_SEMANA = 'vt.semana';

function leer<T>(k: string): T | null {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function escribir(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
}

const SELECT_SESION =
  'id, scheduled_date, name, coach_message, status, rpe, feeling, patient_notes, started_at, completed_at, ' +
  'workout_blocks(id, position, name, type, rounds, workout_items(id, position, sets, target, load_kg, rest_seconds, instructions, ' +
  'exercises(name, video_id, description), set_logs(set_number, reps, load_kg, done), workout_item_feedback(note, cannot_do, reason)))';

function ordenar(s: Sesion): Sesion {
  s.workout_blocks.sort((a, b) => a.position - b.position);
  s.workout_blocks.forEach((b) => b.workout_items.sort((a, c) => a.position - c.position));
  return s;
}

/** Sesiones de un rango de fechas (resumen). Guarda copia para verlas sin conexión. */
export async function cargarSemana(supabase: SupabaseClient, desde: string, hasta: string): Promise<SesionCorta[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, scheduled_date, name, status, coach_message, workout_blocks(workout_items(count))')
    .gte('scheduled_date', desde)
    .lte('scheduled_date', hasta)
    .order('scheduled_date');
  if (error) {
    const copia = leer<Record<string, SesionCorta[]>>(CLAVE_SEMANA)?.[`${desde}_${hasta}`];
    if (copia) return copia;
    throw error;
  }
  const lista = ((data ?? []) as unknown as (Omit<SesionCorta, 'ejercicios'> & { workout_blocks: { workout_items: { count: number }[] }[] })[]).map((w) => ({
    id: w.id, scheduled_date: w.scheduled_date, name: w.name, status: w.status, coach_message: w.coach_message,
    ejercicios: w.workout_blocks.reduce((s, b) => s + (b.workout_items[0]?.count ?? 0), 0)
  }));
  const todas = leer<Record<string, SesionCorta[]>>(CLAVE_SEMANA) ?? {};
  todas[`${desde}_${hasta}`] = lista;
  escribir(CLAVE_SEMANA, todas);
  return lista;
}

/** Sesión completa. Si no hay red, usa la copia local (incluidos los cambios hechos sin conexión). */
export async function cargarSesion(supabase: SupabaseClient, id: string): Promise<Sesion> {
  const { data, error } = await supabase.from('workouts').select(SELECT_SESION).eq('id', id).single();
  if (error || !data) {
    const copia = leer<Sesion>(CLAVE_SESION(id));
    if (copia) return copia;
    throw error ?? new Error('Sin datos');
  }
  const s = ordenar(data as unknown as Sesion);
  // Si hay cambios sin enviar, se respetan los locales
  if (pendientes() > 0) {
    const local = leer<Sesion>(CLAVE_SESION(id));
    if (local) return local;
  }
  escribir(CLAVE_SESION(id), s);
  return s;
}

export function guardarCopia(s: Sesion) {
  escribir(CLAVE_SESION(s.id), s);
}

// ---------- Cola de cambios ----------
type Op =
  | { t: 'set'; fila: { workout_item_id: string; patient_id: string; set_number: number; reps: number | null; load_kg: number | null; done: boolean } }
  | { t: 'borrarSet'; workout_item_id: string; set_number: number }
  | { t: 'feedback'; fila: { workout_item_id: string; patient_id: string; note: string | null; cannot_do: boolean; reason: string | null } }
  | { t: 'sesion'; id: string; cambios: Partial<Pick<Sesion, 'status' | 'rpe' | 'feeling' | 'patient_notes' | 'started_at' | 'completed_at'>> };

export function pendientes(): number {
  return leer<Op[]>(CLAVE_COLA)?.length ?? 0;
}

async function ejecutar(supabase: SupabaseClient, op: Op) {
  if (op.t === 'set') return supabase.from('set_logs').upsert(op.fila, { onConflict: 'workout_item_id,set_number' });
  if (op.t === 'borrarSet') return supabase.from('set_logs').delete().eq('workout_item_id', op.workout_item_id).eq('set_number', op.set_number);
  if (op.t === 'feedback') return supabase.from('workout_item_feedback').upsert(op.fila, { onConflict: 'workout_item_id' });
  return supabase.from('workouts').update(op.cambios).eq('id', op.id);
}

const esDeRed = (e: { message?: string } | null) => !!e && /fetch|network|Failed|Load failed|offline/i.test(e.message ?? '');

/** Envía un cambio. Si no hay red, lo deja en cola y devuelve 'pendiente'. */
export async function enviar(supabase: SupabaseClient, op: Op): Promise<'ok' | 'pendiente' | 'error'> {
  if (pendientes() > 0 || !navigator.onLine) {
    escribir(CLAVE_COLA, [...(leer<Op[]>(CLAVE_COLA) ?? []), op]);
    vaciarCola(supabase);
    return 'pendiente';
  }
  try {
    const { error } = await ejecutar(supabase, op);
    if (!error) return 'ok';
    if (esDeRed(error)) {
      escribir(CLAVE_COLA, [...(leer<Op[]>(CLAVE_COLA) ?? []), op]);
      return 'pendiente';
    }
    return 'error';
  } catch {
    escribir(CLAVE_COLA, [...(leer<Op[]>(CLAVE_COLA) ?? []), op]);
    return 'pendiente';
  }
}

let vaciando = false;
/** Envía lo pendiente en orden. Se para en el primer fallo de red y lo reintenta más tarde. */
export async function vaciarCola(supabase: SupabaseClient): Promise<number> {
  if (vaciando || !navigator.onLine) return pendientes();
  vaciando = true;
  try {
    let cola = leer<Op[]>(CLAVE_COLA) ?? [];
    while (cola.length) {
      try {
        const { error } = await ejecutar(supabase, cola[0]);
        if (error && esDeRed(error)) break;
        // Un error que no es de red (p. ej. permiso) no se puede arreglar reintentando: se descarta
      } catch {
        break;
      }
      cola = cola.slice(1);
      escribir(CLAVE_COLA, cola);
    }
    return cola.length;
  } finally {
    vaciando = false;
  }
}

/** Número que el paciente ve precargado: el primero que aparezca en "8-10 reps" → 8. */
export function repsDe(target: string | null): number | null {
  const m = target?.match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function esTiempo(target: string | null): boolean {
  return !!target && /\d+\s*(s|seg|min|")/i.test(target);
}
