import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { DIAS_CORTOS, desdeIso, hoyIso, iso, lunes, rangoSemana, sumarDias } from '../../lib/fechas';
import { MOTIVOS } from '../../modules/entrenamiento/paciente/tipos';
const uno = (x) => (Array.isArray(x) ? x[0] ?? null : x ?? null);
const diasDesde = (f) => Math.round((desdeIso(hoyIso()).getTime() - desdeIso(f).getTime()) / 86400000);
const fecha = (f) => desdeIso(f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
export default function Inicio({ supabase, nombre, onAbrir }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const inicio = useMemo(() => lunes(new Date()), []);
    const hoy = hoyIso();
    useEffect(() => {
        const desde = iso(inicio);
        const hasta = iso(sumarDias(inicio, 13)); // esta semana y la siguiente (para ver si tiene plan)
        Promise.all([
            supabase.from('profiles').select('id, full_name, created_at').eq('role', 'patient').eq('status', 'active').order('full_name'),
            supabase.from('workouts').select('patient_id, scheduled_date, status').gte('scheduled_date', desde).lte('scheduled_date', hasta),
            supabase.from('workouts').select('patient_id, scheduled_date, status').eq('status', 'completed').gte('scheduled_date', iso(sumarDias(inicio, -90))).order('scheduled_date', { ascending: false }),
            supabase.from('workout_item_feedback').select('id, patient_id, note, cannot_do, reason, created_at, workout_items(exercises(name), workout_blocks(workouts(scheduled_date)))').is('read_by_coach_at', null).order('created_at', { ascending: false }).limit(50),
            supabase.from('consents').select('patient_id').is('withdrawn_at', null).is('replaced_at', null),
            supabase.from('messages').select('patient_id, sender_id').is('read_at', null).limit(1000),
        ]).then(([p, s, h, n, c, m]) => {
            if (p.error || s.error || h.error || n.error || c.error || m.error)
                return setError(true);
            setDatos({
                pacientes: p.data ?? [], sesiones: s.data ?? [], hechas: h.data ?? [],
                notas: n.data ?? [], consentidos: (c.data ?? []).map((x) => x.patient_id),
                mensajes: (m.data ?? []).filter((x) => x.patient_id === x.sender_id).map((x) => x.patient_id),
            });
        });
    }, [supabase, inicio]);
    const filas = useMemo(() => {
        if (!datos)
            return [];
        const finSemana = iso(sumarDias(inicio, 6));
        return datos.pacientes.map((p) => {
            const suyas = datos.sesiones.filter((s) => s.patient_id === p.id);
            const semana = suyas.filter((s) => s.scheduled_date <= finSemana);
            const dias = Array.from({ length: 7 }, (_, i) => {
                const f = iso(sumarDias(inicio, i));
                const d = semana.filter((s) => s.scheduled_date === f);
                if (!d.length)
                    return null;
                if (d.every((s) => s.status === 'completed'))
                    return 'hecho';
                if (f < hoy)
                    return 'perdido';
                return f === hoy ? 'pendiente' : 'futuro';
            });
            return {
                p, dias,
                hechas: semana.filter((s) => s.status === 'completed').length,
                pautadas: semana.length,
                ultima: datos.hechas.find((s) => s.patient_id === p.id)?.scheduled_date ?? null,
                proximas: suyas.filter((s) => s.scheduled_date >= hoy && s.status === 'scheduled').length,
                sinConsentimiento: !datos.consentidos.includes(p.id),
                notas: datos.notas.filter((n) => n.patient_id === p.id).length,
                mensajes: datos.mensajes.filter((x) => x === p.id).length,
            };
        });
    }, [datos, inicio, hoy]);
    if (error)
        return _jsx("p", { className: "bg-white rounded-2xl p-6 text-texto-suave", children: "No se ha podido cargar el panel. Comprueba la conexi\u00F3n y recarga." });
    if (!datos)
        return _jsx("p", { className: "bg-white rounded-2xl p-6 text-texto-suave", children: "Cargando\u2026" });
    const pautadas = filas.reduce((a, f) => a + f.pautadas, 0);
    const hechas = filas.reduce((a, f) => a + f.hechas, 0);
    const atencion = filas
        .map((f) => {
        const motivos = [];
        const dias = f.ultima ? diasDesde(f.ultima) : null;
        if (f.sinConsentimiento)
            motivos.push('Aún no ha aceptado el consentimiento');
        if (dias != null && dias >= 7)
            motivos.push(`${dias} días sin entrenar`);
        if (dias == null && diasDesde(f.p.created_at.slice(0, 10)) >= 7)
            motivos.push('Todavía no ha hecho ninguna sesión');
        if (f.dias.includes('perdido'))
            motivos.push(`${f.dias.filter((d) => d === 'perdido').length} sin hacer esta semana`);
        if (f.proximas === 0)
            motivos.push('Sin sesiones pendientes: necesita plan');
        if (f.notas)
            motivos.push(`${f.notas} ${f.notas === 1 ? 'nota sin leer' : 'notas sin leer'}`);
        if (f.mensajes)
            motivos.push(`${f.mensajes} ${f.mensajes === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}`);
        return { f, motivos };
    })
        .filter((x) => x.motivos.length);
    const sinEntrenar = filas.filter((f) => (f.ultima ? diasDesde(f.ultima) >= 7 : true)).length;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-2xl font-bold", children: ["Hola, ", nombre] }), _jsxs("p", { className: "text-sm text-texto-suave", children: ["Semana del ", rangoSemana(inicio), " \u00B7 ", new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })] })] }), _jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3", children: [_jsx(Dato, { titulo: "Pacientes activos", valor: String(filas.length) }), _jsx(Dato, { titulo: "Sesiones esta semana", valor: pautadas ? `${hechas} de ${pautadas}` : '—', nota: pautadas ? `${Math.round((hechas / pautadas) * 100)} % hechas` : 'Sin sesiones pautadas' }), _jsx(Dato, { titulo: "7 d\u00EDas o m\u00E1s sin entrenar", valor: String(sinEntrenar), destacado: sinEntrenar > 0 }), _jsx(Dato, { titulo: "Notas y mensajes sin leer", valor: String(datos.notas.length + datos.mensajes.length), nota: `${datos.notas.length} notas · ${datos.mensajes.length} mensajes`, destacado: datos.notas.length + datos.mensajes.length > 0 })] }), filas.length === 0 && _jsx("p", { className: "bg-white rounded-2xl p-6 text-texto-suave", children: "A\u00FAn no tienes pacientes activos. Dalos de alta en Pacientes." }), atencion.length > 0 && (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "atencion", children: [_jsx("h3", { id: "atencion", className: "text-lg font-bold", children: "Necesitan atenci\u00F3n" }), _jsx("ul", { className: "flex flex-col gap-2", children: atencion.map(({ f, motivos }) => (_jsx("li", { children: _jsxs("button", { onClick: () => onAbrir(f.p.id), className: "w-full text-left rounded-xl bg-[#F4F1E4] border-l-4 border-mostaza px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1", children: [_jsx("span", { className: "font-bold min-w-40", children: f.p.full_name }), _jsx("span", { className: "flex-1 text-sm", children: motivos.join(' · ') }), _jsx("span", { className: "text-sm font-bold text-petroleo", children: "Abrir ficha \u2192" })] }) }, f.p.id))) })] })), filas.length > 0 && (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "semana-todos", children: [_jsx("h3", { id: "semana-todos", className: "text-lg font-bold", children: "La semana de cada paciente" }), _jsx("div", { className: "overflow-x-auto -mx-1 px-1", children: _jsxs("table", { className: "w-full min-w-[640px] text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs text-texto-suave text-left", children: [_jsx("th", { scope: "col", className: "font-semibold py-2", children: "Paciente" }), DIAS_CORTOS.map((d, i) => _jsx("th", { scope: "col", className: `font-semibold text-center ${iso(sumarDias(inicio, i)) === hoy ? 'text-petroleo' : ''}`, children: d }, d)), _jsx("th", { scope: "col", className: "font-semibold text-center", children: "Hechas" }), _jsx("th", { scope: "col", className: "font-semibold", children: "\u00DAltima sesi\u00F3n" })] }) }), _jsx("tbody", { children: filas.map((f) => (_jsxs("tr", { className: "border-t border-fondo", children: [_jsx("th", { scope: "row", className: "text-left py-2.5 pr-2", children: _jsx("button", { onClick: () => onAbrir(f.p.id), className: "font-semibold text-left hover:underline", children: f.p.full_name }) }), f.dias.map((d, i) => (_jsx("td", { className: "text-center", children: _jsx(Punto, { estado: d }) }, i))), _jsx("td", { className: "text-center font-semibold", children: f.pautadas ? `${f.hechas}/${f.pautadas}` : '—' }), _jsx("td", { className: "text-texto-suave", children: f.ultima ? `${fecha(f.ultima)} (${diasDesde(f.ultima) === 0 ? 'hoy' : `hace ${diasDesde(f.ultima)} d`})` : 'Ninguna' })] }, f.p.id))) })] }) }), _jsxs("div", { className: "flex flex-wrap gap-4 text-xs text-texto-suave", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Punto, { estado: "hecho" }), " Hecha"] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Punto, { estado: "pendiente" }), " Hoy"] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Punto, { estado: "futuro" }), " Pendiente"] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Punto, { estado: "perdido" }), " No hecha"] })] })] })), datos.notas.length > 0 && (_jsxs("section", { className: "bg-white rounded-2xl p-5 flex flex-col gap-3", "aria-labelledby": "notas-todas", children: [_jsx("h3", { id: "notas-todas", className: "text-lg font-bold", children: "Notas sin leer" }), _jsx("p", { className: "text-xs text-texto-suave -mt-2", children: "Se marcan como le\u00EDdas desde la ficha de cada paciente." }), _jsx("ul", { className: "flex flex-col gap-2", children: datos.notas.slice(0, 12).map((n) => {
                            const it = uno(n.workout_items);
                            const ej = uno(it?.exercises)?.name ?? 'Ejercicio';
                            const w = uno(uno(it?.workout_blocks)?.workouts);
                            const p = datos.pacientes.find((x) => x.id === n.patient_id);
                            return (_jsx("li", { children: _jsxs("button", { onClick: () => onAbrir(n.patient_id), className: "w-full text-left rounded-xl bg-fondo px-4 py-3 text-sm", children: [_jsx("span", { className: "font-bold", children: p?.full_name ?? 'Paciente' }), _jsxs("span", { className: "text-texto-suave", children: [" \u00B7 ", ej, w ? ` · ${fecha(w.scheduled_date)}` : ''] }), n.cannot_do && _jsxs("span", { className: "block font-semibold text-[#8A2C1D]", children: ["No ha podido: ", MOTIVOS[n.reason] ?? 'otro motivo'] }), n.note && _jsxs("span", { className: "block italic", children: ["\u00AB", n.note, "\u00BB"] })] }) }, n.id));
                        }) })] }))] }));
}
function Dato({ titulo, valor, nota, destacado }) {
    return (_jsxs("div", { className: `bg-white rounded-2xl p-4 ${destacado ? 'border-l-4 border-mostaza' : ''}`, children: [_jsx("div", { className: "text-xs font-bold tracking-wide text-texto-suave uppercase", children: titulo }), _jsx("div", { className: "text-3xl font-bold mt-1", children: valor }), nota && _jsx("div", { className: "text-xs text-texto-suave", children: nota })] }));
}
function Punto({ estado }) {
    const etiqueta = { hecho: 'Hecha', pendiente: 'Hoy', futuro: 'Pendiente', perdido: 'No hecha' };
    if (!estado)
        return _jsx("span", { className: "inline-block w-5 h-5", "aria-label": "Descanso" });
    const cls = {
        hecho: 'bg-petroleo text-white',
        pendiente: 'border-2 border-mostaza bg-[#F4F1E4]',
        futuro: 'border-2 border-borde',
        perdido: 'bg-gris-claro text-[#8A2C1D]',
    }[estado];
    return (_jsx("span", { className: `inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold align-middle ${cls}`, "aria-label": etiqueta[estado], title: etiqueta[estado], children: estado === 'hecho' ? '✓' : estado === 'perdido' ? '✕' : '' }));
}
