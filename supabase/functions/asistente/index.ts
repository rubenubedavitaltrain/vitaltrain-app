// Función de servidor «asistente»: conecta Claude con la app como asistente del coach (servidor MCP).
//
// - Entra con la cuenta del coach (OAuth de Supabase). Ve lo mismo que el coach y con sus mismas reglas (RLS).
//   La historia clínica solo con doble factor, y cada lectura queda en el registro de accesos.
// - Lee y prepara PROPUESTAS. Nada llega al paciente hasta que el coach aprueba la propuesta (aplicar_propuesta).
// - No guarda nada por su cuenta ni usa la clave de servicio.
// Se despliega con «Verify JWT» desactivado: la propia función comprueba la sesión y responde 401 con la
// dirección de los metadatos OAuth, como pide Claude para iniciar la conexión.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const RESOURCE = `${SUPABASE_URL}/functions/v1/asistente`;
const METADATA_URL = `${RESOURCE}/.well-known/oauth-protected-resource`;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://vitaltrain-prueba.pages.dev';
const TZ = 'Europe/Madrid';
const VERSIONES = ['2025-11-25', '2025-06-18', '2025-03-26'];

const INSTRUCCIONES = `Eres el asistente de Rubén Úbeda Rubio (T.S.D. Sanitario, Clínica Vitaltrain) en su app de pacientes.
Rubén prescribe y decide; tú preparas. Reglas:
1. Antes de proponer, lee la ficha del paciente (ficha_paciente) y, si hace falta y Rubén lo pide, la historia clínica (pide antes a Rubén el código de su app de autenticación). Ten en cuenta dolor, «no puedo hacerlo», esfuerzo, sueño, check-ins, objetivos y lo que diga Rubén.
2. Usa solo ejercicios de la biblioteca (buscar_ejercicios) con su id. No inventes ejercicios.
3. Todo cambio va como propuesta (proponer_*). Enséñale a Rubén la propuesta completa en la conversación y explica el porqué de las decisiones.
4. Solo llama a aplicar_propuesta cuando Rubén la haya aprobado de forma expresa en esta conversación. Si duda o corrige, haz una propuesta nueva y descarta la anterior.
5. No hagas diagnósticos ni recomendaciones de tratamiento para el paciente. Los mensajes al paciente van en nombre de Rubén: claros, cercanos, frases cortas, sin emojis ni avisos alarmistas.
6. Escribe en español. Fechas en formato AAAA-MM-DD; las semanas empiezan en lunes.`;

// ---------- utilidades ----------
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const sumarDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hora = (ts?: string | null) => ts ? new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts)) : null;
const fechaHora = (ts?: string | null) => ts ? new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts)) : null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MOTIVOS: Record<string, string> = { pain: 'dolor o molestia', no_equipment: 'sin material', dont_know: 'no sabe hacerlo', other: 'otro' };

class Fallo extends Error {}
const exigir = (ok: unknown, texto: string) => { if (!ok) throw new Fallo(texto); };
const id = (v: unknown, que: string) => { exigir(typeof v === 'string' && UUID.test(v), `Falta ${que} (id)`); return v as string; };
async function q<T = any>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Fallo(error.message);
  return data as T;
}

// ---------- herramientas ----------
type Herramienta = { name: string; description: string; inputSchema: Record<string, unknown>; annotations?: Record<string, unknown>; run: (db: SupabaseClient, a: any, yo: string, token: string) => Promise<unknown> };
const pacienteId = { type: 'string', description: 'id del paciente (de listar_pacientes)' };
const lectura = { readOnlyHint: true, openWorldHint: false };
const propuesta = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

async function consentimientoVigente(db: SupabaseClient, p: string) {
  const c = await q(db.from('consents').select('version, accepted_at').eq('patient_id', p).is('withdrawn_at', null).is('replaced_at', null).maybeSingle());
  return c as { version: string; accepted_at: string } | null;
}

// Doble factor para la historia clínica: la conexión con Claude no conserva el segundo factor,
// así que cada consulta de la historia pide el código de la app de autenticación de Rubén.
// El código sube la sesión a aal2 y ese token se usa solo para esta consulta.
async function sesionDobleFactor(token: string, codigo: string) {
  const h = { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: h }).then((r) => r.json()).catch(() => null);
  const factor = (u?.factors ?? []).find((f: any) => f.factor_type === 'totp' && f.status === 'verified');
  exigir(factor, 'La cuenta del coach no tiene configurada la app de autenticación.');
  const reto = await fetch(`${SUPABASE_URL}/auth/v1/factors/${factor.id}/challenge`, { method: 'POST', headers: h, body: '{}' }).then((r) => r.json()).catch(() => null);
  exigir(reto?.id, 'No se ha podido pedir el doble factor. Inténtalo de nuevo.');
  const v = await fetch(`${SUPABASE_URL}/auth/v1/factors/${factor.id}/verify`, { method: 'POST', headers: h, body: JSON.stringify({ challenge_id: reto.id, code: codigo }) });
  const ses = await v.json().catch(() => null);
  exigir(v.ok && ses?.access_token, 'El código no es correcto o ha caducado. Pide a Rubén el que muestra ahora su app de autenticación.');
  const db = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${ses.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  // No se cierra la sesión: es la misma conexión de Claude, ahora con el segundo factor. El token caduca solo.
  const cerrar = async () => {};
  return { db, cerrar };
}

