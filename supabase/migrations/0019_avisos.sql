-- Avisos (núcleo): notificaciones en el móvil (web push) y email de respaldo.
-- - El paciente elige en Perfil: avisos de mensajes y recordatorio de entrenamiento a una hora.
-- - Las suscripciones del dispositivo se guardan con guardar_suscripcion(): si el móvil lo usaba otra cuenta, pasa a la actual.
-- - La función de servidor «avisos» envía los avisos y anota cada uno en notification_log para no repetir.
-- - La clave pública de los avisos (VAPID) está en app_settings. Las claves privadas van solo en los secretos de Supabase.
-- Depende de 0001-0018.

alter table patient_settings
  add column reminder_enabled boolean not null default false,
  add column reminder_time time,
  add column notify_messages boolean not null default true;

-- Ajustes generales de la app que puede leer cualquier usuario con sesión (nada secreto)
create table app_settings (
  key text primary key check (key in ('vapid_public_key')),
  value text not null check (char_length(value) <= 500),
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
create policy read_all on app_settings for select to authenticated using (true);
create policy coach_write on app_settings for all using (is_coach()) with check (is_coach());

-- Registro de avisos enviados (para no repetir). Lo escribe solo la función de servidor.
create table notification_log (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('mensaje', 'mensaje_email', 'recordatorio_entreno')),
  user_id uuid not null references profiles(id) on delete cascade,
  ref text not null,
  channel text check (channel in ('push', 'email', 'ninguno')),
  sent_at timestamptz not null default now(),
  unique (kind, user_id, ref)
);
alter table notification_log enable row level security;
create policy coach_read on notification_log for select using (is_coach());
revoke insert, update, delete on notification_log from authenticated, anon;

-- Guarda el dispositivo para la cuenta conectada. Quita antes el mismo dispositivo de otra cuenta.
create or replace function guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if not (is_coach() or is_active_patient()) then raise exception 'Sin acceso'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 or char_length(p_p256dh) > 200 or char_length(p_auth) > 100 then
    raise exception 'Suscripción no válida';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300));
end $$;

-- Guarda en la caja fuerte de Supabase (Vault) el secreto con el que el reloj del servidor llama a los recordatorios
create or replace function guardar_secreto_avisos(p_secreto text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_coach() then raise exception 'Solo el coach'; end if;
  if char_length(p_secreto) < 32 then raise exception 'Secreto demasiado corto'; end if;
  select id into v_id from vault.secrets where name = 'avisos_cron';
  if v_id is null then perform vault.create_secret(p_secreto, 'avisos_cron', 'Llamada del reloj a la función avisos');
  else perform vault.update_secret(v_id, p_secreto); end if;
end $$;
revoke execute on function guardar_secreto_avisos(text) from public, anon;
