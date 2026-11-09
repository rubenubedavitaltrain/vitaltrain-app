import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Núcleo: qué módulos tiene activos cada paciente. Solo aparecen los módulos disponibles en la plataforma.

type Modulo = { slug: string; name: string; description: string | null };

export function useModulosPaciente(supabase: SupabaseClient, pacienteId: string) {
  const [disponibles, setDisponibles] = useState<Modulo[]>([]);
  const [activos, setActivos] = useState<Set<string> | null>(null);
  async function cargar() {
    const [m, pm] = await Promise.all([
      supabase.from('modules').select('slug, name, description').eq('is_available', true).order('name'),
      supabase.from('patient_modules').select('module_slug').eq('patient_id', pacienteId),
    ]);
    setDisponibles((m.data as Modulo[]) ?? []);
    setActivos(new Set(((pm.data as { module_slug: string }[]) ?? []).map((x) => x.module_slug)));
  }
  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps
  return { disponibles, activos, recargar: cargar };
}

export default function ModulosPaciente({ supabase, pacienteId, disponibles, activos, onCambio }: {
  supabase: SupabaseClient; pacienteId: string; disponibles: Modulo[]; activos: Set<string> | null; onCambio: () => void;
}) {
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  if (!activos) return null;

  async function cambiar(slug: string, on: boolean) {
    setError(''); setOcupado(slug);
    const { error } = on
      ? await supabase.from('patient_modules').insert({ patient_id: pacienteId, module_slug: slug })
      : await supabase.from('patient_modules').delete().eq('patient_id', pacienteId).eq('module_slug', slug);
    setOcupado(null);
    if (error) setError('No se ha podido cambiar.');
    onCambio();
  }

  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="modulos">
      <div>
        <h3 id="modulos" className="text-lg font-bold">Qué ve en su app</h3>
        <p className="text-xs text-texto-suave">Al quitar un módulo, el paciente deja de verlo y de poder anotar en él. Sus datos se conservan.</p>
      </div>
      <ul className="grid sm:grid-cols-2 gap-2">
        {disponibles.map((m) => {
          const on = activos.has(m.slug);
          return (
            <li key={m.slug}>
              <label className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer ${on ? 'bg-fondo' : 'border border-gris-claro'}`}>
                <input type="checkbox" checked={on} disabled={ocupado === m.slug} onChange={(e) => cambiar(m.slug, e.target.checked)} className="mt-0.5 w-5 h-5 accent-[#374949]" />
                <span>
                  <span className="block font-semibold">{m.name}</span>
                  {m.description && <span className="block text-xs text-texto-suave">{m.description}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
    </section>
  );
}
