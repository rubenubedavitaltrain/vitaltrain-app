import { desdeIso, diaMes, iso, sumarDias } from '../../lib/fechas';
import type { Comida, Noche } from './datos';

// Gráficas del módulo: noches (de acostarse a levantarse) y ventana de alimentación por día. SVG propio.

const PETROLEO = '#374949';
const MOSTAZA = '#DCB733';
const REJILLA = '#E4E7E6';

/** Barras por noche sobre un eje de 20:00 a 12:00. Las noches de día libre se marcan en mostaza. */
export function GraficaNoches({ noches, dias = 14 }: { noches: Noche[]; dias?: number }) {
  const hoy = new Date();
  const fechas = Array.from({ length: dias }, (_, i) => iso(sumarDias(hoy, -dias + 1 + i)));
  const ini = 20, fin = 36; // 20:00 → 12:00 del día siguiente
  const W = 320, fila = 16, top = 4, left = 40, right = 6, H = top + fila * dias + 18;
  const x = (h: number) => left + ((W - left - right) * (Math.min(Math.max(h, ini), fin) - ini)) / (fin - ini);
  const horaDe = (ts: string, noche: string) => (new Date(ts).valueOf() - desdeIso(noche).valueOf()) / 3600000;
  const con = noches.filter((n) => n.bedtime && n.wake_time);
  if (con.length === 0) return <p className="text-sm text-texto-suave">Aún no hay noches anotadas.</p>;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Horas de sueño de cada noche">
        {[20, 24, 28, 32, 36].map((h) => (
          <g key={h}>
            <line x1={x(h)} x2={x(h)} y1={top} y2={H - 16} stroke={REJILLA} />
            <text x={x(h)} y={H - 4} fontSize="10" textAnchor="middle" fill="#5A6464">{String(h % 24).padStart(2, '0')}h</text>
          </g>
        ))}
        {fechas.map((f, i) => {
          const n = con.find((c) => c.night_of === f);
          const y = top + i * fila;
          return (
            <g key={f}>
              <text x={left - 4} y={y + fila / 2 + 3.5} fontSize="9.5" textAnchor="end" fill="#5A6464">{diaMes(desdeIso(f))}</text>
              {n && (
                <rect x={x(horaDe(n.bedtime!, f))} y={y + 3} width={Math.max(2, x(horaDe(n.wake_time!, f)) - x(horaDe(n.bedtime!, f)))} height={fila - 6} rx="3" fill={n.is_free_day ? MOSTAZA : PETROLEO}>
                  <title>{`${diaMes(desdeIso(f))}: ${new Date(n.bedtime!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${new Date(n.wake_time!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}</title>
                </rect>
              )}
            </g>
          );
        })}
      </svg>
      <p className="flex gap-4 text-xs text-texto-suave mt-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: PETROLEO }} />Antes de un día laborable</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: MOSTAZA }} />Antes de un día libre</span>
      </p>
    </div>
  );
}

/** Ventana de alimentación por día: barra de la primera a la última comida, con un punto por comida. Eje de 6:00 a 24:00. */
export function GraficaComidas({ comidas, dias = 14 }: { comidas: Comida[]; dias?: number }) {
  if (comidas.length === 0) return <p className="text-sm text-texto-suave">Aún no hay comidas anotadas.</p>;
  const hoy = new Date();
  const fechas = Array.from({ length: dias }, (_, i) => iso(sumarDias(hoy, -dias + 1 + i)));
  const ini = 6, fin = 24;
  const W = 320, fila = 16, top = 4, left = 40, right = 6, H = top + fila * dias + 18;
  const x = (h: number) => left + ((W - left - right) * (Math.min(Math.max(h, ini), fin) - ini)) / (fin - ini);
  const horas = (ts: string) => { const d = new Date(ts); return d.getHours() + d.getMinutes() / 60; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Ventana de alimentación de cada día">
      {[6, 10, 14, 18, 22].map((h) => (
        <g key={h}>
          <line x1={x(h)} x2={x(h)} y1={top} y2={H - 16} stroke={REJILLA} />
          <text x={x(h)} y={H - 4} fontSize="10" textAnchor="middle" fill="#5A6464">{h}h</text>
        </g>
      ))}
      {fechas.map((f, i) => {
        const del = comidas.filter((c) => iso(new Date(c.eaten_at)) === f).map((c) => horas(c.eaten_at));
        const y = top + i * fila + fila / 2;
        return (
          <g key={f}>
            <text x={left - 4} y={y + 3.5} fontSize="9.5" textAnchor="end" fill="#5A6464">{diaMes(desdeIso(f))}</text>
            {del.length > 1 && <line x1={x(Math.min(...del))} x2={x(Math.max(...del))} y1={y} y2={y} stroke={MOSTAZA} strokeWidth="6" strokeLinecap="round" />}
            {del.map((h, j) => <circle key={j} cx={x(h)} cy={y} r="3.5" fill={PETROLEO} />)}
          </g>
        );
      })}
    </svg>
  );
}
