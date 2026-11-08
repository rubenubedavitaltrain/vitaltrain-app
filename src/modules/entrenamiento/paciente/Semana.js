import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { DIAS_CORTOS, iso, lunes, rangoSemana, sumarDias } from '../../../lib/fechas';
import { cargarSemana } from './datos';
// Tarjeta de "Hoy" y pantalla "Mi semana" del módulo de entrenamiento (paciente).
const ESTADO = { scheduled: 'Pendiente', in_progress: 'En curso', completed: 'Hecho', skipped: 'No hecho' };
export function useSemana(supabase, inicio) {
    const [lista, setLista] = useState(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        setLista(null);
        cargarSemana(supabase, iso(inicio), iso(sumarDias(inicio, 6))).then(setLista).catch(() => setError(true));
    }, [supabase, inicio.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
    return { lista, error };
}
/** Tarjeta para la pantalla Hoy: entrenamiento del día y semana resumida. */
export function TarjetaHoy({ supabase, onAbrir }) {
    const [inicio] = useState(() => lunes(new Date()));
    const { lista, error } = useSemana(supabase, inicio);
    const hoy = iso(new Date());
    const deHoy = (lista ?? []).filter((s) => s.scheduled_date === hoy);
    return (_jsxs("div", { className: "flex flex-col gap-3", children: [error && !lista && _jsx("p", { className: "bg-white rounded-2xl p-4 text-texto-suave", children: "Sin conexi\u00F3n. Abre la app con internet al menos una vez para tener tu semana guardada." }), !lista && !error && _jsx("div", { className: "bg-white rounded-2xl p-5 text-texto-suave", children: "Cargando\u2026" }), lista && deHoy.length === 0 && (_jsxs("div", { className: "bg-white rounded-2xl p-5", children: [_jsx("div", { className: "text-xs font-bold tracking-wide text-texto-suave", children: "HOY" }), _jsx("p", { className: "text-lg font-semibold mt-1", children: "Hoy no tienes entrenamiento." }), _jsx("p", { className: "text-sm text-texto-suave", children: "Descansar tambi\u00E9n forma parte del plan." })] })), deHoy.map((s) => (_jsxs("div", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", children: [_jsxs("div", { className: "text-xs font-bold tracking-wide text-texto-suave", children: ["HOY \u00B7 ", s.ejercicios, " EJERCICIOS"] }), s.programa && _jsxs("div", { className: "text-sm text-texto-suave -mt-2", children: [s.programa.nombre, " \u00B7 semana ", s.programa.semana, " de ", s.programa.semanas] }), _jsx("h2", { className: "text-2xl font-bold leading-tight", children: s.name }), s.coach_message && _jsx("p", { className: "border-l-4 border-mostaza pl-3", children: s.coach_message }), _jsx("button", { onClick: () => onAbrir(s.id), className: `py-4 rounded-2xl text-lg font-bold ${s.status === 'completed' ? 'bg-fondo text-petroleo' : 'bg-mostaza text-[#1F2424]'}`, children: s.status === 'completed' ? 'Hecho · ver registro' : s.status === 'in_progress' ? 'Continuar' : 'Empezar entrenamiento' })] }, s.id))), lista && (_jsxs("div", { className: "bg-white rounded-2xl p-4", "aria-label": "Tu semana", children: [_jsx("div", { className: "text-xs font-bold tracking-wide text-texto-suave mb-3", children: "ESTA SEMANA" }), _jsx("div", { className: "grid grid-cols-7 gap-1 text-center", children: Array.from({ length: 7 }, (_, i) => {
                            const f = iso(sumarDias(inicio, i));
                            const d = lista.filter((s) => s.scheduled_date === f);
                            const hecho = d.length > 0 && d.every((s) => s.status === 'completed');
                            return (_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("span", { className: `text-[11px] font-semibold ${f === hoy ? 'text-petroleo' : 'text-texto-suave'}`, children: DIAS_CORTOS[i].charAt(0) }), _jsx("span", { "aria-label": `${DIAS_CORTOS[i]}: ${d.length ? (hecho ? 'hecho' : 'pendiente') : 'descanso'}`, className: `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${hecho ? 'bg-petroleo text-white' : d.length ? 'border-2 border-petroleo text-petroleo' : 'bg-fondo'} ${f === hoy ? 'ring-2 ring-mostaza' : ''}`, children: hecho ? '✓' : '' })] }, f));
                        }) })] }))] }));
}
/** Pantalla "Mi semana". */
export function MiSemana({ supabase, onAbrir }) {
    const [inicio, setInicio] = useState(() => lunes(new Date()));
    const { lista } = useSemana(supabase, inicio);
    const hoy = iso(new Date());
    return (_jsxs("div", { className: "flex flex-col", children: [_jsxs("header", { className: "bg-petroleo text-white px-3 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-center justify-between", children: [_jsx("button", { "aria-label": "Semana anterior", onClick: () => setInicio(sumarDias(inicio, -7)), className: "w-11 h-11 text-2xl font-bold", children: "\u2039" }), _jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-xl font-bold", children: "Mi semana" }), _jsx("p", { className: "text-sm text-[#E3E8E8]", children: rangoSemana(inicio) })] }), _jsx("button", { "aria-label": "Semana siguiente", onClick: () => setInicio(sumarDias(inicio, 7)), className: "w-11 h-11 text-2xl font-bold", children: "\u203A" })] }), _jsxs("div", { className: "p-4 flex flex-col gap-2", children: [!lista && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), lista && Array.from({ length: 7 }, (_, i) => {
                        const d = sumarDias(inicio, i);
                        const f = iso(d);
                        const delDia = lista.filter((s) => s.scheduled_date === f);
                        if (!delDia.length) {
                            return (_jsxs("div", { className: "bg-[#F6F6F6] rounded-2xl px-4 py-3 flex items-center gap-4", children: [_jsx(Dia, { i: i, d: d, apagado: true }), _jsx("span", { className: "text-texto-suave", children: "Descanso" })] }, f));
                        }
                        return delDia.map((s) => (_jsxs("button", { onClick: () => onAbrir(s.id), className: `bg-white rounded-2xl px-4 py-3.5 flex items-center gap-4 text-left ${f === hoy ? 'ring-2 ring-petroleo' : ''}`, children: [_jsx(Dia, { i: i, d: d }), _jsxs("span", { className: "flex-1", children: [_jsx("span", { className: "block font-bold", children: s.name }), _jsxs("span", { className: "block text-sm text-texto-suave", children: [s.ejercicios, " ejercicios", s.programa ? ` · semana ${s.programa.semana} de ${s.programa.semanas}` : ''] })] }), f === hoy && s.status !== 'completed' ? (_jsx("span", { className: "text-xs font-bold bg-mostaza text-[#1F2424] px-2.5 py-1 rounded-full", children: "HOY" })) : (_jsx("span", { className: `text-xs font-bold ${s.status === 'completed' ? 'text-petroleo' : 'text-texto-suave'}`, children: ESTADO[s.status] }))] }, s.id)));
                    })] })] }));
}
function Dia({ i, d, apagado }) {
    return (_jsxs("span", { className: "w-11 flex flex-col items-center", children: [_jsx("span", { className: "text-xs font-semibold text-texto-suave", children: DIAS_CORTOS[i] }), _jsx("span", { className: `text-xl font-bold ${apagado ? 'text-texto-suave' : ''}`, children: d.getDate() })] }));
}
