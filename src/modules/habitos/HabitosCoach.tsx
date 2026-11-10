import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hoyIso } from '../../lib/fechas';
import { Constancia } from './Habitos';
import { cargarAsignados, cargarCatalogo, DIAS, num, objetivo, textoAncla, TIPOS, type Asignado, type Definicion, type Tipo } from './datos';

// Módulo de hábitos, parte del coach: ficha del paciente. Asignar del catálogo, ajustar objetivo y días, retirar.

export default function HabitosCoach({ supabase, pacienteId, nombre }: { supabase: SupabaseClient; pacienteId: string; nombre: string }) {
  const [asignados, setAsignados] = useState<Asignado[] | null>(null);
  const [version, setVersion] = useState(0);
  const [hoja, setHoja] = useState<{ tipo: 'catalogo' } | { tipo: 'editar'; def: Definicion; asignado?: Asignado } | { tipo: 'nuevo' } | null>(null);
  useEffect(() => { cargarAsignados(supabase, pacienteId).then(setAsignados); }, [supabase, pacienteId, version]);
  const recargar = () => { setHoja(null); setVersion((v) => v + 1); };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="habitos-coach">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h3 id="habitos-coach" className="text-lg font-bold">Hábitos</h3>
        <button onClick={() => setHoja({ tipo: 'catalogo' })} className="bg-mostaza text-[#1F2424] font-bold px-4 py-2 rounded-xl">+ Asignar hábito</button>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-2">
          <h4 className="font-bold">Lo que tiene pautado</h4>
          {!asignados && <p className="text-sm text-texto-suave">Cargando…</p>}
          {asignados?.length === 0 && <p className="text-sm text-texto-suave">Sin hábitos. Pulsa «Asignar hábito» y elige del catálogo por pilar.</p>}
          <ul className="flex flex-col">
            {asignados?.map((a) => {
              const d = a.habit_definitions;
              const obj = objetivo(a);
              return (
                <li key={a.id} className="border-t border-fondo py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-petroleo">{d.pillars?.name ?? 'Sin pilar'}</div>
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-texto-suave">
                      {[a.days_of_week.length === 7 ? 'Todos los días' : a.days_of_week.map((x) => DIAS[x - 1]).join(' '), obj != null && d.kind !== 'scale' ? `objetivo ${num(obj)} ${d.unit ?? ''}`.trim() : null, textoAncla(d.anchor, d.anchor_offset_minutes), a.remind && a.remind_at ? `aviso a las ${a.remind_at.slice(0, 5)}` : null].filter(Boolean).join(' · ')}
                    </div>
                    {a.coach_note && <div className="text-xs mt-0.5">Tu indicación: {a.coach_note}</div>}
                  </div>
                  <button onClick={() => setHoja({ tipo: 'editar', def: d, asignado: a })} className="text-sm font-bold text-petroleo px-2 py-1">Cambiar</button>
                </li>
              );
            })}
          </ul>
        </div>
        <Constancia supabase={supabase} pacienteId={pacienteId} esCoach version={version} />
      </div>

      {hoja?.tipo === 'catalogo' && <Catalogo supabase={supabase} yaTiene={new Set(asignados?.map((a) => a.habit_id))} onElegir={(def) => setHoja({ tipo: 'editar', def })} onNuevo={() => setHoja({ tipo: 'nuevo' })} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'editar' && <Pautar supabase={supabase} pacienteId={pacienteId} nombre={nombre} def={hoja.def} asignado={hoja.asignado} onCerrar={() => setHoja(null)} onHecho={recargar} />}
      {hoja?.tipo === 'nuevo' && <NuevoHabito supabase={supabase} onCerrar={() => setHoja(null)} onCreado={(def) => setHoja({ tipo: 'editar', def })} />}
    </section>
  );
}

