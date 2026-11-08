import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { DIAS_CORTOS, desdeIso, iso, lunes, rangoSemana, sumarDias } from '../../../lib/fechas';
import { MOTIVOS } from '../paciente/tipos';
import { comoLista } from '../paciente/datos';
import SesionAMedida from './SesionAMedida';
import CambiarEjercicio from './CambiarEjercicio';
const ESTADO = { scheduled: 'Pendiente', in_progress: 'En curso', completed: 'Hecho', skipped: 'No hecho' };
export default function SemanaCoach({ supabase, pacienteId, nombrePaciente }) {
    const [inicio, setInicio] = useState(() => lunes(new Date()));
    const [sesiones, setSesiones] = useState([]);
    const [asignarDia, setAsignarDia] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [aviso, setAviso] = useState('');
    const [aMedida, setAMedida] = useState(null);
    const [cambiando, setCambiando] = useState(false);
    async function cargar() {
        const { data } = await supabase
            .from('workouts')
            .select('id, scheduled_date, name, status, rpe, coach_message')
            .eq('patient_id', pacienteId)
            .gte('scheduled_date', iso(inicio))
            .lte('scheduled_date', iso(sumarDias(inicio, 6)))
            .order('scheduled_date');
        setSesiones(data ?? []);
    }
    useEffect(() => { cargar(); setAviso(''); }, [inicio, pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
    async function copiarAnterior() {
        if (sesiones.length && !window.confirm('Esta semana ya tiene sesiones. ¿Añadir también las de la semana anterior?'))
            return;
        const { data, error } = await supabase.rpc('copy_week', { p_patient: pacienteId, p_from_monday: iso(sumarDias(inicio, -7)), p_to_monday: iso(inicio) });
        if (error)
            return setAviso('No se ha podido copiar la semana.');
        setAviso(data ? `Copiadas ${data} sesiones de la semana anterior.` : 'La semana anterior no tenía sesiones.');
        cargar();
    }
    const hoy = iso(new Date());
    const hechas = sesiones.filter((s) => s.status === 'completed').length;
    return (_jsxs("section", { className: "bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3", "aria-labelledby": "semana", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("h3", { id: "semana", className: "text-lg font-bold mr-auto", children: "Entrenamiento" }), _jsx("button", { "aria-label": "Semana anterior", onClick: () => setInicio(sumarDias(inicio, -7)), className: "px-3 py-2 rounded-lg bg-fondo font-bold", children: "\u2039" }), _jsx("span", { className: "font-semibold min-w-32 text-center", children: rangoSemana(inicio) }), _jsx("button", { "aria-label": "Semana siguiente", onClick: () => setInicio(sumarDias(inicio, 7)), className: "px-3 py-2 rounded-lg bg-fondo font-bold", children: "\u203A" }), _jsx("button", { onClick: copiarAnterior, className: "px-3 py-2 rounded-lg border-2 border-petroleo text-petroleo font-bold text-sm", children: "Copiar semana anterior" }), _jsx("button", { onClick: () => setCambiando(true), className: "px-3 py-2 rounded-lg border-2 border-petroleo text-petroleo font-bold text-sm", children: "Cambiar un ejercicio" })] }), _jsx("p", { className: "text-sm text-texto-suave", children: sesiones.length ? `${hechas} de ${sesiones.length} sesiones hechas` : 'Sin sesiones esta semana' }), aviso && _jsx("p", { role: "status", className: "text-sm font-semibold", children: aviso }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-7 gap-2", children: Array.from({ length: 7 }, (_, i) => {
                    const d = sumarDias(inicio, i);
                    const f = iso(d);
                    const delDia = sesiones.filter((s) => s.scheduled_date === f);
                    return (_jsxs("div", { className: `rounded-xl p-2 flex flex-col gap-2 min-h-24 ${f === hoy ? 'bg-[#F4F1E4] ring-2 ring-mostaza' : 'bg-fondo'}`, children: [_jsxs("div", { className: "text-xs font-semibold text-texto-suave", children: [DIAS_CORTOS[i], " ", d.getDate()] }), delDia.map((s) => (_jsxs("button", { onClick: () => setDetalle(s), className: `text-left rounded-lg px-2 py-1.5 text-sm font-semibold leading-tight ${s.status === 'completed' ? 'bg-petroleo text-white' : s.status === 'skipped' ? 'bg-gris-claro text-texto-suave line-through' : 'bg-white'}`, children: [s.name, _jsxs("span", { className: "block text-[11px] font-normal opacity-80", children: [ESTADO[s.status], s.rpe ? ` · esfuerzo ${s.rpe}` : ''] })] }, s.id))), _jsxs("div", { className: "mt-auto flex flex-col gap-1", children: [_jsx("button", { onClick: () => setAMedida({ tipo: 'nueva', fecha: f }), className: "text-xs font-bold text-[#1F2424] bg-mostaza rounded-lg px-2 py-1.5 text-left", children: "+ Crear sesi\u00F3n" }), _jsx("button", { onClick: () => setAsignarDia(f), className: "text-xs font-bold text-petroleo text-left px-2", children: "+ De plantilla" })] })] }, f));
                }) }), asignarDia && _jsx(Asignar, { supabase: supabase, pacienteId: pacienteId, fecha: asignarDia, onCerrar: () => setAsignarDia(null), onHecho: () => { setAsignarDia(null); cargar(); } }), detalle && (_jsx(Detalle, { supabase: supabase, sesion: detalle, onCerrar: () => setDetalle(null), onBorrada: () => { setDetalle(null); cargar(); }, onEditar: () => { setAMedida({ tipo: 'editar', id: detalle.id }); setDetalle(null); }, onDuplicar: () => { setAMedida({ tipo: 'duplicar', id: detalle.id }); setDetalle(null); } })), cambiando && (_jsx(CambiarEjercicio, { supabase: supabase, pacienteId: pacienteId, onCerrar: () => setCambiando(false), onHecho: (t) => { setCambiando(false); setAviso(t); cargar(); } })), aMedida && (_jsx(SesionAMedida, { supabase: supabase, pacienteId: pacienteId, nombrePaciente: nombrePaciente, modo: aMedida, onCerrar: () => setAMedida(null), onHecho: (t) => { setAMedida(null); setAviso(t); cargar(); } }))] }));
}
function Ventana({ titulo, onCerrar, children }) {
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": titulo, className: "fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6", onClick: onCerrar, children: _jsxs("div", { className: "bg-fondo w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-3", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsx("h3", { className: "text-xl font-bold leading-tight", children: titulo }), _jsx("button", { onClick: onCerrar, className: "text-petroleo font-bold px-2", children: "Cerrar" })] }), children] }) }));
}
function Asignar({ supabase, pacienteId, fecha, onCerrar, onHecho }) {
    const [plantillas, setPlantillas] = useState(null);
    const [elegida, setElegida] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);
    useEffect(() => {
        supabase.from('templates').select('id, name').eq('is_archived', false).order('name').then(({ data }) => setPlantillas(data ?? []));
    }, [supabase]);
    async function asignar() {
        if (!elegida)
            return setError('Elige una plantilla.');
        setEnviando(true);
        const { error } = await supabase.rpc('assign_template', { p_template: elegida, p_patient: pacienteId, p_date: fecha, p_message: mensaje.trim() || null });
        setEnviando(false);
        if (error)
            setError('No se ha podido asignar.');
        else
            onHecho();
    }
    const d = desdeIso(fecha);
    return (_jsxs(Ventana, { titulo: `Asignar el ${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`, onCerrar: onCerrar, children: [!plantillas && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), plantillas && plantillas.length === 0 && _jsx("p", { className: "text-texto-suave", children: "A\u00FAn no tienes plantillas. Cr\u00E9alas en la secci\u00F3n Plantillas." }), _jsx("ul", { className: "flex flex-col gap-2", children: plantillas?.map((p) => (_jsx("li", { children: _jsxs("label", { className: `flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer ${elegida === p.id ? 'bg-petroleo text-white' : 'bg-white'}`, children: [_jsx("input", { type: "radio", name: "plantilla", value: p.id, checked: elegida === p.id, onChange: () => setElegida(p.id), className: "sr-only" }), _jsx("span", { className: "font-semibold", children: p.name })] }) }, p.id))) }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Mensaje para el paciente (opcional)", _jsx("textarea", { value: mensaje, onChange: (e) => setMensaje(e.target.value), rows: 2, placeholder: "Ej.: hoy controla la bajada en las sentadillas", className: "font-normal text-base px-3 py-2 border border-borde rounded-xl bg-white" })] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: asignar, disabled: enviando || !elegida, className: "self-end bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60", children: enviando ? 'Asignando…' : 'Asignar' })] }));
}
function Detalle({ supabase, sesion, onCerrar, onBorrada, onEditar, onDuplicar }) {
    const [bloques, setBloques] = useState(null);
    const [extra, setExtra] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        supabase
            .from('workouts')
            .select('feeling, patient_notes, workout_blocks(position, name, workout_items(id, position, sets, target, load_kg, exercises(name), set_logs(set_number, reps, load_kg, done), workout_item_feedback(note, cannot_do, reason)))')
            .eq('id', sesion.id)
            .single()
            .then(({ data }) => {
            const w = data;
            setExtra(w ? { feeling: w.feeling, patient_notes: w.patient_notes } : null);
            const bs = (w?.workout_blocks ?? []).sort((a, b) => a.position - b.position);
            bs.forEach((b) => b.workout_items.forEach((i) => { i.set_logs = comoLista(i.set_logs); i.workout_item_feedback = comoLista(i.workout_item_feedback); }));
            setBloques(bs);
        });
    }, [sesion.id, supabase]);
    const tieneRegistros = (bloques ?? []).some((b) => b.workout_items.some((i) => i.set_logs.length));
    const tieneNotas = (bloques ?? []).some((b) => b.workout_items.some((i) => i.workout_item_feedback.length));
    const sePuedeBorrar = bloques !== null && sesion.status === 'scheduled' && !tieneRegistros && !tieneNotas;
    const sePuedeEditar = sePuedeBorrar;
    async function borrar() {
        if (!window.confirm('¿Quitar esta sesión del calendario del paciente?'))
            return;
        const { error } = await supabase.from('workouts').delete().eq('id', sesion.id);
        if (error)
            setError(error.message.includes('series o notas') ? 'El paciente ya ha registrado algo en esta sesión, así que no se puede quitar.' : 'No se ha podido quitar.');
        else
            onBorrada();
    }
    return (_jsxs(Ventana, { titulo: sesion.name, onCerrar: onCerrar, children: [_jsxs("p", { className: "text-sm text-texto-suave", children: [desdeIso(sesion.scheduled_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }), " \u00B7 ", ESTADO[sesion.status], sesion.rpe ? ` · esfuerzo ${sesion.rpe}/10` : ''] }), sesion.coach_message && _jsxs("p", { className: "bg-white rounded-xl p-3 text-sm", children: [_jsx("strong", { children: "Tu mensaje:" }), " ", sesion.coach_message] }), extra?.feeling && _jsxs("p", { className: "bg-white rounded-xl p-3 text-sm", children: [_jsx("strong", { children: "C\u00F3mo se ha sentido:" }), " ", extra.feeling] }), extra?.patient_notes && _jsxs("p", { className: "bg-white rounded-xl p-3 text-sm", children: [_jsx("strong", { children: "Sus notas:" }), " ", extra.patient_notes] }), !bloques && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), bloques?.map((b) => (_jsxs("div", { className: "bg-white rounded-xl p-3 flex flex-col gap-2", children: [b.name && _jsx("h4", { className: "text-sm font-bold text-texto-suave", children: b.name }), [...b.workout_items].sort((x, y) => x.position - y.position).map((i) => {
                        const fb = i.workout_item_feedback[0];
                        return (_jsxs("div", { className: "text-sm border-t border-fondo pt-2 first:border-0 first:pt-0", children: [_jsx("div", { className: "font-semibold", children: i.exercises.name }), _jsxs("div", { className: "text-texto-suave", children: ["Pautado: ", i.sets, " \u00D7 ", i.target ?? '—', i.load_kg != null ? ` · ${i.load_kg} kg` : ''] }), i.set_logs.length > 0 && (_jsxs("div", { children: ["Hecho: ", [...i.set_logs].sort((a, c) => a.set_number - c.set_number).map((l) => `${l.reps ?? '—'}${l.load_kg != null ? `×${l.load_kg}kg` : ''}`).join(' · ')] })), fb?.cannot_do && _jsxs("div", { className: "font-semibold text-[#8A2C1D]", children: ["No ha podido: ", MOTIVOS[fb.reason] ?? 'otro motivo'] }), fb?.note && _jsxs("div", { className: "italic", children: ["\u00AB", fb.note, "\u00BB"] })] }, i.id));
                    })] }, b.position))), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 pt-1", children: [sePuedeEditar && _jsx("button", { onClick: onEditar, className: "bg-petroleo text-white font-bold px-4 py-2.5 rounded-xl", children: "Editar sesi\u00F3n" }), bloques && _jsx("button", { onClick: onDuplicar, className: "border-2 border-petroleo text-petroleo font-bold px-4 py-2 rounded-xl", children: "Duplicar" }), sePuedeBorrar && _jsx("button", { onClick: borrar, className: "ml-auto text-[#8A2C1D] font-bold px-2 py-2", children: "Quitar del calendario" })] }), bloques && !sePuedeEditar && _jsx("p", { className: "text-xs text-texto-suave", children: "Ya tiene registros del paciente, as\u00ED que no se edita. Puedes duplicarla para crear otra con cambios." })] }));
}
