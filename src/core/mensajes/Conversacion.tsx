import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Conversación coach-paciente (núcleo). La usan la pestaña Mensajes del paciente y la bandeja del coach.
// Se actualiza sola cada 15 s mientras está abierta y al volver a la app. Al abrirla, marca como leído lo recibido.

export type Mensaje = { id: string; patient_id: string; sender_id: string; body: string; read_at: string | null; created_at: string };

export const RESPUESTAS_RAPIDAS = [
  'Muy bien, sigue así.',
  'Gracias por avisar. Lo reviso y te ajusto la sesión.',
  '¿Me cuentas un poco más? ¿Dónde lo notas y desde cuándo?',
  'Si hay dolor, para ese ejercicio y sigue con el resto.',
  'Esta semana prioriza descansar bien.',
];

const hora = (f: string) => new Date(f).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const dia = (f: string) => {
  const d = new Date(f);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

/** Mensajes sin leer para quien está conectado: el paciente ve los del coach; el coach, los de cada paciente. */
export async function contarNoLeidos(supabase: SupabaseClient, yo: string, pacienteId?: string): Promise<number> {
  let q = supabase.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', yo);
  if (pacienteId) q = q.eq('patient_id', pacienteId);
  const { count } = await q;
  return count ?? 0;
}

export default function Conversacion({ supabase, pacienteId, yo, esCoach, alto = 'h-full', onLeidos }: {
  supabase: SupabaseClient; pacienteId: string; yo: string; esCoach: boolean; alto?: string; onLeidos?: () => void;
}) {
  const [lista, setLista] = useState<Mensaje[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const fin = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('messages').select('id, patient_id, sender_id, body, read_at, created_at').eq('patient_id', pacienteId).order('created_at').limit(500);
    if (error) return;
    const ms = (data as Mensaje[]) ?? [];
    setLista(ms);
    if (ms.some((m) => m.sender_id !== yo && !m.read_at)) {
      await supabase.rpc('mark_messages_read', { p_patient: pacienteId });
      onLeidos?.();
    }
  }, [supabase, pacienteId, yo, onLeidos]);

  useEffect(() => {
    setLista(null);
    cargar();
    const t = window.setInterval(cargar, 15000);
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [cargar]);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [lista?.length]);

  async function enviar(cuerpo = texto) {
    const b = cuerpo.trim();
    if (!b) return;
    setError('');
    setEnviando(true);
    const { error } = await supabase.from('messages').insert({ patient_id: pacienteId, sender_id: yo, body: b.slice(0, 4000) });
    setEnviando(false);
    if (error) return setError(navigator.onLine ? 'No se ha podido enviar. Inténtalo de nuevo.' : 'Sin conexión. El mensaje no se ha enviado.');
    setTexto('');
    cargar();
  }

  // Agrupar por día
  const grupos: { dia: string; ms: Mensaje[] }[] = [];
  for (const m of lista ?? []) {
    const d = dia(m.created_at);
    if (grupos[grupos.length - 1]?.dia !== d) grupos.push({ dia: d, ms: [] });
    grupos[grupos.length - 1].ms.push(m);
  }

  return (
    <div className={`flex flex-col min-h-0 ${alto}`}>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-1.5" aria-live="polite">
        {!lista && <p className="text-center text-texto-suave text-sm">Cargando…</p>}
        {lista && lista.length === 0 && (
          <p className="m-auto text-center text-texto-suave text-sm max-w-xs">
            {esCoach ? 'Aún no hay mensajes con este paciente.' : 'Aquí puedes escribir a Rubén: dudas, molestias o cómo te encuentras. Te responderá en cuanto pueda.'}
          </p>
        )}
        {grupos.map((g) => (
          <div key={g.dia} className="flex flex-col gap-1.5">
            <div className="self-center text-[11px] font-semibold text-texto-suave bg-white/70 rounded-full px-3 py-0.5 my-1 first-letter:uppercase">{g.dia}</div>
            {g.ms.map((m) => {
              const mio = m.sender_id === yo;
              return (
                <div key={m.id} className={`max-w-[82%] rounded-2xl px-3.5 py-2 ${mio ? 'self-end bg-petroleo text-white rounded-br-md' : 'self-start bg-white rounded-bl-md'}`}>
                  <p className="whitespace-pre-wrap break-words leading-snug">{m.body}</p>
                  <p className={`text-[10px] mt-0.5 text-right ${mio ? 'text-[#C9D3D3]' : 'text-texto-suave'}`}>
                    {hora(m.created_at)}{mio && esCoach ? (m.read_at ? ' · leído' : ' · enviado') : ''}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={fin} />
      </div>

      {esCoach && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
          {RESPUESTAS_RAPIDAS.map((r) => (
            <button key={r} onClick={() => setTexto(r)} className="shrink-0 text-xs font-semibold bg-white border border-borde rounded-full px-3 py-1.5">{r}</button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="px-3 pb-1 text-sm font-semibold text-[#8A2C1D]">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-2 px-3 pb-3 pt-1">
        <label className="sr-only" htmlFor={`msg-${pacienteId}`}>Mensaje</label>
        <textarea
          id={`msg-${pacienteId}`} value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} maxLength={4000}
          onKeyDown={(e) => { if (esCoach && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escribe un mensaje" className="flex-1 resize-none max-h-32 px-3 py-2.5 border border-borde rounded-2xl bg-white text-base"
        />
        <button type="submit" disabled={enviando || !texto.trim()} className="bg-mostaza text-[#1F2424] font-bold px-4 py-2.5 rounded-2xl disabled:opacity-50">Enviar</button>
      </form>
    </div>
  );
}
