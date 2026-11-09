import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAUTAS, pauta, type Pauta } from './pautas';

// Módulo de respiración guiada, parte del paciente: tarjeta en Hoy y sesión con temporizador.

type Sesion = { id: string; pattern: string; started_at: string; seconds: number; calm_before: number | null; calm_after: number | null };

function lunes() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }

export function TarjetaRespiracion({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [abierta, setAbierta] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    supabase.from('breathing_sessions').select('id, pattern, started_at, seconds, calm_before, calm_after').eq('patient_id', pacienteId)
      .gte('started_at', lunes().toISOString()).order('started_at', { ascending: false }).then(({ data }) => setSesiones((data as Sesion[]) ?? []));
  }, [supabase, pacienteId, version]);
  const min = Math.round(sesiones.reduce((a, s) => a + s.seconds, 0) / 60);
  if (abierta) return <SesionRespiracion supabase={supabase} pacienteId={pacienteId} onSalir={(hecho) => { setAbierta(false); if (hecho) setVersion((v) => v + 1); }} />;
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="respira-hoy">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="respira-hoy" className="text-xs font-bold tracking-wide text-texto-suave">RESPIRACIÓN</h2>
          <p className="text-sm text-texto-suave mt-1">{min > 0 ? `${min} min esta semana · ${sesiones.length} ${sesiones.length === 1 ? 'sesión' : 'sesiones'}` : 'Unos minutos para bajar revoluciones.'}</p>
        </div>
      </div>
      <button onClick={() => setAbierta(true)} className="bg-petroleo text-white font-bold py-3.5 rounded-2xl">Respirar ahora</button>
    </section>
  );
}

function Escala({ valor, onCambio }: { valor: number | null; onCambio: (v: number) => void }) {
  return (
    <div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} type="button" onClick={() => onCambio(v)} aria-pressed={valor === v} className={`flex-1 py-3 rounded-xl font-bold ${valor === v ? 'bg-petroleo text-white' : 'bg-fondo'}`}>{v}</button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-texto-suave mt-1"><span>Muy tenso</span><span>Muy tranquilo</span></div>
    </div>
  );
}

