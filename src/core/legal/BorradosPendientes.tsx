import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Pacientes con los datos de la app bloqueados hace más de cinco años (migración 0023).
// La app nunca borra sola: solo avisa aquí. Rubén revisa y autoriza cada borrado, uno a uno.
// Solo aparece con la sesión de doble factor y si hay alguien pendiente.

type Pendiente = { patient_id: string; nombre: string; motivo: 'baja' | 'consentimiento_retirado'; bloqueado_desde: string; tiene_historia: boolean };

export default function BorradosPendientes({ supabase }: { supabase: SupabaseClient }) {
  const [lista, setLista] = useState<Pendiente[]>([]);
  const [estado, setEstado] = useState('');
  const [comprobado, setComprobado] = useState<Record<string, boolean>>({});

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc('pendientes_de_borrar');
    setLista((data as Pendiente[]) ?? []);
  }, [supabase]);
  useEffect(() => { cargar(); }, [cargar]);

  async function autorizar(p: Pendiente) {
    const que = p.tiene_historia
      ? 'Se borrarán sus datos de la app (entrenamientos, registros, mensajes). Su historia clínica se queda.'
      : 'Se borrarán sus datos de la app y su cuenta. No tiene historia clínica.';
    if (!window.confirm(`Borrar los datos bloqueados de ${p.nombre}.\n\n${que}\n\nNo se puede deshacer. ¿Autorizas el borrado?`)) return;
    const { error } = await supabase.rpc('borrar_datos_bloqueados', { p_patient: p.patient_id });
    setEstado(error ? `No se ha borrado: ${error.message}` : `Borrados los datos de ${p.nombre}. Queda anotado con tu autorización.`);
    cargar();
  }

  if (!lista.length && !estado) return null;
  const f = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3 border-l-4 border-mostaza" aria-labelledby="borrados">
      <h3 id="borrados" className="text-lg font-bold">Datos bloqueados hace más de cinco años</h3>
      <div className="text-sm flex flex-col gap-1.5">
        <p><span className="font-semibold">Qué dice la norma:</span> el artículo 32 de la LOPDGDD y el apartado 6 de las condiciones de la app (versión 1.4). Tras la baja o la retirada del consentimiento, los datos se guardan bloqueados solo mientras puedan reclamarse responsabilidades, cinco años, y después se suprimen.</p>
        <p><span className="font-semibold">Qué deberías hacer:</span> comprobar que con ese paciente no hay ninguna reclamación, juicio ni petición de la AEPD o de un juzgado abierta. Si la hay, no borres y consúltalo con tu asesora. Si no, autoriza el borrado.</p>
        <p>No se borra nada sin tu autorización. La historia clínica nunca se borra.</p>
      </div>
      {lista.map((p) => (
        <div key={p.patient_id} className="flex flex-wrap items-center gap-3 border-t border-gris-claro pt-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{p.nombre}</p>
            <p className="text-sm text-texto-suave">
              {p.motivo === 'baja' ? 'De baja' : 'Retiró el consentimiento'} desde el {f(p.bloqueado_desde)} · {p.tiene_historia ? 'tiene historia clínica (no se toca)' : 'sin historia clínica'}
            </p>
          </div>
          <label className="w-full flex gap-2 items-start text-sm cursor-pointer">
            <input type="checkbox" checked={!!comprobado[p.patient_id]} onChange={(e) => setComprobado((c) => ({ ...c, [p.patient_id]: e.target.checked }))} className="mt-0.5 w-5 h-5 shrink-0 accent-[#374949]" />
            <span>He comprobado que con este paciente no hay ninguna reclamación ni proceso abierto.</span>
          </label>
          <button onClick={() => autorizar(p)} disabled={!comprobado[p.patient_id]} className="bg-white border-2 border-[#8A2C1D] text-[#8A2C1D] font-bold px-4 py-2 rounded-xl disabled:opacity-40">Autorizar el borrado</button>
        </div>
      ))}
      {estado && <p role="status" className="font-semibold text-petroleo">{estado}</p>}
    </section>
  );
}
