import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { desdeIso, diaMes, hoyIso, iso, sumarDias } from '../../lib/fechas';
import { TIPOS_COMIDA } from './datos';
// Registro de sueño (menos de 20 segundos) y de comidas (solo hora y tipo).
// Los usan el paciente y el coach (que puede anotar en consulta).
const LATENCIAS = [{ t: '< 10 min', v: 5 }, { t: '10-20', v: 15 }, { t: '20-30', v: 25 }, { t: '30-60', v: 45 }, { t: '> 1 h', v: 75 }];
const DESPERTARES = [{ t: '0', v: 0 }, { t: '1', v: 1 }, { t: '2', v: 2 }, { t: '3', v: 3 }, { t: '4+', v: 4 }];
const CALIDAD = ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'];
const DESCANSO = ['Agotado', 'Cansado', 'Normal', 'Descansado', 'Con energía'];
const hhmm = (isoTs) => (isoTs ? new Date(isoTs).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');
const diaIso = (d) => (d.getDay() + 6) % 7 + 1; // 1 = lunes … 7 = domingo
/** Noche "de ayer" hasta las 18:00; después, la de hoy. */
export const nochePorDefecto = () => iso(sumarDias(new Date(), new Date().getHours() < 18 ? -1 : 0));
/** Une la fecha de la noche y las horas: acostarse antes de las 12:00 es ya el día siguiente; levantarse, siempre el día siguiente. */
export function aMomentos(noche, acostarse, levantarse) {
    const d = desdeIso(noche);
    const [ha, ma] = acostarse.split(':').map(Number);
    const [hl, ml] = levantarse.split(':').map(Number);
    const cama = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (ha < 12 ? 1 : 0), ha, ma);
    let arriba = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hl, ml);
    if (arriba <= cama)
        arriba = new Date(arriba.valueOf() + 86400000);
    return { cama, arriba };
}
export function RegistroSueno({ supabase, pacienteId, previas, workdays, onCerrar, onHecho }) {
    const [noche, setNoche] = useState(nochePorDefecto());
    const existente = previas.find((n) => n.night_of === noche);
    const modelo = existente ?? previas.find((n) => n.bedtime && n.wake_time);
    const [acostarse, setAcostarse] = useState(hhmm(modelo?.bedtime ?? null) || '23:30');
    const [levantarse, setLevantarse] = useState(hhmm(modelo?.wake_time ?? null) || '07:30');
    const [latencia, setLatencia] = useState(existente?.sleep_latency_minutes ?? null);
    const [despertares, setDespertares] = useState(existente?.awakenings ?? null);
    const [calidad, setCalidad] = useState(existente?.quality ?? null);
    const [descanso, setDescanso] = useState(existente?.rested ?? null);
    const librePorDefecto = (n) => !workdays.includes(diaIso(sumarDias(desdeIso(n), 1)));
    const [libre, setLibre] = useState(existente?.is_free_day ?? librePorDefecto(noche));
    const [nota, setNota] = useState(existente?.note ?? '');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);
    function cambiarNoche(n) {
        setNoche(n);
        const e = previas.find((x) => x.night_of === n);
        if (e) {
            setAcostarse(hhmm(e.bedtime) || acostarse);
            setLevantarse(hhmm(e.wake_time) || levantarse);
            setLatencia(e.sleep_latency_minutes);
            setDespertares(e.awakenings);
            setCalidad(e.quality);
            setDescanso(e.rested);
            setLibre(e.is_free_day ?? librePorDefecto(n));
            setNota(e.note ?? '');
        }
        else
            setLibre(librePorDefecto(n));
    }
    const { cama, arriba } = aMomentos(noche, acostarse, levantarse);
    const horas = (arriba.valueOf() - cama.valueOf()) / 3600000;
    async function guardar() {
        setError('');
        if (horas > 20)
            return setError('Revisa las horas: salen más de 20 horas en la cama.');
        if (arriba.valueOf() > Date.now() + 10 * 60000)
            return setError('La hora de levantarte aún no ha llegado. Anótalo cuando te levantes.');
        setGuardando(true);
        const { error } = await supabase.from('sleep_logs').upsert({
            patient_id: pacienteId, night_of: noche, bedtime: cama.toISOString(), wake_time: arriba.toISOString(),
            sleep_latency_minutes: latencia, awakenings: despertares, quality: calidad, rested: descanso, is_free_day: libre, note: nota.trim() || null,
        }, { onConflict: 'patient_id,night_of' });
        setGuardando(false);
        if (error)
            return setError(navigator.onLine ? 'No se ha podido guardar.' : 'Necesitas conexión para guardar.');
        onHecho();
    }
    const ayer = iso(sumarDias(new Date(), -1));
    return (_jsxs(Hoja, { titulo: "\u00BFC\u00F3mo has dormido?", onCerrar: onCerrar, children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Noche del", _jsx("input", { type: "date", max: hoyIso(), value: noche, onChange: (e) => e.target.value && cambiarNoche(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" }), _jsxs("span", { className: "font-normal text-xs text-texto-suave", children: [noche === ayer ? 'Anoche' : noche === hoyIso() ? 'Esta noche' : `Del ${diaMes(desdeIso(noche))} al ${diaMes(sumarDias(desdeIso(noche), 1))}`, existente ? ' · ya anotada: se sustituye' : ''] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Me acost\u00E9", _jsx("input", { type: "time", value: acostarse, onChange: (e) => e.target.value && setAcostarse(e.target.value), className: "font-normal text-lg px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Me levant\u00E9", _jsx("input", { type: "time", value: levantarse, onChange: (e) => e.target.value && setLevantarse(e.target.value), className: "font-normal text-lg px-3 py-2.5 border border-borde rounded-xl bg-white" })] })] }), _jsxs("p", { className: "text-xs text-texto-suave -mt-2", children: [Math.floor(horas), " h ", String(Math.round((horas % 1) * 60)).padStart(2, '0'), " min en la cama."] }), _jsx(Chips, { titulo: "Tard\u00E9 en dormirme", opciones: LATENCIAS, valor: latencia, onCambio: setLatencia }), _jsx(Chips, { titulo: "Me despert\u00E9", opciones: DESPERTARES, valor: despertares, onCambio: setDespertares, sufijo: "veces" }), _jsx(Escala, { titulo: "Calidad del sue\u00F1o", etiquetas: CALIDAD, valor: calidad, onCambio: setCalidad }), _jsx(Escala, { titulo: "Al levantarme estaba", etiquetas: DESCANSO, valor: descanso, onCambio: setDescanso }), _jsxs("label", { className: "flex items-center gap-3 text-sm font-semibold", children: [_jsx("input", { type: "checkbox", checked: libre, onChange: (e) => setLibre(e.target.checked), className: "w-5 h-5 accent-[#374949]" }), "Al d\u00EDa siguiente no trabajaba (d\u00EDa libre)"] }), _jsxs("details", { className: "text-sm", children: [_jsx("summary", { className: "cursor-pointer font-semibold text-petroleo", children: "A\u00F1adir una nota" }), _jsx("textarea", { value: nota, onChange: (e) => setNota(e.target.value.slice(0, 500)), rows: 2, placeholder: "Ej.: cen\u00E9 tarde, me despert\u00E9 con calor", className: "mt-2 w-full text-base px-3 py-2 border border-borde rounded-xl bg-white" })] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: guardar, disabled: guardando, className: "bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl disabled:opacity-60", children: guardando ? 'Guardando…' : 'Guardar' })] }));
}
export function RegistroComida({ supabase, pacienteId, onCerrar, onHecho }) {
    const ahora = new Date();
    const [dia, setDia] = useState(hoyIso());
    const [hora, setHora] = useState(ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    const sugerido = ahora.getHours() < 11 ? 'breakfast' : ahora.getHours() < 17 ? 'lunch' : 'dinner';
    const [tipo, setTipo] = useState(sugerido);
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);
    async function guardar() {
        setError('');
        const [h, m] = hora.split(':').map(Number);
        const d = desdeIso(dia);
        d.setHours(h, m, 0, 0);
        if (d.valueOf() > Date.now() + 10 * 60000)
            return setError('Esa hora aún no ha llegado.');
        if (d.valueOf() < Date.now() - 30 * 86400000)
            return setError('Solo se pueden anotar comidas de los últimos 30 días.');
        setGuardando(true);
        const { error } = await supabase.from('meal_events').insert({ patient_id: pacienteId, eaten_at: d.toISOString(), kind: tipo });
        setGuardando(false);
        if (error)
            return setError(navigator.onLine ? 'No se ha podido guardar.' : 'Necesitas conexión para guardar.');
        onHecho();
    }
    return (_jsxs(Hoja, { titulo: "Anotar una comida", onCerrar: onCerrar, children: [_jsx("p", { className: "text-sm text-texto-suave -mt-2", children: "Solo la hora. Sirve para ver tu ventana de alimentaci\u00F3n." }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: Object.keys(TIPOS_COMIDA).filter((t) => t !== 'other').map((t) => (_jsx("button", { onClick: () => setTipo(t), "aria-pressed": tipo === t, className: `py-3 rounded-xl font-semibold ${tipo === t ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`, children: TIPOS_COMIDA[t] }, t))) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["D\u00EDa", _jsx("input", { type: "date", max: hoyIso(), value: dia, onChange: (e) => e.target.value && setDia(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Hora", _jsx("input", { type: "time", value: hora, onChange: (e) => e.target.value && setHora(e.target.value), className: "font-normal text-lg px-3 py-2 border border-borde rounded-xl bg-white" })] })] }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: guardar, disabled: guardando, className: "bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl disabled:opacity-60", children: guardando ? 'Guardando…' : 'Guardar' })] }));
}
/** Comidas de un día con su ventana, y botón para borrar una anotada por error. */
export function ComidasDelDia({ supabase, comidas, onCambio }) {
    const hoy = comidas.filter((c) => iso(new Date(c.eaten_at)) === hoyIso());
    if (hoy.length === 0)
        return _jsx("p", { className: "text-sm text-texto-suave", children: "Hoy a\u00FAn no has anotado ninguna comida." });
    const primera = new Date(hoy[0].eaten_at), ultima = new Date(hoy[hoy.length - 1].eaten_at);
    const min = (ultima.valueOf() - primera.valueOf()) / 60000;
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("ul", { className: "flex flex-col", children: hoy.map((c) => (_jsxs("li", { className: "flex items-center justify-between gap-2 border-t border-fondo py-1.5 text-sm", children: [_jsxs("span", { children: [_jsx("b", { className: "tabular-nums", children: hhmm(c.eaten_at) }), " \u00B7 ", TIPOS_COMIDA[c.kind]] }), _jsx("button", { onClick: async () => { if (window.confirm('¿Borrar esta comida?')) {
                                await supabase.from('meal_events').delete().eq('id', c.id);
                                onCambio();
                            } }, className: "text-xs font-semibold text-texto-suave px-2 py-1", children: "Borrar" })] }, c.id))) }), hoy.length > 1 && _jsxs("p", { className: "text-sm", children: ["Ventana de hoy: ", _jsxs("b", { children: [Math.floor(min / 60), " h ", String(Math.round(min % 60)).padStart(2, '0'), " min"] }), ", de ", hhmm(hoy[0].eaten_at), " a ", hhmm(hoy[hoy.length - 1].eaten_at), "."] })] }));
}
// ---------- Piezas ----------
export function Hoja({ titulo, onCerrar, children }) {
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": titulo, className: "fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6", onClick: onCerrar, children: _jsxs("div", { className: "bg-fondo w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-4", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsx("h3", { className: "text-xl font-bold", children: titulo }), _jsx("button", { onClick: onCerrar, className: "text-petroleo font-bold px-2", children: "Cerrar" })] }), children] }) }));
}
function Chips({ titulo, opciones, valor, onCambio, sufijo }) {
    return (_jsxs("fieldset", { className: "flex flex-col gap-1.5", children: [_jsxs("legend", { className: "text-sm font-semibold mb-1.5", children: [titulo, sufijo ? ` (${sufijo})` : ''] }), _jsx("div", { className: "flex gap-1.5", children: opciones.map((o) => (_jsx("button", { type: "button", onClick: () => onCambio(valor === o.v ? null : o.v), "aria-pressed": valor === o.v, className: `flex-1 py-2.5 rounded-xl text-sm font-semibold ${valor === o.v ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`, children: o.t }, o.t))) })] }));
}
function Escala({ titulo, etiquetas, valor, onCambio }) {
    return (_jsxs("fieldset", { className: "flex flex-col gap-1.5", children: [_jsxs("legend", { className: "text-sm font-semibold mb-1.5", children: [titulo, valor ? `: ${etiquetas[valor - 1].toLowerCase()}` : ''] }), _jsx("div", { className: "flex gap-1.5", children: etiquetas.map((e, i) => (_jsx("button", { type: "button", onClick: () => onCambio(valor === i + 1 ? null : i + 1), "aria-pressed": valor === i + 1, "aria-label": e, className: `flex-1 py-2.5 rounded-xl text-base font-bold ${valor === i + 1 ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`, children: i + 1 }, e))) })] }));
}