export function SesionRespiracion({ supabase, pacienteId, onSalir }: { supabase: SupabaseClient; pacienteId: string; onSalir: (hecho: boolean) => void }) {
  const [p, setP] = useState<Pauta>(PAUTAS[0]);
  const [min, setMin] = useState(PAUTAS[0].minutos[1]);
  const [antes, setAntes] = useState<number | null>(null);
  const [despues, setDespues] = useState<number | null>(null);
  const [paso, setPaso] = useState<'elegir' | 'respirar' | 'fin'>('elegir');
  const [sonido, setSonido] = useState(true);
  const [estado, setEstado] = useState({ fase: 0, escala: 0, restante: 0 });
  const [error, setError] = useState('');
  const inicio = useRef<Date | null>(null);
  const segundos = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const bloqueo = useRef<WakeLockSentinel | null>(null);

  function tono(fase: number) {
    if (!sonido || !audio.current) return;
    const a = audio.current, o = a.createOscillator(), g = a.createGain();
    o.frequency.value = p.fases[fase].hasta > 0.5 ? 440 : 330;
    g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(0.08, a.currentTime + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.6);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.65);
  }

  async function empezar() {
    try { audio.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { /* sin sonido */ }
    try { bloqueo.current = await navigator.wakeLock?.request('screen') ?? null; } catch { /* la pantalla puede apagarse */ }
    inicio.current = new Date(); segundos.current = 0;
    setEstado({ fase: 0, escala: p.fases[0].hasta, restante: min * 60 });
    setPaso('respirar');
  }

  useEffect(() => {
    if (paso !== 'respirar') return;
    let fase = 0, t: number;
    const total = min * 60, t0 = Date.now();
    tono(0); navigator.vibrate?.(40);
    const siguiente = () => {
      fase = (fase + 1) % p.fases.length;
      const pasado = (Date.now() - t0) / 1000;
      segundos.current = Math.round(pasado);
      if (pasado >= total && fase === 0) return terminar();
      setEstado({ fase, escala: p.fases[fase].hasta, restante: Math.max(0, Math.round(total - pasado)) });
      tono(fase); navigator.vibrate?.(40);
      t = window.setTimeout(siguiente, p.fases[fase].seg * 1000);
    };
    t = window.setTimeout(siguiente, p.fases[0].seg * 1000);
    const reloj = window.setInterval(() => setEstado((e) => ({ ...e, restante: Math.max(0, Math.round(total - (Date.now() - t0) / 1000)) })), 1000);
    return () => { clearTimeout(t); clearInterval(reloj); };
  }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  function liberar() { bloqueo.current?.release().catch(() => {}); bloqueo.current = null; audio.current?.close().catch(() => {}); audio.current = null; }
  function terminar() { if (inicio.current) segundos.current = Math.round((Date.now() - inicio.current.valueOf()) / 1000); liberar(); setPaso('fin'); }
  useEffect(() => liberar, []);

  async function guardar() {
    setError('');
    const s = segundos.current;
    if (s < 30) return onSalir(false);
    const { error } = await supabase.from('breathing_sessions').insert({ patient_id: pacienteId, pattern: p.id, started_at: inicio.current!.toISOString(), seconds: Math.min(s, 3600), calm_before: antes, calm_after: despues });
    if (error) return setError(navigator.onLine ? 'No se ha podido guardar.' : 'Sin conexión: no se ha guardado.');
    onSalir(true);
  }

  if (paso === 'respirar') {
    const f = p.fases[estado.fase];
    const mm = Math.floor(estado.restante / 60), ss = String(estado.restante % 60).padStart(2, '0');
    return (
      <div className="fixed inset-0 z-50 bg-petroleo text-white flex flex-col items-center justify-between py-12 px-6" role="dialog" aria-label={p.nombre}>
        <p className="text-sm opacity-80">{p.nombre} · {mm}:{ss}</p>
        <div className="relative w-72 h-72 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-white/20" />
          <div className="absolute rounded-full bg-mostaza" style={{ width: '100%', height: '100%', transform: `scale(${0.3 + 0.7 * estado.escala})`, transition: `transform ${f.seg}s ease-in-out` }} />
          <p className="relative text-2xl font-bold text-[#1F2424]" aria-live="polite">{f.texto}</p>
        </div>
        <button onClick={terminar} className="bg-white/10 font-bold px-8 py-3 rounded-2xl">Terminar</button>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-5" aria-labelledby="respirar">
      <div className="flex items-start justify-between gap-3">
        <h2 id="respirar" className="text-xl font-bold">{paso === 'fin' ? 'Hecho' : 'Respirar'}</h2>
        <button onClick={() => { liberar(); onSalir(false); }} className="text-petroleo font-bold px-1">Cerrar</button>
      </div>
      {paso === 'elegir' && (
        <>
          <div className="flex flex-col gap-2">
            {PAUTAS.map((x) => (
              <button key={x.id} onClick={() => { setP(x); setMin(x.minutos[1]); }} aria-pressed={p.id === x.id}
                className={`text-left rounded-xl px-4 py-3 ${p.id === x.id ? 'bg-petroleo text-white' : 'bg-fondo'}`}>
                <span className="block font-bold">{x.nombre}</span>
                <span className={`block text-sm ${p.id === x.id ? 'opacity-90' : 'text-texto-suave'}`}>{x.corta}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-texto-suave -mt-2">{p.porque}{p.aviso ? ` ${p.aviso}` : ''}</p>
          <div>
            <div className="font-semibold mb-2">Duración</div>
            <div className="flex gap-2">
              {p.minutos.map((m) => <button key={m} onClick={() => setMin(m)} aria-pressed={min === m} className={`flex-1 py-3 rounded-xl font-bold ${min === m ? 'bg-petroleo text-white' : 'bg-fondo'}`}>{m} min</button>)}
            </div>
          </div>
          <div><div className="font-semibold mb-2">¿Cómo estás ahora? <span className="font-normal text-texto-suave">(opcional)</span></div><Escala valor={antes} onCambio={setAntes} /></div>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={sonido} onChange={(e) => setSonido(e.target.checked)} className="w-5 h-5 accent-[#374949]" /> Sonido suave en cada cambio</label>
          <button onClick={empezar} className="bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl">Empezar</button>
        </>
      )}
      {paso === 'fin' && (
        <>
          <p>{Math.max(1, Math.round(segundos.current / 60))} min de {pauta(p.id).nombre.toLowerCase()}.</p>
          <div><div className="font-semibold mb-2">¿Y ahora? <span className="font-normal text-texto-suave">(opcional)</span></div><Escala valor={despues} onCambio={setDespues} /></div>
          {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
          <button onClick={guardar} className="bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl">Guardar</button>
        </>
      )}
    </section>
  );
}
