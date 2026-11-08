import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { MOTIVOS } from '../paciente/tipos';
import { desdeIso } from '../../../lib/fechas';
export default function NotasDelPaciente({ supabase, pacienteId }) {
    const [filas, setFilas] = useState(null);
    async function cargar() {
        const { data } = await supabase
            .from('workout_item_feedback')
            .select('id, note, cannot_do, reason, read_by_coach_at, created_at, workout_items(exercises(name), workout_blocks(workouts(scheduled_date)))')
            .eq('patient_id', pacienteId)
            .order('updated_at', { ascending: false })
            .limit(30);
        setFilas(data ?? []);
    }
    useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
    async function marcarLeidas() {
        // Solo las que se están viendo: si llega otra mientras tanto, sigue sin leer
        const ids = (filas ?? []).filter((f) => !f.read_by_coach_at).map((f) => f.id);
        if (!ids.length)
            return;
        await supabase.from('workout_item_feedback').update({ read_by_coach_at: new Date().toISOString() }).in('id', ids);
        cargar();
    }
    const sinLeer = (filas ?? []).filter((f) => !f.read_by_coach_at).length;
    return (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "notas-paciente", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { id: "notas-paciente", className: "text-lg font-bold mr-auto", children: "Notas del paciente" }), sinLeer > 0 && _jsxs("button", { onClick: marcarLeidas, className: "text-sm font-bold text-petroleo", children: ["Marcar ", sinLeer, " como le\u00EDdas"] })] }), filas && filas.length === 0 && _jsx("p", { className: "text-sm text-texto-suave", children: "Todav\u00EDa no ha dejado notas en sus ejercicios." }), _jsx("ul", { className: "flex flex-col gap-2", children: filas?.map((f) => (_jsxs("li", { className: `text-sm rounded-xl p-3 ${f.read_by_coach_at ? 'bg-fondo' : 'bg-[#F4F1E4] border-l-4 border-mostaza'}`, children: [_jsx("div", { className: "font-semibold", children: f.workout_items.exercises.name }), _jsx("div", { className: "text-xs text-texto-suave", children: desdeIso(f.workout_items.workout_blocks.workouts.scheduled_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }), f.cannot_do && _jsxs("div", { className: "font-semibold text-[#8A2C1D]", children: ["No ha podido: ", f.reason ? MOTIVOS[f.reason] : 'sin motivo'] }), f.note && _jsxs("div", { children: ["\u00AB", f.note, "\u00BB"] })] }, f.id))) })] }));
}
