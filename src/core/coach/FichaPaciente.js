import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import SemanaCoach from '../../modules/entrenamiento/ficha/SemanaCoach';
import NotasDelPaciente from '../../modules/entrenamiento/ficha/NotasDelPaciente';
import ProgramaPaciente from '../../modules/entrenamiento/ficha/ProgramaPaciente';
import Progreso from '../../modules/entrenamiento/progreso/Progreso';
import Medidas from '../medidas/Medidas';
import { DocumentosCoach } from '../documentos/Documentos';
import ModulosPaciente, { useModulosPaciente } from './ModulosPaciente';
import { RitmoCoach } from '../../modules/circadiano/Ritmo';
import HabitosCoach from '../../modules/habitos/HabitosCoach';
export default function FichaPaciente({ supabase, paciente, onVolver, onCambio }) {
    const [error, setError] = useState('');
    const [version, setVersion] = useState(0);
    const modulos = useModulosPaciente(supabase, paciente.id);
    const tiene = (m) => modulos.activos?.has(m) ?? false;
    async function cambiarEstado(status) {
        setError('');
        const { data, error } = await supabase.from('profiles').update({ status }).eq('id', paciente.id).select('id, full_name, email, phone, status, created_at').single();
        if (error)
            setError('No se ha podido cambiar el estado.');
        else
            onCambio(data);
    }
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("button", { onClick: onVolver, className: "self-start text-petroleo font-bold", children: "\u2190 Pacientes" }), _jsxs("header", { className: "bg-white rounded-2xl p-5 flex flex-wrap items-center gap-4", children: [_jsx("span", { className: "w-12 h-12 rounded-full bg-petroleo text-white text-lg font-bold flex items-center justify-center", children: paciente.full_name.charAt(0).toUpperCase() }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h2", { className: "text-2xl font-bold leading-tight", children: paciente.full_name }), _jsxs("p", { className: "text-sm text-texto-suave truncate", children: [paciente.email, paciente.phone ? ` · ${paciente.phone}` : ''] }), _jsx(EstadoConsentimiento, { supabase: supabase, pacienteId: paciente.id })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [paciente.status !== 'active' && _jsx("button", { onClick: () => cambiarEstado('active'), className: "bg-petroleo text-white font-bold px-4 py-2 rounded-xl", children: "Activar" }), paciente.status === 'active' && _jsx("button", { onClick: () => cambiarEstado('paused'), className: "bg-white border-2 border-petroleo text-petroleo font-bold px-4 py-2 rounded-xl", children: "Pausar acceso" }), paciente.status !== 'archived' && _jsx("button", { onClick: () => cambiarEstado('archived'), className: "text-texto-suave font-semibold px-3 py-2", children: "Archivar" })] }), paciente.status !== 'active' && (_jsx("p", { className: "w-full text-sm text-texto-suave", children: paciente.status === 'paused' ? 'En pausa: no puede entrar a ver su plan. Sus datos se conservan.' : 'Archivado: no puede entrar. Sus datos se conservan.' })), error && _jsx("p", { role: "alert", className: "w-full font-semibold text-[#8A2C1D]", children: error })] }), _jsx(ProgramaPaciente, { supabase: supabase, pacienteId: paciente.id, onCambio: () => setVersion((v) => v + 1) }), _jsx(SemanaCoach, { supabase: supabase, pacienteId: paciente.id, nombrePaciente: paciente.full_name.split(' ')[0] }, version), _jsxs("section", { className: "flex flex-col gap-3", "aria-labelledby": "progresion", children: [_jsx("h3", { id: "progresion", className: "text-lg font-bold px-1", children: "Progresi\u00F3n" }), _jsx(Progreso, { supabase: supabase, pacienteId: paciente.id, ancho: true }, `p${version}`), _jsx("div", { className: "grid lg:grid-cols-2 gap-4", children: _jsx(Medidas, { supabase: supabase, pacienteId: paciente.id, esCoach: true }) })] }), _jsx(DocumentosCoach, { supabase: supabase, pacienteId: paciente.id, nombre: paciente.full_name.split(' ')[0] }), tiene('habits') && _jsx(HabitosCoach, { supabase: supabase, pacienteId: paciente.id, nombre: paciente.full_name.split(' ')[0] }), tiene('circadian') && _jsx(RitmoCoach, { supabase: supabase, pacienteId: paciente.id }), _jsx(ModulosPaciente, { supabase: supabase, pacienteId: paciente.id, disponibles: modulos.disponibles, activos: modulos.activos, onCambio: modulos.recargar }), _jsxs("div", { className: "grid lg:grid-cols-2 gap-4", children: [_jsx(NotasDelPaciente, { supabase: supabase, pacienteId: paciente.id }), _jsx(NotasPrivadas, { supabase: supabase, pacienteId: paciente.id })] })] }));
}
function EstadoConsentimiento({ supabase, pacienteId }) {
    const [c, setC] = useState(undefined);
    useEffect(() => {
        supabase.from('consents').select('version, accepted_at, withdrawn_at, replaced_at').eq('patient_id', pacienteId).order('accepted_at', { ascending: false }).limit(1).maybeSingle()
            .then(({ data }) => setC(data ?? null));
    }, [supabase, pacienteId]);
    if (c === undefined)
        return null;
    const f = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    const [texto, color] = !c
        ? ['Consentimiento pendiente: lo verá al entrar por primera vez', 'text-[#8A5A00]']
        : c.withdrawn_at
            ? [`Consentimiento retirado el ${f(c.withdrawn_at)}: no puede usar la app`, 'text-[#8A2C1D]']
            : [`Consentimiento aceptado el ${f(c.accepted_at)} (versión ${c.version})`, 'text-petroleo'];
    return _jsx("p", { className: `text-xs font-semibold mt-1 ${color}`, children: texto });
}
function NotasPrivadas({ supabase, pacienteId }) {
    const [notas, setNotas] = useState([]);
    const [texto, setTexto] = useState('');
    async function cargar() {
        const { data } = await supabase.from('coach_notes').select('id, body, created_at').eq('patient_id', pacienteId).order('created_at', { ascending: false }).limit(20);
        setNotas(data ?? []);
    }
    useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
    async function guardar() {
        if (!texto.trim())
            return;
        const { error } = await supabase.from('coach_notes').insert({ patient_id: pacienteId, body: texto.trim() });
        if (!error) {
            setTexto('');
            cargar();
        }
    }
    return (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "privadas", children: [_jsx("h3", { id: "privadas", className: "text-lg font-bold", children: "Notas privadas" }), _jsx("p", { className: "text-xs text-texto-suave -mt-2", children: "Solo las ves t\u00FA. No guardes aqu\u00ED diagn\u00F3sticos ni historia cl\u00EDnica." }), _jsx("textarea", { value: texto, onChange: (e) => setTexto(e.target.value), rows: 2, placeholder: "Ej.: prefiere entrenar por la ma\u00F1ana", className: "text-base px-3 py-2 border border-borde rounded-xl" }), _jsx("button", { onClick: guardar, disabled: !texto.trim(), className: "self-start bg-petroleo text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50", children: "Guardar nota" }), _jsx("ul", { className: "flex flex-col gap-2", children: notas.map((n) => (_jsxs("li", { className: "text-sm border-t border-fondo pt-2", children: [_jsxs("span", { className: "text-texto-suave", children: [new Date(n.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), " \u00B7 "] }), n.body] }, n.id))) })] }));
}
