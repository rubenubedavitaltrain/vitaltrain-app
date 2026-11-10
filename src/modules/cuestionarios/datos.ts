import type { SupabaseClient } from '@supabase/supabase-js';

// Módulo de cuestionarios: tipos, cargas y lo que toca responder.

export type Pregunta = {
  id: string; text: string; type: 'single' | 'scale' | 'text';
  options?: { label: string; value: number }[]; min?: number; max?: number; minLabel?: string; maxLabel?: string;
  scored?: boolean; required?: boolean;
};
export type Cuestionario = { id: string; slug: string; title: string; description: string | null; schema: { questions: Pregunta[] }; version: number; default_recurrence?: 'weekly' | null };
export type Asignacion = { id: string; questionnaire_id: string; recurrence: 'weekly' | null; is_active: boolean; coach_note: string | null; created_at: string; questionnaires: Cuestionario };
export type Respuesta = { id: string; assignment_id: string; questionnaire_id: string; period: string; answers: Record<string, number | string>; score: number | null; submitted_at: string };

export const CRONOTIPOS: Record<string, { nombre: string; texto: string }> = {
  definitely_morning: { nombre: 'Claramente matutino', texto: 'Tu reloj va adelantado: rindes mejor temprano y te cansas pronto por la noche.' },
  moderately_morning: { nombre: 'Moderadamente matutino', texto: 'Te va mejor la mañana, sin ser extremo.' },
  intermediate: { nombre: 'Intermedio', texto: 'Ni de mañana ni de noche: el tipo más frecuente.' },
  moderately_evening: { nombre: 'Moderadamente vespertino', texto: 'Te activas más tarde y te cuesta acostarte pronto.' },
  definitely_evening: { nombre: 'Claramente vespertino', texto: 'Tu reloj va retrasado: rindes mejor por la tarde y la noche.' },
};

/** Semana ISO de hoy en España, igual que la calcula la base de datos ('2026-W46'). */
export function semanaISO(d = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  const f = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
  const dia = (f.getUTCDay() + 6) % 7;
  f.setUTCDate(f.getUTCDate() - dia + 3);
  const año = f.getUTCFullYear();
  const primero = new Date(Date.UTC(año, 0, 4));
  const semana = 1 + Math.round(((f.valueOf() - primero.valueOf()) / 86400000 - 3 + ((primero.getUTCDay() + 6) % 7)) / 7);
  return `${año}-W${String(semana).padStart(2, '0')}`;
}

export async function cargarAsignaciones(supabase: SupabaseClient, paciente: string, soloActivas = true): Promise<Asignacion[]> {
  let q = supabase.from('questionnaire_assignments').select('id, questionnaire_id, recurrence, is_active, coach_note, created_at, questionnaires(id, slug, title, description, schema, version)').eq('patient_id', paciente);
  if (soloActivas) q = q.eq('is_active', true);
  const { data } = await q.order('created_at');
  return (data as unknown as Asignacion[]) ?? [];
}

export async function cargarRespuestas(supabase: SupabaseClient, paciente: string): Promise<Respuesta[]> {
  const { data } = await supabase.from('questionnaire_responses').select('id, assignment_id, questionnaire_id, period, answers, score, submitted_at').eq('patient_id', paciente).order('submitted_at', { ascending: false }).limit(200);
  return (data as Respuesta[]) ?? [];
}

/** Lo que el paciente tiene pendiente: únicos sin responder y semanales sin respuesta esta semana. */
export function pendientes(asig: Asignacion[], resp: Respuesta[]) {
  const semana = semanaISO();
  return asig.filter((a) => a.is_active && !resp.some((r) => r.assignment_id === a.id && r.period === (a.recurrence === 'weekly' ? semana : 'unico')));
}
