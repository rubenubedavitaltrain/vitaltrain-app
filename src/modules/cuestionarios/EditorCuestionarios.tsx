import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pregunta } from './datos';

// Módulo de cuestionarios, parte del coach: crear y editar cuestionarios de consulta sin programar (migración 0028).
// - Los del sistema (cronotipo, check-in) solo se ven.
// - Si un cuestionario ya tiene respuestas, sus preguntas no se cambian: se hace una copia.
// - La base de datos vuelve a comprobarlo todo al guardar.

type Fila = {
  id: string; slug: string; title: string; description: string | null; pillar_id: string | null; schema: { questions: Pregunta[] };
  version: number; is_archived: boolean; is_system: boolean; default_recurrence: 'weekly' | null; respuestas: number;
};
type Pilar = { id: string; name: string };
type Borrador = { id?: string; title: string; description: string; pillar_id: string; semanal: boolean; preguntas: Pregunta[]; bloqueado: boolean };

const TIPOS: Record<Pregunta['type'], string> = { single: 'Elegir una opción', scale: 'Escala', text: 'Texto libre' };

function slugDe(t: string) {
  const base = t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'cuestionario';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
function idLibre(ps: Pregunta[]) { let n = ps.length + 1; while (ps.some((p) => p.id === `p${n}`)) n++; return `p${n}`; }
const nueva = (ps: Pregunta[]): Pregunta => ({ id: idLibre(ps), type: 'scale', text: '', min: 1, max: 5, minLabel: '', maxLabel: '', required: true });

export default function EditorCuestionarios({ supabase }: { supabase: SupabaseClient }) {
  const [lista, setLista] = useState<Fila[]>([]);
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [verArchivados, setVerArchivados] = useState(false);
  const [b, setB] = useState<Borrador | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('questionnaires')
      .select('id, slug, title, description, pillar_id, schema, version, is_archived, is_system, default_recurrence, questionnaire_responses(count)').order('title');
    setLista(((data ?? []) as unknown as (Fila & { questionnaire_responses: { count: number }[] })[])
      .map((f) => ({ ...f, respuestas: f.questionnaire_responses?.[0]?.count ?? 0 })));
  }, [supabase]);
  useEffect(() => { cargar(); supabase.from('pillars').select('id, name').order('position').then(({ data }) => setPilares((data as Pilar[]) ?? [])); }, [cargar, supabase]);

  const abrir = (f: Fila, copia = false) => {
    setError(''); setAviso('');
    setB({
      id: copia ? undefined : f.id, title: copia ? `${f.title} (copia)` : f.title, description: f.description ?? '', pillar_id: f.pillar_id ?? '',
      semanal: f.default_recurrence === 'weekly', preguntas: structuredClone(f.schema.questions), bloqueado: !copia && (f.is_system || f.respuestas > 0),
    });
  };

  const cambiarP = (i: number, cambio: Partial<Pregunta>) => setB((x) => x && ({ ...x, preguntas: x.preguntas.map((p, j) => (j === i ? { ...p, ...cambio } : p)) }));
  const mover = (i: number, d: number) => setB((x) => {
    if (!x) return x;
    const ps = [...x.preguntas]; const j = i + d;
    if (j < 0 || j >= ps.length) return x;
    [ps[i], ps[j]] = [ps[j], ps[i]];
    return { ...x, preguntas: ps };
  });

  function problemas(x: Borrador): string | null {
    if (x.title.trim().length < 2) return 'Ponle un título.';
    if (!x.preguntas.length) return 'Añade al menos una pregunta.';
    for (const [i, p] of x.preguntas.entries()) {
      if (p.text.trim().length < 2) return `La pregunta ${i + 1} no tiene texto.`;
      if (p.type === 'single') {
        const ops = p.options ?? [];
        if (ops.length < 2) return `La pregunta ${i + 1} necesita al menos dos opciones.`;
        if (ops.some((o) => !o.label.trim())) return `Hay una opción sin texto en la pregunta ${i + 1}.`;
        if (new Set(ops.map((o) => o.value)).size !== ops.length) return `En la pregunta ${i + 1} dos opciones tienen los mismos puntos.`;
      }
      if (p.type === 'scale' && !((p.max ?? 0) > (p.min ?? 0) && (p.max ?? 0) - (p.min ?? 0) <= 10)) return `Revisa la escala de la pregunta ${i + 1}.`;
    }
    return null;
  }

  async function guardar() {
    if (!b) return;
    const p = problemas(b);
    if (p) return setError(p);
    setError(''); setGuardando(true);
    const preguntas = b.preguntas.map((q) => {
      const base = { id: q.id, type: q.type, text: q.text.trim(), required: q.type === 'text' ? q.required === true : true };
      if (q.type === 'single') return { ...base, scored: !!q.scored, options: (q.options ?? []).map((o) => ({ label: o.label.trim(), value: Number(o.value) })) };
      if (q.type === 'scale') return { ...base, scored: !!q.scored, min: Number(q.min), max: Number(q.max), minLabel: q.minLabel?.trim() || undefined, maxLabel: q.maxLabel?.trim() || undefined };
      return base;
    });
    const fila = { title: b.title.trim(), description: b.description.trim() || null, pillar_id: b.pillar_id || null, default_recurrence: b.semanal ? 'weekly' : null };
    const { error } = b.id
      ? await supabase.from('questionnaires').update(b.bloqueado ? { title: fila.title, description: fila.description, pillar_id: fila.pillar_id } : { ...fila, schema: { questions: preguntas } }).eq('id', b.id)
      : await supabase.from('questionnaires').insert({ ...fila, slug: slugDe(b.title), schema: { questions: preguntas } });
    setGuardando(false);
    if (error) return setError(error.message.includes('respuestas') ? 'Ya tiene respuestas: haz una copia para cambiar las preguntas.' : `No se ha podido guardar: ${error.message}`);
    setAviso('Guardado.'); setB(null); cargar();
  }

  async function archivar(f: Fila, si: boolean) {
    const { error } = await supabase.from('questionnaires').update({ is_archived: si }).eq('id', f.id);
    if (error) setError('No se ha podido archivar.');
    cargar();
  }

  if (b) {
    const soloLectura = b.bloqueado;
    return (
      <section className="bg-white rounded-2xl p-5 flex flex-col gap-4 max-w-3xl" aria-labelledby="editor-cuestionario">
        <div className="flex items-center justify-between gap-3">
          <h3 id="editor-cuestionario" className="text-lg font-bold">{b.id ? 'Editar cuestionario' : 'Nuevo cuestionario'}</h3>
          <button onClick={() => setB(null)} className="text-sm font-semibold text-texto-suave px-2">Cancelar</button>
        </div>
        {soloLectura && <p className="text-sm bg-fondo rounded-xl p-3">Este cuestionario es del sistema o ya tiene respuestas. Puedes cambiar el título, la descripción y el pilar. Para cambiar las preguntas, haz una copia.</p>}
        <label className="flex flex-col gap-1 text-sm font-semibold">Título (lo ve el paciente)
          <input value={b.title} maxLength={120} onChange={(e) => setB({ ...b, title: e.target.value })} className="px-3 py-2 border border-borde rounded-xl font-normal text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Para qué sirve (lo ve el paciente antes de empezar)
          <textarea value={b.description} maxLength={1000} rows={2} onChange={(e) => setB({ ...b, description: e.target.value })} className="px-3 py-2 border border-borde rounded-xl font-normal text-base" />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">Pilar
            <select value={b.pillar_id} onChange={(e) => setB({ ...b, pillar_id: e.target.value })} className="px-3 py-2 border border-borde rounded-xl font-normal bg-white">
              <option value="">Ninguno</option>
              {pilares.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <fieldset disabled={soloLectura} className="flex flex-col gap-1 text-sm font-semibold">
            <legend className="mb-1">Se responde</legend>
            <div className="flex gap-3 font-normal">
              <label className="flex items-center gap-1.5"><input type="radio" checked={!b.semanal} onChange={() => setB({ ...b, semanal: false })} className="accent-[#374949]" />Una vez</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={b.semanal} onChange={() => setB({ ...b, semanal: true })} className="accent-[#374949]" />Cada semana</label>
            </div>
          </fieldset>
        </div>

        <fieldset disabled={soloLectura} className="flex flex-col gap-3">
          <legend className="font-bold mb-2">Preguntas</legend>
          {b.preguntas.map((p, i) => (
            <div key={p.id} className="border border-gris-claro rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm w-6">{i + 1}.</span>
                <input value={p.text} maxLength={300} placeholder="Escribe la pregunta" onChange={(e) => cambiarP(i, { text: e.target.value })} className="flex-1 min-w-0 px-3 py-2 border border-borde rounded-xl" />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm pl-8">
                <select value={p.type} onChange={(e) => {
                  const t = e.target.value as Pregunta['type'];
                  cambiarP(i, t === 'single' ? { type: t, options: p.options?.length ? p.options : [{ label: '', value: 1 }, { label: '', value: 2 }] }
                    : t === 'scale' ? { type: t, min: p.min ?? 1, max: p.max ?? 5 } : { type: t, scored: false, required: false });
                }} className="px-2 py-1.5 border border-borde rounded-lg bg-white">
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {p.type !== 'text' && <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!p.scored} onChange={(e) => cambiarP(i, { scored: e.target.checked })} className="accent-[#374949]" />Suma puntos</label>}
                {p.type === 'text' && <label className="flex items-center gap-1.5"><input type="checkbox" checked={p.required === true} onChange={(e) => cambiarP(i, { required: e.target.checked })} className="accent-[#374949]" />Obligatoria</label>}
                <span className="flex-1" />
                <button type="button" onClick={() => mover(i, -1)} aria-label="Subir" className="px-2 font-bold text-petroleo">↑</button>
                <button type="button" onClick={() => mover(i, 1)} aria-label="Bajar" className="px-2 font-bold text-petroleo">↓</button>
                <button type="button" onClick={() => setB({ ...b, preguntas: b.preguntas.filter((_, j) => j !== i) })} className="px-2 font-semibold text-[#8A2C1D]">Quitar</button>
              </div>
              {p.type === 'single' && (
                <div className="pl-8 flex flex-col gap-1.5">
                  {(p.options ?? []).map((o, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <input value={o.label} maxLength={120} placeholder={`Opción ${k + 1}`} onChange={(e) => cambiarP(i, { options: p.options!.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })} className="flex-1 min-w-0 px-3 py-1.5 border border-borde rounded-lg" />
                      {p.scored && <input type="number" value={o.value} aria-label="Puntos" onChange={(e) => cambiarP(i, { options: p.options!.map((x, m) => (m === k ? { ...x, value: Number(e.target.value) } : x)) })} className="w-16 px-2 py-1.5 border border-borde rounded-lg" />}
                      <button type="button" disabled={(p.options ?? []).length <= 2} onClick={() => cambiarP(i, { options: p.options!.filter((_, m) => m !== k) })} className="px-2 text-texto-suave disabled:opacity-30" aria-label="Quitar opción">×</button>
                    </div>
                  ))}
                  {(p.options ?? []).length < 12 && (
                    <button type="button" onClick={() => cambiarP(i, { options: [...(p.options ?? []), { label: '', value: Math.max(0, ...(p.options ?? []).map((o) => o.value)) + 1 }] })} className="self-start text-sm font-semibold text-petroleo">+ Opción</button>
                  )}
                  {p.scored && <p className="text-xs text-texto-suave">El número es lo que suma cada opción.</p>}
                </div>
              )}
              {p.type === 'scale' && (
                <div className="pl-8 flex flex-wrap items-center gap-2 text-sm">
                  De <input type="number" value={p.min ?? 1} onChange={(e) => cambiarP(i, { min: Math.round(Number(e.target.value)) })} className="w-16 px-2 py-1.5 border border-borde rounded-lg" />
                  <input value={p.minLabel ?? ''} maxLength={40} placeholder="Nada" onChange={(e) => cambiarP(i, { minLabel: e.target.value })} className="w-28 px-2 py-1.5 border border-borde rounded-lg" />
                  a <input type="number" value={p.max ?? 5} onChange={(e) => cambiarP(i, { max: Math.round(Number(e.target.value)) })} className="w-16 px-2 py-1.5 border border-borde rounded-lg" />
                  <input value={p.maxLabel ?? ''} maxLength={40} placeholder="Mucho" onChange={(e) => cambiarP(i, { maxLabel: e.target.value })} className="w-28 px-2 py-1.5 border border-borde rounded-lg" />
                </div>
              )}
            </div>
          ))}
          {b.preguntas.length < 40 && <button type="button" onClick={() => setB({ ...b, preguntas: [...b.preguntas, nueva(b.preguntas)] })} className="self-start font-semibold text-petroleo">+ Añadir pregunta</button>}
        </fieldset>

        {error && <p role="alert" className="text-sm font-semibold text-[#8A2C1D]">{error}</p>}
        <button onClick={guardar} disabled={guardando} className="self-start bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-xl disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar'}</button>
      </section>
    );
  }

  const visibles = lista.filter((f) => f.is_archived === verArchivados);
  return (
    <section className="flex flex-col gap-4 max-w-3xl" aria-labelledby="mis-cuestionarios">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="mis-cuestionarios" className="text-2xl font-bold">Cuestionarios</h2>
          <p className="text-sm text-texto-suave">Crea los tuyos y asígnalos desde la ficha de cada paciente. La app solo recoge las respuestas: no interpreta ni decide nada.</p>
        </div>
        <button onClick={() => { setError(''); setB({ title: '', description: '', pillar_id: '', semanal: false, preguntas: [nueva([])], bloqueado: false }); }} className="bg-mostaza text-[#1F2424] font-bold px-4 py-2 rounded-xl">Nuevo cuestionario</button>
      </div>
      {aviso && <p role="status" className="font-semibold text-petroleo">{aviso}</p>}
      {error && <p role="alert" className="text-sm font-semibold text-[#8A2C1D]">{error}</p>}
      <ul className="flex flex-col gap-2">
        {visibles.map((f) => (
          <li key={f.id} className="bg-white rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{f.title}{f.is_system && <span className="ml-2 text-[10px] font-bold uppercase bg-fondo rounded px-1.5 py-0.5 align-middle">Sistema</span>}</p>
              <p className="text-xs text-texto-suave">{f.schema.questions.length} preguntas · {f.default_recurrence === 'weekly' ? 'cada semana' : 'una vez'} · {f.respuestas} respuestas{f.version > 1 ? ` · versión ${f.version}` : ''}</p>
            </div>
            <button onClick={() => abrir(f)} className="text-sm font-bold text-petroleo px-2 py-1">{f.is_system || f.respuestas > 0 ? 'Ver' : 'Editar'}</button>
            <button onClick={() => abrir(f, true)} className="text-sm font-bold text-petroleo px-2 py-1">Copiar</button>
            {!f.is_system && <button onClick={() => archivar(f, !f.is_archived)} className="text-sm font-semibold text-texto-suave px-2 py-1">{f.is_archived ? 'Recuperar' : 'Archivar'}</button>}
          </li>
        ))}
        {visibles.length === 0 && <li className="text-sm text-texto-suave">{verArchivados ? 'No hay cuestionarios archivados.' : 'Aún no hay cuestionarios.'}</li>}
      </ul>
      <button onClick={() => setVerArchivados((v) => !v)} className="self-start text-sm font-semibold text-texto-suave">{verArchivados ? 'Ver los activos' : 'Ver archivados'}</button>
    </section>
  );
}
