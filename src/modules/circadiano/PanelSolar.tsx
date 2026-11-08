import { useEffect, useState } from 'react';
import { alturaSol, cambioVentanaUVB, diaSolar, horaMin, UMBRAL_UVA, UMBRAL_UVB } from './sol';
import { diaMes, sumarDias } from '../../lib/fechas';

// Panel de la luz del día para la ciudad del paciente: amanecer, mediodía solar, atardecer,
// primera y última luz, altura del sol ahora y ventanas UVA y UVB. Todo calculado en el móvil.

const MOSTAZA = '#DCB733';
const PETROLEO = '#374949';

export default function PanelSolar({ ciudad, lat, lon, compacto = false }: { ciudad: string; lat: number; lon: number; compacto?: boolean }) {
  const [desfase, setDesfase] = useState(0);
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setAhora(new Date()), 60000); return () => window.clearInterval(t); }, []);

  const fecha = sumarDias(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()), desfase);
  const d = diaSolar(fecha, lat, lon);
  const esHoy = desfase === 0;
  const altura = alturaSol(ahora, lat, lon);
  const cambio = cambioVentanaUVB(fecha, lat, lon);
  const finCambio = cambio.dias != null ? sumarDias(fecha, cambio.dias) : null;

  const estadoAhora = altura < -6 ? 'Es de noche.'
    : altura < 0 ? 'Crepúsculo: hay luz, pero el sol aún no está sobre el horizonte.'
      : altura < UMBRAL_UVA ? 'Sol bajo: luz cálida, casi sin UV.'
        : altura < UMBRAL_UVB ? 'Hay UVA. El sol aún no está lo bastante alto para el UVB.'
          : 'Ventana UVB abierta: el sol está alto.';

  return (
    <section className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-4" aria-label={`Luz del día en ${ciudad}`}>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setDesfase((x) => x - 1)} className="w-10 h-10 rounded-full bg-fondo text-petroleo font-bold" aria-label="Día anterior">‹</button>
        <div className="text-center">
          <div className="font-bold capitalize">{esHoy ? 'Hoy' : fecha.toLocaleDateString('es-ES', { weekday: 'long' })}, {diaMes(fecha)}</div>
          <div className="text-xs text-texto-suave">{ciudad}</div>
        </div>
        <button onClick={() => setDesfase((x) => x + 1)} className="w-10 h-10 rounded-full bg-fondo text-petroleo font-bold" aria-label="Día siguiente">›</button>
      </div>

      <ArcoSolar fecha={fecha} lat={lat} lon={lon} ahora={esHoy ? ahora : null} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <Dato titulo="Amanecer" valor={horaMin(d.amanecer)} />
        <Dato titulo="Mediodía solar" valor={horaMin(d.mediodia)} />
        <Dato titulo="Atardecer" valor={horaMin(d.atardecer)} />
        <Dato titulo="Primera luz" valor={horaMin(d.primeraLuz)} suave />
        <Dato titulo="Horas de sol" valor={d.horasDeLuz != null ? `${Math.floor(d.horasDeLuz)} h ${String(Math.round((d.horasDeLuz % 1) * 60)).padStart(2, '0')}` : '—'} suave />
        <Dato titulo="Última luz" valor={horaMin(d.ultimaLuz)} suave />
      </div>

      {esHoy && (
        <div className="rounded-xl bg-fondo p-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-petroleo tabular-nums w-16 text-center">{Math.round(altura)}°</span>
          <span className="text-sm leading-snug"><span className="font-semibold">Altura del sol ahora.</span> {estadoAhora}</span>
        </div>
      )}

      {!compacto && (
        <div className="flex flex-col gap-2">
          <Ventana color="#F1E2A6" titulo="Ventana UVA" texto="Sol por encima de 10°. Luz con más intensidad, útil por la mañana para el reloj interno." rango={d.uva ? `${horaMin(d.uva.desde)} – ${horaMin(d.uva.hasta)}` : 'No hay'} />
          <Ventana color={MOSTAZA} titulo="Ventana UVB" texto="Sol por encima de 30°. Solo entonces llega UVB a la piel, que es lo que permite fabricar vitamina D." rango={d.uvb ? `${horaMin(d.uvb.desde)} – ${horaMin(d.uvb.hasta)}` : 'No hay'} />
          <p className="text-sm">
            {cambio.hayHoy && cambio.dias != null && <>Quedan <b>{cambio.dias} días</b> con ventana UVB en {ciudad}. A partir del {diaMes(finCambio!)} el sol no subirá lo bastante.</>}
            {cambio.hayHoy && cambio.dias == null && <>En {ciudad} hay ventana UVB todo el año.</>}
            {!cambio.hayHoy && cambio.dias != null && <>Hoy el sol no sube lo bastante para el UVB. Vuelve en <b>{cambio.dias} días</b>, el {diaMes(finCambio!)}.</>}
          </p>
          <p className="text-xs text-texto-suave">
            Cálculo astronómico para el centro de {ciudad}. Es una estimación: las nubes, la contaminación, la ropa o el cristal reducen el UV que llega.
            Altura máxima del sol este día: {Math.round(d.alturaMaxima)}°.
          </p>
        </div>
      )}
    </section>
  );
}

