-- Cambiar un ejercicio por otro en todas las sesiones pendientes de un paciente.
-- Ejemplo: le molesta la rodilla y se sustituyen las zancadas por puente de glúteo en todo su plan.
-- Solo toca sesiones pendientes desde una fecha y ejercicios sin series ni notas registradas.
-- Mantiene series, repeticiones y descanso. La carga y la indicación se pueden cambiar a la vez.
-- Depende de 0001-0009.

create or replace function replace_exercise(
  p_patient uuid,
  p_from uuid,
  p_to uuid,
  p_from_date date default current_date,
  p_load_kg numeric default null,
  p_clear_load boolean default false,
  p_instructions text default null
)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_n int;
begin
  if not is_coach() then
    raise exception 'Solo el coach puede cambiar ejercicios';
  end if;
  if not exists (select 1 from profiles where id = p_patient and role = 'patient') then
    raise exception 'Paciente no encontrado';
  end if;
  if p_from = p_to then
    raise exception 'Elige un ejercicio distinto';
  end if;
  if not exists (select 1 from exercises where id = p_to and not is_archived) then
    raise exception 'Ejercicio no encontrado';
  end if;

  update workout_items i
  set exercise_id = p_to,
      load_kg = case when p_clear_load then null when p_load_kg is not null then p_load_kg else i.load_kg end,
      instructions = case when p_instructions is null then i.instructions else nullif(trim(p_instructions), '') end
  from workout_blocks b, workouts w
  where i.block_id = b.id and b.workout_id = w.id
    and w.patient_id = p_patient
    and w.status = 'scheduled'
    and w.scheduled_date >= coalesce(p_from_date, current_date)
    and i.exercise_id = p_from
    and not exists (select 1 from set_logs l where l.workout_item_id = i.id)
    and not exists (select 1 from workout_item_feedback f where f.workout_item_id = i.id);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
