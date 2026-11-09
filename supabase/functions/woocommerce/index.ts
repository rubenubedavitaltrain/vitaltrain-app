// Función de servidor «woocommerce»: recibe los avisos de WooCommerce Subscriptions (vitaltrain.com).
// Solo GUARDA el estado de la suscripción (activa, pausada, cancelada...) y lo enlaza con el paciente del mismo email.
// No abre ni cierra módulos, no crea cuentas y no borra nada: el coach lo revisa y lo aplica en su panel.
//
// Seguridad: WooCommerce firma cada aviso con un secreto compartido (cabecera X-WC-Webhook-Signature,
// HMAC-SHA256 en base64). Sin firma válida, se rechaza. El secreto va en Edge Functions → Secrets:
// WOO_WEBHOOK_SECRET (el mismo que se pone en WooCommerce → Ajustes → Avanzado → Webhooks).
// «Verify JWT» debe ir desactivado: WooCommerce no envía sesión de Supabase; la firma hace ese papel.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

async function firmaValida(cuerpo: string, firma: string | null, secreto: string): Promise<boolean> {
  if (!firma) return false;
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(cuerpo)));
  const esperada = btoa(String.fromCharCode(...mac));
  // Comparación en tiempo constante
  if (esperada.length !== firma.length) return false;
  let dif = 0;
  for (let i = 0; i < esperada.length; i++) dif |= esperada.charCodeAt(i) ^ firma.charCodeAt(i);
  return dif === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });
  const secreto = Deno.env.get('WOO_WEBHOOK_SECRET');
  if (!secreto) return json(500, { error: 'Falta el secreto del webhook' });

  const cuerpo = await req.text();
  // Al crear el webhook, WooCommerce manda una prueba sin firma («webhook_id=…»). Se responde bien y no se guarda nada.
  if (/^webhook_id=\d+$/.test(cuerpo.trim())) return json(200, { ok: true, prueba: true });

  if (!(await firmaValida(cuerpo, req.headers.get('X-WC-Webhook-Signature'), secreto))) return json(401, { error: 'Firma no válida' });

  const tema = req.headers.get('X-WC-Webhook-Topic') ?? '';
  if (!tema.startsWith('subscription.')) return json(200, { ok: true, ignorado: tema });

  let datos: Record<string, unknown>;
  try { datos = JSON.parse(cuerpo); } catch { return json(400, { error: 'Datos no válidos' }); }

  // Solo lo necesario: id, estado, email de facturación, productos y fechas. Nada de direcciones ni pagos.
  const minimo = {
    id: datos.id,
    status: datos.status,
    billing: { email: (datos.billing as { email?: string } | undefined)?.email },
    line_items: ((datos.line_items as { product_id?: number; variation_id?: number }[] | undefined) ?? []).map((l) => ({ product_id: l.product_id, variation_id: l.variation_id })),
    next_payment_date_gmt: datos.next_payment_date_gmt,
    end_date_gmt: datos.end_date_gmt,
    date_modified_gmt: datos.date_modified_gmt,
  };
  const { error } = await admin.rpc('registrar_suscripcion', { p: minimo });
  if (error) return json(422, { error: 'No se ha podido registrar', detalle: error.message });
  return json(200, { ok: true });
});
