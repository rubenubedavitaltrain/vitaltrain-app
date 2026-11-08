import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { desdeIso, diaMes, hoyIso, iso, sumarDias } from '../../lib/fechas';
import { cargarAsignados, cargarRegistros, cumplido, DIAS, diaSemana, num, objetivo, textoAncla, tocaEseDia, tocaHoy } from './datos';
// Módulo de hábitos, parte del paciente:
// - TarjetaHabitos: los hábitos de hoy en la pantalla "Hoy", agrupados por pilar, para marcar en un toque.
// - Constancia: cuadrícula de los últimos 14 días (la usan el paciente en Progreso y el coach en la ficha).
export function TarjetaHabitos({ supabase, pacienteId, onPilares }) {
    const [asignados, setAsignados] = useState(null);
    const [registros, setRegistros] = useState([]);
    const [error, setError] = useState('');
    const [abierto, setAbierto] = useState(null);
    const hoy = hoyIso();
    useEffect(() => {
        cargarAsignados(supabase, pacienteId).then((a) => {
            setAsignados(a);
            onPilares?.([...new Set(a.map((x) => x.habit_definitions.pillars?.slug).filter((s) => !!s))]);
        });
        cargarRegistros(supabase, pacienteId, 1).then(setRegistros);
    }, [supabase, pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!asignados)
        return null;
    const deHoy = asignados.filter(tocaHoy);
    if (deHoy.length === 0)
        return null;
    const reg = (a) => registros.find((r) => r.patient_habit_id === a.id && r.log_date === hoy);
    const hechos = deHoy.filter((a) => cumplido(a, reg(a))).length;
    async function guardar(a, cambios) {
        setError('');
        const previo = registros;
        const otro = registros.filter((r) => !(r.patient_habit_id === a.id && r.log_date === hoy));
        if (cambios === null) {
            setRegistros(otro);
            const { error } = await supabase.from('habit_logs').delete().eq('patient_habit_id', a.id).eq('log_date', hoy);
            if (error) {
                setRegistros(previo);
                setError('No se ha podido guardar. Revisa la conexión.');
            }
            return;
        }
        const nuevo = { id: reg(a)?.id ?? 'nuevo', patient_habit_id: a.id, log_date: hoy, done: null, value_numeric: null, value_time: null, ...reg(a), ...cambios };
        setRegistros([...otro, nuevo]);
        const { error } = await supabase.from('habit_logs').upsert({
            patient_habit_id: a.id, patient_id: pacienteId, log_date: hoy, done: nuevo.done, value_numeric: nuevo.value_numeric, value_time: nuevo.value_time,
        }, { onConflict: 'patient_habit_id,log_date' });
        if (error) {
            setRegistros(previo);
            setError('No se ha podido guardar. Revisa la conexión.');
        }
    }
    // Agrupados por pilar
    const grupos = [];
    for (const a of deHoy) {
        const p = a.habit_definitions.pillars?.name ?? 'Otros';
        const g = grupos.find((x) => x.pilar === p);
        if (g)
            g.lista.push(a);
        else
            grupos.push({ pilar: p, lista: [a] });
    }
    return (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "habitos-hoy", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h2", { id: "habitos-hoy", className: "text-xs font-bold tracking-wide text-texto-suave", children: "H\u00C1BITOS DE HOY" }), _jsx("p", { className: "font-bold text-lg leading-tight mt-0.5", children: hechos === deHoy.length ? 'Todo hecho' : `${hechos} de ${deHoy.length}` })] }), _jsx(Anillo, { hecho: hechos, total: deHoy.length })] }), grupos.map((g) => (_jsxs("div", { className: "flex flex-col", children: [_jsx("h3", { className: "text-[11px] font-bold uppercase tracking-wide text-petroleo mb-1", children: g.pilar }), _jsx("ul", { className: "flex flex-col", children: g.lista.map((a) => (_jsx(Fila, { a: a, r: reg(a), abierto: abierto === a.id, onAbrir: () => setAbierto(abierto === a.id ? null : a.id), onGuardar: (c) => guardar(a, c) }, a.id))) })] }, g.pilar))), error && _jsx("p", { role: "alert", className: "text-sm font-semibold text-[#8A2C1D]", children: error })] }));
}
function Fila({ a, r, abierto, onAbrir, onGuardar }) {
    const d = a.habit_definitions;
    const ok = cumplido(a, r);
    const obj = objetivo(a);
    const ancla = textoAncla(d.anchor, d.anchor_offset_minutes);
    const paso = d.kind === 'duration' ? 5 : obj != null && obj >= 1000 ? 500 : 1;
    const valor = r?.value_numeric ?? 0;
    const [texto, setTexto] = useState(valor ? String(valor) : '');
    useEffect(() => { setTexto(valor ? String(valor) : ''); }, [valor]);
    const ponValor = (v) => onGuardar(v == null || v <= 0 ? null : { value_numeric: v, done: obj == null ? true : v >= obj });
    return (_jsxs("li", { className: "border-t border-fondo py-2.5 flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center gap-3", children: [d.kind === 'check' ? (_jsx("button", { onClick: () => onGuardar(ok ? null : { done: true }), "aria-pressed": ok, "aria-label": `${d.name}: ${ok ? 'hecho, toca para desmarcar' : 'marcar como hecho'}`, className: `w-9 h-9 shrink-0 rounded-full border-2 flex items-center justify-center ${ok ? 'bg-petroleo border-petroleo text-white' : 'border-borde'}`, children: ok && _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: _jsx("path", { d: "M5 12l5 5L20 7" }) }) })) : (_jsx("span", { className: `w-9 h-9 shrink-0 rounded-full border-2 flex items-center justify-center ${ok ? 'bg-petroleo border-petroleo text-white' : 'border-gris-claro text-transparent'}`, "aria-hidden": "true", children: _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M5 12l5 5L20 7" }) }) })), _jsxs("button", { onClick: onAbrir, className: "flex-1 text-left min-w-0", "aria-expanded": abierto, children: [_jsx("span", { className: `block font-semibold leading-tight ${ok && d.kind === 'check' ? 'text-texto-suave' : ''}`, children: d.name }), _jsx("span", { className: "block text-xs text-texto-suave leading-snug", children: [ancla, obj != null && d.kind !== 'scale' ? `Objetivo: ${num(obj)} ${d.unit ?? ''}`.trim() : null].filter(Boolean).join(' · ') || d.short_instruction })] })] }), (d.kind === 'number' || d.kind === 'duration') && (_jsxs("div", { className: "flex items-center gap-2 pl-12", children: [_jsx("button", { onClick: () => ponValor(Math.max(0, valor - paso)), className: "w-10 h-10 rounded-xl bg-fondo font-bold text-lg", "aria-label": "Menos", children: "\u2212" }), _jsx("input", { inputMode: "numeric", value: texto, placeholder: "0", "aria-label": `${d.name} (${d.unit ?? ''})`, onChange: (e) => setTexto(e.target.value.replace(/\D/g, '').slice(0, 6)), onBlur: () => { const v = Number(texto || 0); if (v !== valor)
                            ponValor(Math.min(v, 100000)); }, onKeyDown: (e) => { if (e.key === 'Enter')
                            e.target.blur(); }, className: "w-20 text-center text-lg font-bold py-1.5 border border-borde rounded-xl tabular-nums" }), _jsx("button", { onClick: () => ponValor(valor + paso), className: "w-10 h-10 rounded-xl bg-fondo font-bold text-lg", "aria-label": "M\u00E1s", children: "+" }), _jsx("span", { className: "text-sm text-texto-suave", children: d.unit })] })), d.kind === 'scale' && (_jsx("div", { className: "flex gap-1.5 pl-12", children: [1, 2, 3, 4, 5].map((v) => (_jsx("button", { onClick: () => onGuardar(r?.value_numeric === v ? null : { value_numeric: v, done: true }), "aria-pressed": r?.value_numeric === v, className: `flex-1 py-2 rounded-xl font-bold ${r?.value_numeric === v ? 'bg-petroleo text-white' : 'bg-fondo'}`, children: v }, v))) })), d.kind === 'time' && (_jsx("div", { className: "pl-12", children: _jsx("input", { type: "time", value: r?.value_time?.slice(0, 5) ?? '', onChange: (e) => onGuardar(e.target.value ? { value_time: e.target.value, done: true } : null), className: "text-lg px-3 py-1.5 border border-borde rounded-xl" }) })), abierto && (_jsxs("div", { className: "pl-12 text-sm flex flex-col gap-1", children: [d.short_instruction && _jsx("p", { children: d.short_instruction }), a.coach_note && _jsxs("p", { className: "bg-fondo rounded-lg px-3 py-2", children: [_jsx("b", { children: "Rub\u00E9n:" }), " ", a.coach_note] }), d.rationale && _jsxs("p", { className: "text-texto-suave", children: [_jsx("b", { className: "text-texto", children: "Por qu\u00E9: " }), d.rationale] })] }))] }));
}
function Anillo({ hecho, total }) {
    const r = 18, c = 2 * Math.PI * r, f = total ? hecho / total : 0;
    return (_jsxs("svg", { width: "48", height: "48", viewBox: "0 0 48 48", "aria-hidden": "true", children: [_jsx("circle", { cx: "24", cy: "24", r: r, fill: "none", stroke: "#E4E7E6", strokeWidth: "6" }), _jsx("circle", { cx: "24", cy: "24", r: r, fill: "none", stroke: "#DCB733", strokeWidth: "6", strokeDasharray: `${c * f} ${c}`, strokeLinecap: "round", transform: "rotate(-90 24 24)" })] }));
}
/** Últimos 14 días por hábito: cuadro lleno si se hizo, vacío si tocaba y no, gris si no tocaba. */
export function Constancia({ supabase, pacienteId, esCoach = false, version = 0 }) {
    const [asignados, setAsignados] = useState(null);
    const [registros, setRegistros] = useState([]);
    useEffect(() => {
        cargarAsignados(supabase, pacienteId).then(setAsignados);
        cargarRegistros(supabase, pacienteId, 14).then(setRegistros);
    }, [supabase, pacienteId, version]);
    if (!asignados)
        return null;
    if (asignados.length === 0)
        return esCoach ? _jsx("p", { className: "text-sm text-texto-suave", children: "A\u00FAn no tiene h\u00E1bitos asignados." }) : null;
    const fechas = Array.from({ length: 14 }, (_, i) => iso(sumarDias(new Date(), -13 + i)));
    return (_jsxs("section", { className: `bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3 ${esCoach ? '' : ''}`, "aria-labelledby": `constancia-${pacienteId}`, children: [_jsxs("div", { children: [_jsx("h3", { id: `constancia-${pacienteId}`, className: "font-bold", children: esCoach ? 'Constancia (14 días)' : 'Mis hábitos' }), _jsxs("p", { className: "text-xs text-texto-suave", children: ["\u00DAltimos 14 d\u00EDas. ", fechas[0] && `Del ${diaMes(desdeIso(fechas[0]))} a hoy.`] })] }), _jsx("div", { className: "flex flex-col gap-2.5", children: asignados.map((a) => {
                    const tocan = fechas.filter((f) => tocaEseDia(a, f) && f <= hoyIso());
                    const hechos = tocan.filter((f) => cumplido(a, registros.find((r) => r.patient_habit_id === a.id && r.log_date === f))).length;
                    const pct = tocan.length ? Math.round((hechos / tocan.length) * 100) : null;
                    const valores = registros.filter((r) => r.patient_habit_id === a.id && r.value_numeric != null).map((r) => r.value_numeric);
                    const media = valores.length ? valores.reduce((x, y) => x + y, 0) / valores.length : null;
                    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("div", { className: "flex justify-between gap-2 text-sm", children: [_jsx("span", { className: "font-semibold truncate", children: a.habit_definitions.name }), _jsxs("span", { className: "shrink-0 tabular-nums text-texto-suave", children: [media != null && a.habit_definitions.kind !== 'check' ? `media ${num(media)}${a.habit_definitions.unit ? ` ${a.habit_definitions.unit}` : ''} · ` : '', _jsx("b", { className: "text-texto", children: pct == null ? '—' : `${pct}%` })] })] }), _jsx("div", { className: "grid grid-cols-14 gap-1", style: { gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }, children: fechas.map((f) => {
                                    const toca = tocaEseDia(a, f);
                                    const r = registros.find((x) => x.patient_habit_id === a.id && x.log_date === f);
                                    const ok = cumplido(a, r);
                                    const parcial = !ok && r != null;
                                    return (_jsx("span", { title: `${diaMes(desdeIso(f))} (${DIAS[diaSemana(f) - 1]}): ${!toca ? 'no tocaba' : ok ? 'hecho' : parcial ? 'a medias' : 'sin hacer'}`, className: `h-5 rounded ${ok ? 'bg-petroleo' : parcial ? 'bg-mostaza' : toca ? 'border border-borde' : 'bg-fondo'}` }, f));
                                }) })] }, a.id));
                }) }), _jsxs("p", { className: "flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-3 h-3 rounded-sm bg-petroleo" }), "Hecho"] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-3 h-3 rounded-sm bg-mostaza" }), "A medias"] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-3 h-3 rounded-sm border border-borde" }), "Sin hacer"] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-3 h-3 rounded-sm bg-fondo" }), "No tocaba"] })] })] }));
}
