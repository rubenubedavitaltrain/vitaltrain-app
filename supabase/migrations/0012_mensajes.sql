-- Mensajes coach-paciente (la tabla `messages` existe desde 0001).
-- Esta migración la deja lista para usarse:
-- - el remitente siempre es quien está conectado, y un mensaje nuevo siempre llega sin leer;
-- - nadie puede editar ni borrar mensajes, salvo el coach;
-- - marcar como leído se hace con mark_messages_read, que solo marca los mensajes recibidos.
-- Depende de 0001-0011.

create or replace function guard_message_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.sender_id := auth.uid();
  end if;
  new.read_at := null;
  new.created_at := now();
  return new;
end;
$$;
create trigger messages_guard before insert on messages for each row execute function guard_message_insert();

-- El paciente: el remitente es él y la conversación es la suya
drop policy patient_send_messages on messages;
create policy patient_send_messages on messages for insert
  with check (patient_id = auth.uid() and sender_id = auth.uid() and is_active_patient());

-- El coach solo puede escribir en la conversación de un paciente (el coach ve todos los perfiles)
drop policy coach_all_messages on messages;
create policy coach_read_messages on messages for select using (is_coach());
create policy coach_send_messages on messages for insert with check (is_coach() and sender_id = auth.uid() and exists (select 1 from profiles p where p.id = patient_id and p.role = 'patient'));
create policy coach_delete_messages on messages for delete using (is_coach());

-- Marcar como leídos los mensajes recibidos en una conversación
create or replace function mark_messages_read(p_patient uuid)
returns int language plpgsql security definer set search_path = public
as $$
declare
  v_n int;
begin
  if is_coach() then
    update messages set read_at = now()
    where patient_id = p_patient and sender_id = p_patient and read_at is null;
  elsif p_patient = auth.uid() and is_active_patient() then
    update messages set read_at = now()
    where patient_id = auth.uid() and sender_id <> auth.uid() and read_at is null;
  else
    raise exception 'No tienes acceso a esta conversación';
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function mark_messages_read(uuid) from public, anon;
grant execute on function mark_messages_read(uuid) to authenticated;

-- El módulo de mensajes pasa a estar disponible
update modules set is_available = true where slug = 'messages';
