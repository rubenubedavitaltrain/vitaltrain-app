// Función de servidor «avisos»: envía notificaciones al móvil (web push) y, si no llegan, un email.
// Dos usos:
//  1. { tipo: 'mensaje', id }  — la llama la app justo después de enviar un mensaje (con la sesión de quien lo envía).
//     Avisa al destinatario: al paciente si escribe el coach, al coach si escribe el paciente.
//  2. { tipo: 'recordatorios' } — la llama el reloj del servidor cada 15 minutos (cabecera x-cron-secret).
//     Avisa a quien tenga activado el recordatorio a esa hora y una sesión pendiente hoy.
// Nunca se envía el texto del mensaje: solo que hay uno nuevo (los avisos pasan por servidores de Apple y Google).
//
// Secretos que hay que poner en Supabase (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// CRON_SECRET y MAILGUN_API_KEY. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';

const ORIGENES = ['https://vitaltrain-app.pages.dev', 'https://app.vitaltrain.com', 'http://localhost:5173'];
const DOMINIO_MAILGUN = 'vitaltrain.com';
const REMITENTE = 'Vitaltrain <acceso@vitaltrain.com>';
const URL_APP = Deno.env.get('APP_URL') ?? 'https://vitaltrain-prueba.pages.dev';

function cabeceras(origen: string | null) {
  const permitido = !!origen && (ORIGENES.includes(origen) || /^https:\/\/([a-z0-9-]+\.)?vitaltrain-(app|prueba)\.pages\.dev$/.test(origen));
  return {
    'Access-Control-Allow-Origin': permitido ? (origen as string) : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

const vapidPub = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPriv = Deno.env.get('VAPID_PRIVATE_KEY');
if (vapidPub && vapidPriv) webpush.setVapidDetails('mailto:info@vitaltrain.com', vapidPub, vapidPriv);

type Aviso = { title: string; body: string; url: string; tag: string };

/** Envía a todos los dispositivos de un usuario. Borra los que ya no existen. Devuelve cuántos llegaron. */
async function push(userId: string, aviso: Aviso): Promise<number> {
  if (!vapidPub || !vapidPriv) return 0;
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  let ok = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), { TTL: 60 * 60 * 12, urgency: 'normal' });
      ok++;
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode;
      if (codigo === 404 || codigo === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
    }
  }
  return ok;
}

async function email(para: string, asunto: string, texto: string): Promise<boolean> {
  const clave = Deno.env.get('MAILGUN_API_KEY');
  if (!clave) return false;
  const f = new FormData();
  f.set('from', REMITENTE); f.set('to', para); f.set('subject', asunto); f.set('text', texto);
  const r = await fetch(`https://api.eu.mailgun.net/v3/${DOMINIO_MAILGUN}/messages`, { method: 'POST', headers: { Authorization: 'Basic ' + btoa('api:' + clave) }, body: f });
  return r.ok;
}

/** Anota el aviso. false si ya se había enviado (misma clase, usuario y referencia). */
async function anotar(kind: string, userId: string, ref: string, channel: string): Promise<boolean> {
  const { error } = await admin.from('notification_log').insert({ kind, user_id: userId, ref, channel });
  return !error;
}

