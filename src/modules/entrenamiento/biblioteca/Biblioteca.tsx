import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { duracion, idDeYoutube, miniatura, tituloDeYoutube, urlReproductor } from './youtube';

// Biblioteca de ejercicios del coach: buscar, ver el vídeo vertical, editar, etiquetar,
// añadir un Short pegando su enlace y archivar. Módulo Entrenamiento (Movimiento inteligente).

export type Ejercicio = {
  id: string;
  name: string;
  description: string | null;
  video_provider: 'youtube' | 'bunny' | 'none';
  video_id: string | null;
  duration_seconds: number | null;
  muscle_groups: string[];
  equipment: string[];
  is_archived: boolean;
};

const CAMPOS = 'id, name, description, video_provider, video_id, duration_seconds, muscle_groups, equipment, is_archived';

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lista = (t: string) =>
  [...new Set(t.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))];

export default function Biblioteca({ supabase }: { supabase: SupabaseClient }) {
  const [ejercicios, setEjercicios] = useState<Ejercicio[] | null>(null);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [archivados, setArchivados] = useState(false);
  const [abierto, setAbierto] = useState<Ejercicio | null>(null);
  const [nuevo, setNuevo] = useState(false);

  async function cargar() {
    const { data, error } = await supabase.from('exercises').select(CAMPOS).order('name');
    if (error) setError('No se ha podido cargar la biblioteca. Revisa la conexión.');
    else setEjercicios(data as Ejercicio[]);
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const etiquetas = useMemo(() => {
    const c = new Map<string, number>();
    (ejercicios ?? []).filter((e) => !e.is_archived).forEach((e) => [...e.muscle_groups, ...e.equipment].forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [ejercicios]);

  const visibles = useMemo(() => {
    const q = normal(busca.trim());
    return (ejercicios ?? []).filter(
      (e) =>
        e.is_archived === archivados &&
        (!q || normal(e.name).includes(q) || [...e.muscle_groups, ...e.equipment].some((t) => normal(t).includes(q))) &&
        (!etiqueta || e.muscle_groups.includes(etiqueta) || e.equipment.includes(etiqueta))
    );
  }, [ejercicios, busca, etiqueta, archivados]);

  function actualizarLocal(e: Ejercicio) {
    setEjercicios((prev) => (prev ?? []).map((x) => (x.id === e.id ? e : x)).sort((a, b) => a.name.localeCompare(b.name, 'es')));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Biblioteca de ejercicios</h2>
          <p className="text-sm text-texto-suave">
            {ejercicios ? `${ejercicios.filter((e) => !e.is_archived).length} ejercicios` : 'Cargando…'}
          </p>
        </div>
        <button onClick={() => setNuevo(true)} className="bg-mostaza text-[#1F2424] font-bold px-4 py-3 rounded-xl">
          Añadir ejercicio
        </button>
      </div>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nombre, músculo o material"
        aria-label="Buscar ejercicios"
        className="text-base px-4 py-3 border border-borde rounded-xl bg-white"
      />

      {etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Filtrar por etiqueta">
          {etiquetas.slice(0, 24).map((t) => (
            <button
              key={t}
              onClick={() => setEtiqueta(etiqueta === t ? null : t)}
              aria-pressed={etiqueta === t}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 ${etiqueta === t ? 'bg-petroleo text-white border-petroleo' : 'bg-white border-gris-claro'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-texto-suave self-start">
        <input type="checkbox" checked={archivados} onChange={(e) => setArchivados(e.target.checked)} />
        Ver archivados
      </label>

      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}

      {ejercicios && visibles.length === 0 && (
        <p className="text-texto-suave">No hay ejercicios con ese filtro.</p>
      )}

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {visibles.map((e) => (
          <li key={e.id}>
            <button onClick={() => setAbierto(e)} className="w-full text-left bg-white rounded-2xl overflow-hidden flex flex-col">
              <div className="relative aspect-[9/12] bg-gris-claro">
                {e.video_id && (
                  <img src={miniatura(e.video_id)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                )}
                {e.duration_seconds != null && (
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
                    {duracion(e.duration_seconds)}
                  </span>
                )}
              </div>
              <span className="p-3 text-sm font-semibold leading-snug">{e.name}</span>
            </button>
          </li>
        ))}
      </ul>

      {abierto && (
        <Ficha
          supabase={supabase}
          ejercicio={abierto}
          onCerrar={() => setAbierto(null)}
          onGuardado={(e) => { actualizarLocal(e); setAbierto(null); }}
        />
      )}
      {nuevo && (
        <Nuevo
          supabase={supabase}
          existentes={ejercicios ?? []}
          onCerrar={() => setNuevo(false)}
          onCreado={(e) => { setEjercicios((p) => [...(p ?? []), e].sort((a, b) => a.name.localeCompare(b.name, 'es'))); setNuevo(false); setAbierto(e); }}
        />
      )}
    </div>
  );
}

function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onCerrar}>
      <div className="bg-fondo w-full sm:max-w-3xl max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="text-xl font-bold leading-tight">{titulo}</h3>
          <button onClick={onCerrar} className="text-petroleo font-bold px-2 py-1" aria-label="Cerrar">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Reproductor({ id }: { id: string }) {
  return (
    <div className="mx-auto w-full max-w-[300px] aspect-[9/16] bg-black rounded-2xl overflow-hidden">
      <iframe
        src={urlReproductor(id)}
        title="Vídeo del ejercicio"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  );
}

function Ficha({ supabase, ejercicio, onCerrar, onGuardado }: {
  supabase: SupabaseClient; ejercicio: Ejercicio; onCerrar: () => void; onGuardado: (e: Ejercicio) => void;
}) {
  const [nombre, setNombre] = useState(ejercicio.name);
  const [musculos, setMusculos] = useState(ejercicio.muscle_groups.join(', '));
  const [material, setMaterial] = useState(ejercicio.equipment.join(', '));
  const [indicaciones, setIndicaciones] = useState(ejercicio.description ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(cambios: Partial<Ejercicio>) {
    setGuardando(true);
    setError('');
    const { data, error } = await supabase.from('exercises').update(cambios).eq('id', ejercicio.id).select(CAMPOS).single();
    setGuardando(false);
    if (error) {
      setError(error.code === '23505' ? 'Ya hay otro ejercicio con ese nombre.' : 'No se ha podido guardar.');
      return;
    }
    onGuardado(data as Ejercicio);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre no puede quedar vacío.');
    guardar({ name: nombre.trim(), muscle_groups: lista(musculos), equipment: lista(material), description: indicaciones.trim() || null });
  }

  return (
    <Ventana titulo={ejercicio.name} onCerrar={onCerrar}>
      <div className="grid sm:grid-cols-[300px_1fr] gap-5">
        {ejercicio.video_id ? <Reproductor id={ejercicio.video_id} /> : <div className="text-texto-suave">Sin vídeo</div>}
        <form onSubmit={enviar} className="flex flex-col gap-3">
          <Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} />
          <Campo etiqueta="Grupos musculares" ayuda="Separados por comas. Ej.: glúteo, core" valor={musculos} onCambio={setMusculos} />
          <Campo etiqueta="Material" ayuda="Separado por comas. Ej.: kettlebell, elástico" valor={material} onCambio={setMaterial} />
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Indicaciones para el paciente
            <textarea value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} rows={3} className="font-normal text-base px-3 py-2 border border-borde rounded-xl bg-white" />
          </label>
          {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" disabled={guardando} className="bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60">
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" disabled={guardando} onClick={() => guardar({ is_archived: !ejercicio.is_archived })} className="bg-white text-petroleo border-2 border-petroleo font-bold px-5 py-3 rounded-xl">
              {ejercicio.is_archived ? 'Recuperar' : 'Archivar'}
            </button>
          </div>
          {!ejercicio.is_archived && (
            <p className="text-xs text-texto-suave">Archivar lo quita de la biblioteca sin borrarlo. Los entrenamientos que ya lo usan no cambian.</p>
          )}
        </form>
      </div>
    </Ventana>
  );
}

function Campo({ etiqueta, ayuda, valor, onCambio }: { etiqueta: string; ayuda?: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {etiqueta}
      <input value={valor} onChange={(e) => onCambio(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" />
      {ayuda && <span className="font-normal text-xs text-texto-suave">{ayuda}</span>}
    </label>
  );
}

function Nuevo({ supabase, existentes, onCerrar, onCreado }: {
  supabase: SupabaseClient; existentes: Ejercicio[]; onCerrar: () => void; onCreado: (e: Ejercicio) => void;
}) {
  const [enlace, setEnlace] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const id = idDeYoutube(enlace);
  const repetido = id ? existentes.find((e) => e.video_id === id) : undefined;

  useEffect(() => {
    if (!id || repetido || nombre) return;
    let vivo = true;
    tituloDeYoutube(id).then((t) => { if (vivo && t) setNombre(t); });
    return () => { vivo = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!id) return setError('No reconozco ese enlace. Copia el enlace del Short desde YouTube.');
    if (repetido) return setError(`Ese vídeo ya está en la biblioteca como «${repetido.name}».`);
    if (!nombre.trim()) return setError('Escribe un nombre para el ejercicio.');
    setGuardando(true);
    const { data, error } = await supabase
      .from('exercises')
      .insert({ name: nombre.trim(), video_provider: 'youtube', video_id: id })
      .select(CAMPOS)
      .single();
    setGuardando(false);
    if (error) return setError(error.code === '23505' ? 'Ya hay un ejercicio con ese nombre o ese vídeo.' : 'No se ha podido guardar.');
    onCreado(data as Ejercicio);
  }

  return (
    <Ventana titulo="Añadir ejercicio" onCerrar={onCerrar}>
      <form onSubmit={crear} className="flex flex-col gap-3">
        <Campo etiqueta="Enlace del Short de YouTube" ayuda="Ej.: https://youtube.com/shorts/qygWuOFVg7g. El vídeo debe estar como «Oculto» o «Público», no «Privado»." valor={enlace} onCambio={setEnlace} />
        {id && !repetido && <Reproductor id={id} />}
        <Campo etiqueta="Nombre del ejercicio" valor={nombre} onCambio={setNombre} />
        {repetido && <p className="font-semibold text-[#8A2C1D]">Ese vídeo ya está en la biblioteca como «{repetido.name}».</p>}
        {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
        <button type="submit" disabled={guardando || !id || !!repetido} className="bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl self-start disabled:opacity-60">
          {guardando ? 'Guardando…' : 'Guardar en la biblioteca'}
        </button>
      </form>
    </Ventana>
  );
}
