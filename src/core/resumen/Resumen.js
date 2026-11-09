import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { desdeIso, iso } from '../../lib/fechas';
import { calcularFoto, NOMBRE_MES } from './datos';
const mesActual = () => iso(new Date()).slice(0, 7);
const mesesAtras = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return iso(d).slice(0, 7); });
const fechaCorta = (f) => desdeIso(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const n1 = (x) => x.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const horas = (m) => (m == null ? '—' : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`);
export function ResumenCoach({ supabase, pacienteId, nombre }) {
    const [abierto, setAbierto] = useState(false);
    const [filas, setFilas] = useState([]);
    const [version, setVersion] = useState(0);
    useEffect(() => {
        supabase.from('monthly_reviews').select('id, month, conclusions, next_goals, snapshot, shared_at, updated_at').eq('patient_id', pacienteId).order('month', { ascending: false })
            .then(({ data }) => setFilas(data ?? []));
    }, [supabase, pacienteId, version]);
    return (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "resumen-mensual", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h3", { id: "resumen-mensual", className: "text-lg font-bold", children: "Resumen mensual" }), _jsx("p", { className: "text-xs text-texto-suave", children: "Las cifras del mes, tus conclusiones y los objetivos del siguiente. Lo guardas, lo compartes y lo descargas en PDF." })] }), _jsx("button", { onClick: () => setAbierto(true), className: "bg-mostaza text-[#1F2424] font-bold px-4 py-2 rounded-xl", children: "Abrir resumen" })] }), filas.length > 0 && (_jsx("ul", { className: "flex flex-wrap gap-2 text-sm", children: filas.map((f) => (_jsxs("li", { className: "bg-fondo rounded-lg px-3 py-1.5 ", children: [NOMBRE_MES(f.month.slice(0, 7)), " \u00B7 ", _jsx("span", { className: "normal-case text-texto-suave", children: f.shared_at ? 'compartido' : 'guardado' })] }, f.id))) })), abierto && _jsx(EditorResumen, { supabase: supabase, pacienteId: pacienteId, nombre: nombre, guardados: filas, onCerrar: () => { setAbierto(false); setVersion((v) => v + 1); } })] }));
}
function EditorResumen({ supabase, pacienteId, nombre, guardados, onCerrar }) {
    // Por defecto, el mes anterior si estamos en los primeros 10 días; si no, el actual.
    const [mes, setMes] = useState(() => (new Date().getDate() <= 10 ? mesesAtras(2)[1] : mesActual()));
    const [foto, setFoto] = useState(null);
    const [fila, setFila] = useState(null);
    const [conclusiones, setConclusiones] = useState('');
    const [objetivos, setObjetivos] = useState('');
    const [estado, setEstado] = useState('');
    const [cargando, setCargando] = useState(true);
    async function cargar(m, recalcular = false) {
        setCargando(true);
        setEstado('');
        const { data } = await supabase.from('monthly_reviews').select('id, month, conclusions, next_goals, snapshot, shared_at, updated_at').eq('patient_id', pacienteId).eq('month', `${m}-01`).maybeSingle();
        const f = data;
        setFila(f);
        setConclusiones(f?.conclusions ?? '');
        setObjetivos(f?.next_goals ?? '');
        setFoto(f?.snapshot && !recalcular ? f.snapshot : await calcularFoto(supabase, pacienteId, nombre, m));
        setCargando(false);
    }
    useEffect(() => { cargar(mes); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps
    async function guardar(compartir) {
        if (!foto)
            return;
        const datos = {
            patient_id: pacienteId, month: `${mes}-01`, conclusions: conclusiones.trim() || null, next_goals: objetivos.trim() || null, snapshot: foto,
            shared_at: compartir === undefined ? fila?.shared_at ?? null : compartir ? new Date().toISOString() : null,
        };
        const { data, error } = await supabase.from('monthly_reviews').upsert(datos, { onConflict: 'patient_id,month' }).select('id, month, conclusions, next_goals, snapshot, shared_at, updated_at').single();
        if (error)
            return setEstado('No se ha podido guardar.');
        setFila(data);
        setEstado(compartir === true ? `Guardado y compartido. ${nombre} lo ve en Progreso.` : compartir === false ? 'Ya no lo ve el paciente.' : 'Guardado.');
    }
    const meses = [...new Set([...mesesAtras(12), ...guardados.map((g) => g.month.slice(0, 7))])].sort().reverse();
    return (_jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": "Resumen mensual", className: "fixed inset-0 z-50 bg-fondo overflow-y-auto", children: [_jsxs("div", { className: "no-print sticky top-0 z-10 bg-petroleo text-white px-4 py-3 flex flex-wrap items-center gap-2", children: [_jsx("button", { onClick: onCerrar, className: "font-semibold mr-2", children: "\u2190 Volver" }), _jsx("select", { value: mes, onChange: (e) => setMes(e.target.value), className: "text-texto bg-white rounded-lg px-2 py-1.5", children: meses.map((m) => _jsxs("option", { value: m, children: [NOMBRE_MES(m), guardados.some((g) => g.month.startsWith(m)) ? ' ·  guardado' : ''] }, m)) }), _jsx("div", { className: "flex-1" }), _jsx("button", { onClick: () => cargar(mes, true), className: "bg-white/15 font-semibold px-3 py-1.5 rounded-lg", title: "Vuelve a calcular las cifras con los datos de ahora", children: "Actualizar cifras" }), _jsx("button", { onClick: () => guardar(), className: "bg-white/15 font-semibold px-3 py-1.5 rounded-lg", children: "Guardar" }), fila?.shared_at
                        ? _jsx("button", { onClick: () => guardar(false), className: "bg-white/15 font-semibold px-3 py-1.5 rounded-lg", children: "Dejar de compartir" })
                        : _jsx("button", { onClick: () => guardar(true), className: "bg-mostaza text-[#1F2424] font-bold px-3 py-1.5 rounded-lg", children: "Guardar y compartir" }), _jsx("button", { onClick: () => window.print(), className: "bg-white text-petroleo font-bold px-3 py-1.5 rounded-lg", children: "PDF" })] }), estado && _jsx("p", { role: "status", className: "no-print text-center font-semibold text-petroleo bg-white py-2", children: estado }), _jsxs("div", { className: "max-w-3xl mx-auto p-4 sm:p-6", children: [cargando || !foto ? _jsx("p", { className: "text-texto-suave", children: "Calculando el mes\u2026" }) : (_jsx(VistaResumen, { foto: foto, conclusiones: conclusiones, objetivos: objetivos, editor: { onConclusiones: setConclusiones, onObjetivos: setObjetivos } })), _jsx("p", { className: "no-print text-xs text-texto-suave mt-4", children: "Las cifras se guardan tal como est\u00E1n al guardar. Si el paciente anota algo m\u00E1s de ese mes, pulsa \u00ABActualizar cifras\u00BB y guarda de nuevo. Para el PDF, pulsa \u00ABPDF\u00BB y elige \u00ABGuardar como PDF\u00BB." })] })] }));
}
/** El resumen tal como se ve en pantalla y en el PDF. Con `editor`, las conclusiones son editables. */
export function VistaResumen({ foto, conclusiones, objetivos, editor }) {
    const e = foto.entrenamiento;
    return (_jsxs("article", { id: "imprimir", className: "bg-white rounded-2xl p-5 sm:p-8 flex flex-col gap-6 print:rounded-none print:p-0", children: [_jsxs("header", { className: "flex items-start justify-between gap-4 border-b-2 border-mostaza pb-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wide text-texto-suave", children: "Resumen mensual" }), _jsx("h1", { className: "text-2xl font-bold ", children: NOMBRE_MES(foto.mes) }), _jsx("p", { className: "font-semibold", children: foto.nombre })] }), _jsx("img", { src: "/marca/logotipo-petroleo.png", alt: "Vitaltrain", className: "h-10 w-auto", onError: (ev) => { ev.target.style.display = 'none'; } })] }), e && (_jsxs(Bloque, { titulo: "Entrenamiento", children: [_jsxs("div", { className: "grid grid-cols-3 gap-2 text-center", children: [_jsx(Cifra, { titulo: "Sesiones hechas", valor: `${e.hechas} de ${e.pautadas}` }), _jsx(Cifra, { titulo: "Adherencia", valor: e.pautadas ? `${Math.round((e.hechas / e.pautadas) * 100)}%` : '—' }), _jsx(Cifra, { titulo: "Esfuerzo medio", valor: e.rpeMedio != null ? `${n1(e.rpeMedio)} / 10` : '—' })] }), e.ejercicios.length > 0 && (_jsxs("table", { className: "w-full text-sm mt-2", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs text-texto-suave", children: [_jsx("th", { className: "py-1 font-semibold", children: "Ejercicio" }), _jsx("th", { className: "font-semibold", children: "Inicio" }), _jsx("th", { className: "font-semibold", children: "Final" }), _jsx("th", { className: "font-semibold text-right", children: "Cambio" })] }) }), _jsx("tbody", { children: e.ejercicios.map((x) => {
                                    const dif = x.ultimo.kg - x.primero.kg;
                                    return (_jsxs("tr", { className: "border-t border-fondo", children: [_jsx("td", { className: "py-1.5 pr-2", children: x.nombre }), _jsxs("td", { className: "tabular-nums whitespace-nowrap", children: [n1(x.primero.kg), " kg", x.primero.reps ? ` × ${x.primero.reps}` : ''] }), _jsxs("td", { className: "tabular-nums whitespace-nowrap", children: [n1(x.ultimo.kg), " kg", x.ultimo.reps ? ` × ${x.ultimo.reps}` : ''] }), _jsx("td", { className: "tabular-nums text-right font-semibold", children: x.sesiones < 2 ? '—' : dif === 0 ? '=' : `${dif > 0 ? '+' : ''}${n1(dif)} kg` })] }, x.nombre));
                                }) })] })), e.notas.length > 0 && (_jsxs("div", { className: "mt-2", children: [_jsx("h3", { className: "text-sm font-bold", children: "Notas en ejercicios" }), _jsx("ul", { className: "text-sm flex flex-col gap-1 mt-1", children: e.notas.map((n, i) => _jsxs("li", { children: [_jsxs("span", { className: "text-texto-suave", children: [n.fecha ? fechaCorta(n.fecha) : '', " \u00B7 ", n.ejercicio, ":"] }), " ", n.noPuede ? _jsxs("b", { children: ["No pudo (", n.noPuede.toLowerCase(), "). "] }) : null, n.nota] }, i)) })] })), e.sensaciones.length > 0 && (_jsxs("div", { className: "mt-2", children: [_jsx("h3", { className: "text-sm font-bold", children: "C\u00F3mo se sinti\u00F3" }), _jsx("ul", { className: "text-sm flex flex-col gap-1 mt-1", children: e.sensaciones.map((s, i) => _jsxs("li", { children: [_jsxs("span", { className: "text-texto-suave", children: [fechaCorta(s.fecha), s.rpe ? ` · esfuerzo ${s.rpe}` : '', ":"] }), " ", s.texto] }, i)) })] }))] })), foto.medidas && (_jsx(Bloque, { titulo: "Medidas", children: _jsx("div", { className: "grid grid-cols-3 gap-2 text-center", children: foto.medidas.map((m) => {
                        const base = m.previo ?? m.inicio;
                        const dif = m.fin - base;
                        return _jsx(Cifra, { titulo: m.clave, valor: `${n1(m.fin)} ${m.unidad}`, nota: dif === 0 ? 'sin cambio' : `${dif > 0 ? '+' : ''}${n1(dif)} ${m.unidad} ${m.previo != null ? 'vs. mes anterior' : 'en el mes'}` }, m.clave);
                    }) }) })), foto.sueno && (_jsx(Bloque, { titulo: "Sue\u00F1o y horarios", children: _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2 text-center", children: [_jsx(Cifra, { titulo: "Noches anotadas", valor: String(foto.sueno.noches) }), _jsx(Cifra, { titulo: "Sue\u00F1o medio", valor: horas(foto.sueno.duracion) }), _jsx(Cifra, { titulo: "Se acuesta / levanta", valor: `${foto.sueno.acostarse ?? '—'} / ${foto.sueno.levantarse ?? '—'}` }), _jsx(Cifra, { titulo: "Regularidad", valor: foto.sueno.regularidad != null ? `± ${Math.round(foto.sueno.regularidad)} min` : '—' }), _jsx(Cifra, { titulo: "Jet lag social", valor: horas(foto.sueno.jetLag) }), _jsx(Cifra, { titulo: "Calidad del sue\u00F1o", valor: foto.sueno.calidad != null ? `${n1(foto.sueno.calidad)} / 5` : '—' }), _jsx(Cifra, { titulo: "Ventana de comidas", valor: horas(foto.sueno.ventana) }), _jsx(Cifra, { titulo: "\u00DAltima comida \u2192 cama", valor: horas(foto.sueno.ultimaACama) })] }) })), foto.habitos && (_jsx(Bloque, { titulo: "H\u00E1bitos", children: _jsx("ul", { className: "flex flex-col gap-2", children: foto.habitos.map((h) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex justify-between gap-2", children: [_jsxs("span", { children: [_jsx("b", { children: h.nombre }), " ", _jsxs("span", { className: "text-texto-suave", children: ["\u00B7 ", h.pilar] })] }), _jsxs("span", { className: "tabular-nums font-semibold", children: [h.pct, "% ", _jsxs("span", { className: "font-normal text-texto-suave", children: ["(", h.hechos, "/", h.tocaban, ")"] })] })] }), _jsx("div", { className: "h-2 rounded bg-fondo mt-1 overflow-hidden", children: _jsx("div", { className: "h-full bg-petroleo", style: { width: `${h.pct}%` } }) })] }, h.nombre))) }) })), !e && !foto.medidas && !foto.sueno && !foto.habitos && _jsx("p", { className: "text-texto-suave", children: "No hay datos registrados en este mes." }), _jsxs(Bloque, { titulo: "Conclusiones de Rub\u00E9n", children: [editor
                        ? _jsx("textarea", { value: conclusiones ?? '', onChange: (ev) => editor.onConclusiones(ev.target.value.slice(0, 5000)), rows: 6, placeholder: "Qu\u00E9 ha ido bien, qu\u00E9 cuesta y por qu\u00E9. Lo leer\u00E1 el paciente si lo compartes.", className: "no-print w-full text-base px-3 py-2 border border-borde rounded-xl" })
                        : null, _jsx("p", { className: `${editor ? 'hidden print:block' : ''} whitespace-pre-line`, children: conclusiones || (editor ? '' : '—') })] }), _jsxs(Bloque, { titulo: "Objetivos para el mes que viene", children: [editor
                        ? _jsx("textarea", { value: objetivos ?? '', onChange: (ev) => editor.onObjetivos(ev.target.value.slice(0, 2000)), rows: 4, placeholder: "Dos o tres objetivos concretos.", className: "no-print w-full text-base px-3 py-2 border border-borde rounded-xl" })
                        : null, _jsx("p", { className: `${editor ? 'hidden print:block' : ''} whitespace-pre-line`, children: objetivos || (editor ? '' : '—') })] }), _jsx("footer", { className: "text-[11px] text-texto-suave border-t border-fondo pt-3", children: "Rub\u00E9n \u00DAbeda Rubio, T.S.D. Sanitario Colegiado 2209 \u00B7 Cl\u00EDnica Vitaltrain, Centro Sanitario N\u00BA Registro 22433. Datos registrados por el paciente en la app. Este resumen no es un informe cl\u00EDnico." })] }));
}
function Bloque({ titulo, children }) {
    return (_jsxs("section", { className: "flex flex-col gap-2 break-inside-avoid", children: [_jsx("h2", { className: "text-sm font-bold uppercase tracking-wide text-petroleo", children: titulo }), children] }));
}
function Cifra({ titulo, valor, nota }) {
    return (_jsxs("div", { className: "rounded-xl bg-fondo p-2 print:border print:border-borde", children: [_jsx("div", { className: "text-[11px] font-bold uppercase tracking-wide text-texto-suave", children: titulo }), _jsx("div", { className: "text-lg font-bold tabular-nums leading-tight", children: valor }), nota && _jsx("div", { className: "text-[11px] text-texto-suave", children: nota })] }));
}
/** Pestaña Progreso del paciente: resúmenes que el coach ha compartido. */
export function MisResumenes({ supabase, pacienteId }) {
    const [filas, setFilas] = useState([]);
    const [abierto, setAbierto] = useState(null);
    useEffect(() => {
        supabase.from('monthly_reviews').select('id, month, conclusions, next_goals, snapshot, shared_at, updated_at').eq('patient_id', pacienteId).not('shared_at', 'is', null).order('month', { ascending: false })
            .then(({ data }) => setFilas(data ?? []));
    }, [supabase, pacienteId]);
    if (filas.length === 0)
        return null;
    return (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-2", "aria-labelledby": "mis-resumenes", children: [_jsx("h2", { id: "mis-resumenes", className: "font-bold", children: "Mis res\u00FAmenes del mes" }), _jsx("ul", { className: "flex flex-col", children: filas.map((f) => (_jsx("li", { children: _jsxs("button", { onClick: () => setAbierto(f), className: "w-full text-left py-3 border-t border-fondo flex justify-between font-semibold ", children: [NOMBRE_MES(f.month.slice(0, 7)), _jsx("span", { className: "text-petroleo", "aria-hidden": "true", children: "\u203A" })] }) }, f.id))) }), abierto && abierto.snapshot && (_jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": "Resumen del mes", className: "fixed inset-0 z-50 bg-fondo overflow-y-auto", children: [_jsxs("div", { className: "no-print sticky top-0 z-10 bg-petroleo text-white px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)] flex items-center justify-between", children: [_jsx("button", { onClick: () => setAbierto(null), className: "font-semibold", children: "\u2190 Volver" }), _jsx("button", { onClick: () => window.print(), className: "bg-white text-petroleo font-bold px-3 py-1.5 rounded-lg", children: "Guardar PDF" })] }), _jsx("div", { className: "p-4", children: _jsx(VistaResumen, { foto: abierto.snapshot, conclusiones: abierto.conclusions, objetivos: abierto.next_goals }) })] }))] }));
}
