import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import Biblioteca from '../../modules/entrenamiento/biblioteca/Biblioteca';
import Pacientes from './Pacientes';
import Inicio from './Inicio';
import Mensajes from './Mensajes';
import { contarNoLeidos } from '../mensajes/Conversacion';
import Programas from '../../modules/entrenamiento/programas/Programas';
import Plantillas from '../../modules/entrenamiento/plantillas/Plantillas';
export default function PanelCoach({ supabase, nombre, userId }) {
    const [seccion, setSeccion] = useState(() => {
        try {
            return localStorage.getItem('vt.coach.seccion') || 'inicio';
        }
        catch {
            return 'inicio';
        }
    });
    const [abrir, setAbrir] = useState(null);
    const [noLeidos, setNoLeidos] = useState(0);
    useEffect(() => {
        const contar = () => contarNoLeidos(supabase, userId).then(setNoLeidos);
        contar();
        const t = window.setInterval(contar, 60000);
        return () => window.clearInterval(t);
    }, [supabase, userId]);
    const ir = (s) => {
        setSeccion(s);
        try {
            localStorage.setItem('vt.coach.seccion', s);
        }
        catch { /* sin almacenamiento */ }
    };
    const pestaña = (s, texto, aviso = 0) => (_jsxs("button", { onClick: () => ir(s), "aria-current": seccion === s ? 'page' : undefined, className: `px-3 sm:px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${seccion === s ? 'bg-mostaza text-[#1F2424]' : 'text-white'}`, children: [texto, aviso > 0 && _jsx("span", { className: "ml-1.5 inline-flex min-w-5 h-5 px-1.5 rounded-full bg-white text-[#1F2424] text-xs font-bold items-center justify-center", "aria-label": `${aviso} sin leer`, children: aviso })] }));
    return (_jsxs("div", { className: "min-h-full flex flex-col", children: [_jsxs("header", { className: "bg-petroleo text-white px-4 sm:px-5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 flex flex-wrap items-center gap-x-3 gap-y-2", children: [_jsx("img", { src: "/marca/logotipo-blanco.png", alt: "Vitaltrain", className: "h-8 sm:h-10 w-auto" }), _jsx("button", { onClick: () => supabase.auth.signOut(), className: "order-2 sm:order-3 ml-auto text-sm font-semibold text-[#E3E8E8] px-2 py-2", children: "Salir" }), _jsxs("nav", { "aria-label": "Panel del coach", className: "order-3 sm:order-2 w-full sm:w-auto sm:flex-1 flex gap-1 overflow-x-auto -mx-1 px-1", children: [pestaña('inicio', 'Inicio'), pestaña('pacientes', 'Pacientes'), pestaña('mensajes', 'Mensajes', noLeidos), pestaña('programas', 'Programas'), pestaña('plantillas', 'Plantillas'), pestaña('biblioteca', 'Biblioteca')] })] }), _jsxs("main", { className: "flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]", children: [seccion === 'inicio' && _jsx(Inicio, { supabase: supabase, nombre: nombre, onAbrir: (id) => { setAbrir(id); ir('pacientes'); } }), seccion === 'mensajes' && _jsx(Mensajes, { supabase: supabase, yo: userId, onAbrirFicha: (id) => { setAbrir(id); ir('pacientes'); } }), seccion === 'pacientes' && _jsx(Pacientes, { supabase: supabase, abrirId: abrir, onAbierto: () => setAbrir(null) }), seccion === 'programas' && _jsx(Programas, { supabase: supabase }), seccion === 'plantillas' && _jsx(Plantillas, { supabase: supabase }), seccion === 'biblioteca' && _jsx(Biblioteca, { supabase: supabase })] }), _jsxs("footer", { className: "px-6 pb-4 text-center text-xs text-texto-suave", children: ["Rub\u00E9n \u00DAbeda Rubio, T.S.D. Sanitario Colegiado 2209 \u00B7 Cl\u00EDnica Vitaltrain, Centro Sanitario N\u00BA Registro 22433 \u00B7 Versi\u00F3n ", __APP_VERSION__] })] }));
}
