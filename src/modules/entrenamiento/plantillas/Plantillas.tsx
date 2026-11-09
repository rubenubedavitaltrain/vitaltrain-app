import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import EditorBloques, { type Bloque, COLUMNAS_ITEM, aGuardar, bloqueVacio, desdeFilas } from '../constructor/Bloques';

// Plantillas de entrenamiento por bloques. El coach las crea aquí y luego las asigna a un día del paciente.
// Asignar hace una copia: cambiar la plantilla después no cambia lo ya asignado.

export { TIPOS, DESCANSOS, textoDescanso } from '../constructor/Bloques';

type Resumen = { id: string; name: string; description: string | null; updated_at: string; ejercicios: number };

export default function Plantillas({ supabase }: { supabase: SupabaseClient }) {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [editando, setEditando] = useState<string | 'nueva' | null>(null);

  async function cargar() {
    const { data } = await supabase
      .from('templates')
      .select('id, name, description, updated_at, template_blocks(template_items(count))')
      .eq('is_archived', false)
      .order('name');
    setLista(
      ((data ?? []) as unknown as { id: string; name: string; description: string | null; updated_at: string; template_blocks: { template_items: { count: number }[] }[] }[]).map((t) => ({
        id: t.id, name: t.name, description: t.description, updated_at: t.updated_at,
        ejercicios: t.template_blocks.reduce((s, b) => s + (b.template_items[0]?.count ?? 0), 0)
      }))
    );
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (editando) {
    return <Editor supabase={supabase} id={editando === 'nueva' ? null : editando} onSalir={() => { setEditando(null); cargar(); }} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Plantillas de entrenamiento</h2>
          <p className="text-sm text-texto-suave">Entrenamientos por bloques que luego asignas a tus pacientes.</p>
        </div>
        <button onClick={() => setEditando('nueva')} className="bg-mostaza text-[#1F2424] font-bold px-4 py-3 rounded-xl">Nueva plantilla</button>
      </div>
      {!lista && <p className="text-texto-suave">Cargando…</p>}
      {lista && lista.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-texto-suave">Aún no tienes plantillas. Crea la primera con «Nueva plantilla».</div>
      )}
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lista?.map((t) => (
          <li key={t.id}>
            <button onClick={() => setEditando(t.id)} className="w-full text-left bg-white rounded-2xl p-5 flex flex-col gap-1">
              <span className="text-lg font-bold">{t.name}</span>
              <span className="text-sm text-texto-suave">{t.ejercicios} ejercicios{t.description ? ` · ${t.description}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Editor({ supabase, id, onSalir }: { supabase: SupabaseClient; id: string | null; onSalir: () => void }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [bloques, setBloques] = useState<Bloque[]>(id ? [] : [bloqueVacio('Bloque principal')]);
  const [cargando, setCargando] = useState(!!id);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase
      .from('templates')
      .select(`name, description, template_blocks(position, name, type, rounds, template_items(${COLUMNAS_ITEM}))`)
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const t = data as unknown as { name: string; description: string | null; template_blocks: (Parameters<typeof desdeFilas>[0][number] & { template_items: Parameters<typeof desdeFilas>[0][number]['items'] })[] } | null;
        if (!t) return;
        setNombre(t.name);
        setDescripcion(t.description ?? '');
        setBloques(desdeFilas(t.template_blocks.map((b) => ({ ...b, items: b.template_items }))));
        setCargando(false);
      });
  }, [id, supabase]);

  async function guardar() {
    setError('');
    setMensaje('');
    if (!nombre.trim()) return setError('Ponle un nombre a la plantilla.');
    if (!bloques.some((b) => b.items.length)) return setError('Añade al menos un ejercicio.');
    const p = {
      id, name: nombre, description: descripcion,
      blocks: aGuardar(bloques)
    };
    setGuardando(true);
    const { error } = await supabase.rpc('save_template', { p });
    setGuardando(false);
    if (error) return setError('No se ha podido guardar. Revisa los datos e inténtalo de nuevo.');
    onSalir();
  }

  async function archivar() {
    if (!id) return onSalir();
    const { error } = await supabase.from('templates').update({ is_archived: true }).eq('id', id);
    if (error) setError('No se ha podido archivar.');
    else onSalir();
  }

  if (cargando) return <p className="text-texto-suave">Cargando…</p>;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <button onClick={onSalir} className="self-start text-petroleo font-bold">← Plantillas</button>
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Nombre de la plantilla
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Fuerza A · Tren inferior" className="font-normal text-lg px-3 py-2.5 border border-borde rounded-xl" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Descripción (opcional, solo para ti)
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl" />
        </label>
      </div>

      <EditorBloques supabase={supabase} bloques={bloques} setBloques={setBloques} />

      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gris-claro px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex gap-2 justify-end z-40">
        {id && <button onClick={archivar} className="mr-auto text-texto-suave font-semibold px-3">Archivar</button>}
        <button onClick={onSalir} className="px-4 py-3 font-bold text-petroleo">Cancelar</button>
        <button onClick={guardar} disabled={guardando} className="bg-mostaza text-[#1F2424] font-bold px-6 py-3 rounded-xl disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar plantilla'}</button>
      </div>

    </div>
  );
}
