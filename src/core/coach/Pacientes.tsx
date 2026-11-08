import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import FichaPaciente from './FichaPaciente';

// Lista de pacientes y alta. El alta la hace una función de servidor (alta-paciente),
// porque crear cuentas de acceso necesita la clave de servicio, que nunca va en la app.

export type Paciente = { id: string; full_name: string; email: string; phone: string | null; status: 'active' | 'paused' | 'archived'; created_at: string };

const ESTADO: Record<Paciente['status'], string> = { active: 'Activo', paused: 'En pausa', archived: 'Archivado' };

export default function Pacientes({ supabase }: { supabase: SupabaseClient }) {
  const [lista, setLista] = useState<Paciente[] | null>(null);
  const [abierto, setAbierto] = useState<Paciente | null>(null);
  const [alta, setAlta] = useState(false);
  const [verArchivados, setVerArchivados] = useState(false);

  async function cargar() {
    const { data } = await supabase.from('profiles').select('id, full_name, email, phone, status, created_at').eq('role', 'patient').order('full_name');
    setLista((data as Paciente[]) ?? []);
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (abierto) {
    return <FichaPaciente supabase={supabase} paciente={abierto} onVolver={() => { setAbierto(null); cargar(); }} onCambio={(p) => setAbierto(p)} />;
  }

  const visibles = (lista ?? []).filter((p) => (verArchivados ? p.status === 'archived' : p.status !== 'archived'));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Pacientes</h2>
          <p className="text-sm text-texto-suave">{lista ? `${lista.filter((p) => p.status === 'active').length} activos` : 'Cargando…'}</p>
        </div>
        <button onClick={() => setAlta(true)} className="bg-mostaza text-[#1F2424] font-bold px-4 py-3 rounded-xl">Dar de alta</button>
      </div>
      {lista && visibles.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-texto-suave">
          {verArchivados ? 'No hay pacientes archivados.' : 'Aún no hay pacientes. Da de alta al primero: recibirá un código en su email para entrar.'}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {visibles.map((p) => (
          <li key={p.id}>
            <button onClick={() => setAbierto(p)} className="w-full text-left bg-white rounded-2xl px-5 py-4 flex items-center gap-4">
              <span className="w-10 h-10 rounded-full bg-petroleo text-white font-bold flex items-center justify-center shrink-0">{p.full_name.charAt(0).toUpperCase()}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold truncate">{p.full_name}</span>
                <span className="block text-sm text-texto-suave truncate">{p.email}</span>
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.status === 'active' ? 'bg-[#E4EEE9] text-petroleo' : 'bg-gris-claro text-texto-suave'}`}>{ESTADO[p.status]}</span>
            </button>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2 text-sm text-texto-suave self-start">
        <input type="checkbox" checked={verArchivados} onChange={(e) => setVerArchivados(e.target.checked)} />
        Ver archivados
      </label>
      {alta && <Alta supabase={supabase} onCerrar={() => setAlta(false)} onCreado={() => { setAlta(false); cargar(); }} />}
    </div>
  );
}

function Alta({ supabase, onCerrar, onCreado }: { supabase: SupabaseClient; onCerrar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke('alta-paciente', { body: { full_name: nombre, email, phone: telefono } });
    setEnviando(false);
    if (error) {
      let msg = 'No se ha podido dar de alta. Inténtalo de nuevo.';
      try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* sin detalle */ }
      return setError(msg);
    }
    if (data?.id) onCreado();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Dar de alta a un paciente" className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6" onClick={onCerrar}>
      <form onSubmit={enviar} className="bg-fondo w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold">Dar de alta a un paciente</h3>
        <label className="flex flex-col gap-1 text-sm font-semibold">Nombre y apellidos
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Email
          <input required type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Teléfono (opcional)
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="font-normal text-base px-3 py-2.5 border border-borde rounded-xl bg-white" />
        </label>
        <p className="text-xs text-texto-suave">El paciente entrará escribiendo este email: le llegará un código de 6 dígitos. No necesita contraseña.</p>
        {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCerrar} className="px-4 py-3 font-bold text-petroleo">Cancelar</button>
          <button type="submit" disabled={enviando} className="bg-mostaza text-[#1F2424] font-bold px-5 py-3 rounded-xl disabled:opacity-60">{enviando ? 'Creando…' : 'Dar de alta'}</button>
        </div>
      </form>
    </div>
  );
}
