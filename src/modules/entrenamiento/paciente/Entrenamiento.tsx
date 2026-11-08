import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarSesion, enviar, esTiempo, guardarCopia, pendientes, repsDe, vaciarCola, type ItemSesion, type Sesion } from './datos';
import { MOTIVOS, type Motivo } from './tipos';
import { miniatura, urlReproductor } from '../biblioteca/youtube';

// Entrenamiento en curso (paciente). Series precargadas con lo que pauta el coach,
// temporizador de descanso, vídeo vertical, nota y "No puedo hacerlo". Funciona sin conexión.

const TIPO = { normal: '', superset: 'Superserie', circuit: 'Circuito' } as const;

export default function Entrenamiento({ supabase, sesionId, pacienteId, onSalir }: {
  supabase: SupabaseClient; sesionId: string; pacienteId: string; onSalir: () => void;
}) {
  const [s, setS] = useState<Sesion | null>(null);
  const [error, setError] = useState('');
  const [video, setVideo] = useState<string | null>(null);
  const [descanso, setDescanso] = useState<{ fin: number; total: number } | null>(null);
  const [feedbackDe, setFeedbackDe] = useState<{ item: ItemSesion; modo: 'nota' | 'nopuedo' } | null>(null);
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

  function actualizar(cambio: (x: Sesion) => Sesion) {
    setS((prev) => {
      if (!prev) return prev;
      const n = cambio(structuredClone(prev));
      guardarCopia(n);
      return n;
    });
  }

  async function mandar(op: Parameters<typeof enviar>[1]) {
    const r = await enviar(supabase, op);
    if (r === 'pendiente') setSinRed(true);
    if (r === 'error') setError('No se ha podido guardar el último cambio.');
  }

  function empezarSiHaceFalta() {
    if (s && s.status === 'scheduled') {
      const started_at = new Date().toISOString();
      actualizar((x) => ({ ...x, status: 'in_progress', started_at }));
      mandar({ t: 'sesion', id: s.id, cambios: { status: 'in_progress', started_at } });
    }
  }

  function marcarSerie(item: ItemSesion, n: number, reps: number | null, kg: number | null, hecho: boolean) {
    empezarSiHaceFalta();
    actualizar((x) => {
      const it = x.workout_blocks.flatMap((b) => b.workout_items).find((i) => i.id === item.id)!;
      it.set_logs = it.set_logs.filter((l) => l.set_number !== n);
      if (hecho) it.set_logs.push({ set_number: n, reps, load_kg: kg, done: true });
      return x;
    });
    if (hecho) {
      mandar({ t: 'set', fila: { workout_item_id: item.id, patient_id: pacienteId, set_number: n, reps, load_kg: kg, done: true } });
      if (item.rest_seconds) setDescanso({ fin: Date.now() + item.rest_seconds * 1000, total: item.rest_seconds });
    } else {
      mandar({ t: 'borrarSet', workout_item_id: item.id, set_number: n });
    }
  }

  function guardarFeedback(item: ItemSesion, note: string | null, cannot_do: boolean, reason: Motivo | null) {
    actualizar((x) => {
      const it = x.workout_blocks.flatMap((b) => b.workout_items).find((i) => i.id === item.id)!;
      it.workout_item_feedback = [{ note, cannot_do, reason }];
      return x;
    });
    mandar({ t: 'feedback', fila: { workout_item_id: item.id, patient_id: pacienteId, note, cannot_do, reason } });
    setFeedbackDe(null);
  }

  if (error && !s) return <Pantalla titulo="Entrenamiento" onSalir={onSalir}><p className="p-5 font-semibold text-[#8A2C1D]">{error}</p></Pantalla>;
  if (!s) return <Pantalla titulo="Entrenamiento" onSalir={onSalir}><p className="p-5 text-texto-suave">Cargando…</p></Pantalla>;

  if (final) return <Final supabase={supabase} s={s} onHecho={(c) => { actualizar((x) => ({ ...x, ...c })); onSalir(); }} onVolver={() => setFinal(false)} mandar={mandar} />;

  const items = s.workout_blocks.flatMap((b) => b.workout_items);
  const completos = items.filter((i) => i.set_logs.filter((l) => l.done).length >= i.sets || i.workout_item_feedback[0]?.cannot_do).length;

  return (
    <Pantalla titulo={s.name} subtitulo={`${completos} de ${items.length} ejercicios`} onSalir={onSalir}>
      {sinRed && <p className="mx-4 mt-3 text-sm bg-[#F4F1E4] rounded-xl p-3">Sin conexión. Lo que registres se guarda en el móvil y se enviará solo.</p>}
      {error && <p role="alert" className="mx-4 mt-3 font-semibold text-[#8A2C1D]">{error}</p>}
      {s.coach_message && (
        <div className="mx-4 mt-3 bg-white rounded-2xl p-4 border-l-4 border-mostaza">
          <div className="text-xs font-bold text-texto-suave mb-1">RUBÉN</div>
          <p>{s.coach_message}</p>
        </div>
      )}
      <div className="flex flex-col gap-4 p-4 pb-40">
        {s.workout_blocks.map((b) => (
          <section key={b.id} className="flex flex-col gap-3">
            {(b.name || b.type !== 'normal') && (
              <h2 className="text-sm font-bold tracking-wide text-texto-suave uppercase">
                {b.name}{b.type !== 'normal' ? ` · ${TIPO[b.type]} × ${b.rounds} vueltas` : ''}
              </h2>
            )}
            {b.workout_items.map((it) => (
              <TarjetaEjercicio key={it.id} it={it} onVideo={setVideo} onSerie={marcarSerie} onFeedback={(modo) => setFeedbackDe({ item: it, modo })} />
            ))}
          </section>
        ))}
      </div>

      {descanso && <Descanso fin={descanso.fin} total={descanso.total} onCambio={(fin) => setDescanso(fin ? { ...descanso, fin } : null)} />}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro p-4 pb-[max(env(safe-area-inset-bottom),1rem)] z-30">
        <button onClick={() => setFinal(true)} className="w-full bg-mostaza text-[#1F2424] text-lg font-bold py-4 rounded-2xl">Terminar entrenamiento</button>
      </div>

      {video && <Video id={video} onCerrar={() => setVideo(null)} />}
      {feedbackDe && <FeedbackVentana {...feedbackDe} onCerrar={() => setFeedbackDe(null)} onGuardar={guardarFeedback} />}
    </Pantalla>
  );
}

