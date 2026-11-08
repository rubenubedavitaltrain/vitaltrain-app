import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Acceso sin contraseña: el paciente escribe su email, recibe un código de 6 dígitos y lo introduce.
// Solo pueden entrar personas dadas de alta por el coach (shouldCreateUser: false).

function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes('signup') || m.includes('not allowed') || m.includes('not found'))
    return 'Este email no tiene acceso. Si eres paciente de Vitaltrain, escribe a Rubén para que te dé de alta.';
  if (m.includes('rate') || m.includes('seconds') || m.includes('too many'))
    return 'Has pedido varios códigos seguidos. Espera un minuto y vuelve a intentarlo.';
  if (m.includes('expired') || m.includes('invalid') || m.includes('token'))
    return 'El código no es correcto o ha caducado. Revísalo o pide otro.';
  return 'No se ha podido completar. Comprueba tu conexión y vuelve a intentarlo.';
}

export default function Acceso({ supabase }: { supabase: SupabaseClient }) {
  const [paso, setPaso] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function pedirCodigo(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    setAviso('');
    setEnviando(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false }
    });
    setEnviando(false);
    if (error) return setError(traducirError(error.message));
    setPaso('codigo');
    setCodigo('');
    setAviso('Código enviado. Revisa también la carpeta de spam.');
  }

  async function comprobarCodigo(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: codigo,
      type: 'email'
    });
    setEnviando(false);
    if (error) setError(traducirError(error.message));
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-petroleo text-white px-7 pt-[max(env(safe-area-inset-top),3.5rem)] pb-9 flex flex-col gap-3">
        <img src="/marca/logotipo-blanco.png" alt="Vitaltrain · Health balance, training, nutrition" className="h-[72px] w-auto self-start" />
        <h1 className="text-3xl font-bold leading-tight">Entra en tu app</h1>
        <p className="text-base leading-snug text-[#E3E8E8]">
          Sin contraseñas. Te enviamos un código a tu email cada vez que entras desde un móvil nuevo.
        </p>
      </header>

      <main className="flex-1 px-6 py-7 flex flex-col gap-5">
        {paso === 'email' ? (
          <form onSubmit={pedirCodigo} className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl p-5 flex flex-col gap-2.5">
              <label htmlFor="email" className="text-sm font-semibold">Tu email</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-[17px] px-4 py-3.5 border border-borde rounded-xl bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={enviando || !email.includes('@')}
              className="bg-mostaza text-[#1F2424] text-lg font-bold py-4 rounded-2xl disabled:opacity-60"
            >
              {enviando ? 'Enviando…' : 'Enviarme el código'}
            </button>
          </form>
        ) : (
          <form onSubmit={comprobarCodigo} className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl p-5 flex flex-col gap-2.5">
              <span className="text-sm text-texto-suave">Código enviado a <strong className="text-texto">{email}</strong></span>
              <label htmlFor="codigo" className="text-sm font-semibold">Código de 6 dígitos</label>
              <input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-[28px] font-bold tracking-[0.5em] text-center py-3 border-2 border-petroleo rounded-xl bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={enviando || codigo.length !== 6}
              className="bg-mostaza text-[#1F2424] text-lg font-bold py-4 rounded-2xl disabled:opacity-60"
            >
              {enviando ? 'Comprobando…' : 'Entrar'}
            </button>
            <div className="flex justify-between text-[15px] font-semibold text-petroleo">
              <button type="button" onClick={() => pedirCodigo()} disabled={enviando}>Enviar otro código</button>
              <button type="button" onClick={() => { setPaso('email'); setError(''); setAviso(''); }}>Cambiar email</button>
            </div>
          </form>
        )}

        {aviso && !error && <p role="status" className="text-sm text-texto-suave">{aviso}</p>}
        {error && <p role="alert" className="text-[15px] font-semibold text-[#8A2C1D] bg-white rounded-xl p-4">{error}</p>}
      </main>

      <footer className="px-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-xs leading-relaxed text-texto-suave">
        Clínica Vitaltrain · Centro Sanitario Nº Registro 22433
      </footer>
    </div>
  );
}
