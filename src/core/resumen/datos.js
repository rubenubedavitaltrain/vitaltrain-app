import { desdeIso, hoyIso, iso, sumarDias } from '../../lib/fechas';
import { resumenComidas, resumenSueno } from '../../modules/circadiano/datos';
import { cargarAsignados, cumplido, tocaEseDia } from '../../modules/habitos/datos';
const MOTIVOS = { pain: 'Dolor o molestia', no_equipment: 'Sin material', dont_know: 'No sabe hacerlo', other: 'Otro motivo' };
const uno = (x) => (Array.isArray(x) ? x[0] ?? null : x ?? null);
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const NOMBRE_MES = (mes) => { const t = desdeIso(`${mes}-01`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
export async function calcularFoto(supabase, pacienteId, nombre, mes) {
    const ini = `${mes}-01`;
    const d = desdeIso(ini);
    const finMes = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const fin = finMes < hoyIso() ? finMes : hoyIso();
    const previoIni = iso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const [ws, series, fb, med, noches, comidas, logs] = await Promise.all([
        supabase.from('workouts').select('scheduled_date, name, status, rpe, feeling, patient_notes').eq('patient_id', pacienteId).gte('scheduled_date', ini).lte('scheduled_date', fin).order('scheduled_date'),
        supabase.from('set_logs').select('reps, load_kg, workout_items!inner(exercise_id, exercises(name), workout_blocks!inner(workouts!inner(scheduled_date)))')
            .eq('patient_id', pacienteId).eq('done', true).gt('load_kg', 0)
            .gte('workout_items.workout_blocks.workouts.scheduled_date', ini).lte('workout_items.workout_blocks.workouts.scheduled_date', fin).limit(5000),
        supabase.from('workout_item_feedback').select('note, cannot_do, reason, workout_items!inner(exercises(name), workout_blocks!inner(workouts!inner(scheduled_date)))')
            .eq('patient_id', pacienteId).gte('workout_items.workout_blocks.workouts.scheduled_date', ini).lte('workout_items.workout_blocks.workouts.scheduled_date', fin),
        supabase.from('body_measurements').select('measured_on, weight_kg, waist_cm, hip_cm').eq('patient_id', pacienteId).gte('measured_on', previoIni).lte('measured_on', fin).order('measured_on'),
        supabase.from('sleep_logs').select('id, night_of, bedtime, wake_time, sleep_latency_minutes, awakenings, quality, rested, is_free_day, note').eq('patient_id', pacienteId).gte('night_of', ini).lte('night_of', fin),
        supabase.from('meal_events').select('id, eaten_at, kind, note').eq('patient_id', pacienteId).gte('eaten_at', desdeIso(ini).toISOString()).lt('eaten_at', sumarDias(desdeIso(fin), 1).toISOString()).order('eaten_at'),
        supabase.from('habit_logs').select('id, patient_habit_id, log_date, done, value_numeric, value_time').eq('patient_id', pacienteId).gte('log_date', ini).lte('log_date', fin),
    ]);
    const sesiones = ws.data ?? [];
    const hechas = sesiones.filter((s) => s.status === 'completed');
    const porEj = new Map();
    for (const s of series.data ?? []) {
        const it = uno(s.workout_items);
        const ex = uno(it?.exercises);
        const w = uno(uno(it?.workout_blocks)?.workouts);
        if (!it || !ex || !w)
            continue;
        const e = porEj.get(it.exercise_id) ?? { nombre: ex.name, dias: new Map() };
        const p = e.dias.get(w.scheduled_date);
        const kg = Number(s.load_kg);
        if (!p || kg > p.kg)
            e.dias.set(w.scheduled_date, { kg, reps: s.reps });
        porEj.set(it.exercise_id, e);
    }
    const ejercicios = [...porEj.values()].map((e) => {
        const dias = [...e.dias.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        return { nombre: e.nombre, sesiones: dias.length, primero: { fecha: dias[0][0], ...dias[0][1] }, ultimo: { fecha: dias[dias.length - 1][0], ...dias[dias.length - 1][1] } };
    }).sort((a, b) => b.sesiones - a.sesiones || a.nombre.localeCompare(b.nombre, 'es')).slice(0, 12);
    const notas = (fb.data ?? []).map((f) => {
        const it = uno(f.workout_items);
        const w = uno(uno(it?.workout_blocks)?.workouts);
        return { fecha: w?.scheduled_date ?? '', ejercicio: uno(it?.exercises)?.name ?? '', nota: f.note, noPuede: f.cannot_do ? MOTIVOS[f.reason ?? 'other'] : null };
    }).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const entrenamiento = sesiones.length ? {
        pautadas: sesiones.length, hechas: hechas.length, rpeMedio: media(hechas.map((s) => s.rpe).filter((r) => r != null)),
        ejercicios,
        sensaciones: hechas.filter((s) => s.feeling || s.patient_notes).map((s) => ({ fecha: s.scheduled_date, nombre: s.name, rpe: s.rpe, texto: [s.feeling, s.patient_notes].filter(Boolean).join(' · ') })),
        notas,
    } : null;
    const ms = med.data ?? [];
    const campos = [['peso', 'weight_kg', 'kg'], ['cintura', 'waist_cm', 'cm'], ['cadera', 'hip_cm', 'cm']];
    const medidas = campos.map(([clave, col, unidad]) => {
        const del = ms.filter((m) => m.measured_on >= ini && m[col] != null).map((m) => Number(m[col]));
        const prev = ms.filter((m) => m.measured_on < ini && m[col] != null).map((m) => Number(m[col]));
        return del.length ? { clave, unidad, inicio: del[0], fin: del[del.length - 1], previo: prev.length ? prev[prev.length - 1] : null } : null;
    }).filter((x) => !!x);
    // Sueño y comidas
    const ns = noches.data ?? [];
    const cs = comidas.data ?? [];
    const rs = resumenSueno(ns);
    const rc = resumenComidas(cs, ns);
    const sueno = ns.length || cs.length ? {
        noches: rs.noches, duracion: rs.duracionMedia, acostarse: rs.acostarseMedio, levantarse: rs.levantarseMedio,
        regularidad: rs.regularidadAcostarse != null && rs.regularidadLevantarse != null ? (rs.regularidadAcostarse + rs.regularidadLevantarse) / 2 : null,
        jetLag: rs.jetLagSocial, calidad: rs.calidadMedia, descanso: rs.descansoMedio, ventana: rc.ventanaMedia, ultimaACama: rc.ultimaAntesDeDormir,
    } : null;
    // Hábitos: % de días que tocaban y se cumplieron
    const registros = logs.data ?? [];
    let habitos = null;
    if (registros.length || !logs.error) {
        const asignados = (await cargarAsignados(supabase, pacienteId, false)).filter((a) => a.start_date <= fin && (!a.end_date || a.end_date >= ini));
        const fechas = [];
        for (let f = desdeIso(ini); iso(f) <= fin; f = sumarDias(f, 1))
            fechas.push(iso(f));
        const lista = asignados.map((a) => {
            const tocan = fechas.filter((f) => tocaEseDia(a, f));
            const hechos = tocan.filter((f) => cumplido(a, registros.find((r) => r.patient_habit_id === a.id && r.log_date === f))).length;
            return { nombre: a.habit_definitions.name, pilar: a.habit_definitions.pillars?.name ?? '', tocaban: tocan.length, hechos, pct: tocan.length ? Math.round((hechos / tocan.length) * 100) : 0 };
        }).filter((h) => h.tocaban > 0);
        habitos = lista.length ? lista : null;
    }
    return { mes, generado: new Date().toISOString(), nombre, entrenamiento, medidas: medidas.length ? medidas : null, sueno, habitos };
}
