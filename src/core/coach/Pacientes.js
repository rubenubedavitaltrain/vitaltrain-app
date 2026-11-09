import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import FichaPaciente from './FichaPaciente';
const ESTADO = { active: 'Activo', paused: 'En pausa', archived: 'Archivado' };
export default function Pacientes({ supabase, abrirId, onAbierto }) {
    const [lista, setLista] = useState(null);
    const [abierto, setAbierto] = useState(null);
    const [alta, setAlta] = useState(false);
    const [verArchivados, setVerArchivados] = useState(false);
    async function cargar() {
        const { data } = await supabase.from('profiles').select('id, full_name, email, phone, status, created_at').eq('role', 'patient').order('full_name');
        setLista(data ?? []);
    }
    useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // Abrir directamente la ficha pedida desde el panel de inicio
    useEffect(() => {
        if (!abrirId || !lista)
            return;
        const p = lista.find((x) => x.id === abrirId);
        if (p)
            setAbierto(p);
        onAbierto?.();
    }, [abrirId, lista]); // eslint-disable-line react-hooks/exhaustive-deps
    if (abierto) {
        return _jsx(FichaPaciente, { supabase: supabase, paciente: abierto, onVolver: () => { setAbierto(null); cargar(); }, onCambio: (p) => setAbierto(p) });
    }
    const visibles = (lista ?? []).filter((p) => (verArchivados ? p.status === 'archived' : p.status !== 'archived'));
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold", children: "Pacientes" }), _jsx("p", { className: "text-sm text-texto-suave", children: lista ? `${lista.filter((p) => p.status === 'active').length} activos` : 'Cargando…' })] }), _jsx("button", { onClick: () => setAlta(true), className: "bg-mostaza text-[#1F2424] font-bold px-4 py-3 rounded-xl", children: "Dar de alta" })] }), lista && visibles.length === 0 && (_jsx("div", { className: "bg-white rounded-2xl p-6 text-texto-suave", children: verArchivados ? 'No hay pacientes archivados.' : 'Aún no hay pacientes. Da de alta al primero: recibirá un código en su email para entrar.' })), _jsx("ul", { className: "flex flex-col gap-2", children: visibles.map((p) => (_jsx("li", { children: _jsxs("button", { onClick: () => setAbierto(p), className: "w-full text-left bg-white rounded-2xl px-5 py-4 flex items-center gap-4", children: [_jsx("span", { className: "w-10 h-10 rounded-full bg-petroleo text-white font-bold flex items-center justify-center shrink-0", children: p.full_name.charAt(0).toUpperCase() }), _jsxs("span", { className: "flex-1 min-w-0", children: [_jsx("span", { className: "block font-bold truncate", children: p.full_name }), _jsx("span", { className: "block text-sm text-texto-suave truncate", children: p.email })] }), _jsx("span", { className: `text-xs font-bold px-2.5 py-1 rounded-full ${p.status === 'active' ? 'bg-[#E4EEE9] text-petroleo' : 'bg-gris-claro text-texto-suave'}`, children: ESTADO[p.status] })] }) }, p.id))) }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-texto-suave self-start", children: [_jsx("input", { type: "checkbox", checked: verArchivados, onChange: (e) => setVerArchivados(e.target.checked) }), "Ver archivados"] }), alta && _jsx(Alta, { supabase: supabase, onCerrar: () => setAlta(false), onCreado: () => { setAlta(false); cargar(); } })] }));
}
function Alta({ supabase, onCerrar, onCreado }) {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');
    const [soloHistoria, setSoloHistoria] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    async function enviar(e) {
        e.preventDefault();
        setError('');
        setEnviando(true);
        const { data, error } = await supabase.functions.invoke('alta-paciente', { body: { full_name: nombre, email, phone: telefono } });
        setEnviando(false);
        if (error) {
            let msg = 'No se ha podido dar de alta. Inténtalo de nuevo.';
            try {
                const j = await error.context?.json();
                if (j?.error)
                    msg = j.error;
            }
            catch { /* sin detalle */ }
            return setError(msg);
        }
        if (data?.id) {
            // Solo historia clínica: sin acceso a la app (en pausa y sin módulos). Se puede activar después.
            if (soloHistoria) {
                await supabase.from('patient_modules').delete().eq('patient_id', data.id);
                await supabase.from('profiles').update({ status: 'paused' }).eq('id', data.id);
            }
            onCreado();
        }
    }
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": "Dar de alta a un paciente", className: "fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6", onClick: onCerrar, children: _jsxs("form", { onSubmit: enviar, className: "bg-fondo w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-3", onClick: (e) => e.stopPropagation(), children: [_jsx("h3", { className: "text-xl font-bold", children: "Dar de alta a un paciente" }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Nombre y apellidos", _jsx("input", { required: true, value: nombre, onChange: (e) => setNombre(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Email", _jsx("input", { required: true, type: "email", autoCapitalize: "none", value: email, onChange: (e) => setEmail(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Tel\u00E9fono (opcional)", _jsx("input", { type: "tel", value: telefono, onChange: (e) => setTelefono(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" })] }), _jsxs("label", { className: "flex items-start gap-3 text-sm", children: [_jsx("input", { type: "checkbox", checked: soloHistoria, onChange: (e) => setSoloHistoria(e.target.checked), className: "mt-0.5 w-5 h-5 accent-[#374949]" }), _jsxs("span", { children: [_jsx("b", { children: "Solo historia cl\u00EDnica" }), _jsx("br", {}), _jsx("span", { className: "text-texto-suave", children: "Para pacientes de consulta que no usan la app. Queda en pausa; puedes activarle la app cuando quieras." })] })] }), _jsx("p", { className: "text-xs text-texto-suave", children: soloHistoria ? 'No recibirá nada ni podrá entrar en la app.' : 'El paciente entrará escribiendo este email: le llegará un código de 6 dígitos. No necesita contraseña.' }), error && _jsx("p", { role: "alert", className: "font-semibold text-[#8A2C1D]", children: error }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { type: "button", onClick: onCerrar, className: "px-4 py-3 font-bold text-petroleo", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: enviando, className: "bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60", children: enviando ? 'Creando…' : 'Dar de alta' })] })] }) }));
}