function Pantalla({ titulo, subtitulo, onSalir, children }: { titulo: string; subtitulo?: string; onSalir: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-petroleo text-white px-3 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-center gap-2 sticky top-0 z-20">
        <button onClick={onSalir} aria-label="Volver" className="w-11 h-11 text-2xl font-bold">‹</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight truncate">{titulo}</h1>
          {subtitulo && <p className="text-sm text-[#E3E8E8]">{subtitulo}</p>}
        </div>
      </header>
      {children}
    </div>
  );
}

function TarjetaEjercicio({ it, onVideo, onSerie, onFeedback }: {
  it: ItemSesion; onVideo: (id: string) => void;
  onSerie: (it: ItemSesion, n: number, reps: number | null, kg: number | null, hecho: boolean) => void;
  onFeedback: (modo: 'nota' | 'nopuedo') => void;
}) {
  const fb = it.workout_item_feedback[0];
  const tiempo = esTiempo(it.target);
  const r = it.rest_seconds ?? 0;
  const descanso = r ? (r < 60 ? `${r} s` : `${Math.floor(r / 60)} min${r % 60 ? ` ${r % 60} s` : ''}`) : null;
  return (
    <article className={`bg-white rounded-2xl p-4 flex flex-col gap-3 ${fb?.cannot_do ? 'opacity-70' : ''}`}>
      <div className="flex gap-3">
        {it.exercises.video_id && (
          <button onClick={() => onVideo(it.exercises.video_id!)} aria-label={`Ver vídeo de ${it.exercises.name}`} className="relative w-20 h-28 rounded-xl overflow-hidden bg-gris-claro shrink-0">
            <img src={miniatura(it.exercises.video_id)} alt="" className="w-full h-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center"><span className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center text-sm">▶</span></span>
          </button>
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h3 className="text-lg font-bold leading-tight">{it.exercises.name}</h3>
          <p className="text-sm text-texto-suave">
            {it.sets} × {it.target ?? '—'}{it.load_kg != null ? ` · ${it.load_kg} kg` : ''}{descanso ? ` · descanso ${descanso}` : ''}
          </p>
          {it.instructions && <p className="text-sm">{it.instructions}</p>}
          {!it.instructions && it.exercises.description && <p className="text-sm">{it.exercises.description}</p>}
        </div>
      </div>

      {fb?.cannot_do ? (
        <p className="text-sm font-semibold text-[#8A2C1D]">Marcado como «No puedo hacerlo»: {fb.reason ? MOTIVOS[fb.reason] : ''}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[3rem_1fr_1fr_3.25rem] gap-2 text-xs font-semibold text-texto-suave px-1">
            <span>Serie</span><span>{tiempo ? 'Segundos' : 'Reps'}</span><span>Kg</span><span />
          </div>
          {Array.from({ length: it.sets }, (_, k) => k + 1).map((n) => (
            <Serie key={n} n={n} it={it} onSerie={onSerie} />
          ))}
        </div>
      )}

      {fb?.note && <p className="text-sm bg-fondo rounded-xl p-2">Tu nota: «{fb.note}»</p>}
      <div className="flex gap-2">
        <button onClick={() => onFeedback('nota')} className="flex-1 text-sm font-bold text-petroleo border-2 border-gris-claro rounded-xl py-2.5">{fb?.note ? 'Editar nota' : 'Nota a Rubén'}</button>
        <button onClick={() => onFeedback('nopuedo')} className="flex-1 text-sm font-bold text-petroleo border-2 border-gris-claro rounded-xl py-2.5">{fb?.cannot_do ? 'Cambiar' : 'No puedo hacerlo'}</button>
      </div>
    </article>
  );
}

function Serie({ n, it, onSerie }: { n: number; it: ItemSesion; onSerie: (it: ItemSesion, n: number, reps: number | null, kg: number | null, hecho: boolean) => void }) {
  const log = it.set_logs.find((l) => l.set_number === n);
  const [reps, setReps] = useState(String(log?.reps ?? repsDe(it.target) ?? ''));
  const [kg, setKg] = useState(String(log?.load_kg ?? it.load_kg ?? ''));
  const hecho = !!log?.done;
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  return (
    <div className={`grid grid-cols-[3rem_1fr_1fr_3.25rem] gap-2 items-center rounded-xl px-1 py-1 ${hecho ? 'bg-[#E4EEE9]' : ''}`}>
      <span className="text-center font-bold">{n}</span>
      <input aria-label={`Serie ${n}: repeticiones`} inputMode="numeric" value={reps} disabled={hecho} onChange={(e) => setReps(e.target.value.replace(/[^\d]/g, ''))} className="w-full min-w-0 text-lg font-semibold text-center py-2.5 border border-borde rounded-xl bg-white disabled:bg-transparent disabled:border-transparent" />
      <input aria-label={`Serie ${n}: kilos`} inputMode="decimal" value={kg} disabled={hecho} onChange={(e) => setKg(e.target.value.replace(/[^\d.,]/g, ''))} className="w-full min-w-0 text-lg font-semibold text-center py-2.5 border border-borde rounded-xl bg-white disabled:bg-transparent disabled:border-transparent" />
      <button
        onClick={() => onSerie(it, n, num(reps), num(kg), !hecho)}
        aria-label={hecho ? `Desmarcar serie ${n}` : `Marcar serie ${n} como hecha`}
        aria-pressed={hecho}
        className={`h-12 rounded-xl text-xl font-bold ${hecho ? 'bg-petroleo text-white' : 'bg-fondo text-petroleo border-2 border-petroleo'}`}
      >
        ✓
      </button>
    </div>
  );
}

function Descanso({ fin, total, onCambio }: { fin: number; total: number; onCambio: (fin: number | null) => void }) {
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
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* sin vibración */ }
      setTimeout(() => onCambio(null), 1500);
    }
  }, [quedan, onCambio]);
  const pct = Math.min(100, ((total - quedan) / total) * 100);
  return (
    <div role="timer" aria-live="polite" className="fixed left-4 right-4 bottom-28 z-40 bg-petroleo text-white rounded-2xl p-4 shadow-xl flex items-center gap-3">
      <div className="flex-1">
        <div className="text-xs font-semibold text-[#E3E8E8]">{quedan ? 'Descanso' : 'Siguiente serie'}</div>
        <div className="text-3xl font-bold tabular-nums">{Math.floor(quedan / 60)}:{String(quedan % 60).padStart(2, '0')}</div>
        <div className="h-1.5 bg-white/20 rounded-full mt-2"><div className="h-full bg-mostaza rounded-full" style={{ width: `${pct}%` }} /></div>
      </div>
      <button onClick={() => onCambio(fin + 15000)} className="px-3 py-3 rounded-xl bg-white/15 font-bold">+15 s</button>
      <button onClick={() => onCambio(null)} className="px-3 py-3 rounded-xl bg-mostaza text-[#1F2424] font-bold">Saltar</button>
    </div>
  );
}

