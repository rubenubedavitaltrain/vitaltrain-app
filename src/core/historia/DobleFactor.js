import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export default function ConDobleFactor({ supabase, children }) {
    const [estado, setEstado] = useState({ tipo: 'cargando' });
    async function comprobar() {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error)
            return setEstado({ tipo: 'error', texto: 'No se ha podido comprobar la sesión.' });
        if (data.currentLevel === 'aal2')
            return setEstado({ tipo: 'ok' });
        const { data: f } = await supabase.auth.mfa.listFactors();
        const totp = f?.totp?.find((x) => x.status === 'verified');
        setEstado(totp ? { tipo: 'pedir', factorId: totp.id } : { tipo: 'configurar' });
    }
    useEffect(() => { comprobar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    if (estado.tipo === 'ok')
        return _jsx(_Fragment, { children: children });
    return (_jsxs("div", { className: "max-w-md mx-auto bg-white rounded-2xl p-6 flex flex-col gap-4 mt-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold", children: "Historia cl\u00EDnica protegida" }), _jsx("p", { className: "text-sm text-texto-suave mt-1", children: "Para ver datos cl\u00EDnicos hace falta un segundo c\u00F3digo, de una app de autenticaci\u00F3n en tu m\u00F3vil. As\u00ED, aunque alguien entrara en tu email, no podr\u00EDa abrir las historias." })] }), estado.tipo === 'cargando' && _jsx("p", { className: "text-texto-suave", children: "Comprobando\u2026" }), estado.tipo === 'error' && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: estado.texto }), estado.tipo === 'pedir' && _jsx(PedirCodigo, { supabase: supabase, factorId: estado.factorId, onOk: comprobar }), estado.tipo === 'configurar' && _jsx(Configurar, { supabase: supabase, onOk: comprobar })] }));
}
function CampoCodigo({ onEnviar, ocupado }) {
    const [codigo, setCodigo] = useState('');
    return (_jsxs("form", { onSubmit: (e) => { e.preventDefault(); if (codigo.length === 6)
            onEnviar(codigo); }, className: "flex flex-col gap-3", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["C\u00F3digo de la app (6 d\u00EDgitos)", _jsx("input", { autoFocus: true, inputMode: "numeric", autoComplete: "one-time-code", maxLength: 6, value: codigo, onChange: (e) => setCodigo(e.target.value.replace(/\D/g, '')), className: "text-2xl tracking-[0.4em] text-center font-bold px-3 py-3 border border-borde rounded-xl" })] }), _jsx("button", { disabled: codigo.length !== 6 || ocupado, className: "bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl disabled:opacity-50", children: ocupado ? 'Comprobando…' : 'Entrar' })] }));
}
function PedirCodigo({ supabase, factorId, onOk }) {
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState(false);
    async function enviar(code) {
        setOcupado(true);
        setError('');
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        setOcupado(false);
        if (error)
            return setError('Código incorrecto o caducado. Usa el que aparece ahora en la app.');
        onOk();
    }
    return (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", children: ["Abre tu app de autenticaci\u00F3n y escribe el c\u00F3digo de ", _jsx("b", { children: "Vitaltrain" }), "."] }), _jsx(CampoCodigo, { onEnviar: enviar, ocupado: ocupado }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error })] }));
}
function Configurar({ supabase, onOk }) {
    const [alta, setAlta] = useState(null);
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState(false);
    async function empezar() {
        setError('');
        // Si quedó un intento a medias, se borra antes de empezar otro
        const { data: f } = await supabase.auth.mfa.listFactors();
        for (const x of f?.all ?? [])
            if (x.status !== 'verified')
                await supabase.auth.mfa.unenroll({ factorId: x.id });
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Vitaltrain', issuer: 'Vitaltrain' });
        if (error || !data)
            return setError('No se ha podido empezar. Comprueba que el doble factor está activado en Supabase.');
        setAlta({ id: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
    }
    async function verificar(code) {
        if (!alta)
            return;
        setOcupado(true);
        setError('');
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: alta.id, code });
        setOcupado(false);
        if (error)
            return setError('El código no coincide. Espera a que cambie en la app y prueba con el nuevo.');
        onOk();
    }
    if (!alta)
        return (_jsxs(_Fragment, { children: [_jsxs("ol", { className: "text-sm list-decimal pl-5 flex flex-col gap-1", children: [_jsx("li", { children: "Instala en tu m\u00F3vil una app de autenticaci\u00F3n: Google Authenticator, Microsoft Authenticator o la de contrase\u00F1as del iPhone." }), _jsx("li", { children: "Pulsa \u00ABConfigurar\u00BB y escanea el c\u00F3digo QR con esa app." }), _jsx("li", { children: "Escribe aqu\u00ED el c\u00F3digo de 6 d\u00EDgitos que te muestre." })] }), _jsx("button", { onClick: empezar, className: "bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl", children: "Configurar" }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error })] }));
    return (_jsxs(_Fragment, { children: [_jsx("img", { src: alta.qr, alt: "C\u00F3digo QR para la app de autenticaci\u00F3n", className: "w-48 h-48 mx-auto" }), _jsxs("details", { className: "text-xs text-texto-suave", children: [_jsx("summary", { className: "cursor-pointer", children: "No puedo escanear el QR" }), _jsxs("p", { className: "mt-1", children: ["A\u00F1ade una cuenta a mano con esta clave: ", _jsx("code", { className: "break-all font-mono text-texto", children: alta.secreto })] })] }), _jsx(CampoCodigo, { onEnviar: verificar, ocupado: ocupado }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsx("p", { className: "text-xs text-texto-suave", children: "Guarda esta cuenta en la app: si cambias de m\u00F3vil tendr\u00E1s que pasarla al nuevo. Si la pierdes, se recupera desde el panel de Supabase." })] }));
}
