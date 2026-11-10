import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Linea } from '../../core/graficas';
import { cargarAsignaciones, cargarRespuestas, CRONOTIPOS, type Asignacion, type Cuestionario, type Respuesta } from './datos';

// Módulo de cuestionarios, parte del coach: asignar (cronotipo una vez, check-in cada semana), ver cronotipo y evolución.

const ESCALAS_CHECKIN = [['sueno', 'Sueño'], ['energia', 'Energía'], ['digestion', 'Digestión'], ['estres', 'Estrés'], ['dolor', 'Dolor']] as const;

export default function CuestionariosCoach({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [catalogo, setCatalogo] = useState<Cuestionario[]>([]);
  const [asig, setAsig] = useState<Asignacion[]>([]);
  const [resp, setResp] = useState<Respuesta[]>([]);
  const [crono, setCrono] = useState<{ chronotype: string | null; chronotype_score: number | null } | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    supabase.from('questionnaires').select('id, slug, title, description, schema, version, default_recurrence').eq('is_archived', false).order('title').then(({ data }) => setCatalogo((data as Cuestionario[]) ?? []));
    cargarAsignaciones(supabase, pacienteId, false).then(setAsig);
    cargarRespuestas(supabase, pacienteId).then(setResp);
    supabase.from('patient_settings').select('chronotype, chronotype_score').eq('patient_id', pacienteId).maybeSingle().then(({ data }) => setCrono(data as typeof crono));
  }, [supabase, pacienteId, version]);

  async function cambiar(c: Cuestionario, activa: Asignacion | undefined) {
    setError('');
    const r = activa
      ? await supabase.from('questionnaire_assignments').update({ is_active: false }).eq('id', activa.id)
      : await supabase.from('questionnaire_assignments').insert({ questionnaire_id: c.id, patient_id: pacienteId, recurrence: c.default_recurrence ?? null });
    if (r.error) setError('No se ha podido cambiar.');
    setVersion((v) => v + 1);
  }

  const checkins = resp.filter((r) => asig.find((a) => a.id === r.assignment_id)?.questionnaires.slug === 'checkin-semanal').slice().reverse();
  const ultimos = checkins.slice(-12);
  const otros = resp.filter((r) => !['checkin-semanal'].includes(asig.find((a) => a.id === r.assignment_id)?.questionnaires.slug ?? ''));
  const t = crono?.chronotype ? CRONOTIPOS[crono.chronotype] : null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="cuestionarios-coach">
      <h3 id="cuestionarios-coach" className="text-lg font-bold px-1">Cuestionarios</h3>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 items-start">
        <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <h4 className="font-bold">Qué tiene que responder</h4>
          <ul className="flex flex-col gap-2">
            {catalogo.map((c) => {
              const activa = asig.find((a) => a.questionnaire_id === c.id && a.is_active);
              const respondido = resp.some((r) => r.questionnaire_id === c.id);
              return (
                <li key={c.id}>
                  <label className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer ${activa ? 'bg-fondo' : 'border border-gris-claro'}`}>
                    <input type="checkbox" checked={!!activa} onChange={() => cambiar(c, activa)} className="mt-0.5 w-5 h-5 accent-[#374949]" />
                    <span>
                      <span className="block font-semibold">{c.title}</span>
                      <span className="block text-xs text-texto-suave">{c.default_recurrence === 'weekly' ? 'Cada semana, en su pantalla de Hoy' : 'Una vez'}{respondido ? ' · ya ha respondido' : ''}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {error && <p role="alert" className="text-sm font-semibold text-[#8A2C1D]">{error}</p>}
          <div className="rounded-xl bg-fondo p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-texto-suave">Cronotipo (rMEQ)</div>
            {t ? <><div className="font-bold">{t.nombre} · {crono?.chronotype_score} puntos</div><div className="text-xs text-texto-suave">{t.texto} Escala de 4 a 25 (Adan y Almirall, 1991).</div></>
              : <div className="text-sm text-texto-suave">Aún no lo ha respondido.</div>}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <h4 className="font-bold">Check-in semanal</h4>
          {checkins.length === 0 ? <p className="text-sm text-texto-suave">Sin respuestas todavía.</p> : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ESCALAS_CHECKIN.map(([k, nombre]) => (
                  <div key={k}>
                    <div className="text-xs font-bold uppercase tracking-wide text-texto-suave">{nombre}{k === 'estres' || k === 'dolor' ? ' (más alto = peor)' : ''}</div>
                    <Linea puntos={ultimos.map((r) => ({ x: r.submitted_at.slice(0, 10), y: Number(r.answers[k]), etiqueta: `Semana ${r.period.slice(6)}: ${r.answers[k]} de 5` }))} dominioX={ultimos.map((r) => r.submitted_at.slice(0, 10))} minY={1} maxY={5} unidad="" vacio="Sin datos." />
                  </div>
                ))}
              </div>
              <ul className="text-sm flex flex-col gap-1">
                {checkins.slice().reverse().filter((r) => r.answers.nota).slice(0, 6).map((r) => (
                  <li key={r.id}><span className="text-texto-suave">{new Date(r.submitted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}:</span> {String(r.answers.nota)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      {otros.filter((r) => asig.find((a) => a.id === r.assignment_id)?.questionnaires.slug !== 'rmeq').length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <h4 className="font-bold">Otras respuestas</h4>
          {otros.filter((r) => asig.find((a) => a.id === r.assignment_id)?.questionnaires.slug !== 'rmeq').slice(0, 20).map((r) => {
            const q = asig.find((a) => a.id === r.assignment_id)!.questionnaires;
            return (
              <details key={r.id} className="border-t border-gris-claro pt-2">
                <summary className="cursor-pointer font-semibold">{q.title} <span className="font-normal text-texto-suave">· {new Date(r.submitted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}{r.score != null ? ` · ${r.score} puntos` : ''}</span></summary>
                <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                  {q.schema.questions.map((p) => {
                    const v = r.answers[p.id];
                    const texto = v == null || v === '' ? '—' : p.type === 'single' ? (p.options?.find((o) => o.value === v)?.label ?? String(v)) : p.type === 'scale' ? `${v} (de ${p.min} a ${p.max})` : String(v);
                    return <div key={p.id}><dt className="text-texto-suave">{p.text}</dt><dd className="font-semibold">{texto}</dd></div>;
                  })}
                </dl>
              </details>
            );
          })}
          <p className="text-xs text-texto-suave">Se muestran con las preguntas actuales del cuestionario.</p>
        </div>
      )}
    </section>
  );
}