async function avisarMensaje(token: string, id: string) {
  const { data: quien } = await admin.auth.getUser(token);
  if (!quien?.user) return { status: 401, cuerpo: { error: 'Sesión no válida' } };
  const { data: m } = await admin.from('messages').select('id, patient_id, sender_id, created_at').eq('id', id).maybeSingle();
  if (!m || m.sender_id !== quien.user.id) return { status: 403, cuerpo: { error: 'No es tu mensaje' } };
  if (Date.now() - new Date(m.created_at).valueOf() > 10 * 60 * 1000) return { status: 200, cuerpo: { enviado: false, motivo: 'antiguo' } };
  if (!(await anotar('mensaje', m.sender_id, m.id, 'push'))) return { status: 200, cuerpo: { enviado: false, motivo: 'repetido' } };

  const { data: paciente } = await admin.from('profiles').select('id, full_name, email, status').eq('id', m.patient_id).maybeSingle();
  if (!paciente) return { status: 404, cuerpo: { error: 'Paciente no encontrado' } };
  const escribePaciente = m.sender_id === m.patient_id;
  const nombre = (paciente.full_name ?? '').split(' ')[0];
  const destinatarios = escribePaciente
    ? ((await admin.from('profiles').select('id, email').eq('role', 'coach').eq('status', 'active')).data ?? [])
    : [{ id: paciente.id, email: paciente.email }];

  if (!escribePaciente) {
    if (paciente.status !== 'active') return { status: 200, cuerpo: { enviado: false, motivo: 'paciente inactivo' } };
    const { data: aj } = await admin.from('patient_settings').select('notify_messages').eq('patient_id', paciente.id).maybeSingle();
    if (aj && aj.notify_messages === false) return { status: 200, cuerpo: { enviado: false, motivo: 'avisos desactivados' } };
  }

  const aviso: Aviso = escribePaciente
    ? { title: `Mensaje de ${nombre}`, body: 'Tienes un mensaje nuevo en Vitaltrain.', url: '/', tag: `mensaje-${paciente.id}` }
    : { title: 'Vitaltrain', body: 'Tienes un mensaje nuevo de Rubén.', url: '/?pestana=mensajes', tag: 'mensaje' };

  let resultado = 0, emails = 0;
  for (const d of destinatarios) {
    const llegados = await push(d.id, aviso);
    resultado += llegados;
    // Email de respaldo: si no hay móvil con avisos, como mucho uno cada 30 minutos por conversación
    if (llegados === 0 && d.email) {
      const tramo = Math.floor(Date.now() / (30 * 60 * 1000));
      const ref = `${paciente.id}:${tramo}`;
      if (await anotar('mensaje_email', d.id, ref, 'email')) {
        const ok = await email(d.email, escribePaciente ? `Mensaje nuevo de ${paciente.full_name}` : 'Tienes un mensaje nuevo de Rubén',
          escribePaciente
            ? `${paciente.full_name} te ha escrito en la app de Vitaltrain.\n\nÁbrelo en el panel: ${URL_APP}\n`
            : `Hola, ${nombre}:\n\nRubén te ha escrito en la app de Vitaltrain. Ábrela para leerlo: ${URL_APP}\n\nClínica Vitaltrain`);
        // Si no salió, se borra la anotación para que el siguiente mensaje lo intente de nuevo
        if (!ok) await admin.from('notification_log').delete().eq('kind', 'mensaje_email').eq('user_id', d.id).eq('ref', ref);
        else emails++;
      }
    }
  }
  return { status: 200, cuerpo: { enviado: true, push: resultado, email: emails } };
}

async function recordatorios() {
  const ahora = new Date();
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ahora).map((p) => [p.type, p.value]));
  const hoy = `${partes.year}-${partes.month}-${partes.day}`;
  const minAhora = Number(partes.hour) * 60 + Number(partes.minute);

  const { data: ajustes } = await admin.from('patient_settings').select('patient_id, reminder_time').eq('reminder_enabled', true).not('reminder_time', 'is', null);
  let enviados = 0;
  for (const a of ajustes ?? []) {
    const [h, m] = String(a.reminder_time).split(':').map(Number);
    const dif = minAhora - (h * 60 + m);
    if (dif < 0 || dif >= 15) continue; // el reloj pasa cada 15 minutos: se avisa en el tramo que contiene la hora elegida
    const { data: p } = await admin.from('profiles').select('status').eq('id', a.patient_id).maybeSingle();
    if (p?.status !== 'active') continue;
    const { data: ses } = await admin.from('workouts').select('name').eq('patient_id', a.patient_id).eq('scheduled_date', hoy).in('status', ['scheduled', 'in_progress']).limit(1);
    if (!ses?.length) continue;
    if (!(await anotar('recordatorio_entreno', a.patient_id, hoy, 'push'))) continue;
    enviados += await push(a.patient_id, { title: 'Hoy toca entrenar', body: ses[0].name, url: '/', tag: 'recordatorio' });
  }
  return { status: 200, cuerpo: { enviados } };
}

Deno.serve(async (req) => {
  const h = cabeceras(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: h });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: h });
  let cuerpo: { tipo?: string; id?: string };
  try { cuerpo = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Datos no válidos' }), { status: 400, headers: h }); }

  let r: { status: number; cuerpo: unknown };
  if (cuerpo.tipo === 'recordatorios') {
    const secreto = Deno.env.get('CRON_SECRET');
    if (!secreto || req.headers.get('x-cron-secret') !== secreto) r = { status: 401, cuerpo: { error: 'No autorizado' } };
    else r = await recordatorios();
  } else if (cuerpo.tipo === 'mensaje' && typeof cuerpo.id === 'string') {
    r = await avisarMensaje((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''), cuerpo.id);
  } else {
    r = { status: 400, cuerpo: { error: 'Tipo no válido' } };
  }
  return new Response(JSON.stringify(r.cuerpo), { status: r.status, headers: h });
});
