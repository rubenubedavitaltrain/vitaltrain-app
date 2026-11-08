import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import EditorBloques, { COLUMNAS_ITEM, aGuardar, bloqueVacio, desdeFilas } from '../constructor/Bloques';
// Plantillas de entrenamiento por bloques. El coach las crea aquí y luego las asigna a un día del paciente.
// Asignar hace una copia: cambiar la plantilla después no cambia lo ya asignado.
export { TIPOS, DESCANSOS, textoDescanso } from '../constructor/Bloques';
export default function Plantillas({ supabase }) {
    const [lista, setLista] = useState(null);
    const [editando, setEditando] = useState(null);
    async function cargar() {
        const { data } = await supabase
            .from('templates')
            .select('id, name, description, updated_at, template_blocks(template_items(count))')
            .eq('is_archived', false)
            .order('name');
        setLista((data ?? []).map((t) => ({
            id: t.id, name: t.name, description: t.description, updated_at: t.updated_at,
            ejercicios: t.template_blocks.reduce((s, b) => s + (b.template_items[0]?.count ?? 0), 0)
        })));
    }
    useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    if (editando) {
        return _jsx(Editor, { supabase: supabase, id: editando === 'nueva' ? null : editando, onSalir: () => { setEditando(null); cargar(); } });
    }
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold", children: "Plantillas de entrenamiento" }), _jsx("p", { className: "text-sm text-texto-suave", children: "Entrenamientos por bloques que luego asignas a tus pacientes." })] }), _jsx("button", { onClick: () => setEditando('nueva'), className: "bg-mostaza text-[#1F2424] font-bold px-4 py-3 rounded-xl", children: "Nueva plantilla" })] }), !lista && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), lista && lista.length === 0 && (_jsx("div", { className: "bg-white rounded-2xl p-6 text-texto-suave", children: "A\u00FAn no tienes plantillas. Crea la primera con \u00ABNueva plantilla\u00BB." })), _jsx("ul", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-3", children: lista?.map((t) => (_jsx("li", { children: _jsxs("button", { onClick: () => setEditando(t.id), className: "w-full text-left bg-white rounded-2xl p-5 flex flex-col gap-1", children: [_jsx("span", { className: "text-lg font-bold", children: t.name }), _jsxs("span", { className: "text-sm text-texto-suave", children: [t.ejercicios, " ejercicios", t.description ? ` · ${t.description}` : ''] })] }) }, t.id))) })] }));
}
function Editor({ supabase, id, onSalir }) {
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [bloques, setBloques] = useState(id ? [] : [bloqueVacio('Bloque principal')]);
    const [cargando, setCargando] = useState(!!id);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState('');
    useEffect(() => {
        if (!id)
            return;
        supabase
            .from('templates')
            .select(`name, description, template_blocks(position, name, type, rounds, template_items(${COLUMNAS_ITEM}))`)
            .eq('id', id)
            .single()
            .then(({ data }) => {
            const t = data;
            if (!t)
                return;
            setNombre(t.name);
            setDescripcion(t.description ?? '');
            setBloques(desdeFilas(t.template_blocks.map((b) => ({ ...b, items: b.template_items }))));
            setCargando(false);
        });
    }, [id, supabase]);
    async function guardar() {
        setError('');
        setMensaje('');
        if (!nombre.trim())
            return setError('Ponle un nombre a la plantilla.');
        if (!bloques.some((b) => b.items.length))
            return setError('Añade al menos un ejercicio.');
        const p = {
            id, name: nombre, description: descripcion,
            blocks: aGuardar(bloques)
        };
        setGuardando(true);
        const { error } = await supabase.rpc('save_template', { p });
        setGuardando(false);
        if (error)
            return setError('No se ha podido guardar. Revisa los datos e inténtalo de nuevo.');
        onSalir();
    }
    async function archivar() {
        if (!id)
            return onSalir();
        const { error } = await supabase.from('templates').update({ is_archived: true }).eq('id', id);
        if (error)
            setError('No se ha podido archivar.');
        else
            onSalir();
    }
    if (cargando)
        return _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" });
    return (_jsxs("div", { className: "flex flex-col gap-4 pb-24", children: [_jsx("button", { onClick: onSalir, className: "self-start text-petroleo font-bold", children: "\u2190 Plantillas" }), _jsxs("div", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Nombre de la plantilla", _jsx("input", { value: nombre, onChange: (e) => setNombre(e.target.value), placeholder: "Fuerza A \u00B7 Tren inferior", className: "font-normal text-lg px-3 py-2.5 border border-borde rounded-xl" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Descripci\u00F3n (opcional, solo para ti)", _jsx("input", { value: descripcion, onChange: (e) => setDescripcion(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl" })] })] }), _jsx(EditorBloques, { supabase: supabase, bloques: bloques, setBloques: setBloques }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), mensaje && _jsx("p", { role: "status", children: mensaje }), _jsxs("div", { className: "fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex gap-2 justify-end z-40", children: [id && _jsx("button", { onClick: archivar, className: "mr-auto text-texto-suave font-semibold px-3", children: "Archivar" }), _jsx("button", { onClick: onSalir, className: "px-4 py-3 font-bold text-petroleo", children: "Cancelar" }), _jsx("button", { onClick: guardar, disabled: guardando, className: "bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-xl disabled:opacity-60", children: guardando ? 'Guardando…' : 'Guardar plantilla' })] })] }));
}
