import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Propuestas del asistente pendientes de tu aprobación. Se ven en el Inicio del coach.
// Puedes aprobarlas aquí o en la conversación con Claude. Nada cambia hasta que las apruebas.

type Propuesta = { id: string; kind: string; title: string; rationale: string | null; payload: any; created_at: string; profiles: { full_name: string } | null };
const TIPOS: Record<string, string> = { sesiones: 'Sesiones', cambio_ejercicio: 'Cambio de ejercicio', mensaje: 'Mensaje', habito: 'Hábito' };

function detalle(p: Propuesta) {
  if (p.kind === 'sesiones') {
    const s = (p.payload?.sesiones ?? []) as { name: string; dates: string[] }[];
    const n = s.reduce((t, x) => t + (x.dates?.length ?? 0), 0);
    return `${n} sesión${n === 1 ? '' : 'es'}: ${s.map((x) => `${x.name} (${x.dates.join(', ')})`).join(' · ')}`;
  }
  if (p.kind === 'mensaje') return `«${p.payload?.body ?? ''}»`;
  return '';
}

export default function Propuestas({ supabase }: { supabase: SupabaseClient }) {
  const [lista, setLista] = useState<Propuesta[]>([]);
  const [estado, setEstado] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('assistant_drafts').select('id, kind, title, rationale, payload, created_at, profiles(full_name)').eq('status', 'pendiente').order('created_at');
    setLista((data as unknown as Propuesta[]) ?? []);
  }, [supabase]);
  useEffect(() => { cargar(); }, [cargar]);

  async function decidir(p: Propuesta, aplicar: boolean) {
    const quien = p.profiles?.full_name ?? 'el paciente';
    if (!window.confirm(aplicar ? `¿Aplicar «${p.title}» para ${quien}?` : `¿Descartar «${p.title}»?`)) return;
    const { error } = await supabase.rpc(aplicar ? 'aplicar_propuesta' : 'descartar_propuesta', { p_id: p.id });
    setEstado(error ? `No se ha podido: ${error.message}` : aplicar ? `Aplicada para ${quien}.` : 'Descartada.');
    cargar();
  }

  if (!lista.length && !estado) return null;
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3 border-l-4 border-mostaza" aria-labelledby="propuestas">
      <h3 id="propuestas" className="text-lg font-bold">Propuestas del asistente</h3>
      <p className="text-sm text-texto-suave">Las ha preparado Claude. No llegan al paciente hasta que las apruebas.</p>
      {lista.map((p) => (
        <div key={p.id} className="border-t border-gris-claro pt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{p.profiles?.full_name} <span className="font-normal text-texto-suave">· {TIPOS[p.kind] ?? p.kind}</span></p>
              <p className="text-sm">{p.title}</p>
            </div>
            <button onClick={() => setAbierta(abierta === p.id ? null : p.id)} className="text-petroleo font-semibold underline text-sm">{abierta === p.id ? 'Ocultar' : 'Ver'}</button>
          </div>
          {abierta === p.id && (
            <div className="text-sm bg-fondo rounded-xl p-3 flex flex-col gap-1">
              {p.rationale && <p><strong>Por qué:</strong> {p.rationale}</p>}
              {detalle(p) && <p>{detalle(p)}</p>}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => decidir(p, false)} className="bg-white text-petroleo border-2 border-petroleo font-bold px-4 py-2 rounded-xl">Descartar</button>
            <button onClick={() => decidir(p, true)} className="bg-petroleo text-white font-bold px-4 py-2 rounded-xl">Aplicar</button>
          </div>
        </div>
      ))}
      {estado && <p role="status" className="font-semibold text-petroleo">{estado}</p>}
    </section>
  );
}
