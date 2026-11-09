import type { SupabaseClient } from '@supabase/supabase-js';

// Historia clínica: tipos y cargas. Todo esto solo devuelve datos con doble factor (sesión aal2).

export type Modalidad = 'presencial' | 'online' | 'telefono';
export type Consulta = {
  id: string; patient_id: string; happened_at: string; modality: Modalidad; duration_minutes: number | null;
  reason: string | null; subjective: string | null; findings: string | null; plan: string | null; goals: string | null;
  next_review: string | null; status: 'draft' | 'closed'; closed_at: string | null; created_at: string;
};
export type Adenda = { id: string; consultation_id: string; text: string; created_at: string };
export type Ficha = {
  patient_id: string; main_reason: string | null; personal_history: string | null; family_history: string | null; medication: string | null;
  supplements: string | null; allergies: string | null; lifestyle: string | null; observations: string | null; updated_at: string;
};
export type Categoria = 'analitica' | 'cuestionario' | 'estudio_metabolico' | 'plan_alimentacion' | 'tratamiento' | 'test' | 'informe' | 'otro';
export type DocClinico = { id: string; category: Categoria; title: string; document_date: string | null; note: string | null; storage_path: string; size_bytes: number | null; mime: string; created_at: string };
export type Acceso = { id: number; at: string; action: string; entity: string; detail: string | null };

export const MODALIDADES: Record<Modalidad, string> = { presencial: 'Presencial', online: 'Online', telefono: 'Teléfono' };
// Las mismas carpetas que usa Rubén en OneDrive
export const CATEGORIAS: Record<Categoria, string> = {
  analitica: 'Análisis', cuestionario: 'Cuestionarios', estudio_metabolico: 'Estudio metabólico', plan_alimentacion: 'Plan de alimentación',
  tratamiento: 'Tratamientos', test: 'Test', informe: 'Informes', otro: 'Otros',
};
export const CAMPOS_FICHA: { clave: keyof Omit<Ficha, 'patient_id' | 'updated_at'>; titulo: string; ayuda: string; filas: number }[] = [
  { clave: 'main_reason', titulo: 'Motivo de consulta', ayuda: 'Por qué viene y desde cuándo', filas: 3 },
  { clave: 'personal_history', titulo: 'Antecedentes personales', ayuda: 'Enfermedades, cirugías, embarazos, diagnósticos previos', filas: 5 },
  { clave: 'family_history', titulo: 'Antecedentes familiares', ayuda: '', filas: 3 },
  { clave: 'medication', titulo: 'Medicación actual', ayuda: 'Fármaco, dosis y desde cuándo', filas: 3 },
  { clave: 'supplements', titulo: 'Suplementación actual', ayuda: '', filas: 3 },
  { clave: 'allergies', titulo: 'Alergias e intolerancias', ayuda: '', filas: 2 },
  { clave: 'lifestyle', titulo: 'Estilo de vida y contexto', ayuda: 'Trabajo, horarios, sueño, estrés, actividad, alimentación', filas: 4 },
  { clave: 'observations', titulo: 'Observaciones', ayuda: '', filas: 4 },
];
export const CAMPOS_CONSULTA: { clave: 'reason' | 'subjective' | 'findings' | 'plan' | 'goals'; titulo: string; ayuda: string; filas: number }[] = [
  { clave: 'reason', titulo: 'Motivo', ayuda: 'De esta consulta', filas: 2 },
  { clave: 'subjective', titulo: 'Cómo está y evolución', ayuda: 'Lo que cuenta desde la última vez', filas: 4 },
  { clave: 'findings', titulo: 'Valoración', ayuda: 'Lo que ves, pruebas revisadas, hipótesis', filas: 4 },
  { clave: 'plan', titulo: 'Pautas', ayuda: 'Lo que le indicas: alimentación, suplementos, hábitos, entrenamiento', filas: 5 },
  { clave: 'goals', titulo: 'Objetivos hasta la próxima', ayuda: '', filas: 2 },
];

export const BUCKET_HISTORIA = 'historia';

export async function registrar(supabase: SupabaseClient, paciente: string, accion: 'ver_historia' | 'ver_documento' | 'exportar', entidad: string, id?: string) {
  await supabase.rpc('registrar_acceso', { p_patient: paciente, p_action: accion, p_entity: entidad, p_id: id ?? null });
}

export const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fechaLarga = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
