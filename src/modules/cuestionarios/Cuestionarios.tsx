import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarAsignaciones, cargarRespuestas, pendientes, CRONOTIPOS, type Asignacion, type Pregunta, type Respuesta } from './datos';

// Módulo de cuestionarios, parte del paciente: tarjeta en Hoy con lo pendiente y pantalla para responder.

export function TarjetaCuestionarios({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [asig, setAsig] = useState<Asignacion[] | null>(null);
  const [resp, setResp] = useState<Respuesta[]>([]);
  const [abierto, setAbierto] = useState<Asignacion | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const cargar = () => { cargarAsignaciones(supabase, pacienteId).then(setAsig); cargarRespuestas(supabase, pacienteId).then(setResp); };
  useEffect(cargar, [supabase, pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!asig) return null;
  const lista = pendientes(asig, resp);
  if (abierto) return <Responder supabase={supabase} pacienteId={pacienteId} asignacion={abierto} onCerrar={() => setAbierto(null)} onHecho={(t) => { setAbierto(null); setHecho(t); cargar(); }} />;
  if (lista.length === 0 && !hecho) return null;
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="cuestionarios-hoy">
      <h2 id="cuestionarios-hoy" className="text-xs font-bold tracking-wide text-texto-suave">CUESTIONARIOS</h2>
      {hecho && <p role="status" className="bg-fondo rounded-xl p-3 text-sm">{hecho}</p>}
      {lista.map((a) => (
        <button key={a.id} onClick={() => setAbierto(a)} className="w-full text-left rounded-xl border-l-4 border-mostaza bg-[#F4F1E4] px-4 py-3 flex items-center justify-between gap-3">
          <span>
            <span className="block font-bold">{a.questionnaires.title}</span>
            <span className="block text-xs text-texto-suave">{a.recurrence === 'weekly' ? 'Esta semana · 1 minuto' : `${a.questionnaires.schema.questions.length} preguntas`}</span>
          </span>
          <span className="text-petroleo font-bold" aria-hidden="true">›</span>
        </button>
      ))}
    </section>
  );
}

function Responder({ supabase, pacienteId, asignacion, onCerrar, onHecho }: { supabase: SupabaseClient; pacienteId: string; asignacion: Asignacion; onCerrar: () => void; onHecho: (t: string) => void }) {
  const c = asignacion.questionnaires;
  const [resp, setResp] = useState<Record<string, number | string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const faltan = c.schema.questions.filter((p) => p.type !== 'text' && (p.required ?? true) && resp[p.id] === undefined);

  async function enviar() {
    setError('');
    if (faltan.length) return setError(`Falta responder ${faltan.length === 1 ? 'una pregunta' : `${faltan.length} preguntas`}.`);
    setEnviando(true);
    const answers = Object.fromEntries(Object.entries(resp).filter(([, v]) => v !== ''));
    const { data, error } = await supabase.from('questionnaire_responses').insert({
      assignment_id: asignacion.id, questionnaire_id: c.id, questionnaire_version: c.version, patient_id: pacienteId, period: 'auto', answers,
    }).select('score').single();
    setEnviando(false);
    if (error) return setError(/duplicate|unique/i.test(error.message) ? 'Ya lo habías enviado.' : navigator.onLine ? 'No se ha podido enviar.' : 'Necesitas conexión para enviarlo.');
    if (c.slug === 'rmeq') {
      const { data: aj } = await supabase.from('patient_settings').select('chronotype').eq('patient_id', pacienteId).maybeSingle();
      const t = CRONOTIPOS[(aj as { chronotype: string } | null)?.chronotype ?? ''];
      return onHecho(t ? `Tu cronotipo: ${t.nombre} (${(data as { score: number }).score} puntos). ${t.texto} Rubén lo tendrá en cuenta para tus horarios.` : 'Enviado. Gracias.');
    }
    onHecho('Enviado. Gracias: Rubén lo verá antes de tu próxima revisión.');
  }

  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-5" aria-labelledby="responder">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="responder" className="text-xl font-bold">{c.title}</h2>
          {c.description && <p className="text-sm text-texto-suave mt-1">{c.description}</p>}
          {asignacion.coach_note && <p className="text-sm bg-fondo rounded-lg px-3 py-2 mt-2"><b>Rubén:</b> {asignacion.coach_note}</p>}
        </div>
        <button onClick={onCerrar} className="text-petroleo font-bold px-1">Cerrar</button>
      </div>
      {c.schema.questions.map((p, i) => <PreguntaUI key={p.id} n={i + 1} p={p} valor={resp[p.id]} onCambio={(v) => setResp((r) => ({ ...r, [p.id]: v }))} />)}
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <button onClick={enviar} disabled={enviando} className="bg-mostaza text-[#1F2424] font-bold py-3.5 rounded-2xl disabled:opacity-60">{enviando ? 'Enviando…' : 'Enviar'}</button>
    </section>
  );
}

function PreguntaUI({ n, p, valor, onCambio }: { n: number; p: Pregunta; valor: number | string | undefined; onCambio: (v: number | string) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-semibold mb-2">{n}. {p.text}</legend>
      {p.type === 'single' && p.options?.map((o) => (
        <button key={o.label} type="button" onClick={() => onCambio(o.value)} aria-pressed={valor === o.value}
          className={`text-left px-4 py-3 rounded-xl ${valor === o.value ? 'bg-petroleo text-white font-semibold' : 'bg-fondo'}`}>{o.label}</button>
      ))}
      {p.type === 'scale' && (
        <div>
          <div className="flex gap-1.5">
            {Array.from({ length: (p.max ?? 5) - (p.min ?? 1) + 1 }, (_, i) => (p.min ?? 1) + i).map((v) => (
              <button key={v} type="button" onClick={() => onCambio(v)} aria-pressed={valor === v} className={`flex-1 py-3 rounded-xl font-bold ${valor === v ? 'bg-petroleo text-white' : 'bg-fondo'}`}>{v}</button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-texto-suave mt-1"><span>{p.minLabel}</span><span>{p.maxLabel}</span></div>
        </div>
      )}
      {p.type === 'text' && (
        <textarea rows={3} value={(valor as string) ?? ''} onChange={(e) => onCambio(e.target.value.slice(0, 1000))} className="text-base px-3 py-2 border border-borde rounded-xl" />
      )}
    </fieldset>
  );
}
