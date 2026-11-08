import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Acceso from './core/acceso/Acceso';
import PanelCoach from './core/coach/PanelCoach';
import AppPaciente from './core/paciente/AppPaciente';
import { limpiarCuenta } from './modules/entrenamiento/paciente/datos';
function Pie() {
    return (_jsxs("footer", { className: "px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-xs leading-relaxed text-texto-suave", children: ["Rub\u00E9n \u00DAbeda Rubio, T.S.D. Sanitario Colegiado 2209 \u00B7 Cl\u00EDnica Vitaltrain, Centro Sanitario N\u00BA Registro 22433", _jsx("br", {}), "Versi\u00F3n ", __APP_VERSION__] }));
}
function Cabecera({ titulo, texto }) {
    return (_jsxs("header", { className: "bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),3rem)] pb-8", children: [_jsx("img", { src: "/marca/logotipo-blanco.png", alt: "Vitaltrain \u00B7 Health balance, training, nutrition", className: "h-20 w-auto" }), _jsx("h1", { className: "mt-3 text-3xl font-bold leading-tight", children: titulo }), _jsx("p", { className: "mt-2 text-base text-[#E3E8E8]", children: texto })] }));
}
function Mensaje({ titulo, texto, onSalir }) {
    return (_jsxs("div", { className: "min-h-full flex flex-col", children: [_jsx(Cabecera, { titulo: titulo, texto: texto }), _jsx("main", { className: "flex-1 px-5 py-6 flex flex-col gap-4", children: onSalir && (_jsx("button", { onClick: onSalir, className: "bg-white text-petroleo border-2 border-petroleo text-base font-bold py-3.5 rounded-2xl", children: "Cerrar sesi\u00F3n" })) }), _jsx(Pie, {})] }));
}
function Inicio({ supabase, session }) {
    const [perfil, setPerfil] = useState(undefined);
    useEffect(() => {
        let vivo = true;
        (async () => {
            const { data, error } = await supabase.from('profiles').select('full_name, role, status').eq('id', session.user.id).maybeSingle();
            if (!vivo)
                return;
            if (error) {
                // Sin conexión: usar la última copia del perfil
                let copia = null;
                try {
                    copia = JSON.parse(localStorage.getItem('vt.perfil') ?? 'null');
                }
                catch { /* sin copia */ }
                setPerfil(copia);
            }
            else {
                setPerfil(data ?? null);
                try {
                    localStorage.setItem('vt.perfil', JSON.stringify(data));
                }
                catch { /* sin almacenamiento */ }
            }
        })();
        return () => { vivo = false; };
    }, [supabase, session.user.id]);
    const salir = () => supabase.auth.signOut();
    if (perfil === undefined)
        return _jsx(Mensaje, { titulo: "Cargando\u2026", texto: "Un momento." });
    if (perfil === null)
        return _jsx(Mensaje, { titulo: "Tu cuenta a\u00FAn no est\u00E1 activada", texto: "Rub\u00E9n tiene que terminar tu alta. Te avisar\u00E1 cuando est\u00E9 lista.", onSalir: salir });
    if (perfil.status !== 'active')
        return _jsx(Mensaje, { titulo: "Tu acceso est\u00E1 en pausa", texto: "Si crees que es un error, escribe a Rub\u00E9n.", onSalir: salir });
    const nombre = perfil.full_name.split(' ')[0];
    if (perfil.role === 'coach')
        return _jsx(PanelCoach, { supabase: supabase, nombre: nombre, userId: session.user.id });
    return _jsx(AppPaciente, { supabase: supabase, userId: session.user.id, nombre: nombre, email: session.user.email ?? '' });
}
export default function App() {
    const [session, setSession] = useState(undefined);
    useEffect(() => {
        if (!supabase)
            return;
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        let anterior = null;
        const { data } = supabase.auth.onAuthStateChange((evento, s) => {
            // Al cerrar sesión se borra del móvil lo guardado de esa cuenta (salvo lo que falta por enviar)
            if (evento === 'SIGNED_OUT' && anterior)
                limpiarCuenta(anterior);
            anterior = s?.user.id ?? null;
            setSession(s);
        });
        return () => data.subscription.unsubscribe();
    }, []);
    if (!supabase)
        return _jsx(Mensaje, { titulo: "Tu app est\u00E1 en camino", texto: "Estamos terminando de conectar la app. Vuelve a abrirla en unos d\u00EDas." });
    if (session === undefined)
        return _jsx(Mensaje, { titulo: "Cargando\u2026", texto: "Un momento." });
    if (!session)
        return _jsx(Acceso, { supabase: supabase });
    return _jsx(Inicio, { supabase: supabase, session: session });
}
