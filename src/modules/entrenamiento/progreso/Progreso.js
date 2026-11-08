import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { hoyIso, iso, lunes, sumarDias } from '../../../lib/fechas';
import { Linea, PETROLEO, PISTA, REJILLA, fechaCorta, fechaLarga, num } from '../../../core/graficas';
// Progreso del módulo de entrenamiento: entrenamientos por semana, carga por ejercicio y esfuerzo medio.
// Lo usan la pestaña «Progreso» del paciente y la sección «Progresión» de la ficha del coach.
// No añade tablas: lee las sesiones y las series ya registradas. Gráficas en SVG propio, sin librerías.
const SEMANAS = 12;
const uno = (x) => (Array.isArray(x) ? x[0] ?? null : x ?? null);
export function useProgreso(supabase, pacienteId) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        const desde = iso(sumarDias(lunes(new Date()), -7 * (SEMANAS - 1)));
        Promise.all([
            supabase.from('workouts').select('scheduled_date, status, rpe').eq('patient_id', pacienteId).gte('scheduled_date', desde).lte('scheduled_date', hoyIso()),
            supabase.from('set_logs').select('reps, load_kg, workout_items(exercise_id, exercises(name), workout_blocks(workouts(scheduled_date)))')
                .eq('patient_id', pacienteId).eq('done', true).not('load_kg', 'is', null).gt('load_kg', 0).limit(5000),
        ]).then(([a, b]) => {
            if (a.error || b.error)
                return setError(true);
            setDatos({ sesiones: a.data ?? [], series: b.data ?? [] });
        });
    }, [supabase, pacienteId]);
    return { datos, error };
}
export default function Progreso({ supabase, pacienteId, ancho = false }) {
    const { datos, error } = useProgreso(supabase, pacienteId);
    const [ejercicio, setEjercicio] = useState('');
    const semanas = useMemo(() => {
        const base = lunes(new Date());
        return Array.from({ length: SEMANAS }, (_, i) => {
            const l = iso(sumarDias(base, -7 * (SEMANAS - 1 - i)));
            const fin = iso(sumarDias(base, -7 * (SEMANAS - 1 - i) + 6));
            const ss = (datos?.sesiones ?? []).filter((s) => s.scheduled_date >= l && s.scheduled_date <= fin);
            const hechas = ss.filter((s) => s.status === 'completed');
            const rpes = hechas.map((s) => s.rpe).filter((r) => r != null);
            return { lunes: l, pautadas: ss.length, hechas: hechas.length, rpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null };
        });
    }, [datos]);
    // Por ejercicio: carga máxima de cada día (con sus repeticiones)
    const ejercicios = useMemo(() => {
        const m = new Map();
        for (const s of datos?.series ?? []) {
            const it = uno(s.workout_items);
            const ex = uno(it?.exercises);
            const w = uno(uno(it?.workout_blocks)?.workouts);
            if (!it || !ex || !w || s.load_kg == null)
                continue;
            const e = m.get(it.exercise_id) ?? { nombre: ex.name, puntos: new Map() };
            const p = e.puntos.get(w.scheduled_date);
            const kg = Number(s.load_kg);
            if (!p || kg > p.kg || (kg === p.kg && (s.reps ?? 0) > (p.reps ?? 0)))
                e.puntos.set(w.scheduled_date, { fecha: w.scheduled_date, kg, reps: s.reps });
            m.set(it.exercise_id, e);
        }
        return [...m.entries()]
            .map(([id, e]) => ({ id, nombre: e.nombre, puntos: [...e.puntos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)) }))
            .sort((a, b) => b.puntos.length - a.puntos.length || a.nombre.localeCompare(b.nombre, 'es'));
    }, [datos]);
    const elegido = ejercicios.find((e) => e.id === ejercicio) ?? ejercicios[0];
    if (error)
        return _jsx("p", { className: "bg-white rounded-2xl p-5 text-texto-suave", children: "No se ha podido cargar el progreso. Comprueba la conexi\u00F3n." });
    if (!datos)
        return _jsx("p", { className: "bg-white rounded-2xl p-5 text-texto-suave", children: "Cargando\u2026" });
    const ultimas4 = semanas.slice(-4);
    const p4 = ultimas4.reduce((a, s) => a + s.pautadas, 0);
    const h4 = ultimas4.reduce((a, s) => a + s.hechas, 0);
    const rpes4 = ultimas4.map((s) => s.rpe).filter((r) => r != null);
    const estaSemana = semanas[semanas.length - 1];
    const hayAlgo = datos.sesiones.length > 0;
    return (_jsxs("div", { className: `grid gap-4 ${ancho ? 'lg:grid-cols-2' : ''}`, children: [_jsxs("div", { className: `grid grid-cols-3 gap-2 ${ancho ? 'lg:col-span-2' : ''}`, children: [_jsx(Dato, { titulo: "Esta semana", valor: `${estaSemana.hechas} de ${estaSemana.pautadas}` }), _jsx(Dato, { titulo: "\u00DAltimas 4 semanas", valor: p4 ? `${Math.round((h4 / p4) * 100)} %` : '—', nota: p4 ? `${h4} de ${p4} hechas` : undefined }), _jsx(Dato, { titulo: "Esfuerzo medio", valor: rpes4.length ? num(rpes4.reduce((a, b) => a + b, 0) / rpes4.length) : '—', nota: "de 10, \u00FAltimo mes" })] }), !hayAlgo ? (_jsx("p", { className: `bg-white rounded-2xl p-5 text-texto-suave ${ancho ? 'lg:col-span-2' : ''}`, children: "A\u00FAn no hay entrenamientos. Las gr\u00E1ficas aparecer\u00E1n con las primeras sesiones." })) : (_jsxs(_Fragment, { children: [_jsx(Tarjeta, { titulo: "Entrenamientos por semana", subtitulo: "Hechos sobre los pautados, \u00FAltimas 12 semanas", children: _jsx(Barras, { semanas: semanas }) }), _jsx(Tarjeta, { titulo: "Esfuerzo medio por semana", subtitulo: "Lo que anotas al terminar, de 1 a 10", children: _jsx(Linea, { puntos: semanas.filter((s) => s.rpe != null).map((s) => ({ x: s.lunes, y: s.rpe, etiqueta: `Semana del ${fechaLarga(s.lunes)}: ${num(s.rpe)} de 10` })), dominioX: semanas.map((s) => s.lunes), minY: 1, maxY: 10, unidad: "", vacio: "Sin esfuerzo anotado todav\u00EDa." }) }), _jsx(Tarjeta, { titulo: "Carga por ejercicio", subtitulo: "La serie m\u00E1s pesada de cada d\u00EDa", children: ejercicios.length === 0 ? (_jsx("p", { className: "text-sm text-texto-suave", children: "Aparecer\u00E1 cuando registres series con kilos." })) : (_jsxs(_Fragment, { children: [_jsx("select", { "aria-label": "Ejercicio", value: elegido?.id ?? '', onChange: (e) => setEjercicio(e.target.value), className: "w-full px-3 py-2.5 border border-borde rounded-xl bg-white font-semibold", children: ejercicios.map((e) => _jsxs("option", { value: e.id, children: [e.nombre, " (", e.puntos.length, " ", e.puntos.length === 1 ? 'día' : 'días', ")"] }, e.id)) }), elegido && _jsx(ResumenCarga, { puntos: elegido.puntos }), elegido && (_jsx(Linea, { puntos: elegido.puntos.map((p) => ({ x: p.fecha, y: p.kg, etiqueta: `${fechaLarga(p.fecha)}: ${num(p.kg)} kg${p.reps != null ? ` × ${p.reps}` : ''}` })), dominioX: elegido.puntos.map((p) => p.fecha), unidad: " kg", vacio: "" }))] })) })] }))] }));
}
function Dato({ titulo, valor, nota }) {
    return (_jsxs("div", { className: "bg-white rounded-2xl p-3 sm:p-4", children: [_jsx("div", { className: "text-[11px] font-bold tracking-wide text-texto-suave uppercase leading-tight", children: titulo }), _jsx("div", { className: "text-2xl font-bold mt-1", children: valor }), nota && _jsx("div", { className: "text-[11px] text-texto-suave leading-tight", children: nota })] }));
}
function Tarjeta({ titulo, subtitulo, className = '', children }) {
    return (_jsxs("section", { className: `bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3 ${className}`, children: [_jsxs("div", { children: [_jsx("h3", { className: "font-bold", children: titulo }), _jsx("p", { className: "text-xs text-texto-suave", children: subtitulo })] }), children] }));
}
function ResumenCarga({ puntos }) {
    const primero = puntos[0];
    const ultimo = puntos[puntos.length - 1];
    const max = Math.max(...puntos.map((p) => p.kg));
    const dif = ultimo.kg - primero.kg;
    return (_jsxs("p", { className: "text-sm", children: ["\u00DAltimo: ", _jsxs("strong", { children: [num(ultimo.kg), " kg"] }), ultimo.reps != null ? ` × ${ultimo.reps}` : '', " (", fechaLarga(ultimo.fecha), "). M\u00E1ximo: ", num(max), " kg.", puntos.length > 1 && _jsxs(_Fragment, { children: [" ", dif > 0 ? `+${num(dif)} kg` : dif < 0 ? `${num(dif)} kg` : 'Sin cambio', " desde el ", fechaLarga(primero.fecha), "."] })] }));
}
/** Barras: pista gris = sesiones pautadas; relleno petróleo = hechas. Tocar una barra muestra el dato. */
function Barras({ semanas }) {
    const [sel, setSel] = useState(null);
    const W = 320, H = 150, top = 12, bottom = 22, left = 4, right = 4;
    const max = Math.max(1, ...semanas.map((s) => Math.max(s.pautadas, s.hechas)));
    const paso = (W - left - right) / semanas.length;
    const ancho = Math.min(16, paso - 6);
    const y = (v) => top + (H - top - bottom) * (1 - v / max);
    const elegida = sel != null ? semanas[sel] : null;
    return (_jsxs("div", { children: [_jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "w-full h-auto", role: "img", "aria-label": `Entrenamientos hechos por semana: ${semanas.map((s) => `semana del ${fechaLarga(s.lunes)}, ${s.hechas} de ${s.pautadas}`).join('; ')}`, children: [_jsx("line", { x1: left, x2: W - right, y1: y(0), y2: y(0), stroke: REJILLA, strokeWidth: 1 }), semanas.map((s, i) => {
                        const cx = left + paso * i + paso / 2;
                        const x = cx - ancho / 2;
                        return (_jsxs("g", { onClick: () => setSel(sel === i ? null : i), style: { cursor: 'pointer' }, children: [_jsx("rect", { x: left + paso * i, y: top, width: paso, height: H - top, fill: "transparent" }), s.pautadas > 0 && _jsx("rect", { x: x, y: y(s.pautadas), width: ancho, height: y(0) - y(s.pautadas), rx: 4, fill: PISTA }), s.hechas > 0 && _jsx("rect", { x: x, y: y(s.hechas), width: ancho, height: y(0) - y(s.hechas), rx: 4, fill: PETROLEO, opacity: sel == null || sel === i ? 1 : 0.45 }), (i % 2 === 1 || i === semanas.length - 1) && (_jsx("text", { x: cx, y: H - 6, textAnchor: "middle", fontSize: 9, fill: "#5A6464", children: fechaCorta(s.lunes) }))] }, s.lunes));
                    })] }), _jsxs("div", { className: "flex items-center justify-between gap-3 text-xs text-texto-suave min-h-5", children: [_jsxs("span", { className: "flex items-center gap-3", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "w-3 h-3 rounded-sm", style: { background: PETROLEO } }), "Hechos"] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "w-3 h-3 rounded-sm", style: { background: PISTA } }), "Pautados"] })] }), _jsx("span", { className: "font-semibold text-[#4A4A4C]", children: elegida ? `Semana del ${fechaLarga(elegida.lunes)}: ${elegida.hechas} de ${elegida.pautadas}` : 'Toca una barra' })] })] }));
}
