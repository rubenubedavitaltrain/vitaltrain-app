import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { MiSemana, TarjetaHoy } from '../../modules/entrenamiento/paciente/Semana';
import Entrenamiento from '../../modules/entrenamiento/paciente/Entrenamiento';
import Progreso from '../../modules/entrenamiento/progreso/Progreso';
import Medidas from '../medidas/Medidas';
import Conversacion, { contarNoLeidos } from '../mensajes/Conversacion';
import Instalar from '../Instalar';
import { MiRitmo, TarjetaRitmo } from '../../modules/circadiano/Ritmo';
import { PantallaConsentimiento, Privacidad, useConsentimiento } from '../legal/Consentimiento';
import { descartarFallidos, fallidos, pendientes, usarCuenta, vaciarCola } from '../../modules/entrenamiento/paciente/datos';
// Qué pilar ilumina cada módulo
const PILAR_DE_MODULO = { training: 'movimiento-inteligente', circadian: 'ritmos-circadianos' };
function leer(k) { try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : null;
}
catch {
    return null;
} }
function escribir(k, v) { try {
    localStorage.setItem(k, JSON.stringify(v));
}
catch { /* nada */ } }
export default function AppPaciente({ supabase, userId, nombre, email }) {
    usarCuenta(userId);
    const [pestaña, setPestaña] = useState('hoy');
    const [abierta, setAbierta] = useState(null);
    const [ritmo, setRitmo] = useState(false);
    const [pilares, setPilares] = useState(() => leer('vt.pilares') ?? []);
    const [modulos, setModulos] = useState(() => leer('vt.modulos') ?? ['training']);
    const [recarga, setRecarga] = useState(0);
    const consentimiento = useConsentimiento(supabase, userId);
    const [noLeidos, setNoLeidos] = useState(0);
    const conConsentimiento = consentimiento.estado === 'vigente';
    useEffect(() => {
        if (!conConsentimiento)
            return;
        vaciarCola(supabase);
        supabase.from('pillars').select('slug, name, description').order('position').then(({ data }) => {
            if (data) {
                setPilares(data);
                escribir('vt.pilares', data);
            }
        });
        supabase.from('patient_modules').select('module_slug').eq('patient_id', userId).then(({ data }) => {
            if (data) {
                const m = data.map((x) => x.module_slug);
                setModulos(m);
                escribir('vt.modulos', m);
            }
        });
        const contar = () => contarNoLeidos(supabase, userId).then(setNoLeidos).catch(() => { });
        contar();
        const t = window.setInterval(contar, 60000);
        const online = () => vaciarCola(supabase);
        window.addEventListener('online', online);
        return () => { window.removeEventListener('online', online); window.clearInterval(t); };
    }, [supabase, userId, conConsentimiento]);
    if (consentimiento.estado === 'cargando')
        return _jsx("div", { className: "min-h-full flex items-center justify-center text-texto-suave", children: "Cargando\u2026" });
    if (!conConsentimiento) {
        return (_jsx(PantallaConsentimiento, { supabase: supabase, nombre: nombre, nuevaVersion: consentimiento.estado === 'nueva-version', onAceptado: consentimiento.recargar, onSalir: () => supabase.auth.signOut() }));
    }
    if (abierta) {
        return _jsx(Entrenamiento, { supabase: supabase, sesionId: abierta, pacienteId: userId, onSalir: () => { setAbierta(null); setRecarga((r) => r + 1); } });
    }
    if (ritmo)
        return _jsx(MiRitmo, { supabase: supabase, pacienteId: userId, onSalir: () => { setRitmo(false); setRecarga((r) => r + 1); } });
    const activos = new Set(modulos.map((m) => PILAR_DE_MODULO[m]).filter(Boolean));
    return (_jsxs("div", { className: "min-h-full flex flex-col", children: [_jsxs("div", { className: "flex-1 pb-24", children: [pestaña === 'hoy' && (_jsxs(_Fragment, { children: [_jsxs("header", { className: "bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6", children: [_jsx("img", { src: "/marca/logotipo-blanco.png", alt: "Vitaltrain", className: "h-12 w-auto mb-3" }), _jsxs("h1", { className: "text-3xl font-bold", children: ["Hola, ", nombre] }), _jsx("p", { className: "text-[#E3E8E8] mt-1", children: new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) })] }), _jsxs("main", { className: "p-4 flex flex-col gap-4", children: [fallidos() > 0 && (_jsxs("div", { role: "alert", className: "bg-white rounded-2xl p-4 border-l-4 border-[#8A2C1D] flex flex-col gap-2", children: [_jsx("p", { className: "font-semibold", children: fallidos() === 1 ? 'Un registro no se ha podido guardar' : `${fallidos()} registros no se han podido guardar` }), _jsx("p", { className: "text-sm text-texto-suave", children: "Rub\u00E9n cambi\u00F3 esa sesi\u00F3n mientras entrenabas sin conexi\u00F3n. Escr\u00EDbele por Mensajes con lo que hiciste para que lo tenga en cuenta." }), _jsx("button", { onClick: () => { descartarFallidos(); setRecarga((r) => r + 1); }, className: "self-start text-sm font-bold text-petroleo", children: "Entendido" })] })), modulos.includes('training') && _jsx(TarjetaHoy, { supabase: supabase, onAbrir: setAbierta }), modulos.includes('circadian') && _jsx(TarjetaRitmo, { supabase: supabase, pacienteId: userId, onAbrir: () => setRitmo(true) }), pilares.length > 0 && (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "pilares", children: [_jsx("h2", { id: "pilares", className: "text-xs font-bold tracking-wide text-texto-suave", children: "TUS PILARES" }), _jsx("ul", { className: "flex flex-col gap-3", children: pilares.map((p) => {
                                                    const on = activos.has(p.slug);
                                                    return (_jsxs("li", { className: `flex gap-3 ${on ? '' : 'opacity-45'}`, children: [_jsx("span", { className: `mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${on ? 'bg-mostaza' : 'bg-borde'}`, "aria-hidden": "true" }), _jsxs("span", { children: [_jsxs("span", { className: "block font-semibold", children: [p.name, on ? '' : ' · próximamente'] }), p.description && _jsx("span", { className: "block text-sm text-texto-suave leading-snug", children: p.description })] })] }, p.slug));
                                                }) })] }))] })] })), pestaña === 'semana' && _jsx(MiSemana, { supabase: supabase, onAbrir: setAbierta }), pestaña === 'mensajes' && (_jsxs("div", { className: "flex flex-col h-[calc(100dvh-5.5rem)]", children: [_jsxs("header", { className: "bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 shrink-0", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Mensajes" }), _jsx("p", { className: "text-[#E3E8E8] text-sm", children: "Con Rub\u00E9n. Para urgencias, llama al 112." })] }), _jsx(Conversacion, { supabase: supabase, pacienteId: userId, yo: userId, esCoach: false, alto: "flex-1", onLeidos: () => setNoLeidos(0) })] })), pestaña === 'progreso' && (_jsxs("div", { className: "flex flex-col", children: [_jsxs("header", { className: "bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Mi progreso" }), _jsx("p", { className: "text-[#E3E8E8] text-sm mt-1", children: "Lo que has hecho, semana a semana." })] }), _jsxs("div", { className: "p-4 flex flex-col gap-4", children: [_jsx(Progreso, { supabase: supabase, pacienteId: userId }), _jsx(Medidas, { supabase: supabase, pacienteId: userId })] })] })), pestaña === 'perfil' && _jsx(Perfil, { supabase: supabase, nombre: nombre, email: email, consentimiento: consentimiento.actual, onRetirado: () => { setPestaña('hoy'); consentimiento.recargar(); } })] }, recarga), _jsxs("nav", { "aria-label": "Navegaci\u00F3n principal", className: "fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro grid grid-cols-5 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] z-20", children: [_jsx(Boton, { activo: pestaña === 'hoy', onClick: () => setPestaña('hoy'), texto: "Hoy", icono: _jsx("path", { d: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" }) }), _jsx(Boton, { activo: pestaña === 'semana', onClick: () => setPestaña('semana'), texto: "Semana", icono: _jsxs(_Fragment, { children: [_jsx("rect", { x: "3", y: "5", width: "18", height: "16", rx: "2" }), _jsx("path", { d: "M3 10h18M8 3v4M16 3v4" })] }) }), _jsx(Boton, { activo: pestaña === 'progreso', onClick: () => setPestaña('progreso'), texto: "Progreso", icono: _jsx("path", { d: "M4 20V10M10 20V4M16 20v-7M22 20H2" }) }), _jsx(Boton, { activo: pestaña === 'mensajes', onClick: () => setPestaña('mensajes'), texto: "Mensajes", aviso: noLeidos, icono: _jsx("path", { d: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" }) }), _jsx(Boton, { activo: pestaña === 'perfil', onClick: () => setPestaña('perfil'), texto: "Perfil", icono: _jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "8", r: "4" }), _jsx("path", { d: "M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" })] }) })] })] }));
}
function Boton({ activo, onClick, texto, icono, aviso = 0 }) {
    return (_jsxs("button", { onClick: onClick, "aria-current": activo ? 'page' : undefined, className: `flex flex-col items-center gap-1 py-1.5 text-[13px] ${activo ? 'text-petroleo font-bold' : 'text-texto-suave font-medium'}`, children: [_jsxs("span", { className: "relative", children: [_jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: icono }), aviso > 0 && _jsx("span", { className: "absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-mostaza text-[#1F2424] text-[10px] font-bold flex items-center justify-center", "aria-label": `${aviso} sin leer`, children: aviso })] }), texto] }));
}
function Perfil({ supabase, nombre, email, consentimiento, onRetirado }) {
    return (_jsxs("div", { className: "flex flex-col", children: [_jsx("header", { className: "bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-6", children: _jsx("h1", { className: "text-2xl font-bold", children: "Perfil" }) }), _jsxs("div", { className: "p-4 flex flex-col gap-3", children: [_jsxs("div", { className: "bg-white rounded-2xl p-5", children: [_jsx("div", { className: "text-lg font-bold", children: nombre }), _jsx("div", { className: "text-sm text-texto-suave", children: email })] }), _jsx(Instalar, {}), _jsx(Privacidad, { supabase: supabase, actual: consentimiento, onRetirado: onRetirado }), _jsx("div", { className: "bg-white rounded-2xl p-5 text-sm text-texto-suave", children: "Recordatorios y avisos llegar\u00E1n en las pr\u00F3ximas versiones." }), _jsx("button", { onClick: () => {
                            const n = pendientes();
                            if (n && !window.confirm(`Tienes ${n} registros sin enviar porque no hay conexión. Se enviarán cuando vuelvas a entrar con esta cuenta. ¿Cerrar sesión igualmente?`))
                                return;
                            supabase.auth.signOut();
                        }, className: "bg-white text-petroleo border-2 border-petroleo font-bold py-3.5 rounded-2xl", children: "Cerrar sesi\u00F3n" }), _jsxs("p", { className: "text-center text-xs text-texto-suave mt-2", children: ["Rub\u00E9n \u00DAbeda Rubio, T.S.D. Sanitario Colegiado 2209 \u00B7 Cl\u00EDnica Vitaltrain, Centro Sanitario N\u00BA Registro 22433 \u00B7 Versi\u00F3n ", __APP_VERSION__] })] })] }));
}