async function comprobarPaciente(db: SupabaseClient, p: string) {
  const perfil = await q(db.from('profiles').select('id, full_name, role').eq('id', p).maybeSingle());
  exigir(perfil && (perfil as any).role === 'patient', 'Paciente no encontrado');
  return perfil as { id: string; full_name: string };
}

async function comprobarEjercicios(db: SupabaseClient, ids: string[]) {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return new Map<string, string>();
  const filas = await q<any[]>(db.from('exercises').select('id, name').in('id', unicos).eq('is_archived', false));
  const mapa = new Map(filas.map((e) => [e.id, e.name]));
  const faltan = unicos.filter((x) => !mapa.has(x));
  exigir(!faltan.length, `Estos ejercicios no están en la biblioteca o están archivados: ${faltan.join(', ')}. Búscalos con buscar_ejercicios.`);
  return mapa;
}

function resumenSesion(w: any, detalle: boolean) {
  const bloques = [...(w.workout_blocks ?? [])].sort((a, b) => a.position - b.position).map((b: any) => ({
    bloque: b.name ?? undefined, tipo: b.type !== 'normal' ? b.type : undefined, vueltas: b.rounds > 1 ? b.rounds : undefined,
    ejercicios: [...(b.workout_items ?? [])].sort((x: any, y: any) => x.position - y.position).map((i: any) => {
      const pauta = `${i.sets}x${i.target ?? '?'}${i.load_kg != null ? ` @${i.load_kg}kg` : ''}${i.rest_seconds ? ` desc ${i.rest_seconds}s` : ''}`;
      const series = (i.set_logs ?? []).filter((s: any) => s.done !== false).sort((a: any, b: any) => a.set_number - b.set_number);
      const fb = (i.workout_item_feedback ?? [])[0];
      return {
        ejercicio: i.exercises?.name, ejercicio_id: i.exercise_id, pauta, indicaciones: i.instructions ?? undefined,
        hecho: detalle && series.length ? series.map((s: any) => `${s.reps ?? (s.duration_seconds ? s.duration_seconds + 's' : '?')}${s.load_kg != null ? '@' + s.load_kg : ''}${s.rir != null ? ' RIR' + s.rir : ''}`).join(', ') : undefined,
        no_puede: fb?.cannot_do ? MOTIVOS[fb.reason] ?? fb.reason : undefined,
        nota_paciente: fb?.note ?? undefined
      };
    })
  }));
  return {
    id: w.id, fecha: w.scheduled_date, nombre: w.name, estado: w.status, mensaje_coach: w.coach_message ?? undefined,
    esfuerzo: w.rpe ?? undefined, sensaciones: w.feeling ?? undefined, notas_paciente: w.patient_notes ?? undefined,
    semana_programa: w.program_week ?? undefined, bloques
  };
}

const SELECT_SESION = 'id, scheduled_date, name, status, rpe, feeling, patient_notes, coach_message, program_week, workout_blocks(position, name, type, rounds, workout_items(position, exercise_id, sets, target, load_kg, rest_seconds, instructions, exercises(name), set_logs(set_number, reps, load_kg, duration_seconds, rir, done), workout_item_feedback(note, cannot_do, reason)))';

