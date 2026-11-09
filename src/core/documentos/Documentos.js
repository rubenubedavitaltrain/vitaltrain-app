import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
const BUCKET = 'documentos';
const MAX = 20 * 1024 * 1024;
const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const tam = (b) => (b == null ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`);
async function cargar(supabase, pacienteId) {
    const { data } = await supabase.from('patient_documents')
        .select('id, title, note, storage_path, size_bytes, is_shared, created_at, pillar_id, pillars(name, position)')
        .eq('patient_id', pacienteId).order('created_at', { ascending: false });
    const docs = data ?? [];
    const urls = {};
    if (docs.length) {
        const { data: firmadas } = await supabase.storage.from(BUCKET).createSignedUrls(docs.map((d) => d.storage_path), 3600);
        for (const f of firmadas ?? [])
            if (f.path && f.signedUrl)
                urls[f.path] = f.signedUrl;
    }
    return { docs, urls };
}
function agrupar(docs) {
    const g = new Map();
    for (const d of docs) {
        const k = d.pillars?.name ?? 'Otros';
        const e = g.get(k) ?? { orden: d.pillars?.position ?? 9, lista: [] };
        e.lista.push(d);
        g.set(k, e);
    }
    return [...g.entries()].sort((a, b) => a[1].orden - b[1].orden);
}
/** Pestaña Perfil del paciente. No aparece si no tiene documentos. */
export function MisDocumentos({ supabase, pacienteId }) {
    const [datos, setDatos] = useState(null);
    useEffect(() => { cargar(supabase, pacienteId).then(setDatos); }, [supabase, pacienteId]);
    if (!datos || datos.docs.length === 0)
        return null;
    const nuevo = (d) => Date.now() - new Date(d.created_at).valueOf() < 7 * 86400000;
    return (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "mis-documentos", children: [_jsxs("div", { children: [_jsx("h2", { id: "mis-documentos", className: "font-bold", children: "Mis documentos" }), _jsx("p", { className: "text-xs text-texto-suave", children: "Lo que Rub\u00E9n te ha preparado. Se abren en PDF." })] }), agrupar(datos.docs).map(([pilar, { lista }]) => (_jsxs("div", { children: [_jsx("h3", { className: "text-[11px] font-bold uppercase tracking-wide text-petroleo mb-1", children: pilar }), _jsx("ul", { className: "flex flex-col", children: lista.map((d) => (_jsx("li", { className: "border-t border-fondo", children: _jsxs("a", { href: datos.urls[d.storage_path], target: "_blank", rel: "noopener", className: "flex items-center gap-3 py-3", children: [_jsx(IconoPdf, {}), _jsxs("span", { className: "flex-1 min-w-0", children: [_jsxs("span", { className: "block font-semibold leading-tight", children: [d.title, nuevo(d) && _jsx("span", { className: "ml-2 text-[10px] font-bold uppercase bg-mostaza text-[#1F2424] rounded px-1.5 py-0.5 align-middle", children: "Nuevo" })] }), _jsxs("span", { className: "block text-xs text-texto-suave", children: [fecha(d.created_at), d.note ? ` · ${d.note}` : ''] })] }), _jsx("span", { className: "text-petroleo font-bold", "aria-hidden": "true", children: "\u203A" })] }) }, d.id))) })] }, pilar)))] }));
}
/** Sección de la ficha del paciente en el panel del coach. */
export function DocumentosCoach({ supabase, pacienteId, nombre }) {
    const [datos, setDatos] = useState(null);
    const [pilares, setPilares] = useState([]);
    const [version, setVersion] = useState(0);
    const [archivo, setArchivo] = useState(null);
    const [titulo, setTitulo] = useState('');
    const [pilar, setPilar] = useState('');
    const [nota, setNota] = useState('');
    const [compartir, setCompartir] = useState(true);
    const [estado, setEstado] = useState(null);
    const input = useRef(null);
    useEffect(() => { cargar(supabase, pacienteId).then(setDatos); }, [supabase, pacienteId, version]);
    useEffect(() => { supabase.from('pillars').select('id, slug, name, position').order('position').then(({ data }) => setPilares(data ?? [])); }, [supabase]);
    function elegir(f) {
        setEstado(null);
        if (!f)
            return;
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'))
            return setEstado({ tipo: 'error', texto: 'Solo se pueden subir PDF. Si es un Word, guárdalo antes como PDF.' });
        if (f.size > MAX)
            return setEstado({ tipo: 'error', texto: 'El archivo pasa de 20 MB.' });
        setArchivo(f);
        if (!titulo)
            setTitulo(f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 120));
    }
    async function subir() {
        if (!archivo)
            return;
        if (!titulo.trim())
            return setEstado({ tipo: 'error', texto: 'Ponle un título.' });
        setEstado({ tipo: 'subiendo', texto: 'Subiendo…' });
        const ruta = `${pacienteId}/${crypto.randomUUID()}.pdf`;
        const up = await supabase.storage.from(BUCKET).upload(ruta, archivo, { contentType: 'application/pdf', upsert: false });
        if (up.error)
            return setEstado({ tipo: 'error', texto: 'No se ha podido subir el archivo.' });
        const { error } = await supabase.from('patient_documents').insert({
            patient_id: pacienteId, pillar_id: pilar || null, title: titulo.trim(), note: nota.trim() || null,
            storage_path: ruta, size_bytes: archivo.size, is_shared: compartir,
        });
        if (error) {
            await supabase.storage.from(BUCKET).remove([ruta]);
            return setEstado({ tipo: 'error', texto: 'No se ha podido guardar el documento.' });
        }
        setArchivo(null);
        setTitulo('');
        setNota('');
        setPilar('');
        setCompartir(true);
        if (input.current)
            input.current.value = '';
        setEstado({ tipo: 'ok', texto: compartir ? `Subido. ${nombre} ya lo ve en su app.` : 'Subido. Aún no lo ve el paciente.' });
        setVersion((v) => v + 1);
    }
    async function cambiarCompartido(d) {
        await supabase.from('patient_documents').update({ is_shared: !d.is_shared }).eq('id', d.id);
        setVersion((v) => v + 1);
    }
    async function borrar(d) {
        if (!window.confirm(`¿Borrar «${d.title}»? ${nombre} dejará de verlo. No se puede deshacer.`))
            return;
        const { error } = await supabase.from('patient_documents').delete().eq('id', d.id);
        if (error)
            return setEstado({ tipo: 'error', texto: 'No se ha podido borrar.' });
        await supabase.storage.from(BUCKET).remove([d.storage_path]);
        setVersion((v) => v + 1);
    }
    return (_jsxs("section", { className: "flex flex-col gap-3", "aria-labelledby": "documentos-coach", children: [_jsx("h3", { id: "documentos-coach", className: "text-lg font-bold px-1", children: "Documentos" }), _jsxs("div", { className: "grid lg:grid-cols-2 gap-4 items-start", children: [_jsxs("div", { className: "bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3", children: [_jsx("h4", { className: "font-bold", children: "Subir un PDF" }), _jsxs("label", { className: "flex flex-col items-center justify-center gap-1 border-2 border-dashed border-borde rounded-xl p-5 text-center cursor-pointer hover:bg-fondo", onDragOver: (e) => e.preventDefault(), onDrop: (e) => { e.preventDefault(); elegir(e.dataTransfer.files[0] ?? null); }, children: [_jsx("input", { ref: input, type: "file", accept: "application/pdf,.pdf", className: "sr-only", onChange: (e) => elegir(e.target.files?.[0] ?? null) }), _jsx(IconoPdf, {}), _jsx("span", { className: "font-semibold", children: archivo ? archivo.name : 'Arrastra aquí el PDF o pulsa para elegirlo' }), _jsx("span", { className: "text-xs text-texto-suave", children: archivo ? tam(archivo.size) : 'Hasta 20 MB' })] }), archivo && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["T\u00EDtulo que ver\u00E1 el paciente", _jsx("input", { value: titulo, maxLength: 120, onChange: (e) => setTitulo(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl" })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Pilar", _jsxs("select", { value: pilar, onChange: (e) => setPilar(e.target.value), className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white", children: [_jsx("option", { value: "", children: "Sin pilar" }), pilares.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm font-semibold", children: ["Nota para el paciente (opcional)", _jsx("input", { value: nota, maxLength: 300, onChange: (e) => setNota(e.target.value), placeholder: "Ej.: empieza el lunes", className: "font-normal text-base px-3 py-2.5 border border-borde rounded-xl" })] }), _jsxs("label", { className: "flex items-center gap-3 text-sm font-semibold", children: [_jsx("input", { type: "checkbox", checked: compartir, onChange: (e) => setCompartir(e.target.checked), className: "w-5 h-5 accent-[#374949]" }), "Que ", nombre, " lo vea ya en su app"] }), _jsx("button", { onClick: subir, disabled: estado?.tipo === 'subiendo', className: "bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl disabled:opacity-60", children: "Subir" })] })), estado && _jsx("p", { role: estado.tipo === 'error' ? 'alert' : 'status', className: `text-sm font-semibold ${estado.tipo === 'error' ? 'text-[#8A2C1D]' : 'text-petroleo'}`, children: estado.texto }), _jsx("p", { className: "text-xs text-texto-suave", children: "Para planes, protocolos y material de apoyo. No subas anal\u00EDticas ni informes con diagn\u00F3sticos: la historia cl\u00EDnica sigue en su sistema." })] }), _jsxs("div", { className: "bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-2", children: [_jsx("h4", { className: "font-bold", children: "Lo que tiene" }), !datos && _jsx("p", { className: "text-sm text-texto-suave", children: "Cargando\u2026" }), datos?.docs.length === 0 && _jsx("p", { className: "text-sm text-texto-suave", children: "A\u00FAn no hay documentos." }), _jsx("ul", { className: "flex flex-col", children: datos?.docs.map((d) => (_jsxs("li", { className: "border-t border-fondo py-2.5 flex items-start gap-3", children: [_jsx(IconoPdf, {}), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("a", { href: datos.urls[d.storage_path], target: "_blank", rel: "noopener", className: "font-semibold hover:underline", children: d.title }), _jsx("div", { className: "text-xs text-texto-suave", children: [d.pillars?.name ?? 'Sin pilar', fecha(d.created_at), tam(d.size_bytes)].filter(Boolean).join(' · ') }), d.note && _jsx("div", { className: "text-xs", children: d.note })] }), _jsxs("div", { className: "flex flex-col items-end gap-1 shrink-0", children: [_jsx("button", { onClick: () => cambiarCompartido(d), className: `text-xs font-bold px-2 py-1 rounded-lg ${d.is_shared ? 'bg-fondo text-petroleo' : 'bg-mostaza text-[#1F2424]'}`, children: d.is_shared ? 'Lo ve' : 'Oculto · compartir' }), _jsx("button", { onClick: () => borrar(d), className: "text-xs font-semibold text-[#8A2C1D] px-2 py-1", children: "Borrar" })] })] }, d.id))) })] })] })] }));
}
function IconoPdf() {
    return (_jsxs("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "#374949", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", className: "shrink-0", children: [_jsx("path", { d: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" }), _jsx("path", { d: "M14 3v5h5" }), _jsx("text", { x: "12", y: "17.5", fontSize: "5.5", fontWeight: "700", textAnchor: "middle", fill: "#374949", stroke: "none", children: "PDF" })] }));
}
