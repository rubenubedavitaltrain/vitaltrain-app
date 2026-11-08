// Función de servidor: alta de un paciente por el coach.
// Crea la cuenta de acceso (sin contraseña: entrará con código por email), su perfil
// y le activa el módulo de entrenamiento. Solo la puede usar un coach con sesión.
// La clave de servicio la pone Supabase en el servidor; nunca sale de aquí.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const ORIGENES = ['https://vitaltrain-app.pages.dev', 'https://app.vitaltrain.com', 'http://localhost:5173'];

function cabeceras(origen: string | null) {
  const permitido = !!origen && (ORIGENES.includes(origen) || /^https:\/\/([a-z0-9-]+\.)?vitaltrain-(app|prueba)\.pages\.dev$/.test(origen));
  return {
    'Access-Control-Allow-Origin': permitido ? (origen as string) : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin'
  };
}

Deno.serve(async (req) => {
  const h = cabeceras(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: h });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: h });

  const responder = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: h });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Quién llama: tiene que ser el coach con sesión
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: quien } = await admin.auth.getUser(token);
  if (!quien?.user) return responder(401, { error: 'Sesión no válida' });
  const { data: perfil } = await admin.from('profiles').select('role').eq('id', quien.user.id).maybeSingle();
  if (perfil?.role !== 'coach') return responder(403, { error: 'Solo el coach puede dar de alta pacientes' });

  // 2. Datos del paciente
  let datos: { email?: string; full_name?: string; phone?: string };
  try { datos = await req.json(); } catch { return responder(400, { error: 'Datos no válidos' }); }
  const email = (datos.email ?? '').trim().toLowerCase();
  const nombre = (datos.full_name ?? '').trim();
  const telefono = (datos.phone ?? '').trim() || null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return responder(400, { error: 'El email no es válido' });
  if (nombre.length < 2 || nombre.length > 120) return responder(400, { error: 'Escribe el nombre del paciente' });

  const { data: yaPerfil } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (yaPerfil) return responder(409, { error: 'Ya hay alguien dado de alta con ese email' });

  // 3. Cuenta de acceso (confirmada: entrará con código de 6 dígitos)
  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: nombre } });
  if (errCrear || !creado.user) {
    const existe = /already|registered|exists/i.test(errCrear?.message ?? '');
    return responder(existe ? 409 : 500, { error: existe ? 'Ese email ya tiene cuenta. Revisa la lista de pacientes.' : 'No se ha podido crear la cuenta' });
  }

  // 4. Perfil y módulo de entrenamiento
  const id = creado.user.id;
  const { error: errPerfil } = await admin.from('profiles').insert({ id, role: 'patient', full_name: nombre, email, phone: telefono });
  if (errPerfil) {
    await admin.auth.admin.deleteUser(id);
    return responder(500, { error: 'No se ha podido crear el perfil' });
  }
  await admin.from('patient_modules').insert({ patient_id: id, module_slug: 'training' });

  return responder(200, { id, email, full_name: nombre });
});
