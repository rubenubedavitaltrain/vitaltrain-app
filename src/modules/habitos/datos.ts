import type { SupabaseClient } from '@supabase/supabase-js';
import { hoyIso, iso, sumarDias } from '../../lib/fechas';

// Módulo de hábitos: catálogo, hábitos asignados a cada paciente y lo que marca cada día.

export type Tipo = 'check' | 'number' | 'time' | 'duration' | 'scale';
export type Definicion = {
  id: string; name: string; short_instruction: string | null; rationale: string | null; kind: Tipo; unit: string | null;
  default_target: number | null; anchor: string | null; anchor_offset_minutes: number | null; is_archived: boolean;
  pillars: { slug: string; name: string; position: number } | null;
};
export type Asignado = {
  id: string; habit_id: string; target: number | null; days_of_week: number[]; coach_note: string | null;
  start_date: string; end_date: string | null; is_active: boolean; position: number; habit_definitions: Definicion;
  remind: boolean; remind_at: string | null;
};
export type Registro = { id: string; patient_habit_id: string; log_date: string; done: boolean | null; value_numeric: number | null; value_time: string | null };

const CAMPOS_DEF = 'id, name, short_instruction, rationale, kind, unit, default_target, anchor, anchor_offset_minutes, is_archived, pillars(slug, name, position)';

export async function cargarCatalogo(supabase: SupabaseClient): Promise<Definicion[]> {
  const { data } = await supabase.from('habit_definitions').select(CAMPOS_DEF).eq('is_archived', false).order('name');
  return ((data as unknown as Definicion[]) ?? []).map(numeros).sort(porPilar);
}

export async function cargarAsignados(supabase: SupabaseClient, paciente: string, soloActivos = true): Promise<Asignado[]> {
  let q = supabase.from('patient_habits').select(`id, habit_id, target, days_of_week, coach_note, start_date, end_date, is_active, position, remind, remind_at, habit_definitions(${CAMPOS_DEF})`).eq('patient_id', paciente);
  if (soloActivos) q = q.eq('is_active', true);
  const { data } = await q.order('position').order('created_at');
  return ((data as unknown as Asignado[]) ?? []).map((a) => ({ ...a, target: a.target == null ? null : Number(a.target), habit_definitions: numeros(a.habit_definitions) }))
    .sort((a, b) => porPilar(a.habit_definitions, b.habit_definitions));
}

export async function cargarRegistros(supabase: SupabaseClient, paciente: string, dias = 14): Promise<Registro[]> {
  const { data } = await supabase.from('habit_logs').select('id, patient_habit_id, log_date, done, value_numeric, value_time')
    .eq('patient_id', paciente).gte('log_date', iso(sumarDias(new Date(), -dias + 1))).order('log_date');
  return ((data as Registro[]) ?? []).map((r) => ({ ...r, value_numeric: r.value_numeric == null ? null : Number(r.value_numeric) }));
}

function numeros(d: Definicion): Definicion { return { ...d, default_target: d.default_target == null ? null : Number(d.default_target) }; }
function porPilar(a: Definicion, b: Definicion) { return (a.pillars?.position ?? 9) - (b.pillars?.position ?? 9); }

export const objetivo = (a: Asignado) => a.target ?? a.habit_definitions.default_target;
export const diaSemana = (f: string) => { const [y, m, d] = f.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7 + 1; };
export const tocaEseDia = (a: Asignado, f: string) => a.days_of_week.includes(diaSemana(f)) && a.start_date <= f && (!a.end_date || a.end_date >= f);
export const tocaHoy = (a: Asignado) => tocaEseDia(a, hoyIso());

/** Si un registro cuenta como hecho: marcado, o con valor que llega al objetivo (o con cualquier valor si no hay objetivo). */
export function cumplido(a: Asignado, r: Registro | undefined): boolean {
  if (!r) return false;
  const k = a.habit_definitions.kind;
  if (k === 'check') return r.done === true;
  if (k === 'scale' || k === 'time') return r.value_numeric != null || r.value_time != null;
  const obj = objetivo(a);
  return r.value_numeric != null && (obj == null ? r.value_numeric > 0 : r.value_numeric >= obj);
}

export const ANCLAS: Record<string, [string, string]> = {
  wake: ['de despertar', 'de despertar'], sunrise: ['del amanecer', 'del amanecer'], sunset: ['del atardecer', 'del atardecer'],
  bedtime: ['de acostarte', 'de acostarte'], first_meal: ['de la primera comida', 'de la primera comida'], last_meal: ['de la última comida', 'de la última comida'],
};

/** "30 min después de despertar", "3 h antes de acostarte"… */
export function textoAncla(anchor: string | null, off: number | null): string | null {
  if (!anchor || !ANCLAS[anchor]) return null;
  const m = Math.abs(off ?? 0);
  const cuanto = m === 0 ? '' : m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
  if (!cuanto) return `Al momento ${ANCLAS[anchor][0]}`;
  return `${cuanto} ${(off ?? 0) < 0 ? 'antes' : 'después'} ${ANCLAS[anchor][0]}`;
}

export const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const TIPOS: Record<Tipo, string> = { check: 'Sí / no', number: 'Número', duration: 'Minutos', scale: 'Escala 1 a 5', time: 'Hora' };
export const num = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });

/** El paciente activa o quita el aviso de un hábito con momento del día. hora = "HH:MM". */
export async function ponerRecordatorio(supabase: SupabaseClient, id: string, activar: boolean, hora?: string) {
  return supabase.rpc('poner_recordatorio_habito', { p_id: id, p_activar: activar, p_hora: activar ? hora : null });
}
