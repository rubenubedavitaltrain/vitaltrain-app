import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Paciente } from './Pacientes';
import SemanaCoach from '../../modules/entrenamiento/ficha/SemanaCoach';
import NotasDelPaciente from '../../modules/entrenamiento/ficha/NotasDelPaciente';
import ProgramaPaciente from '../../modules/entrenamiento/ficha/ProgramaPaciente';
import Progreso from '../../modules/entrenamiento/progreso/Progreso';
import Medidas from '../medidas/Medidas';
import { DocumentosCoach } from '../documentos/Documentos';
import ModulosPaciente, { useModulosPaciente } from './ModulosPaciente';
import { RitmoCoach } from '../../modules/circadiano/Ritmo';
import HabitosCoach from '../../modules/habitos/HabitosCoach';

// Ficha del paciente (núcleo). Cada módulo activo aporta su sección.

type Nota = { id: string; body: string; created_at: string };

export default function FichaPaciente({ supabase, paciente, onVolver, onCambio }: {
  supabase: SupabaseClient; paciente: Paciente; onVolver: () => void; onCambio: (p: Paciente) => void;
}) {
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const modulos = useModulosPaciente(supabase, paciente.id);
  const tiene = (m: string) => modulos.activos?.has(m) ?? false;

  async function cambiarEstado(status: Paciente['status']) {
    setError('');
    const { data, error } = await supabase.from('profiles').update({ status }).eq('id', paciente.id).select('id, full_name, email, phone, status, created_at').single();
    if (error) setError('No se ha podido cambiar el estado.');
    else onCambio(data as Paciente);
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onVolver} className="self-start text-petroleo font-bold">← Pacientes</button>
      <header className="bg-white rounded-2xl p-5 flex flex-wrap items-center gap-4">
        <span className="w-12 h-12 rounded-full bg-petroleo text-white text-lg font-bold flex items-center justify-center">{paciente.full_name.charAt(0).toUpperCase()}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-tight">{paciente.full_name}</h2>
          <p className="text-sm text-texto-suave truncate">{paciente.email}{paciente.phone ? ` · ${paciente.phone}` : ''}</p>
          <EstadoConsentimiento supabase={supabase} pacienteId={paciente.id} />
        </div>
        <div className="flex flex-wrap gap-2">
          {paciente.status !== 'active' && <button onClick={() => cambiarEstado('active')} className="bg-petroleo text-white font-bold px-4 py-2 rounded-xl">Activar</button>}
          {paciente.status === 'active' && <button onClick={() => cambiarEstado('paused')} className="bg-white border-2 border-petroleo text-petroleo font-bold px-4 py-2 rounded-xl">Pausar acceso</button>}
          {paciente.status !== 'archived' && <button onClick={() => cambiarEstado('archived')} className="text-texto-suave font-semibold px-3 py-2">Archivar</button>}
        </div>
        {paciente.status !== 'active' && (
          <p className="w-full text-sm text-texto-suave">
            {paciente.status === 'paused' ? 'En pausa: no puede entrar a ver su plan. Sus datos se conservan.' : 'Archivado: no puede entrar. Sus datos se conservan.'}
          </p>
        )}
        {error && <p role="alert" className="w-full font-semibold text-[#8A2C1D]">{error}</p>}
      </header>

      <ProgramaPaciente supabase={supabase} pacienteId={paciente.id} onCambio={() => setVersion((v) => v + 1)} />
      <SemanaCoach key={version} supabase={supabase} pacienteId={paciente.id} nombrePaciente={paciente.full_name.split(' ')[0]} />
      <section className="flex flex-col gap-3" aria-labelledby="progresion">
        <h3 id="progresion" className="text-lg font-bold px-1">Progresión</h3>
        <Progreso key={`p${version}`} supabase={supabase} pacienteId={paciente.id} ancho />
        <div className="grid lg:grid-cols-2 gap-4"><Medidas supabase={supabase} pacienteId={paciente.id} esCoach /></div>
      </section>
      <DocumentosCoach supabase={supabase} pacienteId={paciente.id} nombre={paciente.full_name.split(' ')[0]} />
      {tiene('habits') && <HabitosCoach supabase={supabase} pacienteId={paciente.id} nombre={paciente.full_name.split(' ')[0]} />}
      {tiene('circadian') && <RitmoCoach supabase={supabase} pacienteId={paciente.id} />}
      <ModulosPaciente supabase={supabase} pacienteId={paciente.id} disponibles={modulos.disponibles} activos={modulos.activos} onCambio={modulos.recargar} />
      <div className="grid lg:grid-cols-2 gap-4">
        <NotasDelPaciente supabase={supabase} pacienteId={paciente.id} />
        <NotasPrivadas supabase={supabase} pacienteId={paciente.id} />
      </div>
    </div>
  );
}

function EstadoConsentimiento({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [c, setC] = useState<{ version: string; accepted_at: string; withdrawn_at: string | null; replaced_at: string | null } | null | undefined>(undefined);
  useEffect(() => {
    supabase.from('consents').select('version, accepted_at, withdrawn_at, replaced_at').eq('patient_id', pacienteId).order('accepted_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setC((data as typeof c) ?? null));
  }, [supabase, pacienteId]);
  if (c === undefined) return null;
  const f = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const [texto, color] = !c
    ? ['Consentimiento pendiente: lo verá al entrar por primera vez', 'text-[#8A5A00]']
    : c.withdrawn_at
      ? [`Consentimiento retirado el ${f(c.withdrawn_at)}: no puede usar la app`, 'text-[#8A2C1D]']
      : [`Consentimiento aceptado el ${f(c.accepted_at)} (versión ${c.version})`, 'text-petroleo'];
  return <p className={`text-xs font-semibold mt-1 ${color}`}>{texto}</p>;
}

function NotasPrivadas({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [texto, setTexto] = useState('');

  async function cargar() {
    const { data } = await supabase.from('coach_notes').select('id, body, created_at').eq('patient_id', pacienteId).order('created_at', { ascending: false }).limit(20);
    setNotas((data as Nota[]) ?? []);
  }
  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (!texto.trim()) return;
    const { error } = await supabase.from('coach_notes').insert({ patient_id: pacienteId, body: texto.trim() });
    if (!error) { setTexto(''); cargar(); }
  }

  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="privadas">
      <h3 id="privadas" className="text-lg font-bold">Notas privadas</h3>
      <p className="text-xs text-texto-suave -mt-2">Solo las ves tú. No guardes aquí diagnósticos ni historia clínica.</p>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Ej.: prefiere entrenar por la mañana" className="text-base px-3 py-2 border border-borde rounded-xl" />
      <button onClick={guardar} disabled={!texto.trim()} className="self-start bg-petroleo text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50">Guardar nota</button>
      <ul className="flex flex-col gap-2">
        {notas.map((n) => (
          <li key={n.id} className="text-sm border-t border-fondo pt-2">
            <span className="text-texto-suave">{new Date(n.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · </span>{n.body}
          </li>
        ))}
      </ul>
    </section>
  );
}