function Catalogo({ supabase, yaTiene, onElegir, onNuevo, onCerrar }: { supabase: SupabaseClient; yaTiene: Set<string>; onElegir: (d: Definicion) => void; onNuevo: () => void; onCerrar: () => void }) {
  const [lista, setLista] = useState<Definicion[] | null>(null);
  const [pilar, setPilar] = useState<string>('todos');
  useEffect(() => { cargarCatalogo(supabase).then(setLista); }, [supabase]);
  const pilares = [...new Map((lista ?? []).filter((d) => d.pillars).map((d) => [d.pillars!.slug, d.pillars!.name])).entries()];
  const vistos = (lista ?? []).filter((d) => pilar === 'todos' || d.pillars?.slug === pilar);
  return (
    <Hoja titulo="Catálogo de hábitos" onCerrar={onCerrar} ancho>
      <div className="flex flex-wrap gap-1.5">
        <Chip on={pilar === 'todos'} onClick={() => setPilar('todos')}>Todos</Chip>
        {pilares.map(([slug, nombre]) => <Chip key={slug} on={pilar === slug} onClick={() => setPilar(slug)}>{nombre}</Chip>)}
      </div>
      {!lista && <p className="text-sm text-texto-suave">Cargando…</p>}
      <ul className="flex flex-col bg-white rounded-xl max-h-[55dvh] overflow-y-auto">
        {vistos.map((d) => (
          <li key={d.id}>
            <button onClick={() => onElegir(d)} disabled={yaTiene.has(d.id)} className="w-full text-left px-4 py-3 border-b border-fondo disabled:opacity-45">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-petroleo">{d.pillars?.name ?? 'Sin pilar'} · {TIPOS[d.kind]}{d.default_target ? ` · ${num(d.default_target)} ${d.unit ?? ''}` : ''}</span>
              <span className="block font-semibold">{d.name}{yaTiene.has(d.id) ? ' (ya lo tiene)' : ''}</span>
              {d.short_instruction && <span className="block text-sm text-texto-suave">{d.short_instruction}</span>}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onNuevo} className="self-start font-bold text-petroleo">+ Crear un hábito nuevo</button>
    </Hoja>
  );
}

function Pautar({ supabase, pacienteId, nombre, def, asignado, onCerrar, onHecho }: {
  supabase: SupabaseClient; pacienteId: string; nombre: string; def: Definicion; asignado?: Asignado; onCerrar: () => void; onHecho: () => void;
}) {
  const conObjetivo = def.kind === 'number' || def.kind === 'duration';
  const [obj, setObj] = useState(String(asignado?.target ?? def.default_target ?? ''));
  const [dias, setDias] = useState<number[]>(asignado?.days_of_week ?? [1, 2, 3, 4, 5, 6, 7]);
  const [nota, setNota] = useState(asignado?.coach_note ?? '');
  const [desde, setDesde] = useState(asignado?.start_date ?? hoyIso());
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError('');
    if (dias.length === 0) return setError('Elige al menos un día.');
    const t = obj.trim() ? Number(obj.replace(',', '.')) : null;
    if (conObjetivo && t != null && (!Number.isFinite(t) || t <= 0)) return setError('Revisa el objetivo.');
    const fila = { target: conObjetivo ? (t === def.default_target ? null : t) : null, days_of_week: [...dias].sort(), coach_note: nota.trim() || null, start_date: desde };
    setGuardando(true);
    const { error } = asignado
      ? await supabase.from('patient_habits').update(fila).eq('id', asignado.id)
      : await supabase.from('patient_habits').insert({ ...fila, patient_id: pacienteId, habit_id: def.id });
    setGuardando(false);
    if (error) return setError('No se ha podido guardar.');
    onHecho();
  }

  async function retirar() {
    if (!asignado || !window.confirm(`¿Retirar «${def.name}» a ${nombre}? Lo que ya ha marcado se conserva.`)) return;
    const { error } = await supabase.from('patient_habits').update({ is_active: false, end_date: hoyIso() }).eq('id', asignado.id);
    if (error) return setError('No se ha podido retirar.');
    onHecho();
  }

  return (
    <Hoja titulo={asignado ? 'Cambiar hábito' : `Pautar a ${nombre}`} onCerrar={onCerrar}>
      <div className="bg-white rounded-xl p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-petroleo">{def.pillars?.name ?? 'Sin pilar'}</div>
        <div className="font-bold">{def.name}</div>
        {def.short_instruction && <p className="text-sm">{def.short_instruction}</p>}
        {def.rationale && <p className="text-xs text-texto-suave mt-1">Por qué (lo ve el paciente): {def.rationale}</p>}
        {textoAncla(def.anchor, def.anchor_offset_minutes) && <p className="text-xs text-texto-suave mt-1">Momento: {textoAncla(def.anchor, def.anchor_offset_minutes)}</p>}
      </div>
      {conObjetivo && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Objetivo diario ({def.unit ?? 'cantidad'})
          <input inputMode="decimal" value={obj} onChange={(e) => setObj(e.target.value.replace(/[^\d.,]/g, ''))} className="font-normal text-lg px-3 py-2.5 border border-borde rounded-xl bg-white" />
        </label>
      )}
      <fieldset>
        <legend className="text-sm font-semibold mb-1.5">Qué días</legend>
        <div className="flex gap-1.5">
          {DIAS.map((d, i) => {
            const on = dias.includes(i + 1);
            return <button key={d} type="button" aria-pressed={on} onClick={() => setDias(on ? dias.filter((x) => x !== i + 1) : [...dias, i + 1])} className={`flex-1 py-2.5 rounded-xl font-bold ${on ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`}>{d}</button>;
          })}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Indicación para {nombre} (opcional)
        <textarea value={nota} onChange={(e) => setNota(e.target.value.slice(0, 300))} rows={2} placeholder="Ej.: empieza por 5 minutos y sube cuando te resulte fácil" className="font-normal text-base px-3 py-2 border border-borde rounded-xl bg-white" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Desde
        <input type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" />
      </label>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <button onClick={guardar} disabled={guardando} className="bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl disabled:opacity-60">{guardando ? 'Guardando…' : asignado ? 'Guardar cambios' : 'Pautar'}</button>
      {asignado && <button onClick={retirar} className="font-semibold text-[#8A2C1D]">Retirar este hábito</button>}
    </Hoja>
  );
}