function Video({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Vídeo del ejercicio" className="fixed inset-0 z-50 bg-black flex flex-col">
      <button onClick={onCerrar} className="self-end text-white font-bold px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-3">Cerrar</button>
      <div className="flex-1 flex items-center justify-center pb-[env(safe-area-inset-bottom)]">
        <div className="h-full max-h-[calc(100vh-5rem)] aspect-[9/16] max-w-full">
          <iframe src={urlReproductor(id)} title="Vídeo del ejercicio" allow="autoplay; encrypted-media; fullscreen" allowFullScreen className="w-full h-full border-0" />
        </div>
      </div>
    </div>
  );
}

function FeedbackVentana({ item, modo, onCerrar, onGuardar }: {
  item: ItemSesion; modo: 'nota' | 'nopuedo'; onCerrar: () => void;
  onGuardar: (item: ItemSesion, note: string | null, cannot_do: boolean, reason: Motivo | null) => void;
}) {
  const actual = item.workout_item_feedback[0];
  const [nota, setNota] = useState(actual?.note ?? '');
  const [motivo, setMotivo] = useState<Motivo | null>(actual?.reason ?? null);
  return (
    <div role="dialog" aria-modal="true" aria-label={modo === 'nota' ? 'Nota a Rubén' : 'No puedo hacerlo'} className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onCerrar}>
      <div className="bg-fondo w-full rounded-t-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold">{modo === 'nota' ? 'Nota a Rubén' : 'No puedo hacerlo'}</h3>
        <p className="text-sm text-texto-suave">{item.exercises.name}</p>
        {modo === 'nopuedo' && (
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MOTIVOS) as Motivo[]).map((m) => (
              <button key={m} onClick={() => setMotivo(m)} aria-pressed={motivo === m} className={`rounded-xl px-3 py-3 font-semibold text-sm ${motivo === m ? 'bg-petroleo text-white' : 'bg-white'}`}>{MOTIVOS[m]}</button>
            ))}
          </div>
        )}
        <textarea value={nota} onChange={(e) => setNota(e.target.value.slice(0, 1000))} rows={3} placeholder={modo === 'nota' ? 'Cómo te ha ido, si has notado algo…' : 'Cuéntale a Rubén qué ha pasado (opcional)'} className="text-base px-3 py-2 border border-borde rounded-xl bg-white" />
        <div className="flex gap-2">
          {modo === 'nopuedo' && actual?.cannot_do && (
            <button onClick={() => onGuardar(item, nota.trim() || null, false, null)} className="px-4 py-3 font-bold text-petroleo">Sí puedo, quitar</button>
          )}
          <button
            disabled={modo === 'nopuedo' && !motivo}
            onClick={() => onGuardar(item, nota.trim() || null, modo === 'nopuedo' ? true : !!actual?.cannot_do, modo === 'nopuedo' ? motivo : actual?.reason ?? null)}
            className="flex-1 bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl disabled:opacity-50"
          >
            Enviar a Rubén
          </button>
        </div>
      </div>
    </div>
  );
}

