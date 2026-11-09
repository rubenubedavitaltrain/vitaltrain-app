import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Documentos del paciente (núcleo). El coach sube PDFs por pilar; el paciente los abre en «Mis documentos».
// Los archivos están en un almacén privado: se abren con un enlace temporal de una hora.

type Pilar = { id: string; slug: string; name: string; position: number };
type Doc = { id: string; title: string; note: string | null; storage_path: string; size_bytes: number | null; is_shared: boolean; created_at: string; pillar_id: string | null; pillars: { name: string; position: number } | null };

const BUCKET = 'documentos';
const MAX = 20 * 1024 * 1024;
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const tam = (b: number | null) => (b == null ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`);

async function cargar(supabase: SupabaseClient, pacienteId: string): Promise<{ docs: Doc[]; urls: Record<string, string> }> {
  const { data } = await supabase.from('patient_documents')
    .select('id, title, note, storage_path, size_bytes, is_shared, created_at, pillar_id, pillars(name, position)')
    .eq('patient_id', pacienteId).order('created_at', { ascending: false });
  const docs = (data as unknown as Doc[]) ?? [];
  const urls: Record<string, string> = {};
  if (docs.length) {
    const { data: firmadas } = await supabase.storage.from(BUCKET).createSignedUrls(docs.map((d) => d.storage_path), 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls[f.path] = f.signedUrl;
  }
  return { docs, urls };
}

function agrupar(docs: Doc[]) {
  const g = new Map<string, { orden: number; lista: Doc[] }>();
  for (const d of docs) {
    const k = d.pillars?.name ?? 'Otros';
    const e = g.get(k) ?? { orden: d.pillars?.position ?? 9, lista: [] };
    e.lista.push(d); g.set(k, e);
  }
  return [...g.entries()].sort((a, b) => a[1].orden - b[1].orden);
}

/** Pestaña Perfil del paciente. No aparece si no tiene documentos. */
export function MisDocumentos({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [datos, setDatos] = useState<{ docs: Doc[]; urls: Record<string, string> } | null>(null);
  useEffect(() => { cargar(supabase, pacienteId).then(setDatos); }, [supabase, pacienteId]);
  if (!datos || datos.docs.length === 0) return null;
  const nuevo = (d: Doc) => Date.now() - new Date(d.created_at).valueOf() < 7 * 86400000;
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="mis-documentos">
      <div>
        <h2 id="mis-documentos" className="font-bold">Mis documentos</h2>
        <p className="text-xs text-texto-suave">Lo que Rubén te ha preparado. Se abren en PDF.</p>
      </div>
      {agrupar(datos.docs).map(([pilar, { lista }]) => (
        <div key={pilar}>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-petroleo mb-1">{pilar}</h3>
          <ul className="flex flex-col">
            {lista.map((d) => (
              <li key={d.id} className="border-t border-fondo">
                <a href={datos.urls[d.storage_path]} target="_blank" rel="noopener" className="flex items-center gap-3 py-3">
                  <IconoPdf />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold leading-tight">{d.title}{nuevo(d) && <span className="ml-2 text-[10px] font-bold uppercase bg-mostaza text-[#1F2424] rounded px-1.5 py-0.5 align-middle">Nuevo</span>}</span>
                    <span className="block text-xs text-texto-suave">{fecha(d.created_at)}{d.note ? ` · ${d.note}` : ''}</span>
                  </span>
                  <span className="text-petroleo font-bold" aria-hidden="true">›</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Sección de la ficha del paciente en el panel del coach. */
export function DocumentosCoach({ supabase, pacienteId, nombre }: { supabase: SupabaseClient; pacienteId: string; nombre: string }) {
  const [datos, setDatos] = useState<{ docs: Doc[]; urls: Record<string, string> } | null>(null);
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [version, setVersion] = useState(0);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [pilar, setPilar] = useState('');
  const [nota, setNota] = useState('');
  const [compartir, setCompartir] = useState(true);
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error' | 'subiendo'; texto: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { cargar(supabase, pacienteId).then(setDatos); }, [supabase, pacienteId, version]);
  useEffect(() => { supabase.from('pillars').select('id, slug, name, position').order('position').then(({ data }) => setPilares((data as Pilar[]) ?? [])); }, [supabase]);

  function elegir(f: File | null) {
    setEstado(null);
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return setEstado({ tipo: 'error', texto: 'Solo se pueden subir PDF. Si es un Word, guárdalo antes como PDF.' });
    if (f.size > MAX) return setEstado({ tipo: 'error', texto: 'El archivo pasa de 20 MB.' });
    setArchivo(f);
    if (!titulo) setTitulo(f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 120));
  }

  async function subir() {
    if (!archivo) return;
    if (!titulo.trim()) return setEstado({ tipo: 'error', texto: 'Ponle un título.' });
    setEstado({ tipo: 'subiendo', texto: 'Subiendo…' });
    const ruta = `${pacienteId}/${crypto.randomUUID()}.pdf`;
    const up = await supabase.storage.from(BUCKET).upload(ruta, archivo, { contentType: 'application/pdf', upsert: false });
    if (up.error) return setEstado({ tipo: 'error', texto: 'No se ha podido subir el archivo.' });
    const { error } = await supabase.from('patient_documents').insert({
      patient_id: pacienteId, pillar_id: pilar || null, title: titulo.trim(), note: nota.trim() || null,
      storage_path: ruta, size_bytes: archivo.size, is_shared: compartir,
    });
    if (error) {
      await supabase.storage.from(BUCKET).remove([ruta]);
      return setEstado({ tipo: 'error', texto: 'No se ha podido guardar el documento.' });
    }
    setArchivo(null); setTitulo(''); setNota(''); setPilar(''); setCompartir(true);
    if (input.current) input.current.value = '';
    setEstado({ tipo: 'ok', texto: compartir ? `Subido. ${nombre} ya lo ve en su app.` : 'Subido. Aún no lo ve el paciente.' });
    setVersion((v) => v + 1);
  }

  async function cambiarCompartido(d: Doc) {
    await supabase.from('patient_documents').update({ is_shared: !d.is_shared }).eq('id', d.id);
    setVersion((v) => v + 1);
  }

  async function borrar(d: Doc) {
    if (!window.confirm(`¿Borrar «${d.title}»? ${nombre} dejará de verlo. No se puede deshacer.`)) return;
    const { error } = await supabase.from('patient_documents').delete().eq('id', d.id);
    if (error) return setEstado({ tipo: 'error', texto: 'No se ha podido borrar.' });
    await supabase.storage.from(BUCKET).remove([d.storage_path]);
    setVersion((v) => v + 1);
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="documentos-coach">
      <h3 id="documentos-coach" className="text-lg font-bold px-1">Documentos</h3>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <h4 className="font-bold">Subir un PDF</h4>
          <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-borde rounded-xl p-5 text-center cursor-pointer hover:bg-fondo"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); elegir(e.dataTransfer.files[0] ?? null); }}>
            <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
            <IconoPdf />
            <span className="font-semibold">{archivo ? archivo.name : 'Arrastra aquí el PDF o pulsa para elegirlo'}</span>
            <span className="text-xs text-texto-suave">{archivo ? tam(archivo.size) : 'Hasta 20 MB'}</span>
          </label>
          {archivo && (
            <>
              <label className="flex flex-col gap-1 text-sm font-semibold">Título que verá el paciente
                <input value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">Pilar
                <select value={pilar} onChange={(e) => setPilar(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white">
                  <option value="">Sin pilar</option>
                  {pilares.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">Nota para el paciente (opcional)
                <input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: empieza el lunes" className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl" />
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input type="checkbox" checked={compartir} onChange={(e) => setCompartir(e.target.checked)} className="w-5 h-5 accent-[#374949]" />
                Que {nombre} lo vea ya en su app
              </label>
              <button onClick={subir} disabled={estado?.tipo === 'subiendo'} className="bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl disabled:opacity-60">Subir</button>
            </>
          )}
          {estado && <p role={estado.tipo === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${estado.tipo === 'error' ? 'text-[#8A2C1D]' : 'text-petroleo'}`}>{estado.texto}</p>}
          <p className="text-xs text-texto-suave">Para planes, protocolos y material de apoyo. No subas analíticas ni informes con diagnósticos: la historia clínica sigue en su sistema.</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-2">
          <h4 className="font-bold">Lo que tiene</h4>
          {!datos && <p className="text-sm text-texto-suave">Cargando…</p>}
          {datos?.docs.length === 0 && <p className="text-sm text-texto-suave">Aún no hay documentos.</p>}
          <ul className="flex flex-col">
            {datos?.docs.map((d) => (
              <li key={d.id} className="border-t border-fondo py-2.5 flex items-start gap-3">
                <IconoPdf />
                <div className="flex-1 min-w-0">
                  <a href={datos.urls[d.storage_path]} target="_blank" rel="noopener" className="font-semibold hover:underline">{d.title}</a>
                  <div className="text-xs text-texto-suave">{[d.pillars?.name ?? 'Sin pilar', fecha(d.created_at), tam(d.size_bytes)].filter(Boolean).join(' · ')}</div>
                  {d.note && <div className="text-xs">{d.note}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button onClick={() => cambiarCompartido(d)} className={`text-xs font-bold px-2 py-1 rounded-lg ${d.is_shared ? 'bg-fondo text-petroleo' : 'bg-mostaza text-[#1F2424]'}`}>{d.is_shared ? 'Lo ve' : 'Oculto · compartir'}</button>
                  <button onClick={() => borrar(d)} className="text-xs font-semibold text-[#8A2C1D] px-2 py-1">Borrar</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function IconoPdf() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#374949" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
      <text x="12" y="17.5" fontSize="5.5" fontWeight="700" textAnchor="middle" fill="#374949" stroke="none">PDF</text>
    </svg>
  );
}
