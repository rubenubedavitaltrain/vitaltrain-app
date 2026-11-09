import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { hoyIso, iso, lunes } from '../../lib/fechas';
import ConDobleFactor from './DobleFactor';
import { BUCKET_HISTORIA, CAMPOS_CONSULTA, CAMPOS_FICHA, CATEGORIAS, MODALIDADES, fechaHora, fechaLarga, registrar, } from './datos';
export function BotonHistoria({ supabase, paciente }) {
    const [abierta, setAbierta] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setAbierta(true), className: "bg-petroleo text-white font-bold px-4 py-2.5 rounded-xl", children: "Historia cl\u00EDnica" }), abierta && _jsx(Historia, { supabase: supabase, paciente: paciente, onCerrar: () => setAbierta(false) })] }));
}
function Historia({ supabase, paciente, onCerrar }) {
    const [pestaña, setPestaña] = useState('linea');
    return (_jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": `Historia clínica de ${paciente.full_name}`, className: "fixed inset-0 z-50 bg-fondo overflow-y-auto", children: [_jsx("header", { className: "sticky top-0 z-10 bg-petroleo text-white", children: _jsxs("div", { className: "max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3", children: [_jsx("button", { onClick: onCerrar, className: "font-semibold", children: "\u2190 Ficha" }), _jsxs("h1", { className: "font-bold text-lg", children: ["Historia cl\u00EDnica \u00B7 ", paciente.full_name] })] }) }), _jsxs(ConDobleFactor, { supabase: supabase, children: [_jsx(Registrar, { supabase: supabase, pacienteId: paciente.id }), _jsx("nav", { className: "max-w-6xl mx-auto px-4 pt-4 flex flex-wrap gap-1.5", "aria-label": "Apartados de la historia", children: [['linea', 'Línea de tiempo'], ['consultas', 'Consultas'], ['ficha', 'Ficha clínica'], ['documentos', 'Documentos clínicos'], ['accesos', 'Registro de accesos']].map(([k, t]) => (_jsx("button", { onClick: () => setPestaña(k), "aria-pressed": pestaña === k, className: `px-4 py-2 rounded-full font-semibold text-sm ${pestaña === k ? 'bg-petroleo text-white' : 'bg-white'}`, children: t }, k))) }), _jsxs("main", { className: "max-w-6xl mx-auto p-4", children: [pestaña === 'linea' && _jsx(LineaTiempo, { supabase: supabase, pacienteId: paciente.id, onIr: setPestaña }), pestaña === 'consultas' && _jsx(Consultas, { supabase: supabase, pacienteId: paciente.id }), pestaña === 'ficha' && _jsx(FichaClinica, { supabase: supabase, pacienteId: paciente.id }), pestaña === 'documentos' && _jsx(DocsClinicos, { supabase: supabase, pacienteId: paciente.id }), pestaña === 'accesos' && _jsx(Accesos, { supabase: supabase, pacienteId: paciente.id })] })] })] }));
}
/** Deja constancia de que se ha abierto la historia (una vez por apertura). */
function Registrar({ supabase, pacienteId }) {
    const hecho = useRef(false);
    useEffect(() => { if (!hecho.current) {
        hecho.current = true;
        registrar(supabase, pacienteId, 'ver_historia', 'historia');
    } }, [supabase, pacienteId]);
    return null;
}
function LineaTiempo({ supabase, pacienteId, onIr }) {
    const [eventos, setEventos] = useState(null);
    const [filtro, setFiltro] = useState('todo');
    useEffect(() => {
        (async () => {
            const q = (t, s) => supabase.from(t).select(s).eq('patient_id', pacienteId);
            const [cons, ads, docs, pdocs, res, hab, prog, ws, med, consent] = await Promise.all([
                q('consultations', 'id, happened_at, modality, reason, plan, status, next_review'),
                q('consultation_addenda', 'created_at, text'),
                q('clinical_documents', 'title, category, document_date, created_at'),
                q('patient_documents', 'title, created_at, is_shared'),
                q('monthly_reviews', 'month, shared_at, updated_at'),
                q('patient_habits', 'start_date, end_date, is_active, habit_definitions(name)'),
                q('program_assignments', 'start_date, status, programs(name)'),
                q('workouts', 'scheduled_date, status').eq('status', 'completed'),
                q('body_measurements', 'measured_on, weight_kg, waist_cm, hip_cm'),
                q('consents', 'accepted_at, withdrawn_at, version'),
            ]);
            const ev = [];
            const filas = (r) => (r.data ?? []);
            for (const c of filas(cons))
                ev.push({ fecha: c.happened_at, tipo: 'Consulta', titulo: `${MODALIDADES[c.modality]}${c.reason ? ` · ${c.reason}` : ''}${c.status === 'draft' ? ' (borrador)' : ''}`, detalle: c.plan ?? undefined, destacado: true, ir: 'consultas' });
            for (const a of filas(ads))
                ev.push({ fecha: a.created_at, tipo: 'Adenda', titulo: a.text.slice(0, 140), ir: 'consultas' });
            for (const d of filas(docs))
                ev.push({ fecha: d.document_date ?? d.created_at, tipo: CATEGORIAS[d.category], titulo: d.title, ir: 'documentos' });
            for (const d of filas(pdocs))
                ev.push({ fecha: d.created_at, tipo: 'Documento compartido', titulo: `${d.title}${d.is_shared ? '' : ' (oculto)'}` });
            for (const r of filas(res))
                ev.push({ fecha: r.month, tipo: 'Resumen mensual', titulo: r.shared_at ? 'Compartido con el paciente' : 'Guardado' });
            for (const h of filas(hab))
                ev.push({ fecha: h.start_date, tipo: 'Hábito pautado', titulo: h.habit_definitions?.name ?? '', detalle: h.end_date ? `Retirado el ${fechaLarga(h.end_date)}` : undefined });
            for (const p of filas(prog))
                ev.push({ fecha: p.start_date, tipo: 'Programa', titulo: p.programs?.name ?? '', detalle: p.status === 'active' ? undefined : 'Sustituido o cancelado' });
            for (const m of filas(med))
                ev.push({ fecha: m.measured_on, tipo: 'Medidas', titulo: [m.weight_kg && `${Number(m.weight_kg).toLocaleString('es-ES')} kg`, m.waist_cm && `cintura ${Number(m.waist_cm).toLocaleString('es-ES')} cm`, m.hip_cm && `cadera ${Number(m.hip_cm).toLocaleString('es-ES')} cm`].filter(Boolean).join(' · ') });
            for (const c of filas(consent)) {
                ev.push({ fecha: c.accepted_at, tipo: 'Consentimiento', titulo: `Aceptado (versión ${c.version})` });
                if (c.withdrawn_at)
                    ev.push({ fecha: c.withdrawn_at, tipo: 'Consentimiento', titulo: 'Retirado' });
            }
            // Entrenamientos agrupados por semana
            const semanas = new Map();
            for (const w of filas(ws)) {
                const l = iso(lunes(new Date(`${w.scheduled_date}T12:00:00`)));
                semanas.set(l, (semanas.get(l) ?? 0) + 1);
            }
            for (const [l, n] of semanas)
                ev.push({ fecha: l, tipo: 'Entrenamiento', titulo: `${n} ${n === 1 ? 'sesión hecha' : 'sesiones hechas'} esa semana` });
            ev.sort((a, b) => b.fecha.localeCompare(a.fecha));
            setEventos(ev);
        })();
    }, [supabase, pacienteId]);
    const clinicos = new Set(['Consulta', 'Adenda', ...Object.values(CATEGORIAS)]);
    const vistos = (eventos ?? []).filter((e) => filtro === 'todo' || (filtro === 'clinica') === clinicos.has(e.tipo));
    return (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("div", { className: "flex flex-wrap gap-1.5", children: [['todo', 'Todo'], ['clinica', 'Solo clínica'], ['app', 'Solo app']].map(([k, t]) => (_jsx("button", { onClick: () => setFiltro(k), "aria-pressed": filtro === k, className: `px-3 py-1.5 rounded-full text-sm font-semibold ${filtro === k ? 'bg-mostaza text-[#1F2424]' : 'bg-white'}`, children: t }, k))) }), !eventos && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), eventos && vistos.length === 0 && _jsx("p", { className: "bg-white rounded-2xl p-5 text-texto-suave", children: "A\u00FAn no hay nada. Empieza por la ficha cl\u00EDnica o una consulta." }), _jsx("ol", { className: "relative border-l-2 border-gris-claro ml-3 flex flex-col gap-3", children: vistos.map((e, i) => (_jsxs("li", { className: "ml-5 relative", children: [_jsx("span", { className: `absolute -left-[29px] top-3 w-4 h-4 rounded-full border-2 border-white ${e.destacado ? 'bg-mostaza' : clinicos.has(e.tipo) ? 'bg-petroleo' : 'bg-borde'}`, "aria-hidden": "true" }), _jsxs("button", { onClick: () => e.ir && onIr(e.ir), disabled: !e.ir, className: `w-full text-left rounded-2xl p-3 ${e.destacado ? 'bg-white shadow-sm' : 'bg-white/70'}`, children: [_jsxs("div", { className: "text-xs text-texto-suave", children: [_jsx("b", { className: "text-petroleo uppercase tracking-wide", children: e.tipo }), " \u00B7 ", fechaLarga(e.fecha)] }), _jsx("div", { className: "font-semibold", children: e.titulo }), e.detalle && _jsx("div", { className: "text-sm text-texto-suave line-clamp-2 whitespace-pre-line", children: e.detalle })] })] }, i))) })] }));
}
// ---------------- Consultas ----------------
function Consultas({ supabase, pacienteId }) {
    const [lista, setLista] = useState(null);
    const [adendas, setAdendas] = useState([]);
    const [editando, setEditando] = useState(null);
    const [version, setVersion] = useState(0);
    useEffect(() => {
        supabase.from('consultations').select('*').eq('patient_id', pacienteId).order('happened_at', { ascending: false }).then(({ data }) => setLista(data ?? []));
        supabase.from('consultation_addenda').select('id, consultation_id, text, created_at').eq('patient_id', pacienteId).order('created_at').then(({ data }) => setAdendas(data ?? []));
    }, [supabase, pacienteId, version]);
    const recargar = () => { setEditando(null); setVersion((v) => v + 1); };
    if (editando)
        return _jsx(EditorConsulta, { supabase: supabase, pacienteId: pacienteId, consulta: editando === 'nueva' ? null : editando, anterior: lista?.find((c) => c.status === 'closed') ?? null, onCerrar: recargar });
    return (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("button", { onClick: () => setEditando('nueva'), className: "self-start bg-mostaza text-[#1F2424] font-bold px-4 py-2.5 rounded-xl", children: "+ Nueva consulta" }), !lista && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), lista?.length === 0 && _jsx("p", { className: "bg-white rounded-2xl p-5 text-texto-suave", children: "Sin consultas registradas." }), lista?.map((c) => (_jsxs("article", { className: "bg-white rounded-2xl p-5 flex flex-col gap-2", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsxs("div", { className: "font-bold", children: [fechaHora(c.happened_at), " \u00B7 ", MODALIDADES[c.modality], c.duration_minutes ? ` · ${c.duration_minutes} min` : ''] }), _jsxs("div", { className: "text-xs text-texto-suave", children: [c.status === 'closed' ? `Cerrada el ${fechaHora(c.closed_at)}` : 'Borrador: aún se puede cambiar', c.next_review ? ` · Próxima revisión: ${fechaLarga(c.next_review)}` : ''] })] }), c.status === 'draft'
                                ? _jsx("button", { onClick: () => setEditando(c), className: "bg-mostaza text-[#1F2424] font-bold px-3 py-1.5 rounded-lg text-sm", children: "Seguir editando" })
                                : _jsx(NuevaAdenda, { supabase: supabase, consulta: c, onHecho: recargar })] }), _jsx("dl", { className: "grid gap-2 text-sm", children: CAMPOS_CONSULTA.filter((f) => c[f.clave]).map((f) => (_jsxs("div", { children: [_jsx("dt", { className: "text-[11px] font-bold uppercase tracking-wide text-petroleo", children: f.titulo }), _jsx("dd", { className: "whitespace-pre-line", children: c[f.clave] })] }, f.clave))) }), adendas.filter((a) => a.consultation_id === c.id).map((a) => (_jsxs("p", { className: "text-sm bg-fondo rounded-lg px-3 py-2", children: [_jsxs("b", { children: ["Adenda ", fechaHora(a.created_at), ":"] }), " ", _jsx("span", { className: "whitespace-pre-line", children: a.text })] }, a.id)))] }, c.id)))] }));
}
function EditorConsulta({ supabase, pacienteId, consulta, anterior, onCerrar }) {
    const ahora = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const [f, setF] = useState({
        happened_at: consulta ? new Date(new Date(consulta.happened_at).valueOf() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ahora,
        modality: (consulta?.modality ?? 'presencial'), duration_minutes: consulta?.duration_minutes ? String(consulta.duration_minutes) : '',
        reason: consulta?.reason ?? '', subjective: consulta?.subjective ?? '', findings: consulta?.findings ?? '', plan: consulta?.plan ?? '', goals: consulta?.goals ?? '',
        next_review: consulta?.next_review ?? '',
    });
    const [id, setId] = useState(consulta?.id ?? null);
    const [estado, setEstado] = useState('');
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    async function guardar(cerrar) {
        setEstado('');
        if (cerrar && !window.confirm('Al cerrar la consulta ya no se podrá cambiar. Las correcciones se añaden como adenda. ¿Cerrar?'))
            return;
        const fila = {
            patient_id: pacienteId, happened_at: new Date(f.happened_at).toISOString(), modality: f.modality,
            duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : null,
            reason: f.reason.trim() || null, subjective: f.subjective.trim() || null, findings: f.findings.trim() || null, plan: f.plan.trim() || null, goals: f.goals.trim() || null,
            next_review: f.next_review || null, ...(cerrar ? { status: 'closed' } : {}),
        };
        const r = id ? await supabase.from('consultations').update(fila).eq('id', id).select('id').single() : await supabase.from('consultations').insert(fila).select('id').single();
        if (r.error)
            return setEstado('No se ha podido guardar.');
        setId(r.data.id);
        if (cerrar)
            onCerrar();
        else
            setEstado(`Borrador guardado a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`);
    }
    async function borrar() {
        if (!id)
            return onCerrar();
        if (!window.confirm('¿Borrar este borrador?'))
            return;
        await supabase.from('consultations').delete().eq('id', id);
        onCerrar();
    }
    return (_jsxs("div", { className: "grid lg:grid-cols-[1fr_320px] gap-4 items-start", children: [_jsxs("div", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("h2", { className: "text-lg font-bold", children: consulta ? 'Consulta (borrador)' : 'Nueva consulta' }), _jsx("button", { onClick: onCerrar, className: "font-semibold text-petroleo", children: "Volver" })] }), _jsxs("div", { className: "grid sm:grid-cols-3 gap-2", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Fecha y hora", _jsx("input", { type: "datetime-local", value: f.happened_at, onChange: (e) => set('happened_at', e.target.value), className: "font-normal px-3 py-2 border border-borde rounded-xl" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Modalidad", _jsx("select", { value: f.modality, onChange: (e) => set('modality', e.target.value), className: "font-normal px-3 py-2 border border-borde rounded-xl bg-white", children: Object.keys(MODALIDADES).map((m) => _jsx("option", { value: m, children: MODALIDADES[m] }, m)) })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Duraci\u00F3n (min)", _jsx("input", { inputMode: "numeric", value: f.duration_minutes, onChange: (e) => set('duration_minutes', e.target.value.replace(/\D/g, '').slice(0, 3)), className: "font-normal px-3 py-2 border border-borde rounded-xl" })] })] }), CAMPOS_CONSULTA.map((c) => (_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: [c.titulo, c.ayuda && _jsx("span", { className: "font-normal text-xs text-texto-suave", children: c.ayuda }), _jsx("textarea", { rows: c.filas, value: f[c.clave], onChange: (e) => set(c.clave, e.target.value), className: "font-normal text-base px-3 py-2 border border-borde rounded-xl" })] }, c.clave))), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold max-w-xs", children: ["Pr\u00F3xima revisi\u00F3n", _jsx("input", { type: "date", min: hoyIso(), value: f.next_review, onChange: (e) => set('next_review', e.target.value), className: "font-normal px-3 py-2 border border-borde rounded-xl" })] }), estado && _jsx("p", { role: "status", className: "text-sm font-semibold text-petroleo", children: estado }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { onClick: () => guardar(false), className: "bg-white border-2 border-petroleo text-petroleo font-bold px-4 py-2.5 rounded-xl", children: "Guardar borrador" }), _jsx("button", { onClick: () => guardar(true), className: "bg-mostaza text-[#1F2424] font-bold px-4 py-2.5 rounded-xl", children: "Cerrar consulta" }), _jsx("div", { className: "flex-1" }), _jsx("button", { onClick: borrar, className: "font-semibold text-[#8A2C1D] px-2", children: id ? 'Borrar borrador' : 'Descartar' })] })] }), _jsxs("aside", { className: "bg-white rounded-2xl p-4 flex flex-col gap-2 text-sm lg:sticky lg:top-20", children: [_jsx("h3", { className: "font-bold", children: "Consulta anterior" }), !anterior && _jsx("p", { className: "text-texto-suave", children: "Es la primera." }), anterior && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-xs text-texto-suave", children: [fechaHora(anterior.happened_at), " \u00B7 ", MODALIDADES[anterior.modality]] }), anterior.plan && _jsxs("div", { children: [_jsx("div", { className: "text-[11px] font-bold uppercase tracking-wide text-petroleo", children: "Pautas" }), _jsx("p", { className: "whitespace-pre-line", children: anterior.plan })] }), anterior.goals && _jsxs("div", { children: [_jsx("div", { className: "text-[11px] font-bold uppercase tracking-wide text-petroleo", children: "Objetivos" }), _jsx("p", { className: "whitespace-pre-line", children: anterior.goals })] })] }))] })] }));
}
function NuevaAdenda({ supabase, consulta, onHecho }) {
    const [abierta, setAbierta] = useState(false);
    const [texto, setTexto] = useState('');
    const [error, setError] = useState('');
    if (!abierta)
        return _jsx("button", { onClick: () => setAbierta(true), className: "text-sm font-bold text-petroleo px-2 py-1", children: "+ Adenda" });
    return (_jsxs("div", { className: "w-full flex flex-col gap-2", children: [_jsx("textarea", { autoFocus: true, rows: 2, value: texto, onChange: (e) => setTexto(e.target.value.slice(0, 5000)), placeholder: "Correcci\u00F3n o informaci\u00F3n a\u00F1adida. Queda fechada y no se puede cambiar.", className: "text-base px-3 py-2 border border-borde rounded-xl" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: async () => {
                            if (!texto.trim())
                                return;
                            const { error } = await supabase.from('consultation_addenda').insert({ consultation_id: consulta.id, patient_id: consulta.patient_id, text: texto.trim() });
                            if (error)
                                return setError('No se ha podido guardar.');
                            onHecho();
                        }, className: "bg-mostaza text-[#1F2424] font-bold px-3 py-1.5 rounded-lg text-sm", children: "A\u00F1adir adenda" }), _jsx("button", { onClick: () => setAbierta(false), className: "text-sm font-semibold px-2", children: "Cancelar" })] }), error && _jsx("p", { role: "alert", className: "text-sm font-semibold text-[#8A2C1D]", children: error })] }));
}
// ---------------- Ficha clínica ----------------
function FichaClinica({ supabase, pacienteId }) {
    const [ficha, setFicha] = useState(undefined);
    const [valores, setValores] = useState({});
    const [versiones, setVersiones] = useState([]);
    const [estado, setEstado] = useState('');
    async function cargar() {
        const { data } = await supabase.from('clinical_records').select('*').eq('patient_id', pacienteId).maybeSingle();
        const f = data;
        setFicha(f);
        setValores(Object.fromEntries(CAMPOS_FICHA.map((c) => [c.clave, f?.[c.clave] ?? ''])));
        const v = await supabase.from('clinical_record_versions').select('changed_at').eq('patient_id', pacienteId).order('changed_at', { ascending: false });
        setVersiones(v.data ?? []);
    }
    useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
    const cambiada = useMemo(() => CAMPOS_FICHA.some((c) => (valores[c.clave] ?? '') !== (ficha?.[c.clave] ?? '')), [valores, ficha]);
    async function guardar() {
        setEstado('');
        const fila = { patient_id: pacienteId, ...Object.fromEntries(CAMPOS_FICHA.map((c) => [c.clave, valores[c.clave]?.trim() || null])) };
        const { error } = ficha ? await supabase.from('clinical_records').update(fila).eq('patient_id', pacienteId) : await supabase.from('clinical_records').insert(fila);
        if (error)
            return setEstado('No se ha podido guardar.');
        setEstado('Guardado. La versión anterior queda en el historial.');
        cargar();
    }
    if (ficha === undefined)
        return _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" });
    return (_jsxs("div", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3 max-w-3xl", children: [_jsxs("div", { className: "flex flex-wrap justify-between gap-2", children: [_jsx("h2", { className: "text-lg font-bold", children: "Ficha cl\u00EDnica" }), _jsxs("p", { className: "text-xs text-texto-suave", children: [ficha ? `Última actualización: ${fechaHora(ficha.updated_at)}` : 'Sin rellenar', versiones.length ? ` · ${versiones.length} versiones anteriores guardadas` : ''] })] }), CAMPOS_FICHA.map((c) => (_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: [c.titulo, c.ayuda && _jsx("span", { className: "font-normal text-xs text-texto-suave", children: c.ayuda }), _jsx("textarea", { rows: c.filas, value: valores[c.clave] ?? '', onChange: (e) => setValores((v) => ({ ...v, [c.clave]: e.target.value })), className: "font-normal text-base px-3 py-2 border border-borde rounded-xl" })] }, c.clave))), estado && _jsx("p", { role: "status", className: "text-sm font-semibold text-petroleo", children: estado }), _jsx("button", { onClick: guardar, disabled: !cambiada, className: "self-start bg-mostaza text-[#1F2424] font-bold px-5 py-2.5 rounded-xl disabled:opacity-50", children: "Guardar ficha" })] }));
}
// ---------------- Documentos clínicos ----------------
const TIPOS_OK = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
function DocsClinicos({ supabase, pacienteId }) {
    const [docs, setDocs] = useState(null);
    const [version, setVersion] = useState(0);
    const [archivos, setArchivos] = useState([]);
    const [categoria, setCategoria] = useState('analitica');
    const [fecha, setFecha] = useState('');
    const [estado, setEstado] = useState('');
    const [subiendo, setSubiendo] = useState(false);
    const input = useRef(null);
    useEffect(() => {
        supabase.from('clinical_documents').select('id, category, title, document_date, note, storage_path, size_bytes, mime, created_at').eq('patient_id', pacienteId)
            .order('document_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).then(({ data }) => setDocs(data ?? []));
    }, [supabase, pacienteId, version]);
    function elegir(fs) {
        setEstado('');
        const lista = [...(fs ?? [])];
        const malos = lista.filter((f) => !TIPOS_OK[f.type] || f.size > 50 * 1024 * 1024);
        if (malos.length)
            setEstado(`No se pueden subir: ${malos.map((m) => m.name).join(', ')}. Solo PDF, JPG, PNG o Word (.docx), hasta 50 MB.`);
        setArchivos(lista.filter((f) => !malos.includes(f)));
    }
    async function subir() {
        setSubiendo(true);
        setEstado('');
        let ok = 0;
        for (const a of archivos) {
            const ruta = `${pacienteId}/${crypto.randomUUID()}.${TIPOS_OK[a.type]}`;
            const up = await supabase.storage.from(BUCKET_HISTORIA).upload(ruta, a, { contentType: a.type });
            if (up.error)
                continue;
            const { error } = await supabase.from('clinical_documents').insert({
                patient_id: pacienteId, category: categoria, title: a.name.replace(/\.[^.]+$/, '').slice(0, 160), document_date: fecha || null,
                storage_path: ruta, size_bytes: a.size, mime: a.type,
            });
            if (error) {
                await supabase.storage.from(BUCKET_HISTORIA).remove([ruta]);
                continue;
            }
            ok++;
        }
        setSubiendo(false);
        setEstado(ok === archivos.length ? `Subidos ${ok}.` : `Subidos ${ok} de ${archivos.length}. Revisa los que faltan.`);
        setArchivos([]);
        if (input.current)
            input.current.value = '';
        setVersion((v) => v + 1);
    }
    async function abrir(d) {
        const w = window.open('', '_blank');
        const { data } = await supabase.storage.from(BUCKET_HISTORIA).createSignedUrl(d.storage_path, 300);
        registrar(supabase, pacienteId, 'ver_documento', 'documento', d.id);
        if (data?.signedUrl && w)
            w.location.href = data.signedUrl;
        else
            w?.close();
    }
    async function borrar(d) {
        if (!window.confirm(`¿Borrar «${d.title}»? Solo es posible en las 24 horas siguientes a subirlo.`))
            return;
        const { error } = await supabase.from('clinical_documents').delete().eq('id', d.id);
        if (error)
            return setEstado('No se puede borrar: han pasado más de 24 horas desde que se subió.');
        await supabase.storage.from(BUCKET_HISTORIA).remove([d.storage_path]);
        setVersion((v) => v + 1);
    }
    async function renombrar(d) {
        const t = window.prompt('Título del documento', d.title);
        if (!t || !t.trim() || t === d.title)
            return;
        await supabase.from('clinical_documents').update({ title: t.trim().slice(0, 160) }).eq('id', d.id);
        setVersion((v) => v + 1);
    }
    const grupos = Object.keys(CATEGORIAS).map((c) => [c, (docs ?? []).filter((d) => d.category === c)]).filter(([, l]) => l.length);
    return (_jsxs("div", { className: "grid lg:grid-cols-[340px_1fr] gap-4 items-start", children: [_jsxs("div", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", children: [_jsx("h2", { className: "font-bold", children: "Subir documentos" }), _jsxs("label", { className: "flex flex-col items-center gap-1 border-2 border-dashed border-borde rounded-xl p-5 text-center cursor-pointer hover:bg-fondo", onDragOver: (e) => e.preventDefault(), onDrop: (e) => { e.preventDefault(); elegir(e.dataTransfer.files); }, children: [_jsx("input", { ref: input, type: "file", multiple: true, accept: ".pdf,.jpg,.jpeg,.png,.docx", className: "sr-only", onChange: (e) => elegir(e.target.files) }), _jsx("span", { className: "font-semibold", children: archivos.length ? `${archivos.length} archivo${archivos.length > 1 ? 's' : ''} elegido${archivos.length > 1 ? 's' : ''}` : 'Arrastra aquí o pulsa para elegir' }), _jsx("span", { className: "text-xs text-texto-suave", children: "PDF, foto o Word. Varios a la vez." })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Carpeta", _jsx("select", { value: categoria, onChange: (e) => setCategoria(e.target.value), className: "font-normal px-3 py-2 border border-borde rounded-xl bg-white", children: Object.keys(CATEGORIAS).map((c) => _jsx("option", { value: c, children: CATEGORIAS[c] }, c)) })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Fecha del documento (opcional)", _jsx("input", { type: "date", max: hoyIso(), value: fecha, onChange: (e) => setFecha(e.target.value), className: "font-normal px-3 py-2 border border-borde rounded-xl" })] }), _jsx("button", { onClick: subir, disabled: !archivos.length || subiendo, className: "bg-mostaza text-[#1F2424] font-bold py-2.5 rounded-xl disabled:opacity-50", children: subiendo ? 'Subiendo…' : 'Subir' }), estado && _jsx("p", { role: "status", className: "text-sm font-semibold text-petroleo", children: estado }), _jsx("p", { className: "text-xs text-texto-suave", children: "El paciente no ve estos documentos. Se pueden borrar solo en las 24 horas siguientes a subirlos." })] }), _jsxs("div", { className: "flex flex-col gap-3", children: [!docs && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), docs?.length === 0 && _jsx("p", { className: "bg-white rounded-2xl p-5 text-texto-suave", children: "Sin documentos cl\u00EDnicos." }), grupos.map(([c, l]) => (_jsxs("section", { className: "bg-white rounded-2xl p-4", children: [_jsxs("h3", { className: "text-[11px] font-bold uppercase tracking-wide text-petroleo mb-1", children: [CATEGORIAS[c], " (", l.length, ")"] }), _jsx("ul", { children: l.map((d) => (_jsxs("li", { className: "border-t border-fondo py-2 flex items-center gap-3", children: [_jsxs("button", { onClick: () => abrir(d), className: "flex-1 min-w-0 text-left", children: [_jsx("span", { className: "block font-semibold truncate hover:underline", children: d.title }), _jsxs("span", { className: "block text-xs text-texto-suave", children: [d.document_date ? fechaLarga(d.document_date) : `Subido el ${fechaLarga(d.created_at)}`, " \u00B7 ", TIPOS_OK[d.mime]?.toUpperCase()] })] }), _jsx("button", { onClick: () => renombrar(d), className: "text-xs font-semibold text-petroleo px-2", children: "Renombrar" }), Date.now() - new Date(d.created_at).valueOf() < 86400000 && _jsx("button", { onClick: () => borrar(d), className: "text-xs font-semibold text-[#8A2C1D] px-2", children: "Borrar" })] }, d.id))) })] }, c)))] })] }));
}
// ---------------- Registro de accesos ----------------
const ACCIONES = { ver_historia: 'Abrió la historia', ver_documento: 'Abrió un documento', crear: 'Creó', editar: 'Editó', cerrar: 'Cerró', adenda: 'Añadió una adenda a', subir: 'Subió', borrar: 'Borró', exportar: 'Exportó', importar: 'Importó' };
const ENTIDADES = { historia: '', ficha: 'la ficha clínica', consulta: 'una consulta', documento: 'un documento' };
function Accesos({ supabase, pacienteId }) {
    const [filas, setFilas] = useState(null);
    useEffect(() => {
        supabase.from('access_log').select('id, at, action, entity, detail').eq('patient_id', pacienteId).order('at', { ascending: false }).limit(300).then(({ data }) => setFilas(data ?? []));
    }, [supabase, pacienteId]);
    return (_jsxs("div", { className: "bg-white rounded-2xl p-5 max-w-3xl", children: [_jsx("h2", { className: "font-bold", children: "Registro de accesos" }), _jsx("p", { className: "text-xs text-texto-suave mb-2", children: "Qui\u00E9n ha abierto o cambiado esta historia y cu\u00E1ndo. No se puede editar ni borrar. \u00DAltimos 300." }), !filas && _jsx("p", { className: "text-texto-suave", children: "Cargando\u2026" }), _jsx("ul", { className: "text-sm", children: filas?.map((f) => (_jsxs("li", { className: "border-t border-fondo py-1.5 flex gap-3", children: [_jsx("span", { className: "text-texto-suave tabular-nums shrink-0 w-44", children: fechaHora(f.at) }), _jsxs("span", { children: [ACCIONES[f.action] ?? f.action, " ", ENTIDADES[f.entity] ?? f.entity, f.detail ? `: ${f.detail}` : ''] })] }, f.id))) })] }));
}
