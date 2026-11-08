import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import SelectorEjercicio from '../biblioteca/SelectorEjercicio';
import { miniatura } from '../biblioteca/youtube';
import { desdeIso, hoyIso, iso, sumarDias } from '../../../lib/fechas';
import { comoLista } from '../paciente/datos';
export default function CambiarEjercicio({ supabase, pacienteId, onCerrar, onHecho }) {
    const [filas, setFilas] = useState(null);
    const [origen, setOrigen] = useState('');
    const [destino, setDestino] = useState(null);
    const [eligiendo, setEligiendo] = useState(false);
    // Por defecto desde mañana: hoy el paciente puede estar entrenando sin conexión
    const [desde, setDesde] = useState(iso(sumarDias(new Date(), 1)));
    const [carga, setCarga] = useState('mantener');
    const [kg, setKg] = useState('');
    const [cambiarIndicacion, setCambiarIndicacion] = useState(false);
    const [indicacion, setIndicacion] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        supabase
            .from('workouts')
            .select('scheduled_date, workout_blocks(workout_items(exercise_id, exercises(id, name, video_id, duration_seconds, muscle_groups, equipment), set_logs(count), workout_item_feedback(count)))')
            .eq('patient_id', pacienteId)
            .eq('status', 'scheduled')
            .gte('scheduled_date', hoyIso())
            .order('scheduled_date')
            .then(({ data }) => setFilas(data ?? []));
    }, [supabase, pacienteId]);
    // Ejercicios que aparecen en sesiones pendientes (sin registros), con sus fechas
    const usos = useMemo(() => {
        const m = new Map();
        for (const w of filas ?? []) {
            if (w.scheduled_date < desde)
                continue;
            for (const b of w.workout_blocks)
                for (const i of b.workout_items) {
                    const conRegistros = (comoLista(i.set_logs)[0]?.count ?? 0) > 0 || (comoLista(i.workout_item_feedback)[0]?.count ?? 0) > 0;
                    if (conRegistros)
                        continue;
                    const u = m.get(i.exercise_id) ?? { ejercicio: i.exercises, fechas: [] };
                    if (!u.fechas.includes(w.scheduled_date))
                        u.fechas.push(w.scheduled_date);
                    m.set(i.exercise_id, u);
                }
        }
        return [...m.values()].sort((a, b) => a.ejercicio.name.localeCompare(b.ejercicio.name, 'es'));
    }, [filas, desde]);
    const elegido = usos.find((u) => u.ejercicio.id === origen);
    const fmt = (f) => desdeIso(f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    async function confirmar() {
        setError('');
        if (!elegido || !destino)
            return;
        if (carga === 'nueva' && !kg.trim())
            return setError('Escribe la carga nueva o elige otra opción.');
        setEnviando(true);
        const { data, error } = await supabase.rpc('replace_exercise', {
            p_patient: pacienteId, p_from: elegido.ejercicio.id, p_to: destino.id, p_from_date: desde,
            p_load_kg: carga === 'nueva' ? Number(kg.replace(',', '.')) : null,
            p_clear_load: carga === 'quitar',
            p_instructions: cambiarIndicacion ? indicacion : null,
        });
        setEnviando(false);
        if (error)
            return setError('No se ha podido cambiar. Inténtalo de nuevo.');
        onHecho(`«${elegido.ejercicio.name}» cambiado por «${destino.name}» en ${data} ${data === 1 ? 'sitio' : 'sitios'} de sus sesiones pendientes.`);
    }
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": "Cambiar un ejercicio", className: "fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6", onClick: onCerrar, children: _jsxs("div", { className: "bg-fondo w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-4", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold leading-tight", children: "Cambiar un ejercicio en todo su plan" }), _jsx("p", { className: "text-sm text-texto-suave", children: "Solo en sesiones pendientes. Lo ya hecho o registrado no se toca." })] }), _jsx("button", { onClick: onCerrar, className: "text-petroleo font-bold px-2", children: "Cerrar" })] }), !filas && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), filas && usos.length === 0 && _jsx("p", { className: "bg-white rounded-xl p-4 text-texto-suave", children: "No tiene sesiones pendientes desde esa fecha." }), usos.length > 0 && (_jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("h4", { className: "text-sm font-semibold", children: "1. Qu\u00E9 ejercicio quieres quitar" }), _jsx("ul", { className: "flex flex-col gap-1.5 max-h-64 overflow-y-auto", children: usos.map((u) => (_jsx("li", { children: _jsxs("label", { className: `flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer ${origen === u.ejercicio.id ? 'bg-petroleo text-white' : 'bg-white'}`, children: [_jsx("input", { type: "radio", name: "origen", checked: origen === u.ejercicio.id, onChange: () => setOrigen(u.ejercicio.id), className: "sr-only" }), _jsx("span", { className: "flex-1 font-semibold leading-snug", children: u.ejercicio.name }), _jsxs("span", { className: `text-xs ${origen === u.ejercicio.id ? 'text-[#E3E8E8]' : 'text-texto-suave'}`, children: [u.fechas.length, " ", u.fechas.length === 1 ? 'sesión' : 'sesiones'] })] }) }, u.ejercicio.id))) })] })), elegido && (_jsxs(_Fragment, { children: [_jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("h4", { className: "text-sm font-semibold", children: "2. Por cu\u00E1l" }), destino ? (_jsxs("div", { className: "bg-white rounded-xl p-3 flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-14 rounded-md overflow-hidden bg-gris-claro shrink-0", children: destino.video_id && _jsx("img", { src: miniatura(destino.video_id), alt: "", className: "w-full h-full object-cover" }) }), _jsx("span", { className: "flex-1 font-semibold", children: destino.name }), _jsx("button", { onClick: () => setEligiendo(true), className: "text-petroleo font-bold text-sm", children: "Cambiar" })] })) : (_jsx("button", { onClick: () => setEligiendo(true), className: "self-start text-petroleo font-bold px-4 py-2.5 rounded-xl border-2 border-petroleo", children: "Elegir de la biblioteca" }))] }), _jsxs("section", { className: "bg-white rounded-xl p-4 flex flex-col gap-3", children: [_jsx("h4", { className: "text-sm font-semibold", children: "3. Ajustes (series, repeticiones y descanso se mantienen)" }), _jsxs("div", { className: "flex flex-wrap gap-2 items-center text-sm", children: [_jsx("span", { className: "font-semibold mr-1", children: "Carga:" }), ['mantener', 'quitar', 'nueva'].map((c) => (_jsx("button", { "aria-pressed": carga === c, onClick: () => setCarga(c), className: `px-3 py-1.5 rounded-lg font-semibold ${carga === c ? 'bg-petroleo text-white' : 'bg-fondo'}`, children: c === 'mantener' ? 'Mantener' : c === 'quitar' ? 'Sin carga' : 'Nueva' }, c))), carga === 'nueva' && (_jsxs("label", { className: "flex items-center gap-1", children: [_jsx("input", { inputMode: "decimal", value: kg, onChange: (e) => setKg(e.target.value.replace(/[^\d.,]/g, '')), "aria-label": "Carga nueva en kilos", className: "w-20 px-2 py-1.5 border border-borde rounded-lg" }), " kg"] }))] }), _jsxs("label", { className: "flex items-center gap-2 text-sm font-semibold", children: [_jsx("input", { type: "checkbox", checked: cambiarIndicacion, onChange: (e) => setCambiarIndicacion(e.target.checked), className: "w-5 h-5 accent-[#374949]" }), "Cambiar la indicaci\u00F3n para el paciente"] }), cambiarIndicacion && (_jsx("input", { value: indicacion, onChange: (e) => setIndicacion(e.target.value), placeholder: "D\u00E9jalo vac\u00EDo para quitarla", className: "px-3 py-2 border border-borde rounded-lg" })), _jsxs("label", { className: "flex items-center gap-2 text-sm font-semibold", children: ["Desde", _jsx("input", { type: "date", min: hoyIso(), value: desde, onChange: (e) => e.target.value && setDesde(e.target.value), className: "font-normal px-2 py-1.5 border border-borde rounded-lg" })] })] }), _jsxs("p", { className: "text-sm", children: ["Se cambiar\u00E1 en ", elegido.fechas.length, " ", elegido.fechas.length === 1 ? 'sesión' : 'sesiones', ":", ' ', _jsx("span", { className: "text-texto-suave", children: elegido.fechas.length <= 6 ? elegido.fechas.map(fmt).join(', ') : `del ${fmt(elegido.fechas[0])} al ${fmt(elegido.fechas[elegido.fechas.length - 1])}` })] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: confirmar, disabled: !destino || enviando, className: "self-end bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-50", children: enviando ? 'Cambiando…' : 'Cambiar en todas' })] })), eligiendo && (_jsx(SelectorEjercicio, { supabase: supabase, onCerrar: () => setEligiendo(false), onElegir: (e) => { if (e.id === origen) {
                        setError('Elige un ejercicio distinto.');
                    }
                    else {
                        setDestino(e);
                        setError('');
                    } setEligiendo(false); } }))] }) }));
}
