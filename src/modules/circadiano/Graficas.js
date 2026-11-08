import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { desdeIso, diaMes, iso, sumarDias } from '../../lib/fechas';
// Gráficas del módulo: noches (de acostarse a levantarse) y ventana de alimentación por día. SVG propio.
const PETROLEO = '#374949';
const MOSTAZA = '#DCB733';
const REJILLA = '#E4E7E6';
/** Barras por noche sobre un eje de 20:00 a 12:00. Las noches de día libre se marcan en mostaza. */
export function GraficaNoches({ noches, dias = 14 }) {
    const hoy = new Date();
    const fechas = Array.from({ length: dias }, (_, i) => iso(sumarDias(hoy, -dias + 1 + i)));
    const ini = 20, fin = 36; // 20:00 → 12:00 del día siguiente
    const W = 320, fila = 16, top = 4, left = 40, right = 6, H = top + fila * dias + 18;
    const x = (h) => left + ((W - left - right) * (Math.min(Math.max(h, ini), fin) - ini)) / (fin - ini);
    const horaDe = (ts, noche) => (new Date(ts).valueOf() - desdeIso(noche).valueOf()) / 3600000;
    const con = noches.filter((n) => n.bedtime && n.wake_time);
    if (con.length === 0)
        return _jsx("p", { className: "text-sm text-texto-suave", children: "A\u00FAn no hay noches anotadas." });
    return (_jsxs("div", { children: [_jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "w-full h-auto", role: "img", "aria-label": "Horas de sue\u00F1o de cada noche", children: [[20, 24, 28, 32, 36].map((h) => (_jsxs("g", { children: [_jsx("line", { x1: x(h), x2: x(h), y1: top, y2: H - 16, stroke: REJILLA }), _jsxs("text", { x: x(h), y: H - 4, fontSize: "10", textAnchor: "middle", fill: "#5A6464", children: [String(h % 24).padStart(2, '0'), "h"] })] }, h))), fechas.map((f, i) => {
                        const n = con.find((c) => c.night_of === f);
                        const y = top + i * fila;
                        return (_jsxs("g", { children: [_jsx("text", { x: left - 4, y: y + fila / 2 + 3.5, fontSize: "9.5", textAnchor: "end", fill: "#5A6464", children: diaMes(desdeIso(f)) }), n && (_jsx("rect", { x: x(horaDe(n.bedtime, f)), y: y + 3, width: Math.max(2, x(horaDe(n.wake_time, f)) - x(horaDe(n.bedtime, f))), height: fila - 6, rx: "3", fill: n.is_free_day ? MOSTAZA : PETROLEO, children: _jsx("title", { children: `${diaMes(desdeIso(f))}: ${new Date(n.bedtime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${new Date(n.wake_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` }) }))] }, f));
                    })] }), _jsxs("p", { className: "flex gap-4 text-xs text-texto-suave mt-1", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-3 h-3 rounded-sm", style: { background: PETROLEO } }), "Antes de un d\u00EDa laborable"] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-3 h-3 rounded-sm", style: { background: MOSTAZA } }), "Antes de un d\u00EDa libre"] })] })] }));
}
/** Ventana de alimentación por día: barra de la primera a la última comida, con un punto por comida. Eje de 6:00 a 24:00. */
export function GraficaComidas({ comidas, dias = 14 }) {
    if (comidas.length === 0)
        return _jsx("p", { className: "text-sm text-texto-suave", children: "A\u00FAn no hay comidas anotadas." });
    const hoy = new Date();
    const fechas = Array.from({ length: dias }, (_, i) => iso(sumarDias(hoy, -dias + 1 + i)));
    const ini = 6, fin = 24;
    const W = 320, fila = 16, top = 4, left = 40, right = 6, H = top + fila * dias + 18;
    const x = (h) => left + ((W - left - right) * (Math.min(Math.max(h, ini), fin) - ini)) / (fin - ini);
    const horas = (ts) => { const d = new Date(ts); return d.getHours() + d.getMinutes() / 60; };
    return (_jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "w-full h-auto", role: "img", "aria-label": "Ventana de alimentaci\u00F3n de cada d\u00EDa", children: [[6, 10, 14, 18, 22].map((h) => (_jsxs("g", { children: [_jsx("line", { x1: x(h), x2: x(h), y1: top, y2: H - 16, stroke: REJILLA }), _jsxs("text", { x: x(h), y: H - 4, fontSize: "10", textAnchor: "middle", fill: "#5A6464", children: [h, "h"] })] }, h))), fechas.map((f, i) => {
                const del = comidas.filter((c) => iso(new Date(c.eaten_at)) === f).map((c) => horas(c.eaten_at));
                const y = top + i * fila + fila / 2;
                return (_jsxs("g", { children: [_jsx("text", { x: left - 4, y: y + 3.5, fontSize: "9.5", textAnchor: "end", fill: "#5A6464", children: diaMes(desdeIso(f)) }), del.length > 1 && _jsx("line", { x1: x(Math.min(...del)), x2: x(Math.max(...del)), y1: y, y2: y, stroke: MOSTAZA, strokeWidth: "6", strokeLinecap: "round" }), del.map((h, j) => _jsx("circle", { cx: x(h), cy: y, r: "3.5", fill: PETROLEO }, j))] }, f));
            })] }));
}
