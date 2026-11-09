-- Correcciones de la revisión de seguridad independiente (8 nov 2026).
-- 1. Nunca se borra un ejercicio con series o notas del paciente, venga el borrado de donde venga
--    (quitar una sesión del calendario, editarla, cambiar de programa). Solo desde el panel de Supabase.
-- 2. Si el paciente cambia una nota que el coach ya había leído, vuelve a aparecer como no leída.
-- 3. Las fechas «de hoy» se calculan en hora de España, no en la del servidor (UTC).
-- Depende de 0001-0012.

-- 1 ---------------------------------------------------------------
create or replace function guard_item_delete()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and (
       exists (select 1 from set_logs where workout_item_id = old.id)
    or exists (select 1 from workout_item_feedback where workout_item_id = old.id)) then
    raise exception 'Esta sesión tiene series o notas del paciente y no se puede borrar ni rehacer';
  end if;
  return old;
end;
$$;
create trigger workout_items_guard_delete before delete on workout_items
  for each row execute function guard_item_delete();

-- 2 ---------------------------------------------------------------
create or replace function guard_feedback_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not is_coach() then
    if tg_op = 'INSERT' then
      new.read_by_coach_at := null;
    elsif new.read_by_coach_at is distinct from old.read_by_coach_at then
      raise exception 'No tienes permiso para cambiar estos datos';
    elsif new.note is distinct from old.note or new.cannot_do is distinct from old.cannot_do or new.reason is distinct from old.reason then
      new.read_by_coach_at := null;
    end if;
  end if;
  return new;
end;
$$;

-- 3 ---------------------------------------------------------------
create or replace function hoy_local()
returns date language sql stable
as $$ select (now() at time zone 'Europe/Madrid')::date; $$;

drop policy patient_rw on body_measurements;
create policy patient_rw on body_measurements for all
  using (patient_id = auth.uid() and is_active_patient())
  with check (patient_id = auth.uid() and is_active_patient() and measured_on <= hoy_local());

create or replace function replace_program_from_week(p_assignment uuid, p_week int, p_new_program uuid default null, p_message text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  a record;
  v_monday date;
  v_removed int;
  v_kept int;
  v_new uuid;
begin
  if not is_coach() then
    raise exception 'Solo el coach puede cambiar programas';
  end if;
  select pa.*, pr.weeks into a from program_assignments pa join programs pr on pr.id = pa.program_id where pa.id = p_assignment for update;
  if a.id is null then raise exception 'Asignación no encontrada'; end if;
  if a.status <> 'active' then raise exception 'Este programa ya no está en curso'; end if;
  if p_week is null or p_week < 1 or p_week > a.weeks then raise exception 'Semana fuera del programa'; end if;
  v_monday := a.start_date + (p_week - 1) * 7;
  if v_monday < date_trunc('week', hoy_local())::date then
    raise exception 'Solo se puede cambiar desde la semana actual o una futura';
  end if;
  if p_new_program is not null and not exists (select 1 from programs where id = p_new_program and not is_archived) then
    raise exception 'Programa no encontrado';
  end if;

  with borrables as (
    select w.id from workouts w
    where w.program_assignment_id = p_assignment
      and w.scheduled_date >= v_monday
      and w.status = 'scheduled'
      and not exists (select 1 from workout_blocks b join workout_items i on i.block_id = b.id join set_logs l on l.workout_item_id = i.id where b.workout_id = w.id)
      and not exists (select 1 from workout_blocks b join workout_items i on i.block_id = b.id join workout_item_feedback f on f.workout_item_id = i.id where b.workout_id = w.id)
  )
  delete from workouts where id in (select id from borrables);
  get diagnostics v_removed = row_count;

  select count(*) into v_kept from workouts where program_assignment_id = p_assignment and scheduled_date >= v_monday;

  if p_new_program is not null then
    insert into program_assignments (patient_id, program_id, start_date) values (a.patient_id, p_new_program, v_monday)
    returning id into v_new;
    perform _create_program_sessions(v_new, p_message);
  end if;

  update program_assignments set status = 'replaced', replaced_from_week = p_week, replaced_by = v_new where id = p_assignment;
  return jsonb_build_object('removed', v_removed, 'kept', v_kept, 'new_assignment', v_new);
end;
$$;
