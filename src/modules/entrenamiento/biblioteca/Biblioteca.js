import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { duracion, idDeYoutube, miniatura, tituloDeYoutube, urlReproductor } from './youtube';
const CAMPOS = 'id, name, description, video_provider, video_id, duration_seconds, muscle_groups, equipment, is_archived';
const normal = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lista = (t) => [...new Set(t.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))];
export default function Biblioteca({ supabase }) {
    const [ejercicios, setEjercicios] = useState(null);
    const [error, setError] = useState('');
    const [busca, setBusca] = useState('');
    const [etiqueta, setEtiqueta] = useState(null);
    const [archivados, setArchivados] = useState(false);
    const [abierto, setAbierto] = useState(null);
    const [nuevo, setNuevo] = useState(false);
    async function cargar() {
        const { data, error } = await supabase.from('exercises').select(CAMPOS).order('name');
        if (error)
            setError('No se ha podido cargar la biblioteca. Revisa la conexión.');
        else
            setEjercicios(data);
    }
    useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const etiquetas = useMemo(() => {
        const c = new Map();
        (ejercicios ?? []).filter((e) => !e.is_archived).forEach((e) => [...e.muscle_groups, ...e.equipment].forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
        return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    }, [ejercicios]);
    const visibles = useMemo(() => {
        const q = normal(busca.trim());
        return (ejercicios ?? []).filter((e) => e.is_archived === archivados &&
            (!q || normal(e.name).includes(q) || [...e.muscle_groups, ...e.equipment].some((t) => normal(t).includes(q))) &&
            (!etiqueta || e.muscle_groups.includes(etiqueta) || e.equipment.includes(etiqueta)));
    }, [ejercicios, busca, etiqueta, archivados]);
    function actualizarLocal(e) {
        setEjercicios((prev) => (prev ?? []).map((x) => (x.id === e.id ? e : x)).sort((a, b) => a.name.localeCompare(b.name, 'es')));
    }
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold", children: "Biblioteca de ejercicios" }), _jsx("p", { className: "text-sm text-texto-suave", children: ejercicios ? `${ejercicios.filter((e) => !e.is_archived).length} ejercicios` : 'Cargando…' })] }), _jsx("button", { onClick: () => setNuevo(true), className: "bg-mostaza text-[#1F2424] font-bold px-4 py-3 rounded-xl", children: "A\u00F1adir ejercicio" })] }), _jsx("input", { type: "search", value: busca, onChange: (e) => setBusca(e.target.value), placeholder: "Buscar por nombre, m\u00FAsculo o material", "aria-label": "Buscar ejercicios", className: "text-base px-4 py-3 border border-borde rounded-xl bg-white" }), etiquetas.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", "aria-label": "Filtrar por etiqueta", children: etiquetas.slice(0, 24).map((t) => (_jsx("button", { onClick: () => setEtiqueta(etiqueta === t ? null : t), "aria-pressed": etiqueta === t, className: `px-3 py-1.5 rounded-full text-sm font-semibold border-2 ${etiqueta === t ? 'bg-petroleo text-white border-petroleo' : 'bg-white border-gris-claro'}`, children: t }, t))) })), _jsxs("label", { className: "flex items-center gap-2 text-sm text-texto-suave self-start", children: [_jsx("input", { type: "checkbox", checked: archivados, onChange: (e) => setArchivados(e.target.checked) }), "Ver archivados"] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), ejercicios && visibles.length === 0 && (_jsx("p", { className: "text-texto-suave", children: "No hay ejercicios con ese filtro." })), _jsx("ul", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3", children: visibles.map((e) => (_jsx("li", { children: _jsxs("button", { onClick: () => setAbierto(e), className: "w-full text-left bg-white rounded-2xl overflow-hidden flex flex-col", children: [_jsxs("div", { className: "relative aspect-[9/12] bg-gris-claro", children: [e.video_id && (_jsx("img", { src: miniatura(e.video_id), alt: "", loading: "lazy", className: "absolute inset-0 w-full h-full object-cover" })), e.duration_seconds != null && (_jsx("span", { className: "absolute bottom-2 right-2 bg-black/70 text-white text-xs font-semibold px-1.5 py-0.5 rounded", children: duracion(e.duration_seconds) }))] }), _jsx("span", { className: "p-3 text-sm font-semibold leading-snug", children: e.name })] }) }, e.id))) }), abierto && (_jsx(Ficha, { supabase: supabase, ejercicio: abierto, onCerrar: () => setAbierto(null), onGuardado: (e) => { actualizarLocal(e); setAbierto(null); } })), nuevo && (_jsx(Nuevo, { supabase: supabase, existentes: ejercicios ?? [], onCerrar: () => setNuevo(false), onCreado: (e) => { setEjercicios((p) => [...(p ?? []), e].sort((a, b) => a.name.localeCompare(b.name, 'es'))); setNuevo(false); setAbierto(e); } }))] }));
}
function Ventana({ titulo, onCerrar, children }) {
    useEffect(() => {
        const esc = (e) => e.key === 'Escape' && onCerrar();
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onCerrar]);
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": titulo, className: "fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6", onClick: onCerrar, children: _jsxs("div", { className: "bg-fondo w-full sm:max-w-3xl max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between gap-3 mb-4", children: [_jsx("h3", { className: "text-xl font-bold leading-tight", children: titulo }), _jsx("button", { onClick: onCerrar, className: "text-petroleo font-bold px-2 py-1", "aria-label": "Cerrar", children: "Cerrar" })] }), children] }) }));
}
function Reproductor({ id }) {
    return (_jsx("div", { className: "mx-auto w-full max-w-[300px] aspect-[9/16] bg-black rounded-2xl overflow-hidden", children: _jsx("iframe", { src: urlReproductor(id), title: "V\u00EDdeo del ejercicio", allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowFullScreen: true, className: "w-full h-full border-0" }) }));
}
function Ficha({ supabase, ejercicio, onCerrar, onGuardado }) {
    const [nombre, setNombre] = useState(ejercicio.name);
    const [musculos, setMusculos] = useState(ejercicio.muscle_groups.join(', '));
    const [material, setMaterial] = useState(ejercicio.equipment.join(', '));
    const [indicaciones, setIndicaciones] = useState(ejercicio.description ?? '');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    async function guardar(cambios) {
        setGuardando(true);
        setError('');
        const { data, error } = await supabase.from('exercises').update(cambios).eq('id', ejercicio.id).select(CAMPOS).single();
        setGuardando(false);
        if (error) {
            setError(error.code === '23505' ? 'Ya hay otro ejercicio con ese nombre.' : 'No se ha podido guardar.');
            return;
        }
        onGuardado(data);
    }
    function enviar(e) {
        e.preventDefault();
        if (!nombre.trim())
            return setError('El nombre no puede quedar vacío.');
        guardar({ name: nombre.trim(), muscle_groups: lista(musculos), equipment: lista(material), description: indicaciones.trim() || null });
    }
    return (_jsx(Ventana, { titulo: ejercicio.name, onCerrar: onCerrar, children: _jsxs("div", { className: "grid sm:grid-cols-[300px_1fr] gap-5", children: [ejercicio.video_id ? _jsx(Reproductor, { id: ejercicio.video_id }) : _jsx("div", { className: "text-texto-suave", children: "Sin v\u00EDdeo" }), _jsxs("form", { onSubmit: enviar, className: "flex flex-col gap-3", children: [_jsx(Campo, { etiqueta: "Nombre", valor: nombre, onCambio: setNombre }), _jsx(Campo, { etiqueta: "Grupos musculares", ayuda: "Separados por comas. Ej.: gl\u00FAteo, core", valor: musculos, onCambio: setMusculos }), _jsx(Campo, { etiqueta: "Material", ayuda: "Separado por comas. Ej.: kettlebell, el\u00E1stico", valor: material, onCambio: setMaterial }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Indicaciones para el paciente", _jsx("textarea", { value: indicaciones, onChange: (e) => setIndicaciones(e.target.value), rows: 3, className: "font-normal text-base px-3 py-2 border border-borde rounded-xl bg-white" })] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsxs("div", { className: "flex flex-wrap gap-2 pt-1", children: [_jsx("button", { type: "submit", disabled: guardando, className: "bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60", children: guardando ? 'Guardando…' : 'Guardar' }), _jsx("button", { type: "button", disabled: guardando, onClick: () => guardar({ is_archived: !ejercicio.is_archived }), className: "bg-white text-petroleo border-2 border-petroleo font-bold px-5 py-3 rounded-xl", children: ejercicio.is_archived ? 'Recuperar' : 'Archivar' })] }), !ejercicio.is_archived && (_jsx("p", { className: "text-xs text-texto-suave", children: "Archivar lo quita de la biblioteca sin borrarlo. Los entrenamientos que ya lo usan no cambian." }))] })] }) }));
}
function Campo({ etiqueta, ayuda, valor, onCambio }) {
    return (_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: [etiqueta, _jsx("input", { value: valor, onChange: (e) => onCambio(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" }), ayuda && _jsx("span", { className: "font-normal text-xs text-texto-suave", children: ayuda })] }));
}
function Nuevo({ supabase, existentes, onCerrar, onCreado }) {
    const [enlace, setEnlace] = useState('');
    const [nombre, setNombre] = useState('');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);
    const id = idDeYoutube(enlace);
    const repetido = id ? existentes.find((e) => e.video_id === id) : undefined;
    useEffect(() => {
        if (!id || repetido || nombre)
            return;
        let vivo = true;
        tituloDeYoutube(id).then((t) => { if (vivo && t)
            setNombre(t); });
        return () => { vivo = false; };
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
    async function crear(e) {
        e.preventDefault();
        setError('');
        if (!id)
            return setError('No reconozco ese enlace. Copia el enlace del Short desde YouTube.');
        if (repetido)
            return setError(`Ese vídeo ya está en la biblioteca como «${repetido.name}».`);
        if (!nombre.trim())
            return setError('Escribe un nombre para el ejercicio.');
        setGuardando(true);
        const { data, error } = await supabase
            .from('exercises')
            .insert({ name: nombre.trim(), video_provider: 'youtube', video_id: id })
            .select(CAMPOS)
            .single();
        setGuardando(false);
        if (error)
            return setError(error.code === '23505' ? 'Ya hay un ejercicio con ese nombre o ese vídeo.' : 'No se ha podido guardar.');
        onCreado(data);
    }
    return (_jsx(Ventana, { titulo: "A\u00F1adir ejercicio", onCerrar: onCerrar, children: _jsxs("form", { onSubmit: crear, className: "flex flex-col gap-3", children: [_jsx(Campo, { etiqueta: "Enlace del Short de YouTube", ayuda: "Ej.: https://youtube.com/shorts/qygWuOFVg7g. El v\u00EDdeo debe estar como \u00ABOculto\u00BB o \u00ABP\u00FAblico\u00BB, no \u00ABPrivado\u00BB.", valor: enlace, onCambio: setEnlace }), id && !repetido && _jsx(Reproductor, { id: id }), _jsx(Campo, { etiqueta: "Nombre del ejercicio", valor: nombre, onCambio: setNombre }), repetido && _jsxs("p", { className: "font-semibold text-[#8A2C1D]", children: ["Ese v\u00EDdeo ya est\u00E1 en la biblioteca como \u00AB", repetido.name, "\u00BB."] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { type: "submit", disabled: guardando || !id || !!repetido, className: "bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl self-start disabled:opacity-60", children: guardando ? 'Guardando…' : 'Guardar en la biblioteca' })] }) }));
}
