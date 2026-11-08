import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export function useModulosPaciente(supabase, pacienteId) {
    const [disponibles, setDisponibles] = useState([]);
    const [activos, setActivos] = useState(null);
    async function cargar() {
        const [m, pm] = await Promise.all([
            supabase.from('modules').select('slug, name, description').eq('is_available', true).order('name'),
            supabase.from('patient_modules').select('module_slug').eq('patient_id', pacienteId),
        ]);
        setDisponibles(m.data ?? []);
        setActivos(new Set((pm.data ?? []).map((x) => x.module_slug)));
    }
    useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
    return { disponibles, activos, recargar: cargar };
}
export default function ModulosPaciente({ supabase, pacienteId, disponibles, activos, onCambio }) {
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState(null);
    if (!activos)
        return null;
    async function cambiar(slug, on) {
        setError('');
        setOcupado(slug);
        const { error } = on
            ? await supabase.from('patient_modules').insert({ patient_id: pacienteId, module_slug: slug })
            : await supabase.from('patient_modules').delete().eq('patient_id', pacienteId).eq('module_slug', slug);
        setOcupado(null);
        if (error)
            setError('No se ha podido cambiar.');
        onCambio();
    }
    return (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "modulos", children: [_jsxs("div", { children: [_jsx("h3", { id: "modulos", className: "text-lg font-bold", children: "Qu\u00E9 ve en su app" }), _jsx("p", { className: "text-xs text-texto-suave", children: "Al quitar un m\u00F3dulo, el paciente deja de verlo y de poder anotar en \u00E9l. Sus datos se conservan." })] }), _jsx("ul", { className: "grid sm:grid-cols-2 gap-2", children: disponibles.map((m) => {
                    const on = activos.has(m.slug);
                    return (_jsx("li", { children: _jsxs("label", { className: `flex items-start gap-3 rounded-xl p-3 cursor-pointer ${on ? 'bg-fondo' : 'border border-gris-claro'}`, children: [_jsx("input", { type: "checkbox", checked: on, disabled: ocupado === m.slug, onChange: (e) => cambiar(m.slug, e.target.checked), className: "mt-0.5 w-5 h-5 accent-[#374949]" }), _jsxs("span", { children: [_jsx("span", { className: "block font-semibold", children: m.name }), m.description && _jsx("span", { className: "block text-xs text-texto-suave", children: m.description })] })] }) }, m.slug));
                }) }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error })] }));
}
