import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Doble factor para la historia clínica. La base de datos solo deja ver la historia con una sesión "aal2":
// código por email (primer factor) + código de una app de autenticación (segundo factor).
// La primera vez se configura con un QR; después solo se pide el código de 6 dígitos de la app.

type Estado = { tipo: 'cargando' } | { tipo: 'ok' } | { tipo: 'pedir'; factorId: string } | { tipo: 'configurar' } | { tipo: 'error'; texto: string };

export default function ConDobleFactor({ supabase, children }: { supabase: SupabaseClient; children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  async function comprobar() {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return setEstado({ tipo: 'error', texto: 'No se ha podido comprobar la sesión.' });
    if (data.currentLevel === 'aal2') return setEstado({ tipo: 'ok' });
    const { data: f } = await supabase.auth.mfa.listFactors();
    const totp = f?.totp?.find((x) => x.status === 'verified');
    setEstado(totp ? { tipo: 'pedir', factorId: totp.id } : { tipo: 'configurar' });
  }
  useEffect(() => { comprobar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (estado.tipo === 'ok') return <>{children}</>;
  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl p-6 flex flex-col gap-4 mt-6">
      <div>
        <h2 className="text-xl font-bold">Historia clínica protegida</h2>
        <p className="text-sm text-texto-suave mt-1">Para ver datos clínicos hace falta un segundo código, de una app de autenticación en tu móvil. Así, aunque alguien entrara en tu email, no podría abrir las historias.</p>
      </div>
      {estado.tipo === 'cargando' && <p className="text-texto-suave">Comprobando…</p>}
      {estado.tipo === 'error' && <p role="alert" className="font-semibold text-[#8A2C1D]">{estado.texto}</p>}
      {estado.tipo === 'pedir' && <PedirCodigo supabase={supabase} factorId={estado.factorId} onOk={comprobar} />}
      {estado.tipo === 'configurar' && <Configurar supabase={supabase} onOk={comprobar} />}
    </div>
  );
}

function CampoCodigo({ onEnviar, ocupado }: { onEnviar: (c: string) => void; ocupado: boolean }) {
  const [codigo, setCodigo] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (codigo.length === 6) onEnviar(codigo); }} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Código de la app (6 dígitos)
        <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          className="text-2xl tracking-[0.4em] text-center font-bold px-3 py-3 border border-borde rounded-xl" />
      </label>
      <button disabled={codigo.length !== 6 || ocupado} className="bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl disabled:opacity-50">{ocupado ? 'Comprobando…' : 'Entrar'}</button>
    </form>
  );
}

function PedirCodigo({ supabase, factorId, onOk }: { supabase: SupabaseClient; factorId: string; onOk: () => void }) {
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function enviar(code: string) {
    setOcupado(true); setError('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setOcupado(false);
    if (error) return setError('Código incorrecto o caducado. Usa el que aparece ahora en la app.');
    onOk();
  }
  return (
    <>
      <p className="text-sm">Abre tu app de autenticación y escribe el código de <b>Vitaltrain</b>.</p>
      <CampoCodigo onEnviar={enviar} ocupado={ocupado} />
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
    </>
  );
}

function Configurar({ supabase, onOk }: { supabase: SupabaseClient; onOk: () => void }) {
  const [alta, setAlta] = useState<{ id: string; qr: string; secreto: string } | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function empezar() {
    setError('');
    // Si quedó un intento a medias, se borra antes de empezar otro
    const { data: f } = await supabase.auth.mfa.listFactors();
    for (const x of f?.all ?? []) if (x.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Vitaltrain', issuer: 'Vitaltrain' });
    if (error || !data) return setError('No se ha podido empezar. Comprueba que el doble factor está activado en Supabase.');
    setAlta({ id: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
  }

  async function verificar(code: string) {
    if (!alta) return;
    setOcupado(true); setError('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: alta.id, code });
    setOcupado(false);
    if (error) return setError('El código no coincide. Espera a que cambie en la app y prueba con el nuevo.');
    onOk();
  }

  if (!alta) return (
    <>
      <ol className="text-sm list-decimal pl-5 flex flex-col gap-1">
        <li>Instala en tu móvil una app de autenticación: Google Authenticator, Microsoft Authenticator o la de contraseñas del iPhone.</li>
        <li>Pulsa «Configurar» y escanea el código QR con esa app.</li>
        <li>Escribe aquí el código de 6 dígitos que te muestre.</li>
      </ol>
      <button onClick={empezar} className="bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl">Configurar</button>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
    </>
  );
  return (
    <>
      <img src={alta.qr} alt="Código QR para la app de autenticación" className="w-48 h-48 mx-auto" />
      <details className="text-xs text-texto-suave"><summary className="cursor-pointer">No puedo escanear el QR</summary><p className="mt-1">Añade una cuenta a mano con esta clave: <code className="break-all font-mono text-texto">{alta.secreto}</code></p></details>
      <CampoCodigo onEnviar={verificar} ocupado={ocupado} />
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <p className="text-xs text-texto-suave">Guarda esta cuenta en la app: si cambias de móvil tendrás que pasarla al nuevo. Si la pierdes, se recupera desde el panel de Supabase.</p>
    </>
  );
}
