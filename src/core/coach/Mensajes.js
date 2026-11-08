import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import Conversacion from '../mensajes/Conversacion';
const cuando = (f) => {
    const d = new Date(f);
    return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};
export default function Mensajes({ supabase, yo, abrirId, onAbrirFicha }) {
    const [filas, setFilas] = useState(null);
    const [abierto, setAbierto] = useState(abrirId ?? null);
    const cargar = useCallback(async () => {
        const [p, m, w] = await Promise.all([
            supabase.from('profiles').select('id, full_name, status').eq('role', 'patient').neq('status', 'archived').order('full_name'),
            supabase.from('messages').select('patient_id, sender_id, body, read_at, created_at').order('created_at', { ascending: false }).limit(1000),
            supabase.from('workouts').select('patient_id, scheduled_date').eq('status', 'completed').order('scheduled_date', { ascending: false }).limit(500),
        ]);
        const ms = m.data ?? [];
        const ws = w.data ?? [];
        const fs = (p.data ?? []).map((pac) => ({
            p: pac,
            ultimo: ms.find((x) => x.patient_id === pac.id) ?? null,
            sinLeer: ms.filter((x) => x.patient_id === pac.id && x.sender_id === pac.id && !x.read_at).length,
            ultimaSesion: ws.find((x) => x.patient_id === pac.id)?.scheduled_date ?? null,
        }));
        fs.sort((a, b) => (b.sinLeer > 0 ? 1 : 0) - (a.sinLeer > 0 ? 1 : 0) || (b.ultimo?.created_at ?? '').localeCompare(a.ultimo?.created_at ?? '') || a.p.full_name.localeCompare(b.p.full_name, 'es'));
        setFilas(fs);
    }, [supabase]);
    useEffect(() => {
        cargar();
        const t = window.setInterval(cargar, 30000);
        return () => window.clearInterval(t);
    }, [cargar]);
    const actual = filas?.find((f) => f.p.id === abierto) ?? null;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("h2", { className: "text-2xl font-bold", children: "Mensajes" }), _jsxs("div", { className: "bg-white rounded-2xl overflow-hidden grid md:grid-cols-[18rem_1fr] h-[calc(100dvh-13rem)] min-h-[28rem]", children: [_jsxs("ul", { className: `border-r border-fondo overflow-y-auto ${actual ? 'hidden md:block' : ''}`, "aria-label": "Conversaciones", children: [!filas && _jsx("li", { className: "p-4 text-texto-suave", children: "Cargando\u2026" }), filas?.length === 0 && _jsx("li", { className: "p-4 text-texto-suave", children: "A\u00FAn no tienes pacientes." }), filas?.map((f) => (_jsx("li", { children: _jsxs("button", { onClick: () => setAbierto(f.p.id), className: `w-full text-left px-4 py-3 border-b border-fondo flex gap-3 items-start ${abierto === f.p.id ? 'bg-[#F4F1E4]' : ''}`, children: [_jsx("span", { className: "w-9 h-9 rounded-full bg-petroleo text-white font-bold flex items-center justify-center shrink-0", children: f.p.full_name.charAt(0).toUpperCase() }), _jsxs("span", { className: "flex-1 min-w-0", children: [_jsxs("span", { className: "flex justify-between gap-2", children: [_jsx("span", { className: `truncate ${f.sinLeer ? 'font-bold' : 'font-semibold'}`, children: f.p.full_name }), f.ultimo && _jsx("span", { className: "text-[11px] text-texto-suave shrink-0", children: cuando(f.ultimo.created_at) })] }), _jsxs("span", { className: "flex justify-between gap-2", children: [_jsx("span", { className: `text-sm truncate ${f.sinLeer ? 'text-[#4A4A4C]' : 'text-texto-suave'}`, children: f.ultimo ? `${f.ultimo.sender_id === yo ? 'Tú: ' : ''}${f.ultimo.body}` : 'Sin mensajes' }), f.sinLeer > 0 && _jsx("span", { className: "shrink-0 bg-mostaza text-[#1F2424] text-xs font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center", children: f.sinLeer })] })] })] }) }, f.p.id)))] }), _jsx("div", { className: `flex flex-col min-h-0 bg-fondo ${actual ? '' : 'hidden md:flex'}`, children: actual ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "bg-white px-4 py-3 border-b border-fondo flex items-center gap-3", children: [_jsx("button", { onClick: () => setAbierto(null), className: "md:hidden text-petroleo font-bold", "aria-label": "Volver a la lista", children: "\u2190" }), _jsxs("span", { className: "flex-1 min-w-0", children: [_jsx("span", { className: "block font-bold truncate", children: actual.p.full_name }), _jsxs("span", { className: "block text-xs text-texto-suave", children: [actual.ultimaSesion ? `Última sesión hecha: ${new Date(`${actual.ultimaSesion}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Aún no ha hecho ninguna sesión', actual.p.status !== 'active' ? ' · en pausa' : ''] })] }), _jsx("button", { onClick: () => onAbrirFicha(actual.p.id), className: "text-sm font-bold text-petroleo border-2 border-petroleo rounded-xl px-3 py-1.5", children: "Ver ficha" })] }), _jsx(Conversacion, { supabase: supabase, pacienteId: actual.p.id, yo: yo, esCoach: true, alto: "flex-1", onLeidos: cargar }, actual.p.id)] })) : (_jsx("p", { className: "m-auto text-texto-suave", children: "Elige un paciente para ver la conversaci\u00F3n." })) })] })] }));
}