const SENSACIONES = ['Muy bien', 'Bien', 'Normal', 'Cansado', 'Con molestias'];
const ESFUERZO: Record<number, string> = { 1: 'Muy fácil', 3: 'Fácil', 5: 'Moderado', 7: 'Duro', 9: 'Muy duro', 10: 'Máximo' };

function Final({ s, onHecho, onVolver, mandar }: {
  supabase: SupabaseClient; s: Sesion; onHecho: (c: Partial<Sesion>) => void; onVolver: () => void;
  mandar: (op: Parameters<typeof enviar>[1]) => Promise<void>;
}) {
  const [rpe, setRpe] = useState<number | null>(s.rpe);
  const [sensacion, setSensacion] = useState<string | null>(s.feeling);
  const [notas, setNotas] = useState(s.patient_notes ?? '');
  const [hecho, setHecho] = useState(false);

  async function guardar() {
    const cambios = { status: 'completed' as const, rpe, feeling: sensacion, patient_notes: notas.trim() || null, completed_at: new Date().toISOString(), ...(s.started_at ? {} : { started_at: new Date().toISOString() }) };
    await mandar({ t: 'sesion', id: s.id, cambios });
    setHecho(true);
    setTimeout(() => onHecho(cambios), 1800);
  }

  if (hecho) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 p-8 text-center bg-petroleo text-white">
        <div className="w-16 h-16 rounded-full bg-mostaza text-[#1F2424] text-3xl font-bold flex items-center justify-center">✓</div>
        <h1 className="text-2xl font-bold">Entrenamiento guardado</h1>
        <p className="text-[#E3E8E8]">Rubén verá cómo te ha ido.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-petroleo text-white px-3 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-center gap-2">
        <button onClick={onVolver} aria-label="Volver al entrenamiento" className="w-11 h-11 text-2xl font-bold">‹</button>
        <h1 className="text-lg font-bold">¿Cómo ha ido?</h1>
      </header>
      <div className="flex flex-col gap-5 p-4 pb-32">
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="font-bold">Esfuerzo (1 = muy fácil, 10 = máximo)</h2>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setRpe(n)} aria-pressed={rpe === n} className={`h-12 rounded-xl text-lg font-bold ${rpe === n ? 'bg-petroleo text-white' : 'bg-fondo'}`}>{n}</button>
            ))}
          </div>
          {rpe && <p className="text-sm text-texto-suave">{ESFUERZO[rpe] ?? ESFUERZO[rpe - 1] ?? ''}</p>}
        </section>
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="font-bold">Sensaciones</h2>
          <div className="flex flex-wrap gap-2">
            {SENSACIONES.map((t) => (
              <button key={t} onClick={() => setSensacion(t)} aria-pressed={sensacion === t} className={`px-4 py-2.5 rounded-full font-semibold ${sensacion === t ? 'bg-petroleo text-white' : 'bg-fondo'}`}>{t}</button>
            ))}
          </div>
        </section>
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-2">
          <h2 className="font-bold">Notas para Rubén (opcional)</h2>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="text-base px-3 py-2 border border-borde rounded-xl" />
        </section>
      </div>
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <button onClick={guardar} disabled={!rpe} className="w-full bg-mostaza text-[#1F2424] text-lg font-bold py-4 rounded-2xl disabled:opacity-50">Guardar entrenamiento</button>
      </div>
    </div>
  );
}
