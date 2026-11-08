import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { hoyIso } from '../../lib/fechas';
import { Constancia } from './Habitos';
import { cargarAsignados, cargarCatalogo, DIAS, num, objetivo, textoAncla, TIPOS } from './datos';
// Módulo de hábitos, parte del coach: ficha del paciente. Asignar del catálogo, ajustar objetivo y días, retirar.
export default function HabitosCoach({ supabase, pacienteId, nombre }) {
    const [asignados, setAsignados] = useState(null);
    const [version, setVersion] = useState(0);
    const [hoja, setHoja] = useState(null);
    useEffect(() => { cargarAsignados(supabase, pacienteId).then(setAsignados); }, [supabase, pacienteId, version]);
    const recargar = () => { setHoja(null); setVersion((v) => v + 1); };
    return (_jsxs("section", { className: "flex flex-col gap-3", "aria-labelledby": "habitos-coach", children: [_jsxs("div", { className: "flex flex-wrap items-baseline justify-between gap-2 px-1", children: [_jsx("h3", { id: "habitos-coach", className: "text-lg font-bold", children: "H\u00E1bitos" }), _jsx("button", { onClick: () => setHoja({ tipo: 'catalogo' }), className: "bg-mostaza text-[#1F2424] font-bold px-4 py-2 rounded-xl", children: "+ Asignar h\u00E1bito" })] }), _jsxs("div", { className: "grid lg:grid-cols-2 gap-4 items-start", children: [_jsxs("div", { className: "bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-2", children: [_jsx("h4", { className: "font-bold", children: "Lo que tiene pautado" }), !asignados && _jsx("p", { className: "text-sm text-texto-suave", children: "Cargando\u2026" }), asignados?.length === 0 && _jsx("p", { className: "text-sm text-texto-suave", children: "Sin h\u00E1bitos. Pulsa \u00ABAsignar h\u00E1bito\u00BB y elige del cat\u00E1logo por pilar." }), _jsx("ul", { className: "flex flex-col", children: asignados?.map((a) => {
                                    const d = a.habit_definitions;
                                    const obj = objetivo(a);
                                    return (_jsxs("li", { className: "border-t border-fondo py-2.5 flex items-start gap-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-[11px] font-bold uppercase tracking-wide text-petroleo", children: d.pillars?.name ?? 'Sin pilar' }), _jsx("div", { className: "font-semibold", children: d.name }), _jsx("div", { className: "text-xs text-texto-suave", children: [a.days_of_week.length === 7 ? 'Todos los días' : a.days_of_week.map((x) => DIAS[x - 1]).join(' '), obj != null && d.kind !== 'scale' ? `objetivo ${num(obj)} ${d.unit ?? ''}`.trim() : null, textoAncla(d.anchor, d.anchor_offset_minutes)].filter(Boolean).join(' · ') }), a.coach_note && _jsxs("div", { className: "text-xs mt-0.5", children: ["Tu indicaci\u00F3n: ", a.coach_note] })] }), _jsx("button", { onClick: () => setHoja({ tipo: 'editar', def: d, asignado: a }), className: "text-sm font-bold text-petroleo px-2 py-1", children: "Cambiar" })] }, a.id));
                                }) })] }), _jsx(Constancia, { supabase: supabase, pacienteId: pacienteId, esCoach: true, version: version })] }), hoja?.tipo === 'catalogo' && _jsx(Catalogo, { supabase: supabase, yaTiene: new Set(asignados?.map((a) => a.habit_id)), onElegir: (def) => setHoja({ tipo: 'editar', def }), onNuevo: () => setHoja({ tipo: 'nuevo' }), onCerrar: () => setHoja(null) }), hoja?.tipo === 'editar' && _jsx(Pautar, { supabase: supabase, pacienteId: pacienteId, nombre: nombre, def: hoja.def, asignado: hoja.asignado, onCerrar: () => setHoja(null), onHecho: recargar }), hoja?.tipo === 'nuevo' && _jsx(NuevoHabito, { supabase: supabase, onCerrar: () => setHoja(null), onCreado: (def) => setHoja({ tipo: 'editar', def }) })] }));
}
function Catalogo({ supabase, yaTiene, onElegir, onNuevo, onCerrar }) {
    const [lista, setLista] = useState(null);
    const [pilar, setPilar] = useState('todos');
    useEffect(() => { cargarCatalogo(supabase).then(setLista); }, [supabase]);
    const pilares = [...new Map((lista ?? []).filter((d) => d.pillars).map((d) => [d.pillars.slug, d.pillars.name])).entries()];
    const vistos = (lista ?? []).filter((d) => pilar === 'todos' || d.pillars?.slug === pilar);
    return (_jsxs(Hoja, { titulo: "Cat\u00E1logo de h\u00E1bitos", onCerrar: onCerrar, ancho: true, children: [_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [_jsx(Chip, { on: pilar === 'todos', onClick: () => setPilar('todos'), children: "Todos" }), pilares.map(([slug, nombre]) => _jsx(Chip, { on: pilar === slug, onClick: () => setPilar(slug), children: nombre }, slug))] }), !lista && _jsx("p", { className: "text-sm text-texto-suave", children: "Cargando\u2026" }), _jsx("ul", { className: "flex flex-col bg-white rounded-xl max-h-[55dvh] overflow-y-auto", children: vistos.map((d) => (_jsx("li", { children: _jsxs("button", { onClick: () => onElegir(d), disabled: yaTiene.has(d.id), className: "w-full text-left px-4 py-3 border-b border-fondo disabled:opacity-45", children: [_jsxs("span", { className: "block text-[11px] font-bold uppercase tracking-wide text-petroleo", children: [d.pillars?.name ?? 'Sin pilar', " \u00B7 ", TIPOS[d.kind], d.default_target ? ` · ${num(d.default_target)} ${d.unit ?? ''}` : ''] }), _jsxs("span", { className: "block font-semibold", children: [d.name, yaTiene.has(d.id) ? ' (ya lo tiene)' : ''] }), d.short_instruction && _jsx("span", { className: "block text-sm text-texto-suave", children: d.short_instruction })] }) }, d.id))) }), _jsx("button", { onClick: onNuevo, className: "self-start font-bold text-petroleo", children: "+ Crear un h\u00E1bito nuevo" })] }));
}
function Pautar({ supabase, pacienteId, nombre, def, asignado, onCerrar, onHecho }) {
    const conObjetivo = def.kind === 'number' || def.kind === 'duration';
    const [obj, setObj] = useState(String(asignado?.target ?? def.default_target ?? ''));
    const [dias, setDias] = useState(asignado?.days_of_week ?? [1, 2, 3, 4, 5, 6, 7]);
    const [nota, setNota] = useState(asignado?.coach_note ?? '');
    const [desde, setDesde] = useState(asignado?.start_date ?? hoyIso());
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);
    async function guardar() {
        setError('');
        if (dias.length === 0)
            return setError('Elige al menos un día.');
        const t = obj.trim() ? Number(obj.replace(',', '.')) : null;
        if (conObjetivo && t != null && (!Number.isFinite(t) || t <= 0))
            return setError('Revisa el objetivo.');
        const fila = { target: conObjetivo ? (t === def.default_target ? null : t) : null, days_of_week: [...dias].sort(), coach_note: nota.trim() || null, start_date: desde };
        setGuardando(true);
        const { error } = asignado
            ? await supabase.from('patient_habits').update(fila).eq('id', asignado.id)
            : await supabase.from('patient_habits').insert({ ...fila, patient_id: pacienteId, habit_id: def.id });
        setGuardando(false);
        if (error)
            return setError('No se ha podido guardar.');
        onHecho();
    }
    async function retirar() {
        if (!asignado || !window.confirm(`¿Retirar «${def.name}» a ${nombre}? Lo que ya ha marcado se conserva.`))
            return;
        const { error } = await supabase.from('patient_habits').update({ is_active: false, end_date: hoyIso() }).eq('id', asignado.id);
        if (error)
            return setError('No se ha podido retirar.');
        onHecho();
    }
    return (_jsxs(Hoja, { titulo: asignado ? 'Cambiar hábito' : `Pautar a ${nombre}`, onCerrar: onCerrar, children: [_jsxs("div", { className: "bg-white rounded-xl p-3", children: [_jsx("div", { className: "text-[11px] font-bold uppercase tracking-wide text-petroleo", children: def.pillars?.name ?? 'Sin pilar' }), _jsx("div", { className: "font-bold", children: def.name }), def.short_instruction && _jsx("p", { className: "text-sm", children: def.short_instruction }), def.rationale && _jsxs("p", { className: "text-xs text-texto-suave mt-1", children: ["Por qu\u00E9 (lo ve el paciente): ", def.rationale] }), textoAncla(def.anchor, def.anchor_offset_minutes) && _jsxs("p", { className: "text-xs text-texto-suave mt-1", children: ["Momento: ", textoAncla(def.anchor, def.anchor_offset_minutes)] })] }), conObjetivo && (_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Objetivo diario (", def.unit ?? 'cantidad', ")", _jsx("input", { inputMode: "decimal", value: obj, onChange: (e) => setObj(e.target.value.replace(/[^\d.,]/g, '')), className: "font-normal text-lg px-3 py-2.5 border border-borde rounded-xl bg-white" })] })), _jsxs("fieldset", { children: [_jsx("legend", { className: "text-sm font-semibold mb-1.5", children: "Qu\u00E9 d\u00EDas" }), _jsx("div", { className: "flex gap-1.5", children: DIAS.map((d, i) => {
                            const on = dias.includes(i + 1);
                            return _jsx("button", { type: "button", "aria-pressed": on, onClick: () => setDias(on ? dias.filter((x) => x !== i + 1) : [...dias, i + 1]), className: `flex-1 py-2.5 rounded-xl font-bold ${on ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`, children: d }, d);
                        }) })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Indicaci\u00F3n para ", nombre, " (opcional)", _jsx("textarea", { value: nota, onChange: (e) => setNota(e.target.value.slice(0, 300)), rows: 2, placeholder: "Ej.: empieza por 5 minutos y sube cuando te resulte f\u00E1cil", className: "font-normal text-base px-3 py-2 border border-borde rounded-xl bg-white" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Desde", _jsx("input", { type: "date", value: desde, onChange: (e) => e.target.value && setDesde(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: guardar, disabled: guardando, className: "bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl disabled:opacity-60", children: guardando ? 'Guardando…' : asignado ? 'Guardar cambios' : 'Pautar' }), asignado && _jsx("button", { onClick: retirar, className: "font-semibold text-[#8A2C1D]", children: "Retirar este h\u00E1bito" })] }));
}
function NuevoHabito({ supabase, onCerrar, onCreado }) {
    const [pilares, setPilares] = useState([]);
    const [pilar, setPilar] = useState('');
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState('check');
    const [unidad, setUnidad] = useState('');
    const [objetivo, setObjetivo] = useState('');
    const [instr, setInstr] = useState('');
    const [porque, setPorque] = useState('');
    const [error, setError] = useState('');
    useEffect(() => { supabase.from('pillars').select('id, slug, name, position').order('position').then(({ data }) => setPilares(data ?? [])); }, [supabase]);
    async function crear() {
        setError('');
        if (nombre.trim().length < 2)
            return setError('Ponle un nombre.');
        if (!pilar)
            return setError('Elige el pilar.');
        const t = objetivo.trim() ? Number(objetivo.replace(',', '.')) : null;
        if (t != null && (!Number.isFinite(t) || t <= 0))
            return setError('Revisa el objetivo.');
        const { data, error } = await supabase.from('habit_definitions').insert({
            pillar_id: pilar, module_slug: 'habits', name: nombre.trim(), kind: tipo,
            unit: tipo === 'duration' ? 'min' : tipo === 'number' ? unidad.trim() || null : null,
            default_target: tipo === 'number' || tipo === 'duration' ? t : null,
            short_instruction: instr.trim() || null, rationale: porque.trim() || null,
        }).select('id, name, short_instruction, rationale, kind, unit, default_target, anchor, anchor_offset_minutes, is_archived, pillars(slug, name, position)').single();
        if (error || !data)
            return setError('No se ha podido crear.');
        onCreado({ ...data, default_target: t });
    }
    return (_jsxs(Hoja, { titulo: "H\u00E1bito nuevo", onCerrar: onCerrar, children: [_jsx("p", { className: "text-sm text-texto-suave -mt-2", children: "Queda en el cat\u00E1logo para usarlo con cualquier paciente." }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Nombre", _jsx("input", { value: nombre, maxLength: 80, onChange: (e) => setNombre(e.target.value), placeholder: "Ej.: Ducha fr\u00EDa al final", className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Pilar", _jsxs("select", { value: pilar, onChange: (e) => setPilar(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white", children: [_jsx("option", { value: "", children: "Elige\u2026" }), pilares.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }), _jsxs("fieldset", { children: [_jsx("legend", { className: "text-sm font-semibold mb-1.5", children: "C\u00F3mo lo marca el paciente" }), _jsx("div", { className: "grid grid-cols-2 gap-1.5", children: Object.keys(TIPOS).map((t) => _jsx("button", { type: "button", "aria-pressed": tipo === t, onClick: () => setTipo(t), className: `py-2.5 rounded-xl font-semibold text-sm ${tipo === t ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`, children: TIPOS[t] }, t)) })] }), (tipo === 'number' || tipo === 'duration') && (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [tipo === 'number' && _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Unidad", _jsx("input", { value: unidad, maxLength: 20, onChange: (e) => setUnidad(e.target.value), placeholder: "vasos, pasos\u2026", className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Objetivo por defecto", tipo === 'duration' ? ' (min)' : '', _jsx("input", { inputMode: "decimal", value: objetivo, onChange: (e) => setObjetivo(e.target.value.replace(/[^\d.,]/g, '')), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] })] })), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Qu\u00E9 hacer, en una l\u00EDnea", _jsx("input", { value: instr, maxLength: 200, onChange: (e) => setInstr(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Por qu\u00E9 (una o dos frases para el paciente)", _jsx("textarea", { value: porque, maxLength: 400, onChange: (e) => setPorque(e.target.value), rows: 2, className: "font-normal text-base px-3 py-2 border border-borde rounded-xl bg-white" })] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: crear, className: "bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl", children: "Crear y pautar" })] }));
}
function Chip({ on, onClick, children }) {
    return _jsx("button", { type: "button", "aria-pressed": on, onClick: onClick, className: `px-3 py-1.5 rounded-full text-sm font-semibold ${on ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`, children: children });
}
function Hoja({ titulo, onCerrar, children, ancho = false }) {
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": titulo, className: "fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6", onClick: onCerrar, children: _jsxs("div", { className: `bg-fondo w-full ${ancho ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-4`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsx("h3", { className: "text-xl font-bold", children: titulo }), _jsx("button", { onClick: onCerrar, className: "text-petroleo font-bold px-2", children: "Cerrar" })] }), children] }) }));
}
