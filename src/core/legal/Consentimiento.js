import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { CASILLAS, FECHA_CONSENTIMIENTO, RESUMEN, SECCIONES, VERSION_CONSENTIMIENTO } from './textoConsentimiento';
const clave = (u) => `vt.${u}.consentimiento`;
function leerCopia(u) { try {
    return JSON.parse(localStorage.getItem(clave(u)) ?? 'null');
}
catch {
    return null;
} }
function guardarCopia(u, c) { try {
    if (c)
        localStorage.setItem(clave(u), JSON.stringify(c));
    else
        localStorage.removeItem(clave(u));
}
catch { /* sin almacenamiento */ } }
export function useConsentimiento(supabase, userId) {
    const [actual, setActual] = useState(() => leerCopia(userId) ?? undefined);
    const [sinConexion, setSinConexion] = useState(false);
    const cargar = useCallback(async () => {
        const { data, error } = await supabase
            .from('consents')
            .select('version, accepted_at')
            .eq('patient_id', userId)
            .is('withdrawn_at', null)
            .is('replaced_at', null)
            .maybeSingle();
        if (error) {
            // Sin conexión: vale la última copia guardada en el móvil
            setSinConexion(true);
            setActual((a) => (a === undefined ? leerCopia(userId) : a));
            return;
        }
        setSinConexion(false);
        const c = data ?? null;
        guardarCopia(userId, c);
        setActual(c);
    }, [supabase, userId]);
    useEffect(() => { cargar(); }, [cargar]);
    const estado = actual === undefined ? 'cargando' : !actual ? 'falta' : actual.version !== VERSION_CONSENTIMIENTO ? 'nueva-version' : 'vigente';
    return { estado, actual: actual ?? null, sinConexion, recargar: cargar };
}
export function TextoCompleto() {
    return (_jsxs("div", { className: "flex flex-col gap-4 text-[15px] leading-relaxed", children: [SECCIONES.map((s) => (_jsxs("section", { className: "flex flex-col gap-1.5", children: [_jsx("h3", { className: "font-bold", children: s.titulo }), s.parrafos.map((p, i) => _jsx("p", { children: p }, i))] }, s.titulo))), _jsxs("p", { className: "text-xs text-texto-suave", children: ["Versi\u00F3n ", VERSION_CONSENTIMIENTO, " \u00B7 ", FECHA_CONSENTIMIENTO] })] }));
}
/** Pantalla que bloquea la app hasta que el paciente acepta. */
export function PantallaConsentimiento({ supabase, nombre, nuevaVersion, onAceptado, onSalir }) {
    const [marcadas, setMarcadas] = useState(CASILLAS.map(() => false));
    const [completo, setCompleto] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [rechazado, setRechazado] = useState(false);
    const todas = marcadas.every(Boolean);
    async function aceptar() {
        setError('');
        setEnviando(true);
        const { error } = await supabase.rpc('accept_consent', { p_version: VERSION_CONSENTIMIENTO, p_user_agent: navigator.userAgent.slice(0, 300) });
        setEnviando(false);
        if (error)
            return setError(navigator.onLine ? 'No se ha podido guardar. Inténtalo de nuevo.' : 'Necesitas conexión a internet para aceptar.');
        onAceptado();
    }
    if (rechazado) {
        return (_jsxs("div", { className: "min-h-full flex flex-col bg-fondo", children: [_jsx("header", { className: "bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6", children: _jsx("h1", { className: "text-2xl font-bold", children: "Sin consentimiento no podemos guardar tus datos" }) }), _jsxs("div", { className: "p-5 flex flex-col gap-4", children: [_jsx("p", { children: "Lo entendemos. Sin tu consentimiento la app no puede registrar tus entrenamientos." }), _jsx("p", { children: "Tu acompa\u00F1amiento puede seguir por otras v\u00EDas. Habla con Rub\u00E9n para acordarlo." }), _jsx("button", { onClick: () => setRechazado(false), className: "bg-mostaza text-[#1F2424] font-bold py-4 rounded-2xl", children: "Volver a leerlo" }), _jsx("button", { onClick: onSalir, className: "bg-white text-petroleo border-2 border-petroleo font-bold py-3.5 rounded-2xl", children: "Cerrar sesi\u00F3n" })] })] }));
    }
    return (_jsxs("div", { className: "min-h-full flex flex-col bg-fondo", children: [_jsxs("header", { className: "bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6", children: [_jsx("img", { src: "/marca/logotipo-blanco.png", alt: "Vitaltrain", className: "h-10 w-auto mb-3" }), _jsx("h1", { className: "text-2xl font-bold leading-tight", children: nuevaVersion ? 'Hemos actualizado cómo tratamos tus datos' : `Antes de empezar, ${nombre}` }), _jsx("p", { className: "text-[#E3E8E8] mt-1", children: nuevaVersion ? 'Léelo y acéptalo para seguir usando la app.' : 'Tus datos de salud son tuyos. Así los cuidamos.' })] }), _jsxs("div", { className: "p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] flex flex-col gap-4 max-w-2xl w-full mx-auto", children: [_jsxs("section", { className: "bg-white rounded-2xl p-5", children: [_jsx("ul", { className: "flex flex-col gap-3", children: RESUMEN.map((r, i) => (_jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "mt-2 w-2 h-2 rounded-full bg-mostaza shrink-0", "aria-hidden": "true" }), _jsx("span", { className: "leading-snug", children: r })] }, i))) }), _jsx("button", { onClick: () => setCompleto((c) => !c), "aria-expanded": completo, className: "mt-4 text-petroleo font-bold underline underline-offset-4", children: completo ? 'Ocultar la información completa' : 'Leer la información completa' }), completo && _jsx("div", { className: "mt-4 border-t border-gris-claro pt-4", children: _jsx(TextoCompleto, {}) })] }), _jsx("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-4", children: CASILLAS.map((c, i) => (_jsxs("label", { className: "flex gap-3 items-start cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: marcadas[i], onChange: (e) => setMarcadas((m) => m.map((x, j) => (j === i ? e.target.checked : x))), className: "mt-0.5 w-6 h-6 shrink-0 accent-[#374949]" }), _jsx("span", { className: "leading-snug", children: c })] }, i))) }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: aceptar, disabled: !todas || enviando, className: "bg-mostaza text-[#1F2424] font-bold py-4 rounded-2xl text-lg disabled:opacity-50", children: enviando ? 'Guardando…' : 'Acepto y continúo' }), _jsx("button", { onClick: () => setRechazado(true), className: "text-texto-suave font-semibold py-2", children: "No acepto" }), _jsxs("p", { className: "text-center text-xs text-texto-suave", children: ["Versi\u00F3n ", VERSION_CONSENTIMIENTO, " \u00B7 ", FECHA_CONSENTIMIENTO] })] })] }));
}
/** Sección «Privacidad» del perfil del paciente. */
export function Privacidad({ supabase, actual, onRetirado }) {
    const [verTexto, setVerTexto] = useState(false);
    const [error, setError] = useState('');
    async function retirar() {
        if (!window.confirm('Si retiras tu consentimiento, dejarás de poder ver tu plan y registrar entrenamientos en la app. Tus datos se conservarán bloqueados el tiempo que indica el texto. ¿Retirarlo?'))
            return;
        const { error } = await supabase.rpc('withdraw_consent');
        if (error)
            return setError('No se ha podido retirar. Comprueba la conexión.');
        onRetirado();
    }
    return (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "privacidad", children: [_jsx("h2", { id: "privacidad", className: "text-lg font-bold", children: "Privacidad" }), actual && (_jsxs("p", { className: "text-sm text-texto-suave", children: ["Aceptaste la versi\u00F3n ", actual.version, " el ", new Date(actual.accepted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }), "."] })), _jsx("button", { onClick: () => setVerTexto((v) => !v), "aria-expanded": verTexto, className: "self-start text-petroleo font-bold", children: verTexto ? 'Ocultar qué datos se guardan' : 'Qué datos se guardan y para qué' }), verTexto && _jsx("div", { className: "border-t border-gris-claro pt-3", children: _jsx(TextoCompleto, {}) }), _jsx("p", { className: "text-sm text-texto-suave", children: "Para pedir una copia de tus datos, corregirlos o borrarlos, escribe a Rub\u00E9n. Pronto podr\u00E1s descargarlos desde aqu\u00ED." }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("button", { onClick: retirar, className: "self-start text-[#8A2C1D] font-bold py-1", children: "Retirar mi consentimiento" })] }));
}