function NuevoHabito({ supabase, onCerrar, onCreado }: { supabase: SupabaseClient; onCerrar: () => void; onCreado: (d: Definicion) => void }) {
  const [pilares, setPilares] = useState<{ id: string; slug: string; name: string; position: number }[]>([]);
  const [pilar, setPilar] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<Tipo>('check');
  const [unidad, setUnidad] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [instr, setInstr] = useState('');
  const [porque, setPorque] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { supabase.from('pillars').select('id, slug, name, position').order('position').then(({ data }) => setPilares((data as typeof pilares) ?? [])); }, [supabase]);

  async function crear() {
    setError('');
    if (nombre.trim().length < 2) return setError('Ponle un nombre.');
    if (!pilar) return setError('Elige el pilar.');
    const t = objetivo.trim() ? Number(objetivo.replace(',', '.')) : null;
    if (t != null && (!Number.isFinite(t) || t <= 0)) return setError('Revisa el objetivo.');
    const { data, error } = await supabase.from('habit_definitions').insert({
      pillar_id: pilar, module_slug: 'habits', name: nombre.trim(), kind: tipo,
      unit: tipo === 'duration' ? 'min' : tipo === 'number' ? unidad.trim() || null : null,
      default_target: tipo === 'number' || tipo === 'duration' ? t : null,
      short_instruction: instr.trim() || null, rationale: porque.trim() || null,
    }).select('id, name, short_instruction, rationale, kind, unit, default_target, anchor, anchor_offset_minutes, is_archived, pillars(slug, name, position)').single();
    if (error || !data) return setError('No se ha podido crear.');
    onCreado({ ...(data as unknown as Definicion), default_target: t });
  }

  return (
    <Hoja titulo="Hábito nuevo" onCerrar={onCerrar}>
      <p className="text-sm text-texto-suave -mt-2">Queda en el catálogo para usarlo con cualquier paciente.</p>
      <label className="flex flex-col gap-1 text-sm font-semibold">Nombre<input value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Ducha fría al final" className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Pilar
        <select value={pilar} onChange={(e) => setPilar(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white">
          <option value="">Elige…</option>
          {pilares.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-semibold mb-1.5">Cómo lo marca el paciente</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(TIPOS) as Tipo[]).map((t) => <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)} className={`py-2.5 rounded-xl font-semibold text-sm ${tipo === t ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`}>{TIPOS[t]}</button>)}
        </div>
      </fieldset>
      {(tipo === 'number' || tipo === 'duration') && (
        <div className="grid grid-cols-2 gap-2">
          {tipo === 'number' && <label className="flex flex-col gap-1 text-sm font-semibold">Unidad<input value={unidad} maxLength={20} onChange={(e) => setUnidad(e.target.value)} placeholder="vasos, pasos…" className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" /></label>}
          <label className="flex flex-col gap-1 text-sm font-semibold">Objetivo por defecto{tipo === 'duration' ? ' (min)' : ''}<input inputMode="decimal" value={objetivo} onChange={(e) => setObjetivo(e.target.value.replace(/[^\d.,]/g, ''))} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" /></label>
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">Qué hacer, en una línea<input value={instr} maxLength={200} onChange={(e) => setInstr(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Por qué (una o dos frases para el paciente)<textarea value={porque} maxLength={400} onChange={(e) => setPorque(e.target.value)} rows={2} className="font-normal text-base px-3 py-2 border border-borde rounded-xl bg-white" /></label>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <button onClick={crear} className="bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl">Crear y pautar</button>
    </Hoja>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${on ? 'bg-petroleo text-white' : 'bg-white border border-borde'}`}>{children}</button>;
}

function Hoja({ titulo, onCerrar, children, ancho = false }: { titulo: string; onCerrar: () => void; children: React.ReactNode; ancho?: boolean }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6" onClick={onCerrar}>
      <div className={`bg-fondo w-full ${ancho ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-4`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold">{titulo}</h3>
          <button onClick={onCerrar} className="text-petroleo font-bold px-2">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}
