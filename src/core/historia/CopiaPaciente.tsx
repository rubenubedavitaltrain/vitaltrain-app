import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CAMPOS_CONSULTA, CAMPOS_FICHA, CATEGORIAS, MODALIDADES, fechaLarga, registrar, type Adenda, type Consulta, type DocClinico, type Ficha } from './datos';

// Copia de la historia clínica para entregar al paciente (derecho de acceso, art. 15 RGPD y art. 18 Ley 41/2002).
// Documento legible: ficha, consultas cerradas con sus adendas y lista de documentos clínicos.
// Se descarga en PDF con «Imprimir → Guardar como PDF». Queda anotado en el registro de accesos.
// Los borradores no salen: aún no son parte de la historia. Los archivos clínicos se entregan aparte.

export default function CopiaPaciente({ supabase, paciente, onCerrar }: {
  supabase: SupabaseClient; paciente: { id: string; full_name: string }; onCerrar: () => void;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [adendas, setAdendas] = useState<Adenda[]>([]);
  const [docs, setDocs] = useState<DocClinico[]>([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [f, c, a, d] = await Promise.all([
        supabase.from('clinical_records').select('*').eq('patient_id', paciente.id).maybeSingle(),
        supabase.from('consultations').select('*').eq('patient_id', paciente.id).eq('status', 'closed').order('happened_at'),
        supabase.from('consultation_addenda').select('id, consultation_id, text, created_at').eq('patient_id', paciente.id).order('created_at'),
        supabase.from('clinical_documents').select('id, category, title, document_date, note, storage_path, size_bytes, mime, created_at').eq('patient_id', paciente.id).order('document_date'),
      ]);
      if (f.error || c.error || a.error || d.error) setError('No se ha podido cargar toda la historia. Comprueba la conexión y vuelve a abrirla.');
      setFicha((f.data as Ficha) ?? null);
      setConsultas((c.data as Consulta[]) ?? []);
      setAdendas((a.data as Adenda[]) ?? []);
      setDocs((d.data as DocClinico[]) ?? []);
      setCargado(true);
      await registrar(supabase, paciente.id, 'exportar', 'historia');
    })();
  }, [supabase, paciente.id]);

  const hoy = fechaLarga(new Date().toISOString());
  const camposFicha = ficha ? CAMPOS_FICHA.filter((c) => ficha[c.clave]?.trim()) : [];

  return (
    <div role="dialog" aria-modal="true" aria-label="Copia de la historia clínica" className="fixed inset-0 z-[60] bg-fondo overflow-y-auto">
      <div className="no-print sticky top-0 z-10 bg-petroleo text-white px-4 py-3 flex flex-wrap items-center gap-2">
        <button onClick={onCerrar} className="font-semibold">← Historia</button>
        <span className="font-bold">Copia para el paciente</span>
        <div className="flex-1" />
        <button onClick={() => window.print()} disabled={!cargado || !!error} className="bg-white text-petroleo font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">PDF</button>
      </div>
      <div className="max-w-3xl mx-auto p-4">
        <p className="no-print text-sm text-texto-suave mb-3">
          Pulsa «PDF» y elige «Guardar como PDF». Envíaselo al paciente por un canal seguro y anota la fecha de entrega.
          Los archivos de «Documentos clínicos» se le entregan aparte. Tienes un mes desde que lo pide.
        </p>
        {error && <p role="alert" className="no-print font-semibold text-[#8A2C1D] mb-3">{error}</p>}
        {!cargado ? <p className="text-texto-suave">Cargando…</p> : (
          <article id="imprimir" className="bg-white rounded-2xl p-5 sm:p-8 flex flex-col gap-6 print:rounded-none print:p-0 text-[15px] leading-relaxed">
            <header className="border-b-2 border-petroleo pb-4">
              <p className="text-xs text-texto-suave">Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433</p>
              <h1 className="text-2xl font-bold mt-2">Copia de la historia clínica</h1>
              <p className="font-semibold">{paciente.full_name}</p>
              <p className="text-sm text-texto-suave">Emitida el {hoy}, a petición del paciente.</p>
            </header>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">Ficha clínica</h2>
              {camposFicha.length === 0 ? <p className="text-texto-suave">Sin datos en la ficha.</p> : camposFicha.map((c) => (
                <div key={c.clave}>
                  <h3 className="font-semibold">{c.titulo}</h3>
                  <p className="whitespace-pre-wrap">{ficha![c.clave]}</p>
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">Consultas ({consultas.length})</h2>
              {consultas.length === 0 && <p className="text-texto-suave">Sin consultas cerradas.</p>}
              {consultas.map((c) => (
                <div key={c.id} className="border-t border-gris-claro pt-3 break-inside-avoid">
                  <h3 className="font-bold">{fechaLarga(c.happened_at)} · {MODALIDADES[c.modality]}{c.duration_minutes ? ` · ${c.duration_minutes} min` : ''}</h3>
                  {CAMPOS_CONSULTA.filter((k) => c[k.clave]?.trim()).map((k) => (
                    <div key={k.clave} className="mt-1.5">
                      <p className="font-semibold text-sm">{k.titulo}</p>
                      <p className="whitespace-pre-wrap">{c[k.clave]}</p>
                    </div>
                  ))}
                  {c.next_review && <p className="mt-1.5 text-sm">Próxima revisión: {fechaLarga(c.next_review)}</p>}
                  {adendas.filter((a) => a.consultation_id === c.id).map((a) => (
                    <p key={a.id} className="mt-1.5 text-sm"><span className="font-semibold">Adenda del {fechaLarga(a.created_at)}:</span> {a.text}</p>
                  ))}
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">Documentos clínicos ({docs.length})</h2>
              {docs.length === 0 ? <p className="text-texto-suave">Ninguno.</p> : (
                <ul className="list-disc pl-5">
                  {docs.map((d) => (
                    <li key={d.id}>{d.title} · {CATEGORIAS[d.category]}{d.document_date ? ` · ${fechaLarga(d.document_date)}` : ''}</li>
                  ))}
                </ul>
              )}
              {docs.length > 0 && <p className="text-sm text-texto-suave">Los archivos se entregan junto a esta copia.</p>}
            </section>

            <footer className="border-t border-gris-claro pt-3 text-xs text-texto-suave">
              Documento confidencial con datos de salud. Para cualquier duda o para ejercer otros derechos: info@vitaltrain.com.
            </footer>
          </article>
        )}
      </div>
    </div>
  );
}