function Dato({ titulo, valor, suave = false }: { titulo: string; valor: string; suave?: boolean }) {
  return (
    <div className={`rounded-xl p-2 ${suave ? '' : 'bg-fondo'}`}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-texto-suave">{titulo}</div>
      <div className={`${suave ? 'text-base' : 'text-xl'} font-bold tabular-nums`}>{valor}</div>
    </div>
  );
}

function Ventana({ color, titulo, texto, rango }: { color: string; titulo: string; texto: string; rango: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="mt-1 w-3 h-3 rounded-sm shrink-0" style={{ background: color }} aria-hidden="true" />
      <div className="flex-1">
        <div className="flex justify-between gap-2"><span className="font-semibold">{titulo}</span><span className="font-bold tabular-nums">{rango}</span></div>
        <p className="text-xs text-texto-suave leading-snug">{texto}</p>
      </div>
    </div>
  );
}

/** Curva de la altura del sol a lo largo del día, con el horizonte y las bandas UVA y UVB. */
function ArcoSolar({ fecha, lat, lon, ahora }: { fecha: Date; lat: number; lon: number; ahora: Date | null }) {
  const W = 320, H = 130, top = 10, bottom = 18;
  const pasos = 144; // cada 10 minutos
  const base = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const alturas = Array.from({ length: pasos + 1 }, (_, i) => alturaSol(new Date(base.valueOf() + i * 600000), lat, lon));
  const lo = -60, hi = Math.max(75, Math.ceil(Math.max(...alturas) / 10) * 10);
  const px = (i: number) => (W * i) / pasos;
  const py = (a: number) => top + (H - top - bottom) * (1 - (a - lo) / (hi - lo));
  const curva = alturas.map((a, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(a).toFixed(1)}`).join(' ');
  // Zona bajo la curva y por encima de un umbral
  const banda = (umbral: number) => {
    const y0 = py(umbral);
    const tramo = alturas.map((a, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${Math.min(py(a), y0).toFixed(1)}`).join(' ');
    return `${tramo} L${W},${y0} L0,${y0} Z`;
  };
  const minAhora = ahora ? (ahora.getHours() * 60 + ahora.getMinutes()) / 10 : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Altura del sol a lo largo del día">
      <rect x="0" y={py(0)} width={W} height={H - bottom - py(0)} fill="#E4E7E6" />
      <path d={banda(0)} fill="#FAF3D9" />
      <path d={banda(UMBRAL_UVA)} fill="#F1E2A6" />
      <path d={banda(UMBRAL_UVB)} fill={MOSTAZA} />
      <line x1="0" x2={W} y1={py(0)} y2={py(0)} stroke={PETROLEO} strokeWidth="1" />
      <path d={curva} fill="none" stroke={PETROLEO} strokeWidth="2" />
      {[0, 6, 12, 18, 24].map((h) => (
        <g key={h}>
          <line x1={px(h * 6)} x2={px(h * 6)} y1={H - bottom} y2={H - bottom + 3} stroke="#A8A8A8" />
          <text x={Math.min(Math.max(px(h * 6), 8), W - 8)} y={H - 4} fontSize="10" textAnchor="middle" fill="#5A6464">{h}h</text>
        </g>
      ))}
      {minAhora != null && (
        <g>
          <line x1={px(minAhora)} x2={px(minAhora)} y1={top} y2={H - bottom} stroke={PETROLEO} strokeDasharray="2 3" strokeWidth="1" />
          <circle cx={px(minAhora)} cy={py(alturaSol(ahora!, lat, lon))} r="6" fill="#fff" stroke={PETROLEO} strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );
}
