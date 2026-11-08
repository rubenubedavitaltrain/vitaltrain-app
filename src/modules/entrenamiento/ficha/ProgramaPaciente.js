import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { comoLista } from '../paciente/datos';
import { diaMes, desdeIso, iso, lunes, sumarDias } from '../../../lib/fechas';
export default function ProgramaPaciente({ supabase, pacienteId, onCambio }) {
    const [asignaciones, setAsignaciones] = useState(null);
    const [progreso, setProgreso] = useState({});
    const [ventana, setVentana] = useState(null);
    async function cargar() {
        const { data } = await supabase
            .from('program_assignments')
            .select('id, start_date, status, replaced_from_week, programs(id, name, weeks)')
            .eq('patient_id', pacienteId)
            .order('start_date', { ascending: false })
            .limit(10);
        const lista = data ?? [];
        setAsignaciones(lista);
        const activas = lista.filter((a) => a.status === 'active').map((a) => a.id);
        if (activas.length) {
            const { data: ws } = await supabase.from('workouts').select('program_assignment_id, status').in('program_assignment_id', activas);
            const p = {};
            (ws ?? []).forEach((w) => {
                p[w.program_assignment_id] ??= { hechas: 0, total: 0 };
                p[w.program_assignment_id].total++;
                if (w.status === 'completed')
                    p[w.program_assignment_id].hechas++;
            });
            setProgreso(p);
        }
    }
    useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
    const hoy = lunes(new Date());
    const activas = (asignaciones ?? []).filter((a) => a.status === 'active');
    const anteriores = (asignaciones ?? []).filter((a) => a.status !== 'active');
    return (_jsxs("section", { className: "bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3", "aria-labelledby": "programa", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("h3", { id: "programa", className: "text-lg font-bold mr-auto", children: "Programa" }), _jsx("button", { onClick: () => setVentana('asignar'), className: "px-3 py-2 rounded-lg bg-mostaza text-[#1F2424] font-bold text-sm", children: "Asignar programa" })] }), asignaciones && activas.length === 0 && _jsx("p", { className: "text-sm text-texto-suave", children: "Sin programa en curso. Puedes asignar uno o seguir asignando sesiones sueltas en la semana." }), activas.map((a) => {
                const inicio = desdeIso(a.start_date);
                const fin = sumarDias(inicio, a.programs.weeks * 7 - 1);
                const semana = Math.floor((hoy.getTime() - inicio.getTime()) / (7 * 864e5)) + 1;
                const pr = progreso[a.id];
                const terminado = semana > a.programs.weeks;
                return (_jsxs("div", { className: "rounded-xl bg-fondo p-4 flex flex-wrap items-center gap-3", children: [_jsxs("div", { className: "flex-1 min-w-48", children: [_jsx("div", { className: "font-bold text-lg", children: a.programs.name }), _jsxs("div", { className: "text-sm text-texto-suave", children: [diaMes(inicio), " \u2013 ", diaMes(fin), " \u00B7 ", semana < 1 ? `empieza el ${diaMes(inicio)}` : terminado ? 'terminado' : `semana ${semana} de ${a.programs.weeks}`] }), pr && (_jsxs("div", { className: "mt-2", children: [_jsx("div", { className: "h-2 bg-white rounded-full", children: _jsx("div", { className: "h-full bg-petroleo rounded-full", style: { width: `${pr.total ? (pr.hechas / pr.total) * 100 : 0}%` } }) }), _jsxs("div", { className: "text-xs text-texto-suave mt-1", children: [pr.hechas, " de ", pr.total, " sesiones hechas"] })] }))] }), !terminado && _jsx("button", { onClick: () => setVentana(a), className: "px-3 py-2 rounded-lg border-2 border-petroleo text-petroleo font-bold text-sm", children: "Cambiar desde una semana" })] }, a.id));
            }), anteriores.length > 0 && (_jsxs("details", { className: "text-sm", children: [_jsx("summary", { className: "cursor-pointer text-texto-suave", children: "Programas anteriores" }), _jsx("ul", { className: "mt-2 flex flex-col gap-1", children: anteriores.map((a) => (_jsxs("li", { children: [a.programs.name, " \u00B7 desde ", diaMes(desdeIso(a.start_date)), a.status === 'replaced' ? ` · cambiado en la semana ${a.replaced_from_week}` : ''] }, a.id))) })] })), ventana === 'asignar' && _jsx(Asignar, { supabase: supabase, pacienteId: pacienteId, onCerrar: () => setVentana(null), onHecho: () => { setVentana(null); cargar(); onCambio(); } }), ventana && ventana !== 'asignar' && _jsx(Cambiar, { supabase: supabase, asignacion: ventana, onCerrar: () => setVentana(null), onHecho: () => { setVentana(null); cargar(); onCambio(); } })] }));
}
function Ventana({ titulo, onCerrar, children }) {
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": titulo, className: "fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6", onClick: onCerrar, children: _jsxs("div", { className: "bg-fondo w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-3", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsx("h3", { className: "text-xl font-bold leading-tight", children: titulo }), _jsx("button", { onClick: onCerrar, className: "text-petroleo font-bold px-2", children: "Cerrar" })] }), children] }) }));
}
function useProgramas(supabase) {
    const [lista, setLista] = useState(null);
    useEffect(() => {
        supabase.from('programs').select('id, name, weeks').eq('is_archived', false).order('name').then(({ data }) => setLista(data ?? []));
    }, [supabase]);
    return lista;
}
function Asignar({ supabase, pacienteId, onCerrar, onHecho }) {
    const programas = useProgramas(supabase);
    const esteLunes = lunes(new Date());
    const opciones = [0, 1, 2, 3, 4].map((n) => sumarDias(esteLunes, n * 7));
    const [programa, setPrograma] = useState('');
    const [inicio, setInicio] = useState(iso(sumarDias(esteLunes, 7)));
    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);
    async function asignar() {
        if (!programa)
            return setError('Elige un programa.');
        setEnviando(true);
        const { error } = await supabase.rpc('assign_program', { p_program: programa, p_patient: pacienteId, p_start_monday: inicio, p_message: mensaje.trim() || null });
        setEnviando(false);
        if (error)
            setError('No se ha podido asignar el programa.');
        else
            onHecho();
    }
    return (_jsxs(Ventana, { titulo: "Asignar programa", onCerrar: onCerrar, children: [!programas && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), programas && programas.length === 0 && _jsx("p", { className: "text-texto-suave", children: "A\u00FAn no tienes programas. Cr\u00E9alos en la secci\u00F3n Programas." }), _jsx("ul", { className: "flex flex-col gap-2", children: programas?.map((p) => (_jsx("li", { children: _jsxs("label", { className: `flex items-center justify-between gap-3 rounded-xl px-4 py-3 cursor-pointer ${programa === p.id ? 'bg-petroleo text-white' : 'bg-white'}`, children: [_jsx("input", { type: "radio", name: "programa", className: "sr-only", checked: programa === p.id, onChange: () => setPrograma(p.id) }), _jsx("span", { className: "font-semibold", children: p.name }), _jsxs("span", { className: "text-sm opacity-80", children: [p.weeks, " sem."] })] }) }, p.id))) }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Empieza el lunes", _jsx("select", { value: inicio, onChange: (e) => setInicio(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white", children: opciones.map((d, i) => _jsxs("option", { value: iso(d), children: [diaMes(d), i === 0 ? ' (esta semana)' : i === 1 ? ' (la próxima)' : ''] }, iso(d))) })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Mensaje para todas las sesiones (opcional)", _jsx("input", { value: mensaje, onChange: (e) => setMensaje(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: asignar, disabled: enviando || !programa, className: "self-end bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60", children: enviando ? 'Asignando…' : 'Asignar' })] }));
}
function Cambiar({ supabase, asignacion, onCerrar, onHecho }) {
    const programas = useProgramas(supabase);
    const inicio = desdeIso(asignacion.start_date);
    const primera = Math.max(1, Math.floor((lunes(new Date()).getTime() - inicio.getTime()) / (7 * 864e5)) + 1);
    const semanasPosibles = Array.from({ length: asignacion.programs.weeks - primera + 1 }, (_, i) => primera + i);
    const [semana, setSemana] = useState(primera);
    const [nuevo, setNuevo] = useState('');
    const [sesiones, setSesiones] = useState(null);
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);
    useEffect(() => {
        supabase
            .from('workouts')
            .select('id, scheduled_date, status, workout_blocks(workout_items(set_logs(count), workout_item_feedback(count)))')
            .eq('program_assignment_id', asignacion.id)
            .then(({ data }) => setSesiones(data ?? []));
    }, [asignacion.id, supabase]);
    const desde = iso(sumarDias(inicio, (semana - 1) * 7));
    const afectadas = (sesiones ?? []).filter((s) => s.scheduled_date >= desde);
    const conRegistros = (s) => s.workout_blocks.some((b) => b.workout_items.some((i) => (comoLista(i.set_logs)[0]?.count ?? 0) > 0 || (comoLista(i.workout_item_feedback)[0]?.count ?? 0) > 0));
    const seQuitan = afectadas.filter((s) => s.status === 'scheduled' && !conRegistros(s)).length;
    const seQuedan = afectadas.length - seQuitan;
    async function cambiar() {
        setEnviando(true);
        const { data, error } = await supabase.rpc('replace_program_from_week', { p_assignment: asignacion.id, p_week: semana, p_new_program: nuevo || null, p_message: null });
        setEnviando(false);
        if (error)
            return setError('No se ha podido cambiar el programa.');
        if (data)
            onHecho();
    }
    return (_jsxs(Ventana, { titulo: `Cambiar «${asignacion.programs.name}»`, onCerrar: onCerrar, children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Desde la semana", _jsx("select", { value: semana, onChange: (e) => setSemana(Number(e.target.value)), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white", children: semanasPosibles.map((n) => _jsxs("option", { value: n, children: ["Semana ", n, " \u00B7 lunes ", diaMes(sumarDias(inicio, (n - 1) * 7)), n === primera ? ' (esta)' : ''] }, n)) })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["En su lugar", _jsxs("select", { value: nuevo, onChange: (e) => setNuevo(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white", children: [_jsx("option", { value: "", children: "Nada (solo quitar lo pendiente)" }), programas?.map((p) => _jsxs("option", { value: p.id, children: [p.name, " \u00B7 ", p.weeks, " sem."] }, p.id))] })] }), sesiones && (_jsxs("div", { className: "bg-white rounded-xl p-4 text-sm flex flex-col gap-1", children: [_jsxs("p", { children: [_jsxs("strong", { children: ["Se quitar\u00E1n ", seQuitan] }), " ", seQuitan === 1 ? 'sesión pendiente' : 'sesiones pendientes', " desde el lunes ", diaMes(desdeIso(desde)), "."] }), seQuedan > 0 && _jsxs("p", { children: ["Se mantienen ", seQuedan, " porque ya est\u00E1n hechas, en curso o tienen series o notas registradas."] }), nuevo && _jsx("p", { children: "El programa nuevo empezar\u00E1 ese mismo lunes." })] })), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: cambiar, disabled: enviando || !sesiones, className: "self-end bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60", children: enviando ? 'Cambiando…' : 'Confirmar el cambio' })] }));
}
