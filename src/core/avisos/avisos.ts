import type { SupabaseClient } from '@supabase/supabase-js';

// Avisos en el móvil (web push). En iPhone solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o posterior).

export type Estado = 'no-soportado' | 'instalar-primero' | 'bloqueado' | 'activo' | 'inactivo';

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function aBytes(base64url: string) {
  const b = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export async function estadoAvisos(): Promise<Estado> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return esIOS() && !instalada() ? 'instalar-primero' : 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'activo' : 'inactivo';
}

/** Pide permiso y guarda este dispositivo. Devuelve un texto de error o null si todo ha ido bien. */
export async function activarAvisos(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'vapid_public_key').maybeSingle();
  const clave = (data as { value: string } | null)?.value;
  if (!clave) return 'Los avisos aún no están configurados en el servidor.';
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return 'No has dado permiso para los avisos. Puedes activarlo en los ajustes del móvil.';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  try {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) });
  } catch {
    return 'Este navegador no ha dejado activar los avisos.';
  }
  const j = sub.toJSON();
  const { error } = await supabase.rpc('guardar_suscripcion', { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_user_agent: navigator.userAgent });
  return error ? 'No se ha podido guardar este dispositivo.' : null;
}

export async function desactivarAvisos(supabase: SupabaseClient) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}

/** Tras enviar un mensaje: pide al servidor que avise al destinatario. No bloquea ni muestra errores. */
export function avisarMensaje(supabase: SupabaseClient, id: string) {
  supabase.functions.invoke('avisos', { body: { tipo: 'mensaje', id } }).catch(() => undefined);
}
