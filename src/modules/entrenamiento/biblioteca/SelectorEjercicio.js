import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { duracion, miniatura } from './youtube';
const normal = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let cache = null;
/** Lista de ejercicios activos de la biblioteca, cargada una vez por sesión. */
export function useEjercicios(supabase) {
    const [lista, setLista] = useState(cache);
    useEffect(() => {
        if (cache)
            return;
        supabase
            .from('exercises')
            .select('id, name, video_id, duration_seconds, muscle_groups, equipment')
            .eq('is_archived', false)
            .order('name')
            .then(({ data }) => { cache = data ?? []; setLista(cache); });
    }, [supabase]);
    return lista;
}
/** Ventana para elegir un ejercicio de la biblioteca. */
export default function SelectorEjercicio({ supabase, onElegir, onCerrar }) {
    const lista = useEjercicios(supabase);
    const [q, setQ] = useState('');
    const vis = useMemo(() => {
        const n = normal(q.trim());
        return (lista ?? []).filter((e) => !n || normal(e.name).includes(n) || [...e.muscle_groups, ...e.equipment].some((t) => normal(t).includes(n)));
    }, [lista, q]);
    useEffect(() => {
        const esc = (e) => e.key === 'Escape' && onCerrar();
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onCerrar]);
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": "Elegir ejercicio", className: "fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6", onClick: onCerrar, children: _jsxs("div", { className: "bg-fondo w-full sm:max-w-2xl h-[90vh] sm:h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl p-5", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between gap-3 mb-3", children: [_jsx("h3", { className: "text-xl font-bold", children: "Elegir ejercicio" }), _jsx("button", { onClick: onCerrar, className: "text-petroleo font-bold px-2 py-1", children: "Cerrar" })] }), _jsx("input", { autoFocus: true, type: "search", value: q, onChange: (e) => setQ(e.target.value), placeholder: "Buscar", "aria-label": "Buscar ejercicio", className: "text-base px-4 py-3 border border-borde rounded-xl bg-white mb-3" }), _jsxs("ul", { className: "flex-1 overflow-y-auto flex flex-col gap-2", children: [!lista && _jsx("li", { className: "text-texto-suave", children: "Cargando\u2026" }), vis.map((e) => (_jsx("li", { children: _jsxs("button", { onClick: () => onElegir(e), className: "w-full flex items-center gap-3 bg-white rounded-xl p-2 text-left", children: [_jsx("div", { className: "w-12 h-16 rounded-lg overflow-hidden bg-gris-claro shrink-0", children: e.video_id && _jsx("img", { src: miniatura(e.video_id), alt: "", loading: "lazy", className: "w-full h-full object-cover" }) }), _jsx("span", { className: "flex-1 font-semibold leading-snug", children: e.name }), _jsx("span", { className: "text-xs text-texto-suave pr-2", children: duracion(e.duration_seconds) })] }) }, e.id)))] })] }) }));
}
