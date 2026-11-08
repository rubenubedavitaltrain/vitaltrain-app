import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { diaMes, desdeIso, iso, lunes, sumarDias } from '../../../lib/fechas';

// Sección "Programa" en la ficha del paciente: programa en curso, asignar uno nuevo
// y "Cambiar desde una semana" (solo se quitan las sesiones pendientes sin registros).

type Asignacion = { id: string; start_date: string; status: 'active' | 'replaced' | 'cancelled'; replaced_from_week: number | null; programs: { id: string; name: string; weeks: number } };
type Programa = { id: string; name: string; weeks: number };

export default function ProgramaPaciente({ supabase, pacienteId, onCambio }: { supabase: SupabaseClient; pacienteId: string; onCambio: () => void }) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[] | null>(null);
  const [progreso, setProgreso] = useState<Record<string, { hechas: number; total: number }>>({});
  const [ventana, setVentana] = useState<'asignar' | Asignacion | null>(null);

  async function cargar() {
    const { data } = await supabase
      .from('program_assignments')
      .select('id, start_date, status, replaced_from_week, programs(id, name, weeks)')
      .eq('patient_id', pacienteId)
      .order('start_date', { ascending: false })
      .limit(10);
    const lista = (data as unknown as Asignacion[]) ?? [];
    setAsignaciones(lista);
    const activas = lista.filter((a) => a.status === 'active').map((a) => a.id);
    if (activas.length) {
      const { data: ws } = await supabase.from('workouts').select('program_assignment_id, status').in('program_assignment_id', activas);
      const p: Record<string, { hechas: number; total: number }> = {};
      (ws ?? []).forEach((w: { program_assignment_id: string; status: string }) => {
        p[w.program_assignment_id] ??= { hechas: 0, total: 0 };
        p[w.program_assignment_id].total++;
        if (w.status === 'completed') p[w.program_assignment_id].hechas++;
      });
      setProgreso(p);
    }
  }
  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoy = lunes(new Date());
  const activas = (asignaciones ?? []).filter((a) => a.status === 'active');
  const anteriores = (asignaciones ?? []).filter((a) => a.status !== 'active');

  return (
    <section className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3" aria-labelledby="programa">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="programa" className="text-lg font-bold mr-auto">Programa</h3>
        <button onClick={() => setVentana('asignar')} className="px-3 py-2 rounded-lg bg-mostaza text-[#1F2424] font-bold text-sm">Asignar programa</button>
      </div>
      {asignaciones && activas.length === 0 && <p className="text-sm text-texto-suave">Sin programa en curso. Puedes asignar uno o seguir asignando sesiones sueltas en la semana.</p>}
      {activas.map((a) => {
        const inicio = desdeIso(a.start_date);
        const fin = sumarDias(inicio, a.programs.weeks * 7 - 1);
        const semana = Math.floor((hoy.getTime() - inicio.getTime()) / (7 * 864e5)) + 1;
        const pr = progreso[a.id];
        const terminado = semana > a.programs.weeks;
        return (
          <div key={a.id} className="rounded-xl bg-fondo p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-48">
              <div className="font-bold text-lg">{a.programs.name}</div>
              <div className="text-sm text-texto-suave">
                {diaMes(inicio)} – {diaMes(fin)} · {semana < 1 ? `empieza el ${diaMes(inicio)}` : terminado ? 'terminado' : `semana ${semana} de ${a.programs.weeks}`}
              </div>
              {pr && (
                <div className="mt-2">
                  <div className="h-2 bg-white rounded-full"><div className="h-full bg-petroleo rounded-full" style={{ width: `${pr.total ? (pr.hechas / pr.total) * 100 : 0}%` }} /></div>
                  <div className="text-xs text-texto-suave mt-1">{pr.hechas} de {pr.total} sesiones hechas</div>
                </div>
              )}
            </div>
            {!terminado && <button onClick={() => setVentana(a)} className="px-3 py-2 rounded-lg border-2 border-petroleo text-petroleo font-bold text-sm">Cambiar desde una semana</button>}
          </div>
        );
      })}
      {anteriores.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-texto-suave">Programas anteriores</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {anteriores.map((a) => (
              <li key={a.id}>{a.programs.name} · desde {diaMes(desdeIso(a.start_date))}{a.status === 'replaced' ? ` · cambiado en la semana ${a.replaced_from_week}` : ''}</li>
            ))}
          </ul>
        </details>
      )}
      {ventana === 'asignar' && <Asignar supabase={supabase} pacienteId={pacienteId} onCerrar={() => setVentana(null)} onHecho={() => { setVentana(null); cargar(); onCambio(); }} />}
      {ventana && ventana !== 'asignar' && <Cambiar supabase={supabase} asignacion={ventana} onCerrar={() => setVentana(null)} onHecho={() => { setVentana(null); cargar(); onCambio(); }} />}
    </section>
  );
}

function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6" onClick={onCerrar}>
      <div className="bg-fondo w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold leading-tight">{titulo}</h3>
          <button onClick={onCerrar} className="text-petroleo font-bold px-2">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useProgramas(supabase: SupabaseClient) {
  const [lista, setLista] = useState<Programa[] | null>(null);
  useEffect(() => {
    supabase.from('programs').select('id, name, weeks').eq('is_archived', false).order('name').then(({ data }) => setLista((data as Programa[]) ?? []));
  }, [supabase]);
  return lista;
}

