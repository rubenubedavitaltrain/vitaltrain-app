import type { SupabaseClient } from '@supabase/supabase-js';

// Exportación de los datos de un paciente en un archivo JSON (RGPD: derecho de acceso y portabilidad).
// - El paciente descarga lo suyo desde Perfil → Privacidad.
// - El coach descarga todo, incluida la historia clínica (con doble factor), desde la historia del paciente.
// Cada tabla se lee con los permisos de quien exporta: nadie obtiene más de lo que ya puede ver.

type Tabla = { nombre: string; titulo: string; select: string; columna?: string; clinica?: boolean };

const TABLAS: Tabla[] = [
  { nombre: 'profiles', titulo: 'Perfil', select: 'full_name, email, phone, status, created_at', columna: 'id' },
  { nombre: 'consents', titulo: 'Consentimientos', select: 'version, accepted_at, withdrawn_at, replaced_at' },
  { nombre: 'patient_settings', titulo: 'Ajustes', select: '*' },
  { nombre: 'patient_modules', titulo: 'Módulos activos', select: 'module_slug, enabled_at' },
  { nombre: 'workouts', titulo: 'Entrenamientos', select: 'scheduled_date, name, coach_message, status, started_at, completed_at, rpe, feeling, patient_notes, workout_blocks(name, type, rounds, workout_items(sets, target, load_kg, rest_seconds, instructions, exercises(name), set_logs(set_number, reps, load_kg, duration_seconds, rir, done, logged_at), workout_item_feedback(note, cannot_do, reason, created_at)))' },
  { nombre: 'body_measurements', titulo: 'Medidas', select: 'measured_on, weight_kg, waist_cm, hip_cm' },
  { nombre: 'sleep_logs', titulo: 'Sueño', select: 'night_of, bedtime, wake_time, sleep_latency_minutes, awakenings, quality, rested, is_free_day, note' },
  { nombre: 'meal_events', titulo: 'Comidas', select: 'eaten_at, kind, note' },
  { nombre: 'patient_habits', titulo: 'Hábitos pautados', select: 'target, days_of_week, coach_note, start_date, end_date, is_active, habit_definitions(name)' },
  { nombre: 'habit_logs', titulo: 'Registro de hábitos', select: 'log_date, done, value_numeric, value_time, note, patient_habits(habit_definitions(name))' },
  { nombre: 'questionnaire_responses', titulo: 'Cuestionarios respondidos', select: 'period, answers, score, submitted_at, questionnaires(title)' },
  { nombre: 'breathing_sessions', titulo: 'Sesiones de respiración', select: 'pattern, started_at, seconds, calm_before, calm_after' },
  { nombre: 'messages', titulo: 'Mensajes', select: 'sender_id, body, created_at, read_at' },
  { nombre: 'patient_documents', titulo: 'Documentos compartidos', select: 'title, note, is_shared, created_at, pillars(name)' },
  { nombre: 'monthly_reviews', titulo: 'Resúmenes mensuales', select: 'month, conclusions, next_goals, snapshot, shared_at' },
  { nombre: 'clinical_records', titulo: 'Ficha clínica', select: '*', clinica: true },
  { nombre: 'clinical_record_versions', titulo: 'Versiones anteriores de la ficha', select: 'old_row, changed_at', clinica: true },
  { nombre: 'consultations', titulo: 'Consultas', select: 'happened_at, modality, duration_minutes, reason, subjective, findings, plan, goals, next_review, status, closed_at', clinica: true },
  { nombre: 'consultation_addenda', titulo: 'Adendas', select: 'consultation_id, text, created_at', clinica: true },
  { nombre: 'clinical_documents', titulo: 'Documentos clínicos (solo la lista; los archivos se entregan aparte)', select: 'category, title, document_date, note, mime, created_at', clinica: true },
  { nombre: 'access_log', titulo: 'Registro de accesos', select: 'at, action, entity, detail', clinica: true },
];

export async function exportarDatos(supabase: SupabaseClient, pacienteId: string, conClinica: boolean) {
  const datos: Record<string, unknown> = {
    responsable: 'Rubén Úbeda Rubio · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433 · info@vitaltrain.com',
    exportado: new Date().toISOString(),
  };
  const errores: string[] = [];
  for (const t of TABLAS.filter((x) => conClinica || !x.clinica)) {
    const { data, error } = await supabase.from(t.nombre).select(t.select).eq(t.columna ?? 'patient_id', pacienteId);
    if (error) errores.push(t.titulo); else datos[t.titulo] = data;
  }
  if (errores.length) datos['No se han podido exportar'] = errores;
  if (conClinica) await supabase.rpc('registrar_acceso', { p_patient: pacienteId, p_action: 'exportar', p_entity: 'historia', p_id: null });
  const nombre = `vitaltrain-datos-${new Date().toISOString().slice(0, 10)}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return errores;
}
