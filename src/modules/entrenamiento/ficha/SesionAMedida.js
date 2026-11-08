import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { DIAS_CORTOS, desdeIso, iso, lunes, sumarDias } from '../../../lib/fechas';
import EditorBloques, { COLUMNAS_ITEM, aGuardar, bloqueVacio, desdeFilas } from '../constructor/Bloques';
export default function SesionAMedida({ supabase, pacienteId, nombrePaciente, modo, onCerrar, onHecho }) {
    const [nombre, setNombre] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [bloques, setBloques] = useState(modo.tipo === 'nueva' ? [bloqueVacio('Bloque principal')] : []);
    const [fecha, setFecha] = useState(modo.tipo === 'nueva' ? modo.fecha : '');
    const [dias, setDias] = useState(modo.tipo === 'nueva' ? [(desdeIso(modo.fecha).getDay() + 6) % 7] : []);
    const [semanas, setSemanas] = useState(1);
    const [comoPlantilla, setComoPlantilla] = useState(false);
    const [plantillas, setPlantillas] = useState([]);
    const [cargando, setCargando] = useState(modo.tipo !== 'nueva');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        supabase.from('templates').select('id, name').eq('is_archived', false).order('name').then(({ data }) => setPlantillas(data ?? []));
        if (modo.tipo === 'nueva')
            return;
        supabase
            .from('workouts')
            .select(`name, coach_message, scheduled_date, workout_blocks(position, name, type, rounds, workout_items(${COLUMNAS_ITEM}))`)
            .eq('id', modo.id)
            .single()
            .then(({ data }) => {
            const w = data;
            if (!w)
                return setError('No se ha encontrado la sesión.');
            setNombre(w.name);
            setMensaje(w.coach_message ?? '');
            setBloques(desdeFilas(w.workout_blocks.map((b) => ({ ...b, items: b.workout_items }))));
            setFecha(w.scheduled_date);
            if (modo.tipo === 'duplicar')
                setDias([(desdeIso(w.scheduled_date).getDay() + 6) % 7]);
            setCargando(false);
        });
    }, [modo, supabase]);
    async function partirDePlantilla(id) {
        if (!id)
            return;
        if (bloques.some((b) => b.items.length) && !window.confirm('Se sustituirán los ejercicios que ya has puesto. ¿Seguir?'))
            return;
        const { data } = await supabase
            .from('templates')
            .select(`name, template_blocks(position, name, type, rounds, template_items(${COLUMNAS_ITEM}))`)
            .eq('id', id)
            .single();
        const t = data;
        if (!t)
            return;
        setBloques(desdeFilas(t.template_blocks.map((b) => ({ ...b, items: b.template_items }))));
        if (!nombre.trim())
            setNombre(t.name);
    }
    // Fechas en las que se creará la sesión (nueva o duplicada)
    const lunesBase = useMemo(() => lunes(desdeIso(fecha || iso(new Date()))), [fecha]);
    // Los días ya pasados no se incluyen: se diseña hacia delante
    const hoy = iso(new Date());
    const todas = useMemo(() => (modo.tipo === 'editar' ? [] : Array.from({ length: semanas }, (_, w) => [...dias].sort().map((d) => iso(sumarDias(lunesBase, w * 7 + d)))).flat()), [modo.tipo, semanas, dias, lunesBase]);
    const fechas = todas.filter((f) => f >= hoy);
    const pasadas = todas.length - fechas.length;
    async function guardar() {
        setError('');
        if (!nombre.trim())
            return setError('Ponle un nombre a la sesión.');
        if (!bloques.some((b) => b.items.length))
            return setError('Añade al menos un ejercicio.');
        if (modo.tipo !== 'editar' && fechas.length === 0)
            return setError('Elige al menos un día.');
        const blocks = aGuardar(bloques);
        const p = modo.tipo === 'editar'
            ? { id: modo.id, name: nombre, coach_message: mensaje, date: fecha, blocks }
            : { patient_id: pacienteId, name: nombre, coach_message: mensaje, dates: fechas, blocks };
        setGuardando(true);
        const { error } = await supabase.rpc('save_workout', { p });
        if (error) {
            setGuardando(false);
            return setError(error.message.includes('registros') ? 'El paciente ya ha registrado algo en esta sesión. Duplícala y quita esta si quieres cambiarla.' : 'No se ha podido guardar. Revisa los datos e inténtalo de nuevo.');
        }
        let extra = '';
        if (comoPlantilla && modo.tipo !== 'editar') {
            const r = await supabase.rpc('save_template', { p: { id: null, name: nombre, description: `Creada para ${nombrePaciente}`, blocks } });
            extra = r.error ? ' No se ha podido guardar como plantilla.' : ' También guardada como plantilla.';
        }
        setGuardando(false);
        onHecho(modo.tipo === 'editar' ? `Sesión actualizada.${extra}` : `${fechas.length === 1 ? 'Creada 1 sesión' : `Creadas ${fechas.length} sesiones`}.${extra}`);
    }
    const titulo = modo.tipo === 'editar' ? 'Editar sesión' : modo.tipo === 'duplicar' ? 'Duplicar sesión' : 'Nueva sesión';
    const fmt = (f) => desdeIso(f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    return (_jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": titulo, className: "fixed inset-0 z-50 bg-fondo overflow-y-auto", children: [_jsxs("header", { className: "sticky top-0 z-10 bg-petroleo text-white px-4 sm:px-8 py-3 flex items-center gap-3", children: [_jsxs("h2", { className: "text-lg font-bold flex-1 truncate", children: [titulo, " \u00B7 ", nombrePaciente] }), _jsx("button", { onClick: onCerrar, className: "font-bold px-2", children: "Cerrar" })] }), cargando ? _jsx("p", { className: "p-6 text-texto-suave", children: "Cargando\u2026" }) : (_jsxs("div", { className: "max-w-4xl mx-auto px-4 sm:px-8 pt-4 pb-28 flex flex-col gap-4", children: [_jsxs("div", { className: "bg-white rounded-2xl p-5 grid sm:grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold sm:col-span-2", children: ["Nombre de la sesi\u00F3n", _jsx("input", { autoFocus: modo.tipo === 'nueva', value: nombre, onChange: (e) => setNombre(e.target.value), placeholder: "Fuerza \u00B7 tren inferior", className: "font-normal text-lg px-3 py-2.5 border border-borde rounded-xl" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold sm:col-span-2", children: ["Mensaje para el paciente (opcional)", _jsx("textarea", { value: mensaje, onChange: (e) => setMensaje(e.target.value), rows: 2, placeholder: "Ej.: hoy controla la bajada en las sentadillas", className: "font-normal text-base px-3 py-2 border border-borde rounded-xl" })] }), plantillas.length > 0 && (_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold sm:col-span-2", children: ["Partir de una plantilla (opcional)", _jsxs("select", { value: "", onChange: (e) => partirDePlantilla(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white", children: [_jsx("option", { value: "", children: "Empezar desde cero" }), plantillas.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }))] }), _jsx(EditorBloques, { supabase: supabase, bloques: bloques, setBloques: setBloques }), _jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-label": "Cu\u00E1ndo", children: [_jsx("h3", { className: "text-lg font-bold", children: "Cu\u00E1ndo" }), modo.tipo === 'editar' ? (_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold max-w-60", children: ["D\u00EDa", _jsx("input", { type: "date", value: fecha, onChange: (e) => setFecha(e.target.value), className: "font-normal text-base px-3 py-2 border border-borde rounded-xl" })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-sm font-semibold", children: "D\u00EDas de la semana" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: DIAS_CORTOS.map((d, i) => {
                                                    const on = dias.includes(i);
                                                    return (_jsx("button", { "aria-pressed": on, onClick: () => setDias((ds) => (on ? ds.filter((x) => x !== i) : [...ds, i])), className: `w-14 py-2.5 rounded-xl font-bold ${on ? 'bg-petroleo text-white' : 'bg-fondo text-texto-suave'}`, children: d }, d));
                                                }) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("span", { className: "text-sm font-semibold", children: "Durante" }), _jsx("button", { "aria-label": "Una semana menos", onClick: () => setSemanas((n) => Math.max(1, n - 1)), className: "w-11 h-11 rounded-xl bg-fondo text-xl font-bold", children: "\u2212" }), _jsxs("span", { className: "min-w-24 text-center font-semibold", children: [semanas, " ", semanas === 1 ? 'semana' : 'semanas'] }), _jsx("button", { "aria-label": "Una semana m\u00E1s", onClick: () => setSemanas((n) => Math.min(12, n + 1)), className: "w-11 h-11 rounded-xl bg-fondo text-xl font-bold", children: "+" }), _jsxs("label", { className: "text-sm text-texto-suave flex items-center gap-2", children: ["a partir de la semana del", _jsx("input", { type: "date", value: iso(lunesBase), onChange: (e) => e.target.value && setFecha(e.target.value), className: "text-base px-2 py-1.5 border border-borde rounded-lg text-[#4A4A4C]" })] })] }), _jsxs("p", { className: "text-sm", children: [fechas.length === 0 ? (pasadas ? 'Esos días ya han pasado. Elige otros o empieza la semana siguiente.' : 'Elige al menos un día.') : _jsxs(_Fragment, { children: ["Se ", fechas.length === 1 ? 'creará 1 sesión' : `crearán ${fechas.length} sesiones`, ": ", _jsx("span", { className: "text-texto-suave", children: fechas.length <= 6 ? fechas.map(fmt).join(', ') : `del ${fmt(fechas[0])} al ${fmt(fechas[fechas.length - 1])}` })] }), pasadas > 0 && _jsxs("span", { className: "text-texto-suave", children: [" (", pasadas === 1 ? 'se omite 1 día que ya ha pasado' : `se omiten ${pasadas} días que ya han pasado`, ")"] })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm font-semibold", children: [_jsx("input", { type: "checkbox", checked: comoPlantilla, onChange: (e) => setComoPlantilla(e.target.checked), className: "w-5 h-5 accent-[#374949]" }), "Guardar tambi\u00E9n como plantilla para reutilizarla"] })] }))] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error })] })), _jsxs("div", { className: "fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex gap-2 justify-end z-20", children: [_jsx("button", { onClick: onCerrar, className: "px-4 py-3 font-bold text-petroleo", children: "Cancelar" }), _jsx("button", { onClick: guardar, disabled: guardando || cargando, className: "bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-xl disabled:opacity-60", children: guardando ? 'Guardando…' : modo.tipo === 'editar' ? 'Guardar cambios' : fechas.length > 1 ? `Crear ${fechas.length} sesiones` : 'Crear sesión' })] })] }));
}
