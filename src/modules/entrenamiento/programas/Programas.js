import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { DIAS_CORTOS } from '../../../lib/fechas';
const PCTS = [-40, -30, -20, -10, -5, 0, 5, 10, 15, 20];
const semanaVacia = () => ({ pct: 0, nota: '', dias: Array(7).fill(null) });
export default function Programas({ supabase }) {
    const [lista, setLista] = useState(null);
    const [editando, setEditando] = useState(null);
    async function cargar() {
        const { data } = await supabase.from('programs').select('id, name, description, weeks').eq('is_archived', false).order('name');
        setLista(data ?? []);
    }
    useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    if (editando)
        return _jsx(Editor, { supabase: supabase, id: editando === 'nuevo' ? null : editando, onSalir: () => { setEditando(null); cargar(); } });
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold", children: "Programas" }), _jsx("p", { className: "text-sm text-texto-suave", children: "De 1 a 12 semanas, con una regla de progresi\u00F3n por semana. Se asignan desde la ficha del paciente." })] }), _jsx("button", { onClick: () => setEditando('nuevo'), className: "bg-mostaza text-[#1F2424] font-bold px-4 py-3 rounded-xl", children: "Nuevo programa" })] }), !lista && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), lista && lista.length === 0 && _jsx("div", { className: "bg-white rounded-2xl p-6 text-texto-suave", children: "A\u00FAn no tienes programas. Primero crea las plantillas y luego rep\u00E1rtelas por semanas aqu\u00ED." }), _jsx("ul", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-3", children: lista?.map((p) => (_jsx("li", { children: _jsxs("button", { onClick: () => setEditando(p.id), className: "w-full text-left bg-white rounded-2xl p-5 flex flex-col gap-1", children: [_jsx("span", { className: "text-lg font-bold", children: p.name }), _jsxs("span", { className: "text-sm text-texto-suave", children: [p.weeks, " ", p.weeks === 1 ? 'semana' : 'semanas', p.description ? ` · ${p.description}` : ''] })] }) }, p.id))) })] }));
}
function Editor({ supabase, id, onSalir }) {
    const [plantillas, setPlantillas] = useState([]);
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [semanas, setSemanas] = useState([semanaVacia(), semanaVacia(), semanaVacia(), semanaVacia()]);
    const [cargando, setCargando] = useState(!!id);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        supabase.from('templates').select('id, name').eq('is_archived', false).order('name').then(({ data }) => setPlantillas(data ?? []));
        if (!id)
            return;
        supabase
            .from('programs')
            .select('name, description, weeks, program_weeks(week_number, load_change_pct, note), program_slots(week_number, day_of_week, template_id)')
            .eq('id', id)
            .single()
            .then(({ data }) => {
            const p = data;
            if (!p)
                return;
            setNombre(p.name);
            setDescripcion(p.description ?? '');
            setSemanas(Array.from({ length: p.weeks }, (_, i) => {
                const r = p.program_weeks.find((w) => w.week_number === i + 1);
                const dias = Array(7).fill(null);
                p.program_slots.filter((s) => s.week_number === i + 1).forEach((s) => { dias[s.day_of_week - 1] = s.template_id; });
                return { pct: Number(r?.load_change_pct ?? 0), nota: r?.note ?? '', dias };
            }));
            setCargando(false);
        });
    }, [id, supabase]);
    const cambiarDuracion = (n) => {
        const m = Math.min(12, Math.max(1, n));
        setSemanas((s) => (m > s.length ? [...s, ...Array.from({ length: m - s.length }, () => ({ ...semanaVacia(), dias: [...(s[s.length - 1]?.dias ?? Array(7).fill(null))] }))] : s.slice(0, m)));
    };
    const cambiar = (i, c) => setSemanas((s) => s.map((w, j) => (j === i ? { ...w, ...c } : w)));
    async function guardar() {
        setError('');
        if (!nombre.trim())
            return setError('Ponle un nombre al programa.');
        if (!semanas.some((w) => w.dias.some(Boolean)))
            return setError('Asigna al menos una plantilla a algún día.');
        const p = {
            id, name: nombre, description: descripcion, weeks: semanas.length,
            week_rules: semanas.map((w, i) => ({ week_number: i + 1, load_change_pct: w.pct, note: w.nota })),
            slots: semanas.flatMap((w, i) => w.dias.map((t, d) => (t ? { week_number: i + 1, day_of_week: d + 1, template_id: t } : null)).filter(Boolean))
        };
        setGuardando(true);
        const { error } = await supabase.rpc('save_program', { p });
        setGuardando(false);
        if (error)
            return setError('No se ha podido guardar el programa.');
        onSalir();
    }
    async function archivar() {
        if (!id)
            return onSalir();
        const { error } = await supabase.from('programs').update({ is_archived: true }).eq('id', id);
        if (error)
            setError('No se ha podido archivar.');
        else
            onSalir();
    }
    if (cargando)
        return _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" });
    const sesiones = semanas.reduce((n, w) => n + w.dias.filter(Boolean).length, 0);
    return (_jsxs("div", { className: "flex flex-col gap-4 pb-24", children: [_jsx("button", { onClick: onSalir, className: "self-start text-petroleo font-bold", children: "\u2190 Programas" }), _jsxs("div", { className: "bg-white rounded-2xl p-5 grid sm:grid-cols-[1fr_auto] gap-3 items-end", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Nombre del programa", _jsx("input", { value: nombre, onChange: (e) => setNombre(e.target.value), placeholder: "Fuerza base \u00B7 8 semanas", className: "font-normal text-lg px-3 py-2.5 border border-borde rounded-xl" })] }), _jsxs("div", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Duraci\u00F3n", _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { "aria-label": "Una semana menos", onClick: () => cambiarDuracion(semanas.length - 1), className: "w-11 h-11 rounded-xl bg-fondo text-xl font-bold", children: "\u2212" }), _jsxs("span", { className: "min-w-24 text-center text-lg", children: [semanas.length, " ", semanas.length === 1 ? 'semana' : 'semanas'] }), _jsx("button", { "aria-label": "Una semana m\u00E1s", onClick: () => cambiarDuracion(semanas.length + 1), className: "w-11 h-11 rounded-xl bg-fondo text-xl font-bold", children: "+" })] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold sm:col-span-2", children: ["Descripci\u00F3n (opcional, solo para ti)", _jsx("input", { value: descripcion, onChange: (e) => setDescripcion(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl" })] })] }), plantillas.length === 0 && _jsx("p", { className: "bg-white rounded-2xl p-4 text-texto-suave", children: "Para repartir sesiones necesitas plantillas. Cr\u00E9alas en la secci\u00F3n Plantillas." }), _jsxs("section", { className: "bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("h3", { className: "text-lg font-bold mr-auto", children: ["Semanas \u00B7 ", sesiones, " sesiones"] }), semanas.length > 1 && (_jsx("button", { onClick: () => setSemanas((s) => s.map((w, i) => (i === 0 ? w : { ...w, dias: [...s[0].dias] }))), className: "text-sm font-bold text-petroleo border-2 border-petroleo rounded-xl px-3 py-2", children: "Repetir los d\u00EDas de la semana 1 en todas" }))] }), _jsx("p", { className: "text-xs text-texto-suave", children: "\u00ABCarga\u00BB sube o baja los kilos de la plantilla esa semana (se redondea a 0,5 kg). La nota la ver\u00E1 el paciente en sus sesiones de esa semana." }), _jsx("div", { className: "overflow-x-auto -mx-1 px-1", children: _jsxs("table", { className: "w-full min-w-[1100px] border-separate border-spacing-1 text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs text-texto-suave", children: [_jsx("th", { scope: "col", className: "text-left font-semibold w-16", children: "Semana" }), DIAS_CORTOS.map((d) => _jsx("th", { scope: "col", className: "font-semibold", children: d }, d)), _jsx("th", { scope: "col", className: "font-semibold w-24", children: "Carga" }), _jsx("th", { scope: "col", className: "text-left font-semibold min-w-56", children: "Nota para el paciente" })] }) }), _jsx("tbody", { children: semanas.map((w, i) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", className: "text-left font-bold", children: i + 1 }), w.dias.map((t, d) => (_jsx("td", { children: _jsxs("select", { "aria-label": `Semana ${i + 1}, ${DIAS_CORTOS[d]}`, title: plantillas.find((p) => p.id === t)?.name ?? 'Descanso', value: t ?? '', onChange: (e) => cambiar(i, { dias: w.dias.map((x, k) => (k === d ? e.target.value || null : x)) }), className: `w-full px-1.5 py-2 rounded-lg border text-xs ${t ? 'bg-petroleo text-white border-petroleo font-semibold' : 'bg-fondo border-transparent text-texto-suave'}`, children: [_jsx("option", { value: "", children: "Descanso" }), plantillas.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] }) }, d))), _jsx("td", { children: _jsx("select", { "aria-label": `Carga semana ${i + 1}`, value: w.pct, onChange: (e) => cambiar(i, { pct: Number(e.target.value) }), className: `w-full px-1.5 py-2 rounded-lg border border-borde ${w.pct < 0 ? 'text-[#2E6B8A]' : w.pct > 0 ? 'text-petroleo font-bold' : ''}`, children: PCTS.map((p) => _jsx("option", { value: p, children: p > 0 ? `+${p} %` : p < 0 ? `${p} %` : 'Igual' }, p)) }) }), _jsx("td", { children: _jsx("input", { "aria-label": `Nota semana ${i + 1}`, value: w.nota, maxLength: 300, onChange: (e) => cambiar(i, { nota: e.target.value }), placeholder: w.pct < 0 ? 'Semana de descarga' : '', className: "w-full px-2 py-2 rounded-lg border border-borde" }) })] }, i))) })] }) })] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsxs("div", { className: "fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex gap-2 justify-end z-40", children: [id && _jsx("button", { onClick: archivar, className: "mr-auto text-texto-suave font-semibold px-3", children: "Archivar" }), _jsx("button", { onClick: onSalir, className: "px-4 py-3 font-bold text-petroleo", children: "Cancelar" }), _jsx("button", { onClick: guardar, disabled: guardando, className: "bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-xl disabled:opacity-60", children: guardando ? 'Guardando…' : 'Guardar programa' })] })] }));
}
