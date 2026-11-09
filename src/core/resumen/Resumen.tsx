import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { desdeIso, iso } from '../../lib/fechas';
import { calcularFoto, NOMBRE_MES, type Foto } from './datos';

// Resumen mensual (núcleo, seguimiento).
// - ResumenCoach: botón en la ficha que abre el resumen de un mes, con conclusiones, guardar, compartir y PDF.
// - MisResumenes: lista de resúmenes compartidos en la pestaña Progreso del paciente.
// El PDF se hace con «Imprimir → Guardar como PDF» del navegador, sin librerías.

type Fila = { id: string; month: string; conclusions: string | null; next_goals: string | null; snapshot: Foto | null; shared_at: string | null; updated_at: string };

const mesActual = () => iso(new Date()).slice(0, 7);
const mesesAtras = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return iso(d).slice(0, 7); });
const fechaCorta = (f: string) => desdeIso(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const n1 = (x: number) => x.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const horas = (m: number | null) => (m == null ? '—' : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`);

export function ResumenCoach({ supabase, pacienteId, nombre }: { supabase: SupabaseClient; pacienteId: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    supabase.from('monthly_reviews').select('id, month, conclusions, next_goals, snapshot, shared_at, updated_at').eq('patient_id', pacienteId).order('month', { ascending: false })
      .then(({ data }) => setFilas((data as Fila[]) ?? []));
  }, [supabase, pacienteId, version]);
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="resumen-mensual">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="resumen-mensual" className="text-lg font-bold">Resumen mensual</h3>
          <p className="text-xs text-texto-suave">Las cifras del mes, tus conclusiones y los objetivos del siguiente. Lo guardas, lo compartes y lo descargas en PDF.</p>
        </div>
        <button onClick={() => setAbierto(true)} className="bg-mostaza text-[#1F2424] font-bold px-4 py-2 rounded-xl">Abrir resumen</button>
      </div>
      {filas.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {filas.map((f) => (
            <li key={f.id} className="bg-fondo rounded-lg px-3 py-1.5 ">{NOMBRE_MES(f.month.slice(0, 7))} · <span className="normal-case text-texto-suave">{f.shared_at ? 'compartido' : 'guardado'}</span></li>
          ))}
        </ul>
      )}
      {abierto && <EditorResumen supabase={supabase} pacienteId={pacienteId} nombre={nombre} guardados={filas} onCerrar={() => { setAbierto(false); setVersion((v) => v + 1); }} />}
    </section>
  );
}

function EditorResumen({ supabase, pacienteId, nombre, guardados, onCerrar }: { supabase: SupabaseClient; pacienteId: string; nombre: string; guardados: Fila[]; onCerrar: () => void }) {
  // Por defecto, el mes anterior si estamos en los primeros 10 días; si no, el actual.
  const [mes, setMes] = useState(() => (new Date().getDate() <= 10 ? mesesAtras(2)[1] : mesActual()));
  const [foto, setFoto] = useState<Foto | null>(null);
  const [fila, setFila] = useState<Fila | null>(null);
  const [conclusiones, setConclusiones] = useState('');
  const [objetivos, setObjetivos] = useState('');
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(true);

  async function cargar(m: string, recalcular = false) {
    setCargando(true); setEstado('');
    const { data } = await supabase.from('monthly_reviews').select('id, month, conclusions, next_goals, snapshot, shared_at, updated_at').eq('patient_id', pacienteId).eq('month', `${m}-01`).maybeSingle();
    const f = data as Fila | null;
    setFila(f); setConclusiones(f?.conclusions ?? ''); setObjetivos(f?.next_goals ?? '');
    setFoto(f?.snapshot && !recalcular ? f.snapshot : await calcularFoto(supabase, pacienteId, nombre, m));
    setCargando(false);
  }
  useEffect(() => { cargar(mes); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(compartir?: boolean) {
    if (!foto) return;
    const datos = {
      patient_id: pacienteId, month: `${mes}-01`, conclusions: conclusiones.trim() || null, next_goals: objetivos.trim() || null, snapshot: foto,
      shared_at: compartir === undefined ? fila?.shared_at ?? null : compartir ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase.from('monthly_reviews').upsert(datos, { onConflict: 'patient_id,month' }).select('id, month, conclusions, next_goals, snapshot, shared_at, updated_at').single();
    if (error) return setEstado('No se ha podido guardar.');
    setFila(data as Fila);
    setEstado(compartir === true ? `Guardado y compartido. ${nombre} lo ve en Progreso.` : compartir === false ? 'Ya no lo ve el paciente.' : 'Guardado.');
  }

  const meses = [...new Set([...mesesAtras(12), ...guardados.map((g) => g.month.slice(0, 7))])].sort().reverse();

  return (
    <div role="dialog" aria-modal="true" aria-label="Resumen mensual" className="fixed inset-0 z-50 bg-fondo overflow-y-auto">
      <div className="no-print sticky top-0 z-10 bg-petroleo text-white px-4 py-3 flex flex-wrap items-center gap-2">
        <button onClick={onCerrar} className="font-semibold mr-2">← Volver</button>
        <select value={mes} onChange={(e) => setMes(e.target.value)} className="text-texto bg-white rounded-lg px-2 py-1.5">
          {meses.map((m) => <option key={m} value={m}>{NOMBRE_MES(m)}{guardados.some((g) => g.month.startsWith(m)) ? ' ·  guardado' : ''}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => cargar(mes, true)} className="bg-white/15 font-semibold px-3 py-1.5 rounded-lg" title="Vuelve a calcular las cifras con los datos de ahora">Actualizar cifras</button>
        <button onClick={() => guardar()} className="bg-white/15 font-semibold px-3 py-1.5 rounded-lg">Guardar</button>
        {fila?.shared_at
          ? <button onClick={() => guardar(false)} className="bg-white/15 font-semibold px-3 py-1.5 rounded-lg">Dejar de compartir</button>
          : <button onClick={() => guardar(true)} className="bg-mostaza text-[#1F2424] font-bold px-3 py-1.5 rounded-lg">Guardar y compartir</button>}
        <button onClick={() => window.print()} className="bg-white text-petroleo font-bold px-3 py-1.5 rounded-lg">PDF</button>
      </div>
      {estado && <p role="status" className="no-print text-center font-semibold text-petroleo bg-white py-2">{estado}</p>}
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {cargando || !foto ? <p className="text-texto-suave">Calculando el mes…</p> : (
          <VistaResumen foto={foto} conclusiones={conclusiones} objetivos={objetivos}
            editor={{ onConclusiones: setConclusiones, onObjetivos: setObjetivos }} />
        )}
        <p className="no-print text-xs text-texto-suave mt-4">
          Las cifras se guardan tal como están al guardar. Si el paciente anota algo más de ese mes, pulsa «Actualizar cifras» y guarda de nuevo.
          Para el PDF, pulsa «PDF» y elige «Guardar como PDF».
        </p>
      </div>
    </div>
  );
}

/** El resumen tal como se ve en pantalla y en el PDF. Con `editor`, las conclusiones son editables. */
export function VistaResumen({ foto, conclusiones, objetivos, editor }: {
  foto: Foto; conclusiones: string | null; objetivos: string | null;
  editor?: { onConclusiones: (s: string) => void; onObjetivos: (s: string) => void };
}) {
  const e = foto.entrenamiento;
  return (
    <article id="imprimir" className="bg-white rounded-2xl p-5 sm:p-8 flex flex-col gap-6 print:rounded-none print:p-0">
      <header className="flex items-start justify-between gap-4 border-b-2 border-mostaza pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">Resumen mensual</p>
          <h1 className="text-2xl font-bold ">{NOMBRE_MES(foto.mes)}</h1>
          <p className="font-semibold">{foto.nombre}</p>
        </div>
        <img src="/marca/logotipo-petroleo.png" alt="Vitaltrain" className="h-10 w-auto" onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
      </header>

      {e && (
        <Bloque titulo="Entrenamiento">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Cifra titulo="Sesiones hechas" valor={`${e.hechas} de ${e.pautadas}`} />
            <Cifra titulo="Adherencia" valor={e.pautadas ? `${Math.round((e.hechas / e.pautadas) * 100)}%` : '—'} />
            <Cifra titulo="Esfuerzo medio" valor={e.rpeMedio != null ? `${n1(e.rpeMedio)} / 10` : '—'} />
          </div>
          {e.ejercicios.length > 0 && (
            <table className="w-full text-sm mt-2">
              <thead><tr className="text-left text-xs text-texto-suave"><th className="py-1 font-semibold">Ejercicio</th><th className="font-semibold">Inicio</th><th className="font-semibold">Final</th><th className="font-semibold text-right">Cambio</th></tr></thead>
              <tbody>
                {e.ejercicios.map((x) => {
                  const dif = x.ultimo.kg - x.primero.kg;
                  return (
                    <tr key={x.nombre} className="border-t border-fondo">
                      <td className="py-1.5 pr-2">{x.nombre}</td>
                      <td className="tabular-nums whitespace-nowrap">{n1(x.primero.kg)} kg{x.primero.reps ? ` × ${x.primero.reps}` : ''}</td>
                      <td className="tabular-nums whitespace-nowrap">{n1(x.ultimo.kg)} kg{x.ultimo.reps ? ` × ${x.ultimo.reps}` : ''}</td>
                      <td className="tabular-nums text-right font-semibold">{x.sesiones < 2 ? '—' : dif === 0 ? '=' : `${dif > 0 ? '+' : ''}${n1(dif)} kg`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {e.notas.length > 0 && (
            <div className="mt-2">
              <h3 className="text-sm font-bold">Notas en ejercicios</h3>
              <ul className="text-sm flex flex-col gap-1 mt-1">
                {e.notas.map((n, i) => <li key={i}><span className="text-texto-suave">{n.fecha ? fechaCorta(n.fecha) : ''} · {n.ejercicio}:</span> {n.noPuede ? <b>No pudo ({n.noPuede.toLowerCase()}). </b> : null}{n.nota}</li>)}
              </ul>
            </div>
          )}
          {e.sensaciones.length > 0 && (
            <div className="mt-2">
              <h3 className="text-sm font-bold">Cómo se sintió</h3>
              <ul className="text-sm flex flex-col gap-1 mt-1">
                {e.sensaciones.map((s, i) => <li key={i}><span className="text-texto-suave">{fechaCorta(s.fecha)}{s.rpe ? ` · esfuerzo ${s.rpe}` : ''}:</span> {s.texto}</li>)}
              </ul>
            </div>
          )}
        </Bloque>
      )}

      {foto.medidas && (
        <Bloque titulo="Medidas">
          <div className="grid grid-cols-3 gap-2 text-center">
            {foto.medidas.map((m) => {
              const base = m.previo ?? m.inicio; const dif = m.fin - base;
              return <Cifra key={m.clave} titulo={m.clave} valor={`${n1(m.fin)} ${m.unidad}`} nota={dif === 0 ? 'sin cambio' : `${dif > 0 ? '+' : ''}${n1(dif)} ${m.unidad} ${m.previo != null ? 'vs. mes anterior' : 'en el mes'}`} />;
            })}
          </div>
        </Bloque>
      )}

      {foto.sueno && (
        <Bloque titulo="Sueño y horarios">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <Cifra titulo="Noches anotadas" valor={String(foto.sueno.noches)} />
            <Cifra titulo="Sueño medio" valor={horas(foto.sueno.duracion)} />
            <Cifra titulo="Se acuesta / levanta" valor={`${foto.sueno.acostarse ?? '—'} / ${foto.sueno.levantarse ?? '—'}`} />
            <Cifra titulo="Regularidad" valor={foto.sueno.regularidad != null ? `± ${Math.round(foto.sueno.regularidad)} min` : '—'} />
            <Cifra titulo="Jet lag social" valor={horas(foto.sueno.jetLag)} />
            <Cifra titulo="Calidad del sueño" valor={foto.sueno.calidad != null ? `${n1(foto.sueno.calidad)} / 5` : '—'} />
            <Cifra titulo="Ventana de comidas" valor={horas(foto.sueno.ventana)} />
            <Cifra titulo="Última comida → cama" valor={horas(foto.sueno.ultimaACama)} />
          </div>
        </Bloque>
      )}

      {foto.habitos && (
        <Bloque titulo="Hábitos">
          <ul className="flex flex-col gap-2">
            {foto.habitos.map((h) => (
              <li key={h.nombre} className="text-sm">
                <div className="flex justify-between gap-2"><span><b>{h.nombre}</b> <span className="text-texto-suave">· {h.pilar}</span></span><span className="tabular-nums font-semibold">{h.pct}% <span className="font-normal text-texto-suave">({h.hechos}/{h.tocaban})</span></span></div>
                <div className="h-2 rounded bg-fondo mt-1 overflow-hidden"><div className="h-full bg-petroleo" style={{ width: `${h.pct}%` }} /></div>
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      {!e && !foto.medidas && !foto.sueno && !foto.habitos && <p className="text-texto-suave">No hay datos registrados en este mes.</p>}

      <Bloque titulo="Conclusiones de Rubén">
        {editor
          ? <textarea value={conclusiones ?? ''} onChange={(ev) => editor.onConclusiones(ev.target.value.slice(0, 5000))} rows={6} placeholder="Qué ha ido bien, qué cuesta y por qué. Lo leerá el paciente si lo compartes." className="no-print w-full text-base px-3 py-2 border border-borde rounded-xl" />
          : null}
        <p className={`${editor ? 'hidden print:block' : ''} whitespace-pre-line`}>{conclusiones || (editor ? '' : '—')}</p>
      </Bloque>
      <Bloque titulo="Objetivos para el mes que viene">
        {editor
          ? <textarea value={objetivos ?? ''} onChange={(ev) => editor.onObjetivos(ev.target.value.slice(0, 2000))} rows={4} placeholder="Dos o tres objetivos concretos." className="no-print w-full text-base px-3 py-2 border border-borde rounded-xl" />
          : null}
        <p className={`${editor ? 'hidden print:block' : ''} whitespace-pre-line`}>{objetivos || (editor ? '' : '—')}</p>
      </Bloque>

      <footer className="text-[11px] text-texto-suave border-t border-fondo pt-3">
        Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433.
        Datos registrados por el paciente en la app. Este resumen no es un informe clínico.
      </footer>
    </article>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 break-inside-avoid">
      <h2 className="text-sm font-bold uppercase tracking-wide text-petroleo">{titulo}</h2>
      {children}
    </section>
  );
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl bg-fondo p-2 print:border print:border-borde">
      <div className="text-[11px] font-bold uppercase tracking-wide text-texto-suave">{titulo}</div>
      <div className="text-lg font-bold tabular-nums leading-tight">{valor}</div>
      {nota && <div className="text-[11px] text-texto-suave">{nota}</div>}
    </div>
  );
}

/** Pestaña Progreso del paciente: resúmenes que el coach ha compartido. */
export function MisResumenes({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [abierto, setAbierto] = useState<Fila | null>(null);
  useEffect(() => {
    supabase.from('monthly_reviews').select('id, month, conclusions, next_goals, snapshot, shared_at, updated_at').eq('patient_id', pacienteId).not('shared_at', 'is', null).order('month', { ascending: false })
      .then(({ data }) => setFilas((data as Fila[]) ?? []));
  }, [supabase, pacienteId]);
  if (filas.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-2" aria-labelledby="mis-resumenes">
      <h2 id="mis-resumenes" className="font-bold">Mis resúmenes del mes</h2>
      <ul className="flex flex-col">
        {filas.map((f) => (
          <li key={f.id}><button onClick={() => setAbierto(f)} className="w-full text-left py-3 border-t border-fondo flex justify-between font-semibold ">{NOMBRE_MES(f.month.slice(0, 7))}<span className="text-petroleo" aria-hidden="true">›</span></button></li>
        ))}
      </ul>
      {abierto && abierto.snapshot && (
        <div role="dialog" aria-modal="true" aria-label="Resumen del mes" className="fixed inset-0 z-50 bg-fondo overflow-y-auto">
          <div className="no-print sticky top-0 z-10 bg-petroleo text-white px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)] flex items-center justify-between">
            <button onClick={() => setAbierto(null)} className="font-semibold">← Volver</button>
            <button onClick={() => window.print()} className="bg-white text-petroleo font-bold px-3 py-1.5 rounded-lg">Guardar PDF</button>
          </div>
          <div className="p-4"><VistaResumen foto={abierto.snapshot} conclusiones={abierto.conclusions} objetivos={abierto.next_goals} /></div>
        </div>
      )}
    </section>
  );
}
