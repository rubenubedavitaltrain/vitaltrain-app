-- Recordatorios de «Mi día»: avisos opcionales en los hábitos que el coach ha anclado a un momento del día
-- (al despertar, al amanecer, antes de la última comida...).
-- - El paciente decide en cada hábito si quiere el aviso. El coach lo ve, pero no lo activa por él.
-- - La hora del aviso la calcula el móvil del paciente con sus propios datos (media de sueño y comidas, ciudad)
--   y la guarda en remind_at. La función «avisos» solo envía a esa hora; no calcula nada.
-- - Para las anclas del sol se usa siempre la ciudad guardada, nunca la ubicación del móvil.
-- No borra ni cambia ningún dato existente.
-- Depende de 0001-0026.

alter table patient_habits add column remind_at time;

-- El paciente activa, cambia la hora o quita el aviso de UN hábito suyo. Solo toca remind y remind_at.
create or replace function poner_recordatorio_habito(p_id uuid, p_activar boolean, p_hora time default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not is_active_patient() or not patient_has_module('habits') then
    raise exception 'Sin acceso';
  end if;
  if p_activar and p_hora is null then raise exception 'Falta la hora del aviso'; end if;
  update patient_habits ph
     set remind = p_activar, remind_at = case when p_activar then date_trunc('minute', p_hora)::time end
   where ph.id = p_id and ph.patient_id = auth.uid() and ph.is_active
     and exists (select 1 from habit_definitions d where d.id = ph.habit_id and d.anchor is not null);
  if not found then raise exception 'Hábito no encontrado'; end if;
end;
$$;
revoke execute on function poner_recordatorio_habito(uuid, boolean, time) from public, anon;
grant execute on function poner_recordatorio_habito(uuid, boolean, time) to authenticated;

-- Un aviso de hábito como mucho por hábito y día (lo anota la función «avisos»).
alter table notification_log drop constraint if exists notification_log_kind_check;
alter table notification_log add constraint notification_log_kind_check
  check (kind in ('mensaje', 'mensaje_email', 'recordatorio_entreno', 'borrado_pendiente', 'recordatorio_habito'));
