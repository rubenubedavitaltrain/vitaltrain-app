import { useEffect, useMemo, useState } from 'react';
import Revisiones from '../historia/Revisiones';
import BorradosPendientes from '../legal/BorradosPendientes';
import Propuestas from '../asistente/Propuestas';
import { CambiosSuscripcion } from '../suscripciones/Suscripciones';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DIAS_CORTOS, desdeIso, hoyIso, iso, lunes, rangoSemana, sumarDias } from '../../lib/fechas';
import { MOTIVOS } from '../../modules/entrenamiento/paciente/tipos';

// Panel de inicio del coach: cómo va la semana de cada paciente y qué necesita atención.
// Solo lee datos; desde aquí se abre la ficha de cada paciente.

type Paciente = { id: string; full_name: string; created_at: string };
type Sesion = { patient_id: string; scheduled_date: string; status: string };
type Nota = { id: string; patient_id: string; note: string | null; cannot_do: boolean; reason: string | null; created_at: string; workout_items: unknown };
type Fila = {
  p: Paciente; dias: ('hecho' | 'pendiente' | 'perdido' | 'futuro' | null)[]; hechas: number; pautadas: number;
  ultima: string | null; proximas: number; sinConsentimiento: boolean; notas: number; mensajes: number;
};

const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
const diasDesde = (f: string) => Math.round((desdeIso(hoyIso()).getTime() - desdeIso(f).getTime()) / 86400000);
const fecha = (f: string) => desdeIso(f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

export default function Inicio({ supabase, nombre, onAbrir }: { supabase: SupabaseClient; nombre: string; onAbrir: (id: string) => void }) {
  const [datos, setDatos] = useState<{ pacientes: Paciente[]; sesiones: Sesion[]; hechas: Sesion[]; notas: Nota[]; consentidos: string[]; mensajes: string[] } | null>(null);
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
      if (p.error || s.error || h.error || n.error || c.error || m.error) return setError(true);
      setDatos({
        pacientes: (p.data as Paciente[]) ?? [], sesiones: (s.data as Sesion[]) ?? [], hechas: (h.data as Sesion[]) ?? [],
        notas: (n.data as Nota[]) ?? [], consentidos: ((c.data as { patient_id: string }[]) ?? []).map((x) => x.patient_id),
        mensajes: ((m.data as { patient_id: string; sender_id: string }[]) ?? []).filter((x) => x.patient_id === x.sender_id).map((x) => x.patient_id),
      });
    });
  }, [supabase, inicio]);

  const filas = useMemo<Fila[]>(() => {
    if (!datos) return [];
    const finSemana = iso(sumarDias(inicio, 6));
    return datos.pacientes.map((p) => {
      const suyas = datos.sesiones.filter((s) => s.patient_id === p.id);
      const semana = suyas.filter((s) => s.scheduled_date <= finSemana);
      const dias = Array.from({ length: 7 }, (_, i) => {
        const f = iso(sumarDias(inicio, i));
        const d = semana.filter((s) => s.scheduled_date === f);
        if (!d.length) return null;
        if (d.every((s) => s.status === 'completed')) return 'hecho';
        if (f < hoy) return 'perdido';
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

  if (error) return <p className="bg-white rounded-2xl p-6 text-texto-suave">No se ha podido cargar el panel. Comprueba la conexión y recarga.</p>;
  if (!datos) return <p className="bg-white rounded-2xl p-6 text-texto-suave">Cargando…</p>;

  const pautadas = filas.reduce((a, f) => a + f.pautadas, 0);
  const hechas = filas.reduce((a, f) => a + f.hechas, 0);
  const atencion = filas
    .map((f) => {
      const motivos: string[] = [];
      const dias = f.ultima ? diasDesde(f.ultima) : null;
      if (f.sinConsentimiento) motivos.push('Aún no ha aceptado el consentimiento');
      if (dias != null && dias >= 7) motivos.push(`${dias} días sin entrenar`);
      if (dias == null && diasDesde(f.p.created_at.slice(0, 10)) >= 7) motivos.push('Todavía no ha hecho ninguna sesión');
      if (f.dias.includes('perdido')) motivos.push(`${f.dias.filter((d) => d === 'perdido').length} sin hacer esta semana`);
      if (f.proximas === 0) motivos.push('Sin sesiones pendientes: necesita plan');
      if (f.notas) motivos.push(`${f.notas} ${f.notas === 1 ? 'nota sin leer' : 'notas sin leer'}`);
      if (f.mensajes) motivos.push(`${f.mensajes} ${f.mensajes === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}`);
      return { f, motivos };
    })
    .filter((x) => x.motivos.length);
  const sinEntrenar = filas.filter((f) => (f.ultima ? diasDesde(f.ultima) >= 7 : true)).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold">Hola, {nombre}</h2>
        <p className="text-sm text-texto-suave">Semana del {rangoSemana(inicio)} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Dato titulo="Pacientes activos" valor={String(filas.length)} />
        <Dato titulo="Sesiones esta semana" valor={pautadas ? `${hechas} de ${pautadas}` : '—'} nota={pautadas ? `${Math.round((hechas / pautadas) * 100)} % hechas` : 'Sin sesiones pautadas'} />
        <Dato titulo="7 días o más sin entrenar" valor={String(sinEntrenar)} destacado={sinEntrenar > 0} />
        <Dato titulo="Notas y mensajes sin leer" valor={String(datos.notas.length + datos.mensajes.length)} nota={`${datos.notas.length} notas · ${datos.mensajes.length} mensajes`} destacado={datos.notas.length + datos.mensajes.length > 0} />
      </div>

      <Propuestas supabase={supabase} />
      <Revisiones supabase={supabase} onAbrir={onAbrir} />
      <CambiosSuscripcion supabase={supabase} />
      <BorradosPendientes supabase={supabase} />

      {filas.length === 0 && <p className="bg-white rounded-2xl p-6 text-texto-suave">Aún no tienes pacientes activos. Dalos de alta en Pacientes.</p>}

      {atencion.length > 0 && (
        <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="atencion">
          <h3 id="atencion" className="text-lg font-bold">Necesitan atención</h3>
          <ul className="flex flex-col gap-2">
            {atencion.map(({ f, motivos }) => (
              <li key={f.p.id}>
                <button onClick={() => onAbrir(f.p.id)} className="w-full text-left rounded-xl bg-[#F4F1E4] border-l-4 border-mostaza px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-bold min-w-40">{f.p.full_name}</span>
                  <span className="flex-1 text-sm">{motivos.join(' · ')}</span>
                  <span className="text-sm font-bold text-petroleo">Abrir ficha →</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {filas.length > 0 && (
        <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="semana-todos">
          <h3 id="semana-todos" className="text-lg font-bold">La semana de cada paciente</h3>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-xs text-texto-suave text-left">
                  <th scope="col" className="font-semibold py-2">Paciente</th>
                  {DIAS_CORTOS.map((d, i) => <th key={d} scope="col" className={`font-semibold text-center ${iso(sumarDias(inicio, i)) === hoy ? 'text-petroleo' : ''}`}>{d}</th>)}
                  <th scope="col" className="font-semibold text-center">Hechas</th>
                  <th scope="col" className="font-semibold">Última sesión</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.p.id} className="border-t border-fondo">
                    <th scope="row" className="text-left py-2.5 pr-2">
                      <button onClick={() => onAbrir(f.p.id)} className="font-semibold text-left hover:underline">{f.p.full_name}</button>
                    </th>
                    {f.dias.map((d, i) => (
                      <td key={i} className="text-center">
                        <Punto estado={d} />
                      </td>
                    ))}
                    <td className="text-center font-semibold">{f.pautadas ? `${f.hechas}/${f.pautadas}` : '—'}</td>
                    <td className="text-texto-suave">{f.ultima ? `${fecha(f.ultima)} (${diasDesde(f.ultima) === 0 ? 'hoy' : `hace ${diasDesde(f.ultima)} d`})` : 'Ninguna'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-texto-suave">
            <span className="flex items-center gap-1.5"><Punto estado="hecho" /> Hecha</span>
            <span className="flex items-center gap-1.5"><Punto estado="pendiente" /> Hoy</span>
            <span className="flex items-center gap-1.5"><Punto estado="futuro" /> Pendiente</span>
            <span className="flex items-center gap-1.5"><Punto estado="perdido" /> No hecha</span>
          </div>
        </section>
      )}

      {datos.notas.length > 0 && (
        <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="notas-todas">
          <h3 id="notas-todas" className="text-lg font-bold">Notas sin leer</h3>
          <p className="text-xs text-texto-suave -mt-2">Se marcan como leídas desde la ficha de cada paciente.</p>
          <ul className="flex flex-col gap-2">
            {datos.notas.slice(0, 12).map((n) => {
              const it = uno(n.workout_items as { exercises: unknown; workout_blocks: unknown } | null);
              const ej = uno(it?.exercises as { name: string } | null)?.name ?? 'Ejercicio';
              const w = uno(uno(it?.workout_blocks as { workouts: unknown } | null)?.workouts as { scheduled_date: string } | null);
              const p = datos.pacientes.find((x) => x.id === n.patient_id);
              return (
                <li key={n.id}>
                  <button onClick={() => onAbrir(n.patient_id)} className="w-full text-left rounded-xl bg-fondo px-4 py-3 text-sm">
                    <span className="font-bold">{p?.full_name ?? 'Paciente'}</span>
                    <span className="text-texto-suave"> · {ej}{w ? ` · ${fecha(w.scheduled_date)}` : ''}</span>
                    {n.cannot_do && <span className="block font-semibold text-[#8A2C1D]">No ha podido: {MOTIVOS[n.reason as keyof typeof MOTIVOS] ?? 'otro motivo'}</span>}
                    {n.note && <span className="block italic">«{n.note}»</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Dato({ titulo, valor, nota, destacado }: { titulo: string; valor: string; nota?: string; destacado?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl p-4 ${destacado ? 'border-l-4 border-mostaza' : ''}`}>
      <div className="text-xs font-bold tracking-wide text-texto-suave uppercase">{titulo}</div>
      <div className="text-3xl font-bold mt-1">{valor}</div>
      {nota && <div className="text-xs text-texto-suave">{nota}</div>}
    </div>
  );
}

function Punto({ estado }: { estado: Fila['dias'][number] }) {
  const etiqueta = { hecho: 'Hecha', pendiente: 'Hoy', futuro: 'Pendiente', perdido: 'No hecha' } as const;
  if (!estado) return <span className="inline-block w-5 h-5" aria-label="Descanso" />;
  const cls = {
    hecho: 'bg-petroleo text-white',
    pendiente: 'border-2 border-mostaza bg-[#F4F1E4]',
    futuro: 'border-2 border-borde',
    perdido: 'bg-gris-claro text-[#8A2C1D]',
  }[estado];
  return (
    <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold align-middle ${cls}`} aria-label={etiqueta[estado]} title={etiqueta[estado]}>
      {estado === 'hecho' ? '✓' : estado === 'perdido' ? '✕' : ''}
    </span>
  );
}
