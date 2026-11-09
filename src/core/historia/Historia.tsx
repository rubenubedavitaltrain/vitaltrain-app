import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hoyIso, iso, lunes } from '../../lib/fechas';
import ConDobleFactor from './DobleFactor';
import { exportarDatos } from '../legal/exportar';
import CopiaPaciente from './CopiaPaciente';
import {
  BUCKET_HISTORIA, CAMPOS_CONSULTA, CAMPOS_FICHA, CATEGORIAS, MODALIDADES, fechaHora, fechaLarga, registrar,
  type Acceso, type Adenda, type Categoria, type Consulta, type DocClinico, type Ficha, type Modalidad,
} from './datos';

// Historia clínica y seguimiento del paciente (CRM clínico). Pantalla completa desde la ficha del paciente.
// Pestañas: Línea de tiempo, Consultas, Ficha clínica, Documentos clínicos, Registro de accesos.

type Pestaña = 'linea' | 'consultas' | 'ficha' | 'documentos' | 'accesos';

export function BotonHistoria({ supabase, paciente }: { supabase: SupabaseClient; paciente: { id: string; full_name: string } }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button onClick={() => setAbierta(true)} className="bg-petroleo text-white font-bold px-4 py-2.5 rounded-xl">Historia clínica</button>
      {abierta && <Historia supabase={supabase} paciente={paciente} onCerrar={() => setAbierta(false)} />}
    </>
  );
}

