import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { cargarSesion, enviar, esTiempo, guardarCopia, pendientes, repsDe, vaciarCola } from './datos';
import { MOTIVOS } from './tipos';
import { miniatura, urlReproductor } from '../biblioteca/youtube';
// Entrenamiento en curso (paciente). Series precargadas con lo que pauta el coach,
// temporizador de descanso, vídeo vertical, nota y "No puedo hacerlo". Funciona sin conexión.
const TIPO = { normal: '', superset: 'Superserie', circuit: 'Circuito' };
export default function Entrenamiento({ supabase, sesionId, pacienteId, onSalir }) {
    const [s, setS] = useState(null);
    const [error, setError] = useState('');
    const [video, setVideo] = useState(null);
    const [descanso, setDescanso] = useState(null);
    const [feedbackDe, setFeedbackDe] = useState(null);
    const [final, setFinal] = useState(false);
    const [sinRed, setSinRed] = useState(pendientes() > 0 || !navigator.onLine);
    useEffect(() => {
        cargarSesion(supabase, sesionId).then(setS).catch(() => setError('No se ha podido abrir el entrenamiento. Comprueba la conexión.'));
        const online = () => { vaciarCola(supabase).then((n) => setSinRed(n > 0)); };
        const offline = () => setSinRed(true);
        window.addEventListener('online', online);
        window.addEventListener('offline', offline);
        return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
    }, [supabase, sesionId]);
    function actualizar(cambio) {
        setS((prev) => {
            if (!prev)
                return prev;
            const n = cambio(structuredClone(prev));
            guardarCopia(n);
            return n;
        });
    }
    async function mandar(op) {
        const r = await enviar(supabase, op);
        setSinRed(r === 'pendiente');
        if (r === 'error')
            setError('No se ha podido guardar el último cambio.');
    }
    function empezarSiHaceFalta() {
        if (s && s.status === 'scheduled') {
            const started_at = new Date().toISOString();
            actualizar((x) => ({ ...x, status: 'in_progress', started_at }));
            mandar({ s: s.id, t: 'sesion', id: s.id, cambios: { status: 'in_progress', started_at } });
        }
    }
    function marcarSerie(item, n, reps, kg, hecho) {
        empezarSiHaceFalta();
        actualizar((x) => {
            const it = x.workout_blocks.flatMap((b) => b.workout_items).find((i) => i.id === item.id);
            it.set_logs = it.set_logs.filter((l) => l.set_number !== n);
            if (hecho)
                it.set_logs.push({ set_number: n, reps, load_kg: kg, done: true });
            return x;
        });
        if (hecho) {
            mandar({ s: sesionId, t: 'set', fila: { workout_item_id: item.id, patient_id: pacienteId, set_number: n, reps, load_kg: kg, done: true } });
            if (item.rest_seconds)
                setDescanso({ fin: Date.now() + item.rest_seconds * 1000, total: item.rest_seconds });
        }
        else {
            mandar({ s: sesionId, t: 'borrarSet', workout_item_id: item.id, set_number: n });
        }
    }
    function guardarFeedback(item, note, cannot_do, reason) {
        actualizar((x) => {
            const it = x.workout_blocks.flatMap((b) => b.workout_items).find((i) => i.id === item.id);
            it.workout_item_feedback = [{ note, cannot_do, reason }];
            return x;
        });
        mandar({ s: sesionId, t: 'feedback', fila: { workout_item_id: item.id, patient_id: pacienteId, note, cannot_do, reason } });
        setFeedbackDe(null);
    }
    if (error && !s)
        return _jsx(Pantalla, { titulo: "Entrenamiento", onSalir: onSalir, children: _jsx("p", { className: "p-5 font-semibold text-[#8A2C1D]", children: error }) });
    if (!s)
        return _jsx(Pantalla, { titulo: "Entrenamiento", onSalir: onSalir, children: _jsx("p", { className: "p-5 text-texto-suave", children: "Cargando\u2026" }) });
    if (final)
        return _jsx(Final, { supabase: supabase, s: s, onHecho: (c) => { actualizar((x) => ({ ...x, ...c })); onSalir(); }, onVolver: () => setFinal(false), mandar: mandar });
    const items = s.workout_blocks.flatMap((b) => b.workout_items);
    const completos = items.filter((i) => i.set_logs.filter((l) => l.done).length >= i.sets || i.workout_item_feedback[0]?.cannot_do).length;
    return (_jsxs(Pantalla, { titulo: s.name, subtitulo: `${completos} de ${items.length} ejercicios`, onSalir: onSalir, children: [sinRed && _jsx("p", { className: "mx-4 mt-3 text-sm bg-[#F4F1E4] rounded-xl p-3", children: "Sin conexi\u00F3n. Lo que registres se guarda en el m\u00F3vil y se enviar\u00E1 solo." }), error && _jsx("p", { role: "alert", className: "mx-4 mt-3 font-semibold text-[#8A2C1D]", children: error }), s.coach_message && (_jsxs("div", { className: "mx-4 mt-3 bg-white rounded-2xl p-4 border-l-4 border-mostaza", children: [_jsx("div", { className: "text-xs font-bold text-texto-suave mb-1", children: "RUB\u00C9N" }), _jsx("p", { children: s.coach_message })] })), _jsx("div", { className: "flex flex-col gap-4 p-4 pb-40", children: s.workout_blocks.map((b) => (_jsxs("section", { className: "flex flex-col gap-3", children: [(b.name || b.type !== 'normal') && (_jsxs("h2", { className: "text-sm font-bold tracking-wide text-texto-suave uppercase", children: [b.name, b.type !== 'normal' ? ` · ${TIPO[b.type]} × ${b.rounds} vueltas` : ''] })), b.workout_items.map((it) => (_jsx(TarjetaEjercicio, { it: it, onVideo: setVideo, onSerie: marcarSerie, onFeedback: (modo) => setFeedbackDe({ item: it, modo }) }, it.id)))] }, b.id))) }), descanso && _jsx(Descanso, { fin: descanso.fin, total: descanso.total, onCambio: (fin) => setDescanso(fin ? { ...descanso, fin } : null) }), _jsx("div", { className: "fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro p-4 pb-[max(env(safe-area-inset-bottom),1rem)] z-30", children: _jsx("button", { onClick: () => setFinal(true), className: "w-full bg-mostaza text-[#1F2424] text-lg font-bold py-4 rounded-2xl", children: "Terminar entrenamiento" }) }), video && _jsx(Video, { id: video, onCerrar: () => setVideo(null) }), feedbackDe && _jsx(FeedbackVentana, { ...feedbackDe, onCerrar: () => setFeedbackDe(null), onGuardar: guardarFeedback })] }));
}
function Pantalla({ titulo, subtitulo, onSalir, children }) {
    return (_jsxs("div", { className: "min-h-full flex flex-col", children: [_jsxs("header", { className: "bg-petroleo text-white px-3 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-center gap-2 sticky top-0 z-20", children: [_jsx("button", { onClick: onSalir, "aria-label": "Volver", className: "w-11 h-11 text-2xl font-bold", children: "\u2039" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h1", { className: "text-lg font-bold leading-tight truncate", children: titulo }), subtitulo && _jsx("p", { className: "text-sm text-[#E3E8E8]", children: subtitulo })] })] }), children] }));
}
function TarjetaEjercicio({ it, onVideo, onSerie, onFeedback }) {
    const fb = it.workout_item_feedback[0];
    const tiempo = esTiempo(it.target);
    const r = it.rest_seconds ?? 0;
    const descanso = r ? (r < 60 ? `${r} s` : `${Math.floor(r / 60)} min${r % 60 ? ` ${r % 60} s` : ''}`) : null;
    return (_jsxs("article", { className: `bg-white rounded-2xl p-4 flex flex-col gap-3 ${fb?.cannot_do ? 'opacity-70' : ''}`, children: [_jsxs("div", { className: "flex gap-3", children: [it.exercises.video_id && (_jsxs("button", { onClick: () => onVideo(it.exercises.video_id), "aria-label": `Ver vídeo de ${it.exercises.name}`, className: "relative w-20 h-28 rounded-xl overflow-hidden bg-gris-claro shrink-0", children: [_jsx("img", { src: miniatura(it.exercises.video_id), alt: "", className: "w-full h-full object-cover" }), _jsx("span", { className: "absolute inset-0 flex items-center justify-center", children: _jsx("span", { className: "w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center text-sm", children: "\u25B6" }) })] })), _jsxs("div", { className: "flex-1 min-w-0 flex flex-col gap-1", children: [_jsx("h3", { className: "text-lg font-bold leading-tight", children: it.exercises.name }), _jsxs("p", { className: "text-sm text-texto-suave", children: [it.sets, " \u00D7 ", it.target ?? '—', it.load_kg != null ? ` · ${it.load_kg} kg` : '', descanso ? ` · descanso ${descanso}` : ''] }), it.instructions && _jsx("p", { className: "text-sm", children: it.instructions }), !it.instructions && it.exercises.description && _jsx("p", { className: "text-sm", children: it.exercises.description })] })] }), fb?.cannot_do ? (_jsxs("p", { className: "text-sm font-semibold text-[#8A2C1D]", children: ["Marcado como \u00ABNo puedo hacerlo\u00BB: ", fb.reason ? MOTIVOS[fb.reason] : ''] })) : (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "grid grid-cols-[3rem_1fr_1fr_3.25rem] gap-2 text-xs font-semibold text-texto-suave px-1", children: [_jsx("span", { children: "Serie" }), _jsx("span", { children: tiempo ? 'Segundos' : 'Reps' }), _jsx("span", { children: "Kg" }), _jsx("span", {})] }), Array.from({ length: it.sets }, (_, k) => k + 1).map((n) => (_jsx(Serie, { n: n, it: it, onSerie: onSerie }, n)))] })), fb?.note && _jsxs("p", { className: "text-sm bg-fondo rounded-xl p-2", children: ["Tu nota: \u00AB", fb.note, "\u00BB"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => onFeedback('nota'), className: "flex-1 text-sm font-bold text-petroleo border-2 border-gris-claro rounded-xl py-2.5", children: fb?.note ? 'Editar nota' : 'Nota a Rubén' }), _jsx("button", { onClick: () => onFeedback('nopuedo'), className: "flex-1 text-sm font-bold text-petroleo border-2 border-gris-claro rounded-xl py-2.5", children: fb?.cannot_do ? 'Cambiar' : 'No puedo hacerlo' })] })] }));
}
function Serie({ n, it, onSerie }) {
    const log = it.set_logs.find((l) => l.set_number === n);
    const [reps, setReps] = useState(String(log?.reps ?? repsDe(it.target) ?? ''));
    const [kg, setKg] = useState(String(log?.load_kg ?? it.load_kg ?? ''));
    const hecho = !!log?.done;
    const num = (v) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
    return (_jsxs("div", { className: `grid grid-cols-[3rem_1fr_1fr_3.25rem] gap-2 items-center rounded-xl px-1 py-1 ${hecho ? 'bg-[#E4EEE9]' : ''}`, children: [_jsx("span", { className: "text-center font-bold", children: n }), _jsx("input", { "aria-label": `Serie ${n}: repeticiones`, inputMode: "numeric", value: reps, disabled: hecho, onChange: (e) => setReps(e.target.value.replace(/[^\d]/g, '')), className: "w-full min-w-0 text-lg font-semibold text-center py-2.5 border border-borde rounded-xl bg-white disabled:bg-transparent disabled:border-transparent" }), _jsx("input", { "aria-label": `Serie ${n}: kilos`, inputMode: "decimal", value: kg, disabled: hecho, onChange: (e) => setKg(e.target.value.replace(/[^\d.,]/g, '')), className: "w-full min-w-0 text-lg font-semibold text-center py-2.5 border border-borde rounded-xl bg-white disabled:bg-transparent disabled:border-transparent" }), _jsx("button", { onClick: () => onSerie(it, n, num(reps), num(kg), !hecho), "aria-label": hecho ? `Desmarcar serie ${n}` : `Marcar serie ${n} como hecha`, "aria-pressed": hecho, className: `h-12 rounded-xl text-xl font-bold ${hecho ? 'bg-petroleo text-white' : 'bg-fondo text-petroleo border-2 border-petroleo'}`, children: "\u2713" })] }));
}
function Descanso({ fin, total, onCambio }) {
    const [ahora, setAhora] = useState(Date.now());
    const avisado = useRef(false);
    useEffect(() => {
        const t = setInterval(() => setAhora(Date.now()), 250);
        return () => clearInterval(t);
    }, []);
    const quedan = Math.max(0, Math.ceil((fin - ahora) / 1000));
    useEffect(() => {
        if (quedan === 0 && !avisado.current) {
            avisado.current = true;
            try {
                navigator.vibrate?.([200, 100, 200]);
            }
            catch { /* sin vibración */ }
            setTimeout(() => onCambio(null), 1500);
        }
    }, [quedan, onCambio]);
    const pct = Math.min(100, ((total - quedan) / total) * 100);
    return (_jsxs("div", { role: "timer", "aria-live": "polite", className: "fixed left-4 right-4 bottom-28 z-40 bg-petroleo text-white rounded-2xl p-4 shadow-xl flex items-center gap-3", children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-xs font-semibold text-[#E3E8E8]", children: quedan ? 'Descanso' : 'Siguiente serie' }), _jsxs("div", { className: "text-3xl font-bold tabular-nums", children: [Math.floor(quedan / 60), ":", String(quedan % 60).padStart(2, '0')] }), _jsx("div", { className: "h-1.5 bg-white/20 rounded-full mt-2", children: _jsx("div", { className: "h-full bg-mostaza rounded-full", style: { width: `${pct}%` } }) })] }), _jsx("button", { onClick: () => onCambio(fin + 15000), className: "px-3 py-3 rounded-xl bg-white/15 font-bold", children: "+15 s" }), _jsx("button", { onClick: () => onCambio(null), className: "px-3 py-3 rounded-xl bg-mostaza text-[#1F2424] font-bold", children: "Saltar" })] }));
}
function Video({ id, onCerrar }) {
    return (_jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": "V\u00EDdeo del ejercicio", className: "fixed inset-0 z-50 bg-black flex flex-col", children: [_jsx("button", { onClick: onCerrar, className: "self-end text-white font-bold px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-3", children: "Cerrar" }), _jsx("div", { className: "flex-1 flex items-center justify-center pb-[env(safe-area-inset-bottom)]", children: _jsx("div", { className: "h-full max-h-[calc(100vh-5rem)] aspect-[9/16] max-w-full", children: _jsx("iframe", { src: urlReproductor(id), title: "V\u00EDdeo del ejercicio", allow: "autoplay; encrypted-media; fullscreen", allowFullScreen: true, className: "w-full h-full border-0" }) }) })] }));
}
function FeedbackVentana({ item, modo, onCerrar, onGuardar }) {
    const actual = item.workout_item_feedback[0];
    const [nota, setNota] = useState(actual?.note ?? '');
    const [motivo, setMotivo] = useState(actual?.reason ?? null);
    return (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": modo === 'nota' ? 'Nota a Rubén' : 'No puedo hacerlo', className: "fixed inset-0 z-50 bg-black/60 flex items-end", onClick: onCerrar, children: _jsxs("div", { className: "bg-fondo w-full rounded-t-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-3", onClick: (e) => e.stopPropagation(), children: [_jsx("h3", { className: "text-xl font-bold", children: modo === 'nota' ? 'Nota a Rubén' : 'No puedo hacerlo' }), _jsx("p", { className: "text-sm text-texto-suave", children: item.exercises.name }), modo === 'nopuedo' && (_jsx("div", { className: "grid grid-cols-2 gap-2", children: Object.keys(MOTIVOS).map((m) => (_jsx("button", { onClick: () => setMotivo(m), "aria-pressed": motivo === m, className: `rounded-xl px-3 py-3 font-semibold text-sm ${motivo === m ? 'bg-petroleo text-white' : 'bg-white'}`, children: MOTIVOS[m] }, m))) })), _jsx("textarea", { value: nota, onChange: (e) => setNota(e.target.value.slice(0, 1000)), rows: 3, placeholder: modo === 'nota' ? 'Cómo te ha ido, si has notado algo…' : 'Cuéntale a Rubén qué ha pasado (opcional)', className: "text-base px-3 py-2 border border-borde rounded-xl bg-white" }), _jsxs("div", { className: "flex gap-2", children: [modo === 'nopuedo' && actual?.cannot_do && (_jsx("button", { onClick: () => onGuardar(item, nota.trim() || null, false, null), className: "px-4 py-3 font-bold text-petroleo", children: "S\u00ED puedo, quitar" })), _jsx("button", { disabled: modo === 'nopuedo' && !motivo, onClick: () => onGuardar(item, nota.trim() || null, modo === 'nopuedo' ? true : !!actual?.cannot_do, modo === 'nopuedo' ? motivo : actual?.reason ?? null), className: "flex-1 bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl disabled:opacity-50", children: "Enviar a Rub\u00E9n" })] })] }) }));
}
const SENSACIONES = ['Muy bien', 'Bien', 'Normal', 'Cansado', 'Con molestias'];
const ESFUERZO = { 1: 'Muy fácil', 3: 'Fácil', 5: 'Moderado', 7: 'Duro', 9: 'Muy duro', 10: 'Máximo' };
function Final({ s, onHecho, onVolver, mandar }) {
    const [rpe, setRpe] = useState(s.rpe);
    const [sensacion, setSensacion] = useState(s.feeling);
    const [notas, setNotas] = useState(s.patient_notes ?? '');
    const [hecho, setHecho] = useState(false);
    async function guardar() {
        const cambios = { status: 'completed', rpe, feeling: sensacion, patient_notes: notas.trim() || null, completed_at: new Date().toISOString(), ...(s.started_at ? {} : { started_at: new Date().toISOString() }) };
        await mandar({ s: s.id, t: 'sesion', id: s.id, cambios });
        setHecho(true);
        setTimeout(() => onHecho(cambios), 1800);
    }
    if (hecho) {
        return (_jsxs("div", { className: "min-h-full flex flex-col items-center justify-center gap-3 p-8 text-center bg-petroleo text-white", children: [_jsx("div", { className: "w-16 h-16 rounded-full bg-mostaza text-[#1F2424] text-3xl font-bold flex items-center justify-center", children: "\u2713" }), _jsx("h1", { className: "text-2xl font-bold", children: "Entrenamiento guardado" }), _jsx("p", { className: "text-[#E3E8E8]", children: "Rub\u00E9n ver\u00E1 c\u00F3mo te ha ido." })] }));
    }
    return (_jsxs("div", { className: "min-h-full flex flex-col", children: [_jsxs("header", { className: "bg-petroleo text-white px-3 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-center gap-2", children: [_jsx("button", { onClick: onVolver, "aria-label": "Volver al entrenamiento", className: "w-11 h-11 text-2xl font-bold", children: "\u2039" }), _jsx("h1", { className: "text-lg font-bold", children: "\u00BFC\u00F3mo ha ido?" })] }), _jsxs("div", { className: "flex flex-col gap-5 p-4 pb-32", children: [_jsxs("section", { className: "bg-white rounded-2xl p-4 flex flex-col gap-3", children: [_jsx("h2", { className: "font-bold", children: "Esfuerzo (1 = muy f\u00E1cil, 10 = m\u00E1ximo)" }), _jsx("div", { className: "grid grid-cols-5 gap-2", children: Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (_jsx("button", { onClick: () => setRpe(n), "aria-pressed": rpe === n, className: `h-12 rounded-xl text-lg font-bold ${rpe === n ? 'bg-petroleo text-white' : 'bg-fondo'}`, children: n }, n))) }), rpe && _jsx("p", { className: "text-sm text-texto-suave", children: ESFUERZO[rpe] ?? ESFUERZO[rpe - 1] ?? '' })] }), _jsxs("section", { className: "bg-white rounded-2xl p-4 flex flex-col gap-3", children: [_jsx("h2", { className: "font-bold", children: "Sensaciones" }), _jsx("div", { className: "flex flex-wrap gap-2", children: SENSACIONES.map((t) => (_jsx("button", { onClick: () => setSensacion(t), "aria-pressed": sensacion === t, className: `px-4 py-2.5 rounded-full font-semibold ${sensacion === t ? 'bg-petroleo text-white' : 'bg-fondo'}`, children: t }, t))) })] }), _jsxs("section", { className: "bg-white rounded-2xl p-4 flex flex-col gap-2", children: [_jsx("h2", { className: "font-bold", children: "Notas para Rub\u00E9n (opcional)" }), _jsx("textarea", { value: notas, onChange: (e) => setNotas(e.target.value), rows: 3, className: "text-base px-3 py-2 border border-borde rounded-xl" })] })] }), _jsx("div", { className: "fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro p-4 pb-[max(env(safe-area-inset-bottom),1rem)]", children: _jsx("button", { onClick: guardar, disabled: !rpe, className: "w-full bg-mostaza text-[#1F2424] text-lg font-bold py-4 rounded-2xl disabled:opacity-50", children: "Guardar entrenamiento" }) })] }));
}