function Asignar({ supabase, pacienteId, onCerrar, onHecho }: { supabase: SupabaseClient; pacienteId: string; onCerrar: () => void; onHecho: () => void }) {
  const programas = useProgramas(supabase);
  const esteLunes = lunes(new Date());
  const opciones = [0, 1, 2, 3, 4].map((n) => sumarDias(esteLunes, n * 7));
  const [programa, setPrograma] = useState('');
  const [inicio, setInicio] = useState(iso(sumarDias(esteLunes, 7)));
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function asignar() {
    if (!programa) return setError('Elige un programa.');
    setEnviando(true);
    const { error } = await supabase.rpc('assign_program', { p_program: programa, p_patient: pacienteId, p_start_monday: inicio, p_message: mensaje.trim() || null });
    setEnviando(false);
    if (error) setError('No se ha podido asignar el programa.');
    else onHecho();
  }

  return (
    <Ventana titulo="Asignar programa" onCerrar={onCerrar}>
      {!programas && <p className="text-texto-suave">Cargando…</p>}
      {programas && programas.length === 0 && <p className="text-texto-suave">Aún no tienes programas. Créalos en la sección Programas.</p>}
      <ul className="flex flex-col gap-2">
        {programas?.map((p) => (
          <li key={p.id}>
            <label className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 cursor-pointer ${programa === p.id ? 'bg-petroleo text-white' : 'bg-white'}`}>
              <input type="radio" name="programa" className="sr-only" checked={programa === p.id} onChange={() => setPrograma(p.id)} />
              <span className="font-semibold">{p.name}</span>
              <span className="text-sm opacity-80">{p.weeks} sem.</span>
            </label>
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Empieza el lunes
        <select value={inicio} onChange={(e) => setInicio(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white">
          {opciones.map((d, i) => <option key={iso(d)} value={iso(d)}>{diaMes(d)}{i === 0 ? ' (esta semana)' : i === 1 ? ' (la próxima)' : ''}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Mensaje para todas las sesiones (opcional)
        <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" />
      </label>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <button onClick={asignar} disabled={enviando || !programa} className="self-end bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60">{enviando ? 'Asignando…' : 'Asignar'}</button>
    </Ventana>
  );
}

type SesionPrograma = { id: string; scheduled_date: string; status: string; workout_blocks: { workout_items: { set_logs: { count: number }[]; workout_item_feedback: { count: number }[] }[] }[] };

function Cambiar({ supabase, asignacion, onCerrar, onHecho }: { supabase: SupabaseClient; asignacion: Asignacion; onCerrar: () => void; onHecho: () => void }) {
  const programas = useProgramas(supabase);
  const inicio = desdeIso(asignacion.start_date);
  const primera = Math.max(1, Math.floor((lunes(new Date()).getTime() - inicio.getTime()) / (7 * 864e5)) + 1);
  const semanasPosibles = Array.from({ length: asignacion.programs.weeks - primera + 1 }, (_, i) => primera + i);
  const [semana, setSemana] = useState(primera);
  const [nuevo, setNuevo] = useState('');
  const [sesiones, setSesiones] = useState<SesionPrograma[] | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase
      .from('workouts')
      .select('id, scheduled_date, status, workout_blocks(workout_items(set_logs(count), workout_item_feedback(count)))')
      .eq('program_assignment_id', asignacion.id)
      .then(({ data }) => setSesiones((data as unknown as SesionPrograma[]) ?? []));
  }, [asignacion.id, supabase]);

  const desde = iso(sumarDias(inicio, (semana - 1) * 7));
  const afectadas = (sesiones ?? []).filter((s) => s.scheduled_date >= desde);
  const conRegistros = (s: SesionPrograma) => s.workout_blocks.some((b) => b.workout_items.some((i) => (i.set_logs[0]?.count ?? 0) > 0 || (i.workout_item_feedback[0]?.count ?? 0) > 0));
  const seQuitan = afectadas.filter((s) => s.status === 'scheduled' && !conRegistros(s)).length;
  const seQuedan = afectadas.length - seQuitan;

  async function cambiar() {
    setEnviando(true);
    const { data, error } = await supabase.rpc('replace_program_from_week', { p_assignment: asignacion.id, p_week: semana, p_new_program: nuevo || null, p_message: null });
    setEnviando(false);
    if (error) return setError('No se ha podido cambiar el programa.');
    if (data) onHecho();
  }

  return (
    <Ventana titulo={`Cambiar «${asignacion.programs.name}»`} onCerrar={onCerrar}>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Desde la semana
        <select value={semana} onChange={(e) => setSemana(Number(e.target.value))} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white">
          {semanasPosibles.map((n) => <option key={n} value={n}>Semana {n} · lunes {diaMes(sumarDias(inicio, (n - 1) * 7))}{n === primera ? ' (esta)' : ''}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        En su lugar
        <select value={nuevo} onChange={(e) => setNuevo(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white">
          <option value="">Nada (solo quitar lo pendiente)</option>
          {programas?.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.weeks} sem.</option>)}
        </select>
      </label>
      {sesiones && (
        <div className="bg-white rounded-xl p-4 text-sm flex flex-col gap-1">
          <p><strong>Se quitarán {seQuitan}</strong> {seQuitan === 1 ? 'sesión pendiente' : 'sesiones pendientes'} desde el lunes {diaMes(desdeIso(desde))}.</p>
          {seQuedan > 0 && <p>Se mantienen {seQuedan} porque ya están hechas, en curso o tienen series o notas registradas.</p>}
          {nuevo && <p>El programa nuevo empezará ese mismo lunes.</p>}
        </div>
      )}
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <button onClick={cambiar} disabled={enviando || !sesiones} className="self-end bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60">{enviando ? 'Cambiando…' : 'Confirmar el cambio'}</button>
    </Ventana>
  );
}