function Historia({ supabase, paciente, onCerrar }: { supabase: SupabaseClient; paciente: { id: string; full_name: string }; onCerrar: () => void }) {
  const [pestaña, setPestaña] = useState<Pestaña>('linea');
  const [copia, setCopia] = useState(false);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Historia clínica de ${paciente.full_name}`} className="fixed inset-0 z-50 bg-fondo overflow-y-auto">
      <header className="sticky top-0 z-10 bg-petroleo text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <button onClick={onCerrar} className="font-semibold">← Ficha</button>
          <h1 className="font-bold text-lg">Historia clínica · {paciente.full_name}</h1>
          <div className="flex-1" />
          <button onClick={() => setCopia(true)} className="bg-mostaza text-[#1F2424] font-bold px-3 py-1.5 rounded-lg text-sm" title="Si el paciente pide su historia clínica">Copia para el paciente</button>
          <button onClick={() => { if (window.confirm(`Descargar todos los datos de ${paciente.full_name}, incluida la historia clínica, en un archivo. Queda anotado en el registro de accesos. Guárdalo en un sitio seguro.`)) exportarDatos(supabase, paciente.id, true); }}
            className="bg-white/15 font-semibold px-3 py-1.5 rounded-lg text-sm" title="Para atender una petición de acceso del paciente">Exportar datos</button>
        </div>
      </header>
      <ConDobleFactor supabase={supabase}>
        <Registrar supabase={supabase} pacienteId={paciente.id} />
        {copia && <CopiaPaciente supabase={supabase} paciente={paciente} onCerrar={() => setCopia(false)} />}
        <nav className="max-w-6xl mx-auto px-4 pt-4 flex flex-wrap gap-1.5" aria-label="Apartados de la historia">
          {([['linea', 'Línea de tiempo'], ['consultas', 'Consultas'], ['ficha', 'Ficha clínica'], ['documentos', 'Documentos clínicos'], ['accesos', 'Registro de accesos']] as [Pestaña, string][]).map(([k, t]) => (
            <button key={k} onClick={() => setPestaña(k)} aria-pressed={pestaña === k} className={`px-4 py-2 rounded-full font-semibold text-sm ${pestaña === k ? 'bg-petroleo text-white' : 'bg-white'}`}>{t}</button>
          ))}
        </nav>
        <main className="max-w-6xl mx-auto p-4">
          {pestaña === 'linea' && <LineaTiempo supabase={supabase} pacienteId={paciente.id} onIr={setPestaña} />}
          {pestaña === 'consultas' && <Consultas supabase={supabase} pacienteId={paciente.id} />}
          {pestaña === 'ficha' && <FichaClinica supabase={supabase} pacienteId={paciente.id} />}
          {pestaña === 'documentos' && <DocsClinicos supabase={supabase} pacienteId={paciente.id} />}
          {pestaña === 'accesos' && <Accesos supabase={supabase} pacienteId={paciente.id} />}
        </main>
      </ConDobleFactor>
    </div>
  );
}

/** Deja constancia de que se ha abierto la historia (una vez por apertura). */
function Registrar({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const hecho = useRef(false);
  useEffect(() => { if (!hecho.current) { hecho.current = true; registrar(supabase, pacienteId, 'ver_historia', 'historia'); } }, [supabase, pacienteId]);
  return null;
}

// ---------------- Línea de tiempo ----------------

type Evento = { fecha: string; tipo: string; titulo: string; detalle?: string; destacado?: boolean; ir?: Pestaña };

function LineaTiempo({ supabase, pacienteId, onIr }: { supabase: SupabaseClient; pacienteId: string; onIr: (p: Pestaña) => void }) {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [filtro, setFiltro] = useState<'todo' | 'clinica' | 'app'>('todo');

  useEffect(() => {
    (async () => {
      const q = (t: string, s: string) => supabase.from(t).select(s).eq('patient_id', pacienteId);
      const [cons, ads, docs, pdocs, res, hab, prog, ws, med, consent] = await Promise.all([
        q('consultations', 'id, happened_at, modality, reason, plan, status, next_review'),
        q('consultation_addenda', 'created_at, text'),
        q('clinical_documents', 'title, category, document_date, created_at'),
        q('patient_documents', 'title, created_at, is_shared'),
        q('monthly_reviews', 'month, shared_at, updated_at'),
        q('patient_habits', 'start_date, end_date, is_active, habit_definitions(name)'),
        q('program_assignments', 'start_date, status, programs(name)'),
        q('workouts', 'scheduled_date, status').eq('status', 'completed'),
        q('body_measurements', 'measured_on, weight_kg, waist_cm, hip_cm'),
        q('consents', 'accepted_at, withdrawn_at, version'),
      ]);
      const ev: Evento[] = [];
      type R = Record<string, unknown>;
      const filas = (r: { data: unknown }) => ((r.data as R[]) ?? []);
      for (const c of filas(cons)) ev.push({ fecha: c.happened_at as string, tipo: 'Consulta', titulo: `${MODALIDADES[c.modality as Modalidad]}${c.reason ? ` · ${c.reason}` : ''}${c.status === 'draft' ? ' (borrador)' : ''}`, detalle: (c.plan as string) ?? undefined, destacado: true, ir: 'consultas' });
      for (const a of filas(ads)) ev.push({ fecha: a.created_at as string, tipo: 'Adenda', titulo: (a.text as string).slice(0, 140), ir: 'consultas' });
      for (const d of filas(docs)) ev.push({ fecha: (d.document_date as string) ?? (d.created_at as string), tipo: CATEGORIAS[d.category as Categoria], titulo: d.title as string, ir: 'documentos' });
      for (const d of filas(pdocs)) ev.push({ fecha: d.created_at as string, tipo: 'Documento compartido', titulo: `${d.title}${d.is_shared ? '' : ' (oculto)'}` });
      for (const r of filas(res)) ev.push({ fecha: r.month as string, tipo: 'Resumen mensual', titulo: r.shared_at ? 'Compartido con el paciente' : 'Guardado' });
      for (const h of filas(hab)) ev.push({ fecha: h.start_date as string, tipo: 'Hábito pautado', titulo: ((h.habit_definitions as R | null)?.name as string) ?? '', detalle: h.end_date ? `Retirado el ${fechaLarga(h.end_date as string)}` : undefined });
      for (const p of filas(prog)) ev.push({ fecha: p.start_date as string, tipo: 'Programa', titulo: ((p.programs as R | null)?.name as string) ?? '', detalle: p.status === 'active' ? undefined : 'Sustituido o cancelado' });
      for (const m of filas(med)) ev.push({ fecha: m.measured_on as string, tipo: 'Medidas', titulo: [m.weight_kg && `${Number(m.weight_kg).toLocaleString('es-ES')} kg`, m.waist_cm && `cintura ${Number(m.waist_cm).toLocaleString('es-ES')} cm`, m.hip_cm && `cadera ${Number(m.hip_cm).toLocaleString('es-ES')} cm`].filter(Boolean).join(' · ') });
      for (const c of filas(consent)) {
        ev.push({ fecha: c.accepted_at as string, tipo: 'Consentimiento', titulo: `Aceptado (versión ${c.version})` });
        if (c.withdrawn_at) ev.push({ fecha: c.withdrawn_at as string, tipo: 'Consentimiento', titulo: 'Retirado' });
      }
      // Entrenamientos agrupados por semana
      const semanas = new Map<string, number>();
      for (const w of filas(ws)) { const l = iso(lunes(new Date(`${w.scheduled_date}T12:00:00`))); semanas.set(l, (semanas.get(l) ?? 0) + 1); }
      for (const [l, n] of semanas) ev.push({ fecha: l, tipo: 'Entrenamiento', titulo: `${n} ${n === 1 ? 'sesión hecha' : 'sesiones hechas'} esa semana` });
      ev.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setEventos(ev);
    })();
  }, [supabase, pacienteId]);

  const clinicos = new Set(['Consulta', 'Adenda', ...Object.values(CATEGORIAS)]);
  const vistos = (eventos ?? []).filter((e) => filtro === 'todo' || (filtro === 'clinica') === clinicos.has(e.tipo));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {([['todo', 'Todo'], ['clinica', 'Solo clínica'], ['app', 'Solo app']] as const).map(([k, t]) => (
          <button key={k} onClick={() => setFiltro(k)} aria-pressed={filtro === k} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${filtro === k ? 'bg-mostaza text-[#1F2424]' : 'bg-white'}`}>{t}</button>
        ))}
      </div>
      {!eventos && <p className="text-texto-suave">Cargando…</p>}
      {eventos && vistos.length === 0 && <p className="bg-white rounded-2xl p-5 text-texto-suave">Aún no hay nada. Empieza por la ficha clínica o una consulta.</p>}
      <ol className="relative border-l-2 border-gris-claro ml-3 flex flex-col gap-3">
        {vistos.map((e, i) => (
          <li key={i} className="ml-5 relative">
            <span className={`absolute -left-[29px] top-3 w-4 h-4 rounded-full border-2 border-white ${e.destacado ? 'bg-mostaza' : clinicos.has(e.tipo) ? 'bg-petroleo' : 'bg-borde'}`} aria-hidden="true" />
            <button onClick={() => e.ir && onIr(e.ir)} disabled={!e.ir} className={`w-full text-left rounded-2xl p-3 ${e.destacado ? 'bg-white shadow-sm' : 'bg-white/70'}`}>
              <div className="text-xs text-texto-suave"><b className="text-petroleo uppercase tracking-wide">{e.tipo}</b> · {fechaLarga(e.fecha)}</div>
              <div className="font-semibold">{e.titulo}</div>
              {e.detalle && <div className="text-sm text-texto-suave line-clamp-2 whitespace-pre-line">{e.detalle}</div>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------- Consultas ----------------

function Consultas({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [lista, setLista] = useState<Consulta[] | null>(null);
  const [adendas, setAdendas] = useState<Adenda[]>([]);
  const [editando, setEditando] = useState<Consulta | 'nueva' | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    supabase.from('consultations').select('*').eq('patient_id', pacienteId).order('happened_at', { ascending: false }).then(({ data }) => setLista((data as Consulta[]) ?? []));
    supabase.from('consultation_addenda').select('id, consultation_id, text, created_at').eq('patient_id', pacienteId).order('created_at').then(({ data }) => setAdendas((data as Adenda[]) ?? []));
  }, [supabase, pacienteId, version]);
  const recargar = () => { setEditando(null); setVersion((v) => v + 1); };

  if (editando) return <EditorConsulta supabase={supabase} pacienteId={pacienteId} consulta={editando === 'nueva' ? null : editando} anterior={lista?.find((c) => c.status === 'closed') ?? null} onCerrar={recargar} />;

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setEditando('nueva')} className="self-start bg-mostaza text-[#1F2424] font-bold px-4 py-2.5 rounded-xl">+ Nueva consulta</button>
      {!lista && <p className="text-texto-suave">Cargando…</p>}
      {lista?.length === 0 && <p className="bg-white rounded-2xl p-5 text-texto-suave">Sin consultas registradas.</p>}
      {lista?.map((c) => (
        <article key={c.id} className="bg-white rounded-2xl p-5 flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-bold">{fechaHora(c.happened_at)} · {MODALIDADES[c.modality]}{c.duration_minutes ? ` · ${c.duration_minutes} min` : ''}</div>
              <div className="text-xs text-texto-suave">{c.status === 'closed' ? `Cerrada el ${fechaHora(c.closed_at!)}` : 'Borrador: aún se puede cambiar'}{c.next_review ? ` · Próxima revisión: ${fechaLarga(c.next_review)}` : ''}</div>
            </div>
            {c.status === 'draft'
              ? <button onClick={() => setEditando(c)} className="bg-mostaza text-[#1F2424] font-bold px-3 py-1.5 rounded-lg text-sm">Seguir editando</button>
              : <NuevaAdenda supabase={supabase} consulta={c} onHecho={recargar} />}
          </div>
          <dl className="grid gap-2 text-sm">
            {CAMPOS_CONSULTA.filter((f) => c[f.clave]).map((f) => (
              <div key={f.clave}><dt className="text-[11px] font-bold uppercase tracking-wide text-petroleo">{f.titulo}</dt><dd className="whitespace-pre-line">{c[f.clave]}</dd></div>
            ))}
          </dl>
          {adendas.filter((a) => a.consultation_id === c.id).map((a) => (
            <p key={a.id} className="text-sm bg-fondo rounded-lg px-3 py-2"><b>Adenda {fechaHora(a.created_at)}:</b> <span className="whitespace-pre-line">{a.text}</span></p>
          ))}
        </article>
      ))}
    </div>
  );
}

function EditorConsulta({ supabase, pacienteId, consulta, anterior, onCerrar }: { supabase: SupabaseClient; pacienteId: string; consulta: Consulta | null; anterior: Consulta | null; onCerrar: () => void }) {
  const ahora = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [f, setF] = useState({
    happened_at: consulta ? new Date(new Date(consulta.happened_at).valueOf() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ahora,
    modality: (consulta?.modality ?? 'presencial') as Modalidad, duration_minutes: consulta?.duration_minutes ? String(consulta.duration_minutes) : '',
    reason: consulta?.reason ?? '', subjective: consulta?.subjective ?? '', findings: consulta?.findings ?? '', plan: consulta?.plan ?? '', goals: consulta?.goals ?? '',
    next_review: consulta?.next_review ?? '',
  });
  const [id, setId] = useState(consulta?.id ?? null);
  const [estado, setEstado] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(cerrar: boolean) {
    setEstado('');
    if (cerrar && !window.confirm('Al cerrar la consulta ya no se podrá cambiar. Las correcciones se añaden como adenda. ¿Cerrar?')) return;
    const fila = {
      patient_id: pacienteId, happened_at: new Date(f.happened_at).toISOString(), modality: f.modality,
      duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : null,
      reason: f.reason.trim() || null, subjective: f.subjective.trim() || null, findings: f.findings.trim() || null, plan: f.plan.trim() || null, goals: f.goals.trim() || null,
      next_review: f.next_review || null, ...(cerrar ? { status: 'closed' } : {}),
    };
    const r = id ? await supabase.from('consultations').update(fila).eq('id', id).select('id').single() : await supabase.from('consultations').insert(fila).select('id').single();
    if (r.error) return setEstado('No se ha podido guardar.');
    setId((r.data as { id: string }).id);
    if (cerrar) onCerrar(); else setEstado(`Borrador guardado a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`);
  }

  async function borrar() {
    if (!id) return onCerrar();
    if (!window.confirm('¿Borrar este borrador?')) return;
    await supabase.from('consultations').delete().eq('id', id);
    onCerrar();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{consulta ? 'Consulta (borrador)' : 'Nueva consulta'}</h2>
          <button onClick={onCerrar} className="font-semibold text-petroleo">Volver</button>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">Fecha y hora<input type="datetime-local" value={f.happened_at} onChange={(e) => set('happened_at', e.target.value)} className="font-normal px-3 py-2 border border-borde rounded-xl" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">Modalidad
            <select value={f.modality} onChange={(e) => set('modality', e.target.value)} className="font-normal px-3 py-2 border border-borde rounded-xl bg-white">
              {(Object.keys(MODALIDADES) as Modalidad[]).map((m) => <option key={m} value={m}>{MODALIDADES[m]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">Duración (min)<input inputMode="numeric" value={f.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value.replace(/\D/g, '').slice(0, 3))} className="font-normal px-3 py-2 border border-borde rounded-xl" /></label>
        </div>
        {CAMPOS_CONSULTA.map((c) => (
          <label key={c.clave} className="flex flex-col gap-1 text-sm font-semibold">{c.titulo}{c.ayuda && <span className="font-normal text-xs text-texto-suave">{c.ayuda}</span>}
            <textarea rows={c.filas} value={f[c.clave]} onChange={(e) => set(c.clave, e.target.value)} className="font-normal text-base px-3 py-2 border border-borde rounded-xl" />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm font-semibold max-w-xs">Próxima revisión<input type="date" min={hoyIso()} value={f.next_review} onChange={(e) => set('next_review', e.target.value)} className="font-normal px-3 py-2 border border-borde rounded-xl" /></label>
        {estado && <p role="status" className="text-sm font-semibold text-petroleo">{estado}</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => guardar(false)} className="bg-white border-2 border-petroleo text-petroleo font-bold px-4 py-2.5 rounded-xl">Guardar borrador</button>
          <button onClick={() => guardar(true)} className="bg-mostaza text-[#1F2424] font-bold px-4 py-2.5 rounded-xl">Cerrar consulta</button>
          <div className="flex-1" />
          <button onClick={borrar} className="font-semibold text-[#8A2C1D] px-2">{id ? 'Borrar borrador' : 'Descartar'}</button>
        </div>
      </div>
      <aside className="bg-white rounded-2xl p-4 flex flex-col gap-2 text-sm lg:sticky lg:top-20">
        <h3 className="font-bold">Consulta anterior</h3>
        {!anterior && <p className="text-texto-suave">Es la primera.</p>}
        {anterior && (
          <>
            <p className="text-xs text-texto-suave">{fechaHora(anterior.happened_at)} · {MODALIDADES[anterior.modality]}</p>
            {anterior.plan && <div><div className="text-[11px] font-bold uppercase tracking-wide text-petroleo">Pautas</div><p className="whitespace-pre-line">{anterior.plan}</p></div>}
            {anterior.goals && <div><div className="text-[11px] font-bold uppercase tracking-wide text-petroleo">Objetivos</div><p className="whitespace-pre-line">{anterior.goals}</p></div>}
          </>
        )}
      </aside>
    </div>
  );
}

function NuevaAdenda({ supabase, consulta, onHecho }: { supabase: SupabaseClient; consulta: Consulta; onHecho: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  if (!abierta) return <button onClick={() => setAbierta(true)} className="text-sm font-bold text-petroleo px-2 py-1">+ Adenda</button>;
  return (
    <div className="w-full flex flex-col gap-2">
      <textarea autoFocus rows={2} value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 5000))} placeholder="Corrección o información añadida. Queda fechada y no se puede cambiar." className="text-base px-3 py-2 border border-borde rounded-xl" />
      <div className="flex gap-2">
        <button onClick={async () => {
          if (!texto.trim()) return;
          const { error } = await supabase.from('consultation_addenda').insert({ consultation_id: consulta.id, patient_id: consulta.patient_id, text: texto.trim() });
          if (error) return setError('No se ha podido guardar.');
          onHecho();
        }} className="bg-mostaza text-[#1F2424] font-bold px-3 py-1.5 rounded-lg text-sm">Añadir adenda</button>
        <button onClick={() => setAbierta(false)} className="text-sm font-semibold px-2">Cancelar</button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-[#8A2C1D]">{error}</p>}
    </div>
  );
}

// ---------------- Ficha clínica ----------------

function FichaClinica({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [versiones, setVersiones] = useState<{ changed_at: string }[]>([]);
  const [estado, setEstado] = useState('');
  async function cargar() {
    const { data } = await supabase.from('clinical_records').select('*').eq('patient_id', pacienteId).maybeSingle();
    const f = data as Ficha | null;
    setFicha(f);
    setValores(Object.fromEntries(CAMPOS_FICHA.map((c) => [c.clave, (f?.[c.clave] as string | null) ?? ''])));
    const v = await supabase.from('clinical_record_versions').select('changed_at').eq('patient_id', pacienteId).order('changed_at', { ascending: false });
    setVersiones((v.data as { changed_at: string }[]) ?? []);
  }
  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiada = useMemo(() => CAMPOS_FICHA.some((c) => (valores[c.clave] ?? '') !== ((ficha?.[c.clave] as string | null) ?? '')), [valores, ficha]);

  async function guardar() {
    setEstado('');
    const fila = { patient_id: pacienteId, ...Object.fromEntries(CAMPOS_FICHA.map((c) => [c.clave, valores[c.clave]?.trim() || null])) };
    const { error } = ficha ? await supabase.from('clinical_records').update(fila).eq('patient_id', pacienteId) : await supabase.from('clinical_records').insert(fila);
    if (error) return setEstado('No se ha podido guardar.');
    setEstado('Guardado. La versión anterior queda en el historial.');
    cargar();
  }

  if (ficha === undefined) return <p className="text-texto-suave">Cargando…</p>;
  return (
    <div className="bg-white rounded-2xl p-5 flex flex-col gap-3 max-w-3xl">
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="text-lg font-bold">Ficha clínica</h2>
        <p className="text-xs text-texto-suave">{ficha ? `Última actualización: ${fechaHora(ficha.updated_at)}` : 'Sin rellenar'}{versiones.length ? ` · ${versiones.length} versiones anteriores guardadas` : ''}</p>
      </div>
      {CAMPOS_FICHA.map((c) => (
        <label key={c.clave} className="flex flex-col gap-1 text-sm font-semibold">{c.titulo}{c.ayuda && <span className="font-normal text-xs text-texto-suave">{c.ayuda}</span>}
          <textarea rows={c.filas} value={valores[c.clave] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))} className="font-normal text-base px-3 py-2 border border-borde rounded-xl" />
        </label>
      ))}
      {estado && <p role="status" className="text-sm font-semibold text-petroleo">{estado}</p>}
      <button onClick={guardar} disabled={!cambiada} className="self-start bg-mostaza text-[#1F2424] font-bold px-5 py-2.5 rounded-xl disabled:opacity-50">Guardar ficha</button>
    </div>
  );
}

// ---------------- Documentos clínicos ----------------

const TIPOS_OK: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };

function DocsClinicos({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [docs, setDocs] = useState<DocClinico[] | null>(null);
  const [version, setVersion] = useState(0);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [categoria, setCategoria] = useState<Categoria>('analitica');
  const [fecha, setFecha] = useState('');
  const [estado, setEstado] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('clinical_documents').select('id, category, title, document_date, note, storage_path, size_bytes, mime, created_at').eq('patient_id', pacienteId)
      .order('document_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).then(({ data }) => setDocs((data as DocClinico[]) ?? []));
  }, [supabase, pacienteId, version]);

  function elegir(fs: FileList | null) {
    setEstado('');
    const lista = [...(fs ?? [])];
    const malos = lista.filter((f) => !TIPOS_OK[f.type] || f.size > 50 * 1024 * 1024);
    if (malos.length) setEstado(`No se pueden subir: ${malos.map((m) => m.name).join(', ')}. Solo PDF, JPG, PNG o Word (.docx), hasta 50 MB.`);
    setArchivos(lista.filter((f) => !malos.includes(f)));
  }

  async function subir() {
    setSubiendo(true); setEstado('');
    let ok = 0;
    for (const a of archivos) {
      const ruta = `${pacienteId}/${crypto.randomUUID()}.${TIPOS_OK[a.type]}`;
      const up = await supabase.storage.from(BUCKET_HISTORIA).upload(ruta, a, { contentType: a.type });
      if (up.error) continue;
      const { error } = await supabase.from('clinical_documents').insert({
        patient_id: pacienteId, category: categoria, title: a.name.replace(/\.[^.]+$/, '').slice(0, 160), document_date: fecha || null,
        storage_path: ruta, size_bytes: a.size, mime: a.type,
      });
      if (error) { await supabase.storage.from(BUCKET_HISTORIA).remove([ruta]); continue; }
      ok++;
    }
    setSubiendo(false);
    setEstado(ok === archivos.length ? `Subidos ${ok}.` : `Subidos ${ok} de ${archivos.length}. Revisa los que faltan.`);
    setArchivos([]); if (input.current) input.current.value = '';
    setVersion((v) => v + 1);
  }

  async function abrir(d: DocClinico) {
    const w = window.open('', '_blank');
    const { data } = await supabase.storage.from(BUCKET_HISTORIA).createSignedUrl(d.storage_path, 300);
    registrar(supabase, pacienteId, 'ver_documento', 'documento', d.id);
    if (data?.signedUrl && w) w.location.href = data.signedUrl; else w?.close();
  }

  async function borrar(d: DocClinico) {
    if (!window.confirm(`¿Borrar «${d.title}»? Solo es posible en las 24 horas siguientes a subirlo.`)) return;
    const { error } = await supabase.from('clinical_documents').delete().eq('id', d.id);
    if (error) return setEstado('No se puede borrar: han pasado más de 24 horas desde que se subió.');
    await supabase.storage.from(BUCKET_HISTORIA).remove([d.storage_path]);
    setVersion((v) => v + 1);
  }

  async function renombrar(d: DocClinico) {
    const t = window.prompt('Título del documento', d.title);
    if (!t || !t.trim() || t === d.title) return;
    await supabase.from('clinical_documents').update({ title: t.trim().slice(0, 160) }).eq('id', d.id);
    setVersion((v) => v + 1);
  }

  const grupos = (Object.keys(CATEGORIAS) as Categoria[]).map((c) => [c, (docs ?? []).filter((d) => d.category === c)] as const).filter(([, l]) => l.length);

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="font-bold">Subir documentos</h2>
        <label className="flex flex-col items-center gap-1 border-2 border-dashed border-borde rounded-xl p-5 text-center cursor-pointer hover:bg-fondo"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); elegir(e.dataTransfer.files); }}>
          <input ref={input} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.docx" className="sr-only" onChange={(e) => elegir(e.target.files)} />
          <span className="font-semibold">{archivos.length ? `${archivos.length} archivo${archivos.length > 1 ? 's' : ''} elegido${archivos.length > 1 ? 's' : ''}` : 'Arrastra aquí o pulsa para elegir'}</span>
          <span className="text-xs text-texto-suave">PDF, foto o Word. Varios a la vez.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Carpeta
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)} className="font-normal px-3 py-2 border border-borde rounded-xl bg-white">
            {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => <option key={c} value={c}>{CATEGORIAS[c]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Fecha del documento (opcional)<input type="date" max={hoyIso()} value={fecha} onChange={(e) => setFecha(e.target.value)} className="font-normal px-3 py-2 border border-borde rounded-xl" /></label>
        <button onClick={subir} disabled={!archivos.length || subiendo} className="bg-mostaza text-[#1F2424] font-bold py-2.5 rounded-xl disabled:opacity-50">{subiendo ? 'Subiendo…' : 'Subir'}</button>
        {estado && <p role="status" className="text-sm font-semibold text-petroleo">{estado}</p>}
        <p className="text-xs text-texto-suave">El paciente no ve estos documentos. Se pueden borrar solo en las 24 horas siguientes a subirlos.</p>
      </div>
      <div className="flex flex-col gap-3">
        {!docs && <p className="text-texto-suave">Cargando…</p>}
        {docs?.length === 0 && <p className="bg-white rounded-2xl p-5 text-texto-suave">Sin documentos clínicos.</p>}
        {grupos.map(([c, l]) => (
          <section key={c} className="bg-white rounded-2xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-petroleo mb-1">{CATEGORIAS[c]} ({l.length})</h3>
            <ul>
              {l.map((d) => (
                <li key={d.id} className="border-t border-fondo py-2 flex items-center gap-3">
                  <button onClick={() => abrir(d)} className="flex-1 min-w-0 text-left">
                    <span className="block font-semibold truncate hover:underline">{d.title}</span>
                    <span className="block text-xs text-texto-suave">{d.document_date ? fechaLarga(d.document_date) : `Subido el ${fechaLarga(d.created_at)}`} · {TIPOS_OK[d.mime]?.toUpperCase()}</span>
                  </button>
                  <button onClick={() => renombrar(d)} className="text-xs font-semibold text-petroleo px-2">Renombrar</button>
                  {Date.now() - new Date(d.created_at).valueOf() < 86400000 && <button onClick={() => borrar(d)} className="text-xs font-semibold text-[#8A2C1D] px-2">Borrar</button>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------------- Registro de accesos ----------------

const ACCIONES: Record<string, string> = { ver_historia: 'Abrió la historia', ver_documento: 'Abrió un documento', crear: 'Creó', editar: 'Editó', cerrar: 'Cerró', adenda: 'Añadió una adenda a', subir: 'Subió', borrar: 'Borró', exportar: 'Exportó', importar: 'Importó' };
const ENTIDADES: Record<string, string> = { historia: '', ficha: 'la ficha clínica', consulta: 'una consulta', documento: 'un documento' };

function Accesos({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [filas, setFilas] = useState<Acceso[] | null>(null);
  useEffect(() => {
    supabase.from('access_log').select('id, at, action, entity, detail').eq('patient_id', pacienteId).order('at', { ascending: false }).limit(300).then(({ data }) => setFilas((data as Acceso[]) ?? []));
  }, [supabase, pacienteId]);
  return (
    <div className="bg-white rounded-2xl p-5 max-w-3xl">
      <h2 className="font-bold">Registro de accesos</h2>
      <p className="text-xs text-texto-suave mb-2">Quién ha abierto o cambiado esta historia y cuándo. No se puede editar ni borrar. Últimos 300.</p>
      {!filas && <p className="text-texto-suave">Cargando…</p>}
      <ul className="text-sm">
        {filas?.map((f) => (
          <li key={f.id} className="border-t border-fondo py-1.5 flex gap-3">
            <span className="text-texto-suave tabular-nums shrink-0 w-44">{fechaHora(f.at)}</span>
            <span>{ACCIONES[f.action] ?? f.action} {ENTIDADES[f.entity] ?? f.entity}{f.detail ? `: ${f.detail}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
