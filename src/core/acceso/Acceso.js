import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
// Acceso sin contraseña: el paciente escribe su email, recibe un código de 6 dígitos y lo introduce.
// Solo pueden entrar personas dadas de alta por el coach (shouldCreateUser: false).
function traducirError(mensaje) {
    const m = mensaje.toLowerCase();
    if (m.includes('signup') || m.includes('not allowed') || m.includes('not found'))
        return 'Este email no tiene acceso. Si eres paciente de Vitaltrain, escribe a Rubén para que te dé de alta.';
    if (m.includes('rate') || m.includes('seconds') || m.includes('too many'))
        return 'Has pedido varios códigos seguidos. Espera un minuto y vuelve a intentarlo.';
    if (m.includes('expired') || m.includes('invalid') || m.includes('token'))
        return 'El código no es correcto o ha caducado. Revísalo o pide otro.';
    return 'No se ha podido completar. Comprueba tu conexión y vuelve a intentarlo.';
}
export default function Acceso({ supabase }) {
    const [paso, setPaso] = useState('email');
    const [email, setEmail] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [aviso, setAviso] = useState('');
    async function pedirCodigo(e) {
        e?.preventDefault();
        setError('');
        setAviso('');
        setEnviando(true);
        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: { shouldCreateUser: false }
        });
        setEnviando(false);
        if (error)
            return setError(traducirError(error.message));
        setPaso('codigo');
        setCodigo('');
        setAviso('Código enviado. Revisa también la carpeta de spam.');
    }
    async function comprobarCodigo(e) {
        e.preventDefault();
        setError('');
        setEnviando(true);
        const { error } = await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: codigo,
            type: 'email'
        });
        setEnviando(false);
        if (error)
            setError(traducirError(error.message));
    }
    return (_jsxs("div", { className: "min-h-full flex flex-col", children: [_jsxs("header", { className: "bg-petroleo text-white px-7 pt-[max(env(safe-area-inset-top),3.5rem)] pb-9 flex flex-col gap-3", children: [_jsx("img", { src: "/marca/logotipo-blanco.png", alt: "Vitaltrain \u00B7 Health balance, training, nutrition", className: "h-[72px] w-auto self-start" }), _jsx("h1", { className: "text-3xl font-bold leading-tight", children: "Entra en tu app" }), _jsx("p", { className: "text-base leading-snug text-[#E3E8E8]", children: "Sin contrase\u00F1as. Te enviamos un c\u00F3digo a tu email cada vez que entras desde un m\u00F3vil nuevo." })] }), _jsxs("main", { className: "flex-1 px-6 py-7 flex flex-col gap-5", children: [paso === 'email' ? (_jsxs("form", { onSubmit: pedirCodigo, className: "flex flex-col gap-5", children: [_jsxs("div", { className: "bg-white rounded-2xl p-5 flex flex-col gap-2.5", children: [_jsx("label", { htmlFor: "email", className: "text-sm font-semibold", children: "Tu email" }), _jsx("input", { id: "email", type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "none", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "text-[17px] px-4 py-3.5 border border-borde rounded-xl bg-white" })] }), _jsx("button", { type: "submit", disabled: enviando || !email.includes('@'), className: "bg-mostaza text-[#1F2424] text-lg font-bold py-4 rounded-2xl disabled:opacity-60", children: enviando ? 'Enviando…' : 'Enviarme el código' })] })) : (_jsxs("form", { onSubmit: comprobarCodigo, className: "flex flex-col gap-5", children: [_jsxs("div", { className: "bg-white rounded-2xl p-5 flex flex-col gap-2.5", children: [_jsxs("span", { className: "text-sm text-texto-suave", children: ["C\u00F3digo enviado a ", _jsx("strong", { className: "text-texto", children: email })] }), _jsx("label", { htmlFor: "codigo", className: "text-sm font-semibold", children: "C\u00F3digo de 6 d\u00EDgitos" }), _jsx("input", { id: "codigo", inputMode: "numeric", autoComplete: "one-time-code", pattern: "[0-9]{6}", maxLength: 6, required: true, autoFocus: true, value: codigo, onChange: (e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6)), className: "text-[28px] font-bold tracking-[0.5em] text-center py-3 border-2 border-petroleo rounded-xl bg-white" })] }), _jsx("button", { type: "submit", disabled: enviando || codigo.length !== 6, className: "bg-mostaza text-[#1F2424] text-lg font-bold py-4 rounded-2xl disabled:opacity-60", children: enviando ? 'Comprobando…' : 'Entrar' }), _jsxs("div", { className: "flex justify-between text-[15px] font-semibold text-petroleo", children: [_jsx("button", { type: "button", onClick: () => pedirCodigo(), disabled: enviando, children: "Enviar otro c\u00F3digo" }), _jsx("button", { type: "button", onClick: () => { setPaso('email'); setError(''); setAviso(''); }, children: "Cambiar email" })] })] })), aviso && !error && _jsx("p", { role: "status", className: "text-sm text-texto-suave", children: aviso }), error && _jsx("p", { role: "alert", className: "text-[15px] font-semibold text-[#8A2C1D] bg-white rounded-xl p-4", children: error })] }), _jsx("footer", { className: "px-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-xs leading-relaxed text-texto-suave", children: "Cl\u00EDnica Vitaltrain \u00B7 Centro Sanitario N\u00BA Registro 22433" })] }));
}
