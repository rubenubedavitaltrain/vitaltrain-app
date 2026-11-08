import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { hoyIso } from '../../lib/fechas';
import { Linea, fechaLarga, num } from '../graficas';
const CAMPOS = [
    { k: 'weight_kg', nombre: 'Peso', unidad: 'kg' },
    { k: 'waist_cm', nombre: 'Cintura', unidad: 'cm' },
    { k: 'hip_cm', nombre: 'Cadera', unidad: 'cm' },
];
export default function Medidas({ supabase, pacienteId, esCoach = false }) {
    const [lista, setLista] = useState(null);
    const [anotando, setAnotando] = useState(false);
    const [ver, setVer] = useState('weight_kg');
    async function cargar() {
        const { data } = await supabase.from('body_measurements').select('id, measured_on, weight_kg, waist_cm, hip_cm').eq('patient_id', pacienteId).order('measured_on');
        setLista((data ?? []).map((m) => ({ ...m, weight_kg: m.weight_kg == null ? null : Number(m.weight_kg), waist_cm: m.waist_cm == null ? null : Number(m.waist_cm), hip_cm: m.hip_cm == null ? null : Number(m.hip_cm) })));
    }
    useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
    const conDato = (k) => (lista ?? []).filter((m) => m[k] != null);
    const campo = CAMPOS.find((c) => c.k === ver);
    const puntos = conDato(ver);
    return (_jsxs("section", { className: "bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3", "aria-labelledby": `medidas-${pacienteId}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { id: `medidas-${pacienteId}`, className: "font-bold", children: esCoach ? 'Medidas' : 'Mis medidas' }), _jsx("p", { className: "text-xs text-texto-suave", children: "Opcional. Mejor siempre a la misma hora, por ejemplo en ayunas." })] }), _jsx("button", { onClick: () => setAnotando(true), className: "shrink-0 bg-mostaza text-[#1F2424] font-bold px-4 py-2.5 rounded-xl", children: "Anotar" })] }), !lista && _jsx("p", { className: "text-sm text-texto-suave", children: "Cargando\u2026" }), lista && lista.length === 0 && _jsx("p", { className: "text-sm text-texto-suave", children: esCoach ? 'Aún no hay medidas anotadas.' : 'Aún no has anotado ninguna medida. Si quieres seguirlas, pulsa «Anotar».' }), lista && lista.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-3 gap-2", children: CAMPOS.map((c) => {
                            const d = conDato(c.k);
                            const ultimo = d[d.length - 1];
                            const dif = d.length > 1 ? ultimo[c.k] - d[0][c.k] : null;
                            return (_jsxs("button", { onClick: () => setVer(c.k), "aria-pressed": ver === c.k, className: `text-left rounded-xl p-3 ${ver === c.k ? 'bg-petroleo text-white' : 'bg-fondo'}`, children: [_jsx("span", { className: "block text-[11px] font-bold uppercase tracking-wide opacity-80", children: c.nombre }), _jsx("span", { className: "block text-xl font-bold", children: ultimo ? `${num(ultimo[c.k])} ${c.unidad}` : '—' }), dif != null && _jsxs("span", { className: "block text-[11px] opacity-80", children: [dif > 0 ? '+' : '', num(dif), " ", c.unidad, " desde el ", fechaLarga(d[0].measured_on)] })] }, c.k));
                        }) }), puntos.length > 0 ? (_jsx(Linea, { puntos: puntos.map((m) => ({ x: m.measured_on, y: m[ver], etiqueta: `${fechaLarga(m.measured_on)}: ${num(m[ver])} ${campo.unidad}` })), dominioX: puntos.map((m) => m.measured_on), unidad: ` ${campo.unidad}`, vacio: "" })) : (_jsxs("p", { className: "text-sm text-texto-suave", children: ["Sin datos de ", campo.nombre.toLowerCase(), "."] })), _jsxs("details", { className: "text-sm", children: [_jsxs("summary", { className: "cursor-pointer font-semibold text-petroleo", children: ["Ver todas las anotaciones (", lista.length, ")"] }), _jsx("ul", { className: "mt-2 flex flex-col", children: [...lista].reverse().map((m) => (_jsxs("li", { className: "flex justify-between gap-2 border-t border-fondo py-1.5", children: [_jsx("span", { className: "text-texto-suave", children: fechaLarga(m.measured_on) }), _jsx("span", { children: CAMPOS.map((c) => (m[c.k] != null ? `${c.nombre.toLowerCase()} ${num(m[c.k])} ${c.unidad}` : null)).filter(Boolean).join(' · ') })] }, m.id))) })] })] })), anotando && _jsx(Anotar, { supabase: supabase, pacienteId: pacienteId, previas: lista ?? [], onCerrar: () => setAnotando(false), onHecho: () => { setAnotando(false); cargar(); } })] }));
}
function Anotar({ supabase, pacienteId, previas, onCerrar, onHecho }) {
    const [fecha, setFecha] = useState(hoyIso());
    const delDia = previas.find((m) => m.measured_on === fecha);
    const [valores, setValores] = useState(() => ({
        weight_kg: delDia?.weight_kg != null ? String(delDia.weight_kg).replace('.', ',') : '',
        waist_cm: delDia?.waist_cm != null ? String(delDia.waist_cm).replace('.', ',') : '',
        hip_cm: delDia?.hip_cm != null ? String(delDia.hip_cm).replace('.', ',') : '',
    }));
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);
    const aNum = (v) => (v.trim() ? Number(v.replace(',', '.')) : null);
    async function guardar() {
        setError('');
        const fila = { patient_id: pacienteId, measured_on: fecha, weight_kg: aNum(valores.weight_kg), waist_cm: aNum(valores.waist_cm), hip_cm: aNum(valores.hip_cm) };
        if (fila.weight_kg == null && fila.waist_cm == null && fila.hip_cm == null)
            return setError('Anota al menos una medida.');
        if ([fila.weight_kg, fila.waist_cm, fila.hip_cm].some((v) => v != null && Number.isNaN(v)))
            return setError('Revisa los números.');
        if (fila.weight_kg != null && (fila.weight_kg < 20 || fila.weight_kg > 350))
            return setError('El peso debe estar entre 20 y 350 kg.');
        if ([fila.waist_cm, fila.hip_cm].some((v) => v != null && (v < 30 || v > 250)))
            return setError('Cintura y cadera deben estar entre 30 y 250 cm.');
        setGuardando(true);
        const { error } = await supabase.from('body_measurements').upsert(fila, { onConflict: 'patient_id,measured_on' });
        setGuardando(false);
        if (error)
            return setError(navigator.onLine ? 'No se ha podido guardar.' : 'Necesitas conexión para guardar las medidas.');
        onHecho();
    }
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": "Anotar medidas", className: "fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6", onClick: onCerrar, children: _jsxs("div", { className: "bg-fondo w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-4", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsx("h3", { className: "text-xl font-bold", children: "Anotar medidas" }), _jsx("button", { onClick: onCerrar, className: "text-petroleo font-bold px-2", children: "Cerrar" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["D\u00EDa", _jsx("input", { type: "date", max: hoyIso(), value: fecha, onChange: (e) => e.target.value && setFecha(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: CAMPOS.map((c) => (_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: [c.nombre, " (", c.unidad, ")", _jsx("input", { inputMode: "decimal", value: valores[c.k], onChange: (e) => setValores((v) => ({ ...v, [c.k]: e.target.value.replace(/[^\d.,]/g, '') })), className: "w-full min-w-0 font-normal text-lg px-3 py-2.5 border border-borde rounded-xl bg-white" })] }, c.k))) }), _jsx("p", { className: "text-xs text-texto-suave", children: "Rellena solo lo que quieras. Si ya anotaste ese d\u00EDa, se sustituye." }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: guardar, disabled: guardando, className: "bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl disabled:opacity-60", children: guardando ? 'Guardando…' : 'Guardar' })] }) }));
}
