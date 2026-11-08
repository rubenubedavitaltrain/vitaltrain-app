import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
// Piezas de gráficas comunes (SVG propio, sin librerías). Las usan el progreso de entrenamiento y las medidas.
export const PETROLEO = '#374949';
export const PISTA = '#D2D6D4';
export const REJILLA = '#E4E7E6';
export const fechaCorta = (f) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}`; };
export const fechaLarga = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
export const num = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
/** Línea de una serie con puntos. Tocar un punto muestra el dato; el último se etiqueta siempre. */
export function Linea({ puntos, dominioX, minY, maxY, unidad, vacio }) {
    const [sel, setSel] = useState(null);
    if (puntos.length === 0)
        return _jsx("p", { className: "text-sm text-texto-suave", children: vacio });
    const W = 320, H = 150, top = 16, bottom = 22, left = 30, right = 14;
    const ys = puntos.map((p) => p.y);
    let lo = minY ?? Math.min(...ys), hi = maxY ?? Math.max(...ys);
    if (minY == null && maxY == null) {
        // Márgenes y marcas redondas (0,5 · 1 · 2,5 · 5 · 10 kg…) para que el eje se lea fácil
        const rango = Math.max(hi - lo, hi * 0.2, 1);
        const paso = [0.5, 1, 2.5, 5, 10, 20, 50].find((x) => rango / x <= 4) ?? 100;
        lo = Math.max(0, Math.floor((lo - rango * 0.1) / paso) * paso);
        hi = Math.ceil((hi + rango * 0.1) / paso) * paso;
        if (hi === lo)
            hi = lo + paso;
    }
    const xs = [...new Set(dominioX)];
    const xi = (x) => (xs.length === 1 ? 0.5 : xs.indexOf(x) / (xs.length - 1));
    const px = (x) => left + (W - left - right) * xi(x);
    const py = (v) => top + (H - top - bottom) * (1 - (v - lo) / (hi - lo || 1));
    const marcas = minY != null ? [lo, (lo + hi) / 2, hi] : [lo, hi - (hi - lo) / 2, hi].map((m) => Math.round(m * 2) / 2);
    const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
    const ultimo = puntos[puntos.length - 1];
    const etiquetasX = xs.length <= 6 ? xs : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]];
    return (_jsxs("div", { children: [_jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "w-full h-auto", role: "img", "aria-label": puntos.map((p) => p.etiqueta).join('; '), children: [marcas.map((m) => (_jsxs("g", { children: [_jsx("line", { x1: left, x2: W - right, y1: py(m), y2: py(m), stroke: REJILLA, strokeWidth: 1 }), _jsx("text", { x: left - 4, y: py(m) + 3, textAnchor: "end", fontSize: 9, fill: "#5A6464", children: num(m) })] }, m))), etiquetasX.map((x) => _jsx("text", { x: px(x), y: H - 6, textAnchor: "middle", fontSize: 9, fill: "#5A6464", children: fechaCorta(x) }, x)), puntos.length > 1 && _jsx("path", { d: d, fill: "none", stroke: PETROLEO, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }), puntos.map((p, i) => (_jsxs("g", { onClick: () => setSel(sel === i ? null : i), style: { cursor: 'pointer' }, children: [_jsx("circle", { cx: px(p.x), cy: py(p.y), r: 14, fill: "transparent" }), _jsx("circle", { cx: px(p.x), cy: py(p.y), r: sel === i ? 6 : 4, fill: PETROLEO, stroke: "#fff", strokeWidth: 2 })] }, p.x))), _jsxs("text", { x: Math.min(px(ultimo.x), W - right), y: py(ultimo.y) - 9, textAnchor: "end", fontSize: 10, fontWeight: 700, fill: "#4A4A4C", children: [num(ultimo.y), unidad] })] }), _jsx("p", { className: "text-xs font-semibold text-right min-h-5", children: sel != null ? puntos[sel].etiqueta : _jsx("span", { className: "font-normal text-texto-suave", children: "Toca un punto para ver el dato" }) })] }));
}