const HERRAMIENTAS: Herramienta[] = [
  {
    name: 'listar_pacientes',
    description: 'Lista los pacientes con su estado, módulos activos, consentimiento, última sesión hecha, sesiones pendientes y avisos (notas o «no puedo» sin leer, mensajes sin leer). Úsala para encontrar el id de un paciente.',
    inputSchema: { type: 'object', properties: { incluir_archivados: { type: 'boolean', description: 'También los dados de baja' } } },
    annotations: lectura,
    run: async (db, a) => {
      let consulta = db.from('profiles').select('id, full_name, email, status, created_at').eq('role', 'patient').order('full_name');
      if (!a.incluir_archivados) consulta = consulta.neq('status', 'archived');
      const pacientes = await q<any[]>(consulta);
      const ids = pacientes.map((p) => p.id);
      if (!ids.length) return { pacientes: [] };
      const [mods, cons, hechas, pend, fb, msgs] = await Promise.all([
        q<any[]>(db.from('patient_modules').select('patient_id, module_slug').in('patient_id', ids)),
        q<any[]>(db.from('consents').select('patient_id').in('patient_id', ids).is('withdrawn_at', null).is('replaced_at', null)),
        q<any[]>(db.from('workouts').select('patient_id, scheduled_date').in('patient_id', ids).eq('status', 'completed').order('scheduled_date', { ascending: false })),
        q<any[]>(db.from('workouts').select('patient_id, scheduled_date').in('patient_id', ids).eq('status', 'scheduled').gte('scheduled_date', hoy())),
        q<any[]>(db.from('workout_item_feedback').select('patient_id').in('patient_id', ids).is('read_by_coach_at', null)),
        q<any[]>(db.from('messages').select('patient_id, sender_id').in('patient_id', ids).is('read_at', null))
      ]);
      return {
        hoy: hoy(),
        pacientes: pacientes.map((p) => ({
          id: p.id, nombre: p.full_name, email: p.email, estado: p.status, alta: p.created_at?.slice(0, 10),
          modulos: mods.filter((m) => m.patient_id === p.id).map((m) => m.module_slug),
          consentimiento: cons.some((c) => c.patient_id === p.id) ? 'vigente' : 'sin aceptar o retirado',
          ultima_sesion_hecha: hechas.find((w) => w.patient_id === p.id)?.scheduled_date ?? null,
          sesiones_pendientes: pend.filter((w) => w.patient_id === p.id).length,
          ultima_sesion_pendiente: pend.filter((w) => w.patient_id === p.id).map((w) => w.scheduled_date).sort().pop() ?? null,
          notas_sin_leer: fb.filter((f) => f.patient_id === p.id).length,
          mensajes_sin_leer: msgs.filter((m) => m.patient_id === p.id && m.sender_id === p.id).length
        }))
      };
    }
  },
  {
    name: 'ficha_paciente',
    description: 'Todo lo que la app sabe de un paciente: perfil, módulos, notas privadas de Rubén, programa, sesiones de las últimas semanas con lo que hizo (series, cargas, esfuerzo, sensaciones, «no puedo» y notas), próximas sesiones, check-ins y cuestionarios, medidas, sueño, comidas, hábitos, respiración, mensajes y resúmenes mensuales. No incluye la historia clínica (ver historia_clinica).',
    inputSchema: { type: 'object', properties: { paciente_id: pacienteId, semanas: { type: 'integer', minimum: 1, maximum: 26, description: 'Semanas hacia atrás (por defecto 6)' } }, required: ['paciente_id'] },
    annotations: lectura,
    run: async (db, a) => {
      const p = id(a.paciente_id, 'el paciente');
      const semanas = Math.min(Math.max(Number(a.semanas) || 6, 1), 26);
      const desde = sumarDias(hoy(), -7 * semanas);
      const perfil = await q<any>(db.from('profiles').select('id, full_name, email, phone, status, created_at').eq('id', p).eq('role', 'patient').maybeSingle());
      exigir(perfil, 'Paciente no encontrado');
      const [mods, notas, consent] = await Promise.all([
        q<any[]>(db.from('patient_modules').select('module_slug').eq('patient_id', p)),
        q<any[]>(db.from('coach_notes').select('body, created_at').eq('patient_id', p).order('created_at', { ascending: false }).limit(20)),
        consentimientoVigente(db, p)
      ]);
      const base = {
        hoy: hoy(), paciente: { id: perfil.id, nombre: perfil.full_name, email: perfil.email, telefono: perfil.phone, estado: perfil.status, alta: perfil.created_at?.slice(0, 10) },
        modulos: mods.map((m) => m.module_slug),
        notas_privadas_de_ruben: notas.map((n) => ({ fecha: n.created_at.slice(0, 10), nota: n.body }))
      };
      if (!consent) return { ...base, aviso: 'El paciente no tiene el consentimiento en vigor (sin aceptar o retirado). Los datos de la app no se muestran.' };

      const [ajustes, programa, pasadas, proximas, respuestas, checkins, medidas, sueno, comidas, habitos, resp, mensajes, resumenes] = await Promise.all([
        q<any>(db.from('patient_settings').select('city, chronotype, chronotype_score, workdays, reminder_enabled, reminder_time').eq('patient_id', p).maybeSingle()),
        q<any[]>(db.from('program_assignments').select('start_date, status, programs(name, weeks)').eq('patient_id', p).eq('status', 'active')),
        q<any[]>(db.from('workouts').select(SELECT_SESION).eq('patient_id', p).gte('scheduled_date', desde).lte('scheduled_date', hoy()).order('scheduled_date')),
        q<any[]>(db.from('workouts').select(SELECT_SESION).eq('patient_id', p).gt('scheduled_date', hoy()).order('scheduled_date').limit(30)),
        q<any[]>(db.from('questionnaire_responses').select('period, score, answers, submitted_at, questionnaires(title, slug, schema)').eq('patient_id', p).order('submitted_at', { ascending: false }).limit(12)),
        q<any[]>(db.from('checkins').select('week_start, sleep, energy, digestion, stress, pain, notes').eq('patient_id', p).order('week_start', { ascending: false }).limit(8)),
        q<any[]>(db.from('body_measurements').select('measured_on, weight_kg, waist_cm, hip_cm').eq('patient_id', p).order('measured_on', { ascending: false }).limit(10)),
        q<any[]>(db.from('sleep_logs').select('night_of, bedtime, wake_time, sleep_latency_minutes, awakenings, quality, rested, is_free_day, note').eq('patient_id', p).gte('night_of', sumarDias(hoy(), -21)).order('night_of')),
        q<any[]>(db.from('meal_events').select('eaten_at, kind').eq('patient_id', p).gte('eaten_at', sumarDias(hoy(), -7) + 'T00:00:00Z').order('eaten_at')),
        q<any[]>(db.from('patient_habits').select('id, target, days_of_week, coach_note, start_date, remind_at, habit_definitions(name, kind, unit, anchor), habit_logs(log_date, done, value_numeric, value_time)').eq('patient_id', p).eq('is_active', true)),
        q<any[]>(db.from('breathing_sessions').select('pattern, started_at, seconds, calm_before, calm_after').eq('patient_id', p).gte('started_at', sumarDias(hoy(), -28) + 'T00:00:00Z').order('started_at')),
        q<any[]>(db.from('messages').select('sender_id, body, created_at').eq('patient_id', p).order('created_at', { ascending: false }).limit(15)),
        q<any[]>(db.from('monthly_reviews').select('month, conclusions, next_goals, shared_at').eq('patient_id', p).order('month', { ascending: false }).limit(2))
      ]);
      const desde14 = sumarDias(hoy(), -14);
      const comidasPorDia: Record<string, string[]> = {};
      for (const m of comidas) { const d = fechaHora(m.eaten_at)!.slice(0, 10); (comidasPorDia[d] ??= []).push(`${hora(m.eaten_at)} ${m.kind}`); }
      return {
        ...base,
        consentimiento: { version: consent.version, aceptado: consent.accepted_at.slice(0, 10) },
        ajustes: ajustes ? { ciudad: ajustes.city, cronotipo: ajustes.chronotype, puntuacion_rmeq: ajustes.chronotype_score, dias_laborables: ajustes.workdays, recordatorio_entreno: ajustes.reminder_enabled ? ajustes.reminder_time : 'no' } : null,
        programa_activo: programa.map((x) => ({ programa: x.programs?.name, semanas: x.programs?.weeks, desde: x.start_date })),
        sesiones_pasadas: pasadas.map((w) => resumenSesion(w, true)),
        proximas_sesiones: proximas.map((w) => resumenSesion(w, false)),
        cuestionarios: respuestas.map((r) => ({
          cuestionario: r.questionnaires?.title, periodo: r.period, puntuacion: r.score ?? undefined, fecha: r.submitted_at?.slice(0, 10),
          respuestas: Object.fromEntries(Object.entries(r.answers ?? {}).map(([k, v]) => {
            const preg = (r.questionnaires?.schema?.questions ?? []).find((x: any) => x.id === k);
            const etiqueta = preg?.options?.find((o: any) => o.value === v)?.label;
            return [preg?.text ?? k, etiqueta ?? v];
          }))
        })),
        checkins_antiguos: checkins.length ? checkins : undefined,
        medidas,
        sueno_ultimas_3_semanas: sueno.map((s) => ({ noche: s.night_of, acostarse: hora(s.bedtime), levantarse: hora(s.wake_time), latencia_min: s.sleep_latency_minutes, despertares: s.awakenings, calidad_1a5: s.quality, descanso_1a5: s.rested, dia_libre: s.is_free_day, nota: s.note ?? undefined })),
        comidas_ultima_semana: comidasPorDia,
        habitos: habitos.map((h) => ({
          habito: h.habit_definitions?.name, tipo: h.habit_definitions?.kind, momento: h.habit_definitions?.anchor ?? undefined, objetivo: h.target ?? undefined,
          dias: h.days_of_week, nota_ruben: h.coach_note ?? undefined, desde: h.start_date, aviso: h.remind_at ?? undefined,
          marcados_ultimos_14_dias: (h.habit_logs ?? []).filter((l: any) => l.log_date >= desde14 && (l.done || l.value_numeric != null || l.value_time != null)).length
        })),
        respiracion_ultimas_4_semanas: resp.map((r) => ({ fecha: fechaHora(r.started_at), pauta: r.pattern, minutos: Math.round(r.seconds / 60), calma_antes: r.calm_before, calma_despues: r.calm_after })),
        mensajes_recientes: mensajes.reverse().map((m) => ({ de: m.sender_id === p ? 'paciente' : 'Rubén', fecha: fechaHora(m.created_at), texto: m.body })),
        resumenes_mensuales: resumenes
      };
    }
  },
  {
    name: 'historia_clinica',
    description: 'Historia clínica del paciente: ficha clínica (motivo, antecedentes, medicación, suplementos, alergias, estilo de vida, observaciones), consultas con sus adendas y la lista de documentos clínicos. Exige el doble factor en cada consulta: pide a Rubén el código de 6 dígitos que muestra AHORA su app de autenticación (caduca en unos 30 segundos) y pásalo en codigo_doble_factor. Cada lectura queda en el registro de accesos. Úsala solo cuando haga falta para la tarea que pide Rubén.',
    inputSchema: { type: 'object', properties: { paciente_id: pacienteId, codigo_doble_factor: { type: 'string', description: 'Código de 6 dígitos de la app de autenticación de Rubén, recién dado por él' }, consultas: { type: 'integer', minimum: 1, maximum: 50, description: 'Cuántas consultas recientes (por defecto 10)' } }, required: ['paciente_id', 'codigo_doble_factor'] },
    annotations: lectura,
    run: async (db, a, _yo, token) => {
      const p = id(a.paciente_id, 'el paciente');
      await comprobarPaciente(db, p);
      const codigo = String(a.codigo_doble_factor ?? '').replace(/\D/g, '');
      exigir(codigo.length === 6, 'Para abrir la historia clínica, pide a Rubén el código de 6 dígitos que muestra ahora su app de autenticación.');
      const mfa = await sesionDobleFactor(token, codigo);
      try {
        const { error } = await mfa.db.rpc('registrar_acceso', { p_patient: p, p_action: 'ver_historia', p_entity: 'asistente_ia', p_id: null });
        if (error) throw new Fallo('No se ha podido abrir la historia clínica con el doble factor.');
        const n = Math.min(Math.max(Number(a.consultas) || 10, 1), 50);
        const [ficha, consultas, docs] = await Promise.all([
          q<any>(mfa.db.from('clinical_records').select('main_reason, personal_history, family_history, medication, supplements, allergies, lifestyle, observations, updated_at').eq('patient_id', p).maybeSingle()),
          q<any[]>(mfa.db.from('consultations').select('happened_at, modality, duration_minutes, reason, subjective, findings, plan, goals, next_review, status, consultation_addenda(text, created_at)').eq('patient_id', p).order('happened_at', { ascending: false }).limit(n)),
          q<any[]>(mfa.db.from('clinical_documents').select('title, category, document_date, note, created_at').eq('patient_id', p).order('created_at', { ascending: false }).limit(50))
        ]);
        return {
          ficha_clinica: ficha ?? 'Sin ficha clínica',
          consultas: consultas.map((c) => ({ fecha: fechaHora(c.happened_at), modalidad: c.modality, estado: c.status === 'closed' ? 'cerrada' : 'borrador', motivo: c.reason, subjetivo: c.subjective, hallazgos: c.findings, plan: c.plan, objetivos: c.goals, proxima_revision: c.next_review, adendas: (c.consultation_addenda ?? []).map((x: any) => `${x.created_at.slice(0, 10)}: ${x.text}`) })),
          documentos: docs.map((d) => ({ titulo: d.title, tipo: d.category, fecha: d.document_date ?? d.created_at.slice(0, 10), nota: d.note ?? undefined })),
          aviso: 'Datos clínicos: úsalos solo para lo que ha pedido Rubén y no los copies en mensajes al paciente.'
        };
      } finally {
        await mfa.cerrar();
      }
    }
  },
  {
    name: 'calendario',
    description: 'Sesiones de un paciente entre dos fechas, con ejercicios y, si están hechas, lo registrado.',
    inputSchema: { type: 'object', properties: { paciente_id: pacienteId, desde: { type: 'string', description: 'AAAA-MM-DD' }, hasta: { type: 'string', description: 'AAAA-MM-DD (máx. 120 días después)' } }, required: ['paciente_id', 'desde', 'hasta'] },
    annotations: lectura,
    run: async (db, a) => {
      const p = id(a.paciente_id, 'el paciente');
      exigir(FECHA.test(a.desde) && FECHA.test(a.hasta) && a.desde <= a.hasta && a.hasta <= sumarDias(a.desde, 120), 'Fechas no válidas (AAAA-MM-DD, máximo 120 días)');
      exigir(await consentimientoVigente(db, p), 'El paciente no tiene el consentimiento en vigor: sus datos de la app no se muestran.');
      const ses = await q<any[]>(db.from('workouts').select(SELECT_SESION).eq('patient_id', p).gte('scheduled_date', a.desde).lte('scheduled_date', a.hasta).order('scheduled_date'));
      return { sesiones: ses.map((w) => resumenSesion(w, true)) };
    }
  },
  {
    name: 'buscar_ejercicios',
    description: 'Busca en la biblioteca de ejercicios de Rubén (vídeos propios). Devuelve id, nombre, etiquetas, músculos, material e indicaciones. Sin filtros devuelve la biblioteca entera en formato corto.',
    inputSchema: { type: 'object', properties: { texto: { type: 'string', description: 'Parte del nombre, p. ej. «sentadilla»' }, etiqueta: { type: 'string' }, limite: { type: 'integer', minimum: 1, maximum: 300 } } },
    annotations: lectura,
    run: async (db, a) => {
      let c = db.from('exercises').select('id, name, tags, muscle_groups, equipment, description, video_id').eq('is_archived', false).order('name');
      if (a.texto) c = c.ilike('name', `%${String(a.texto).replace(/[%_]/g, '')}%`);
      if (a.etiqueta) c = c.contains('tags', [a.etiqueta]);
      const filas = await q<any[]>(c.limit(Math.min(Number(a.limite) || 300, 300)));
      const corto = !a.texto && !a.etiqueta;
      return {
        total: filas.length,
        ejercicios: filas.map((e) => corto
          ? { id: e.id, nombre: e.name, etiquetas: e.tags ?? [] }
          : { id: e.id, nombre: e.name, etiquetas: e.tags ?? [], musculos: e.muscle_groups ?? [], material: e.equipment ?? [], indicaciones: e.description ?? undefined, video: e.video_id ? `https://youtube.com/shorts/${e.video_id}` : undefined })
      };
    }
  },
  {
    name: 'catalogo_habitos',
    description: 'Catálogo de hábitos que se pueden asignar, por pilar, con su porqué.',
    inputSchema: { type: 'object', properties: {} },
    annotations: lectura,
    run: async (db) => {
      const h = await q<any[]>(db.from('habit_definitions').select('id, name, short_instruction, rationale, kind, unit, default_target, anchor, module_slug, pillars(name)').eq('is_archived', false).order('name'));
      return { habitos: h.map((x) => ({ id: x.id, nombre: x.name, pilar: x.pillars?.name, tipo: x.kind, unidad: x.unit ?? undefined, objetivo_por_defecto: x.default_target ?? undefined, momento: x.anchor ?? undefined, modulo: x.module_slug, que_hacer: x.short_instruction, porque: x.rationale })) };
    }
  },
  {
    name: 'propuestas',
    description: 'Lista las propuestas del asistente (pendientes por defecto) con su paciente y contenido.',
    inputSchema: { type: 'object', properties: { estado: { type: 'string', enum: ['pendiente', 'aplicada', 'descartada', 'todas'] }, paciente_id: pacienteId } },
    annotations: lectura,
    run: async (db, a) => {
      let c = db.from('assistant_drafts').select('id, kind, title, rationale, payload, status, result, created_at, decided_at, profiles(full_name)').order('created_at', { ascending: false }).limit(50);
      if ((a.estado ?? 'pendiente') !== 'todas') c = c.eq('status', a.estado ?? 'pendiente');
      if (a.paciente_id) c = c.eq('patient_id', id(a.paciente_id, 'el paciente'));
      const f = await q<any[]>(c);
      return { propuestas: f.map((d) => ({ id: d.id, paciente: d.profiles?.full_name, tipo: d.kind, titulo: d.title, porque: d.rationale, estado: d.status, creada: fechaHora(d.created_at), decidida: fechaHora(d.decided_at), contenido: d.payload, resultado: d.result ?? undefined })) };
    }
  },
  {
    name: 'proponer_sesiones',
    description: 'Prepara una PROPUESTA de sesiones nuevas para el calendario de un paciente: una sesión suelta o una planificación de varias semanas (cada sesión puede repetirse en varias fechas). No cambia nada hasta que Rubén la apruebe y se llame a aplicar_propuesta. Las cargas se pautan por ejercicio; para progresar semana a semana, crea una sesión por semana con sus cargas.',
    inputSchema: {
      type: 'object',
      properties: {
        paciente_id: pacienteId,
        titulo: { type: 'string', description: 'Resumen corto, p. ej. «Fuerza 4 semanas, martes y jueves»' },
        porque: { type: 'string', description: 'Qué has tenido en cuenta y por qué (para Rubén)' },
        sesiones: {
          type: 'array', minItems: 1, maxItems: 120,
          items: {
            type: 'object',
            properties: {
              nombre: { type: 'string' },
              mensaje: { type: 'string', description: 'Mensaje de Rubén que el paciente ve en la sesión (opcional)' },
              fechas: { type: 'array', items: { type: 'string', description: 'AAAA-MM-DD, hoy o después' }, minItems: 1, maxItems: 84 },
              bloques: {
                type: 'array', minItems: 1,
                items: {
                  type: 'object',
                  properties: {
                    nombre: { type: 'string', description: 'p. ej. Calentamiento, Principal' },
                    tipo: { type: 'string', enum: ['normal', 'superset', 'circuit'] },
                    vueltas: { type: 'integer', minimum: 1, maximum: 20 },
                    ejercicios: {
                      type: 'array', minItems: 1,
                      items: {
                        type: 'object',
                        properties: {
                          ejercicio_id: { type: 'string' }, series: { type: 'integer', minimum: 1, maximum: 20 },
                          objetivo: { type: 'string', description: 'Repeticiones o tiempo, p. ej. «8-10» o «30 s»' },
                          carga_kg: { type: 'number', minimum: 0 }, descanso_s: { type: 'integer', enum: [0, 30, 45, 60, 90, 120, 180, 240, 300], description: 'Segundos: solo 0, 30, 45, 60, 90, 120, 180, 240 o 300' },
                          indicaciones: { type: 'string' }
                        },
                        required: ['ejercicio_id', 'series', 'objetivo']
                      }
                    }
                  },
                  required: ['ejercicios']
                }
              }
            },
            required: ['nombre', 'fechas', 'bloques']
          }
        }
      },
      required: ['paciente_id', 'titulo', 'porque', 'sesiones']
    },
    annotations: propuesta,
    run: async (db, a) => {
      const p = id(a.paciente_id, 'el paciente');
      const pac = await comprobarPaciente(db, p);
      exigir(Array.isArray(a.sesiones) && a.sesiones.length >= 1 && a.sesiones.length <= 120, 'Entre 1 y 120 sesiones');
      const ejercicios = await comprobarEjercicios(db, a.sesiones.flatMap((s: any) => (s.bloques ?? []).flatMap((b: any) => (b.ejercicios ?? []).map((e: any) => String(e.ejercicio_id)))));
      let total = 0;
      const sesiones = a.sesiones.map((s: any) => {
        exigir(typeof s.nombre === 'string' && s.nombre.trim() && s.nombre.length <= 120, 'Cada sesión necesita un nombre (máx. 120)');
        exigir(Array.isArray(s.fechas) && s.fechas.length >= 1 && s.fechas.length <= 84 && s.fechas.every((f: string) => FECHA.test(f) && f >= hoy()), `Fechas no válidas en «${s.nombre}»: AAAA-MM-DD, desde hoy`);
        total += s.fechas.length;
        return {
          name: s.nombre.trim(), coach_message: s.mensaje?.trim() || null, dates: [...new Set(s.fechas)],
          blocks: (s.bloques ?? []).map((b: any) => ({
            name: b.nombre ?? null, type: b.tipo ?? 'normal', rounds: b.vueltas ?? 1,
            items: (b.ejercicios ?? []).map((e: any) => ({ exercise_id: e.ejercicio_id, sets: e.series, target: String(e.objetivo ?? ''), load_kg: e.carga_kg ?? null, rest_seconds: e.descanso_s ?? null, instructions: e.indicaciones ?? null }))
          }))
        };
      });
      const DESCANSOS = [0, 30, 45, 60, 90, 120, 180, 240, 300];
      for (const s of sesiones) for (const b of s.blocks) for (const i of b.items) {
        exigir(i.rest_seconds == null || DESCANSOS.includes(i.rest_seconds), `Descanso no válido (${i.rest_seconds} s) en «${s.name}»: usa 0, 30, 45, 60, 90, 120, 180, 240 o 300 s`);
        exigir(Number.isInteger(i.sets) && i.sets >= 1 && i.sets <= 20, `Series no válidas en «${s.name}» (1 a 20)`);
      }
      exigir(total <= 200, 'Demasiadas sesiones en una sola propuesta (máximo 200 fechas)');
      const d = await q<any>(db.from('assistant_drafts').insert({ patient_id: p, kind: 'sesiones', title: String(a.titulo).slice(0, 200), rationale: a.porque ? String(a.porque).slice(0, 4000) : null, payload: { sesiones } }).select('id').single());
      return {
        propuesta_id: d.id, paciente: pac.full_name, sesiones_en_calendario: total,
        resumen: sesiones.map((s: any) => `${s.name} (${s.dates.join(', ')}): ${s.blocks.map((b: any) => b.items.map((i: any) => `${ejercicios.get(i.exercise_id)} ${i.sets}x${i.target}${i.load_kg != null ? '@' + i.load_kg + 'kg' : ''}`).join(', ')).join(' | ')}`),
        siguiente_paso: 'Enseña la propuesta a Rubén. Solo si la aprueba de forma expresa, llama a aplicar_propuesta. También puede aprobarla en el panel de la app.'
      };
    }
  },
  {
    name: 'proponer_cambio_ejercicio',
    description: 'PROPUESTA de cambiar un ejercicio por otro en todas las sesiones pendientes del paciente desde una fecha (no toca sesiones hechas ni ejercicios con series o notas). Mantiene series, repeticiones y descanso.',
    inputSchema: { type: 'object', properties: { paciente_id: pacienteId, de_ejercicio_id: { type: 'string' }, a_ejercicio_id: { type: 'string' }, desde: { type: 'string', description: 'AAAA-MM-DD (por defecto hoy)' }, carga_kg: { type: 'number' }, quitar_carga: { type: 'boolean' }, indicaciones: { type: 'string' }, porque: { type: 'string' } }, required: ['paciente_id', 'de_ejercicio_id', 'a_ejercicio_id', 'porque'] },
    annotations: propuesta,
    run: async (db, a) => {
      const p = id(a.paciente_id, 'el paciente');
      const pac = await comprobarPaciente(db, p);
      const de = id(a.de_ejercicio_id, 'el ejercicio a cambiar'); const aa = id(a.a_ejercicio_id, 'el ejercicio nuevo');
      exigir(de !== aa, 'Elige un ejercicio distinto');
      const nuevo = await comprobarEjercicios(db, [aa]);
      const viejo = await q<any>(db.from('exercises').select('name').eq('id', de).maybeSingle());
      exigir(!a.desde || (FECHA.test(a.desde) && a.desde >= hoy()), 'La fecha tiene que ser hoy o después');
      const d = await q<any>(db.from('assistant_drafts').insert({ patient_id: p, kind: 'cambio_ejercicio', title: `Cambiar ${viejo?.name ?? de} por ${nuevo.get(aa)}`, rationale: String(a.porque).slice(0, 4000), payload: { from: de, to: aa, from_date: a.desde ?? hoy(), load_kg: a.carga_kg ?? null, clear_load: !!a.quitar_carga, instructions: a.indicaciones ?? null } }).select('id').single());
      return { propuesta_id: d.id, paciente: pac.full_name, siguiente_paso: 'Enseña la propuesta a Rubén y aplícala solo con su aprobación expresa.' };
    }
  },
  {
    name: 'proponer_mensaje',
    description: 'PROPUESTA de mensaje de Rubén para un paciente. No se envía hasta que Rubén lo apruebe.',
    inputSchema: { type: 'object', properties: { paciente_id: pacienteId, texto: { type: 'string', description: 'Texto tal y como lo leerá el paciente' }, porque: { type: 'string' } }, required: ['paciente_id', 'texto'] },
    annotations: propuesta,
    run: async (db, a) => {
      const p = id(a.paciente_id, 'el paciente');
      const pac = await comprobarPaciente(db, p);
      const texto = String(a.texto ?? '').trim();
      exigir(texto.length >= 1 && texto.length <= 4000, 'El mensaje está vacío o pasa de 4000 caracteres');
      const d = await q<any>(db.from('assistant_drafts').insert({ patient_id: p, kind: 'mensaje', title: `Mensaje para ${pac.full_name}`, rationale: a.porque ? String(a.porque).slice(0, 4000) : null, payload: { body: texto } }).select('id').single());
      return { propuesta_id: d.id, texto, siguiente_paso: 'Enseña el mensaje a Rubén y envíalo con aplicar_propuesta solo si lo aprueba.' };
    }
  },
  {
    name: 'proponer_habito',
    description: 'PROPUESTA de asignar un hábito del catálogo a un paciente (días, objetivo e indicación personal).',
    inputSchema: { type: 'object', properties: { paciente_id: pacienteId, habito_id: { type: 'string' }, dias_semana: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, description: '1 = lunes … 7 = domingo (por defecto todos)' }, objetivo: { type: 'number' }, nota: { type: 'string', description: 'Indicación personal que ve el paciente (máx. 300)' }, desde: { type: 'string' }, porque: { type: 'string' } }, required: ['paciente_id', 'habito_id', 'porque'] },
    annotations: propuesta,
    run: async (db, a) => {
      const p = id(a.paciente_id, 'el paciente');
      const pac = await comprobarPaciente(db, p);
      const h = await q<any>(db.from('habit_definitions').select('id, name').eq('id', id(a.habito_id, 'el hábito')).eq('is_archived', false).maybeSingle());
      exigir(h, 'Hábito no encontrado: búscalo con catalogo_habitos');
      exigir(!a.nota || String(a.nota).length <= 300, 'La nota pasa de 300 caracteres');
      exigir(!a.desde || FECHA.test(a.desde), 'Fecha no válida');
      const d = await q<any>(db.from('assistant_drafts').insert({ patient_id: p, kind: 'habito', title: `Hábito: ${h.name}`, rationale: String(a.porque).slice(0, 4000), payload: { habit_id: h.id, days_of_week: a.dias_semana ?? [1, 2, 3, 4, 5, 6, 7], target: a.objetivo ?? null, coach_note: a.nota ?? null, start_date: a.desde ?? hoy() } }).select('id').single());
      return { propuesta_id: d.id, paciente: pac.full_name, siguiente_paso: 'Aplícala solo con la aprobación expresa de Rubén.' };
    }
  },
  {
    name: 'aplicar_propuesta',
    description: 'Aplica una propuesta pendiente: crea las sesiones en el calendario, cambia el ejercicio, envía el mensaje o asigna el hábito. SOLO cuando Rubén la haya aprobado de forma expresa en esta conversación. Queda registrado que la aprobó él.',
    inputSchema: { type: 'object', properties: { propuesta_id: { type: 'string' } }, required: ['propuesta_id'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (db, a) => {
      const r = await q(db.rpc('aplicar_propuesta', { p_id: id(a.propuesta_id, 'la propuesta') }));
      return { hecho: true, resultado: r, ver_en_la_app: APP_URL };
    }
  },
  {
    name: 'descartar_propuesta',
    description: 'Descarta una propuesta pendiente (no se borra: queda como descartada).',
    inputSchema: { type: 'object', properties: { propuesta_id: { type: 'string' } }, required: ['propuesta_id'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (db, a) => { await q(db.rpc('descartar_propuesta', { p_id: id(a.propuesta_id, 'la propuesta') })); return { hecho: true }; }
  }
];

// ---------- protocolo MCP (HTTP, respuestas JSON) ----------
const JSON_H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const noAutorizado = () => new Response(JSON.stringify({ error: 'Conecta tu cuenta de coach' }), {
  status: 401, headers: { ...JSON_H, 'WWW-Authenticate': `Bearer resource_metadata="${METADATA_URL}"` }
});

async function sesionCoach(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const db = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await db.auth.getUser(token);
  if (!data?.user) return null;
  const { data: perfil } = await db.from('profiles').select('role, status').eq('id', data.user.id).maybeSingle();
  if (perfil?.role !== 'coach' || perfil?.status !== 'active') return 'no-coach' as const;
  return { db, yo: data.user.id, token };
}

async function atender(m: any, db: SupabaseClient, yo: string, token: string) {
  const res = (result: unknown) => ({ jsonrpc: '2.0', id: m.id, result });
  const err = (code: number, message: string) => ({ jsonrpc: '2.0', id: m.id ?? null, error: { code, message } });
  switch (m.method) {
    case 'initialize': {
      const v = VERSIONES.includes(m.params?.protocolVersion) ? m.params.protocolVersion : VERSIONES[1];
      return res({ protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'vitaltrain', title: 'Vitaltrain · asistente del coach', version: '1.0.0' }, instructions: INSTRUCCIONES });
    }
    case 'ping': return res({});
    case 'tools/list': return res({ tools: HERRAMIENTAS.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })) });
    case 'tools/call': {
      const h = HERRAMIENTAS.find((x) => x.name === m.params?.name);
      if (!h) return err(-32602, 'Herramienta desconocida');
      try {
        const out = await h.run(db, m.params?.arguments ?? {}, yo, token);
        return res({ content: [{ type: 'text', text: JSON.stringify(out) }] });
      } catch (e) {
        const texto = e instanceof Fallo ? e.message : 'Error inesperado. Inténtalo de nuevo.';
        if (!(e instanceof Fallo)) console.error(e);
        return res({ content: [{ type: 'text', text: texto }], isError: true });
      }
    }
    default:
      if (m.id === undefined) return null; // notificación
      return err(-32601, 'Método no disponible');
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith('/.well-known/oauth-protected-resource')) {
    return new Response(JSON.stringify({
      resource: RESOURCE,
      authorization_servers: [`${SUPABASE_URL}/auth/v1`],
      bearer_methods_supported: ['header'],
      scopes_supported: ['openid', 'email', 'profile'],
      resource_name: 'Vitaltrain'
    }), { headers: { ...JSON_H, 'Access-Control-Allow-Origin': '*' } });
  }
  if (req.method === 'GET' || req.method === 'DELETE') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });

  const s = await sesionCoach(req);
  if (s === null) return noAutorizado();
  if (s === 'no-coach') return new Response(JSON.stringify({ error: 'Solo el coach puede usar el asistente' }), { status: 403, headers: JSON_H });

  let cuerpo: any;
  try { cuerpo = await req.json(); } catch { return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON no válido' } }), { status: 400, headers: JSON_H }); }
  const lote = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
  const respuestas = (await Promise.all(lote.map((m) => atender(m, s.db, s.yo, s.token)))).filter(Boolean);
  if (!respuestas.length) return new Response(null, { status: 202 });
  return new Response(JSON.stringify(Array.isArray(cuerpo) ? respuestas : respuestas[0]), { headers: JSON_H });
});
