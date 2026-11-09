export const MODALIDADES = { presencial: 'Presencial', online: 'Online', telefono: 'Teléfono' };
// Las mismas carpetas que usa Rubén en OneDrive
export const CATEGORIAS = {
    analitica: 'Análisis', cuestionario: 'Cuestionarios', estudio_metabolico: 'Estudio metabólico', plan_alimentacion: 'Plan de alimentación',
    tratamiento: 'Tratamientos', test: 'Test', informe: 'Informes', otro: 'Otros',
};
export const CAMPOS_FICHA = [
    { clave: 'main_reason', titulo: 'Motivo de consulta', ayuda: 'Por qué viene y desde cuándo', filas: 3 },
    { clave: 'personal_history', titulo: 'Antecedentes personales', ayuda: 'Enfermedades, cirugías, embarazos, diagnósticos previos', filas: 5 },
    { clave: 'family_history', titulo: 'Antecedentes familiares', ayuda: '', filas: 3 },
    { clave: 'medication', titulo: 'Medicación actual', ayuda: 'Fármaco, dosis y desde cuándo', filas: 3 },
    { clave: 'supplements', titulo: 'Suplementación actual', ayuda: '', filas: 3 },
    { clave: 'allergies', titulo: 'Alergias e intolerancias', ayuda: '', filas: 2 },
    { clave: 'lifestyle', titulo: 'Estilo de vida y contexto', ayuda: 'Trabajo, horarios, sueño, estrés, actividad, alimentación', filas: 4 },
    { clave: 'observations', titulo: 'Observaciones', ayuda: '', filas: 4 },
];
export const CAMPOS_CONSULTA = [
    { clave: 'reason', titulo: 'Motivo', ayuda: 'De esta consulta', filas: 2 },
    { clave: 'subjective', titulo: 'Cómo está y evolución', ayuda: 'Lo que cuenta desde la última vez', filas: 4 },
    { clave: 'findings', titulo: 'Valoración', ayuda: 'Lo que ves, pruebas revisadas, hipótesis', filas: 4 },
    { clave: 'plan', titulo: 'Pautas', ayuda: 'Lo que le indicas: alimentación, suplementos, hábitos, entrenamiento', filas: 5 },
    { clave: 'goals', titulo: 'Objetivos hasta la próxima', ayuda: '', filas: 2 },
];
export const BUCKET_HISTORIA = 'historia';
export async function registrar(supabase, paciente, accion, entidad, id) {
    await supabase.rpc('registrar_acceso', { p_patient: paciente, p_action: accion, p_entity: entidad, p_id: id ?? null });
}
export const fechaHora = (iso) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fechaLarga = (iso) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
