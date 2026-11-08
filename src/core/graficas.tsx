import { useState } from 'react';

// Piezas de gráficas comunes (SVG propio, sin librerías). Las usan el progreso de entrenamiento y las medidas.

export const PETROLEO = '#374949';
export const PISTA = '#D2D6D4';
export const REJILLA = '#E4E7E6';
export const fechaCorta = (f: string) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}`; };
export const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
export const num = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });

/** Línea de una serie con puntos. Tocar un punto muestra el dato; el último se etiqueta siempre. */
export function Linea({ puntos, dominioX, minY, maxY, unidad, vacio }: {
  puntos: { x: string; y: number; etiqueta: string }[]; dominioX: string[]; minY?: number; maxY?: number; unidad: string; vacio: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  if (puntos.length === 0) return <p className="text-sm text-texto-suave">{vacio}</p>;
  const W = 320, H = 150, top = 16, bottom = 22, left = 30, right = 14;
  const ys = puntos.map((p) => p.y);
  let lo = minY ?? Math.min(...ys), hi = maxY ?? Math.max(...ys);
  if (minY == null && maxY == null) {
    // Márgenes y marcas redondas (0,5 · 1 · 2,5 · 5 · 10 kg…) para que el eje se lea fácil
    const rango = Math.max(hi - lo, hi * 0.2, 1);
    const paso = [0.5, 1, 2.5, 5, 10, 20, 50].find((x) => rango / x <= 4) ?? 100;
    lo = Math.max(0, Math.floor((lo - rango * 0.1) / paso) * paso);
    hi = Math.ceil((hi + rango * 0.1) / paso) * paso;
    if (hi === lo) hi = lo + paso;
  }
  const xs = [...new Set(dominioX)];
  const xi = (x: string) => (xs.length === 1 ? 0.5 : xs.indexOf(x) / (xs.length - 1));
  const px = (x: string) => left + (W - left - right) * xi(x);
  const py = (v: number) => top + (H - top - bottom) * (1 - (v - lo) / (hi - lo || 1));
  const marcas = minY != null ? [lo, (lo + hi) / 2, hi] : [lo, hi - (hi - lo) / 2, hi].map((m) => Math.round(m * 2) / 2);
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const ultimo = puntos[puntos.length - 1];
  const etiquetasX = xs.length <= 6 ? xs : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={puntos.map((p) => p.etiqueta).join('; ')}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={left} x2={W - right} y1={py(m)} y2={py(m)} stroke={REJILLA} strokeWidth={1} />
            <text x={left - 4} y={py(m) + 3} textAnchor="end" fontSize={9} fill="#5A6464">{num(m)}</text>
          </g>
        ))}
        {etiquetasX.map((x) => <text key={x} x={px(x)} y={H - 6} textAnchor="middle" fontSize={9} fill="#5A6464">{fechaCorta(x)}</text>)}
        {puntos.length > 1 && <path d={d} fill="none" stroke={PETROLEO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {puntos.map((p, i) => (
          <g key={p.x} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
            <circle cx={px(p.x)} cy={py(p.y)} r={14} fill="transparent" />
            <circle cx={px(p.x)} cy={py(p.y)} r={sel === i ? 6 : 4} fill={PETROLEO} stroke="#fff" strokeWidth={2} />
          </g>
        ))}
        <text x={Math.min(px(ultimo.x), W - right)} y={py(ultimo.y) - 9} textAnchor="end" fontSize={10} fontWeight={700} fill="#4A4A4C">{num(ultimo.y)}{unidad}</text>
      </svg>
      <p className="text-xs font-semibold text-right min-h-5">{sel != null ? puntos[sel].etiqueta : <span className="font-normal text-texto-suave">Toca un punto para ver el dato</span>}</p>
    </div>
  );
}
