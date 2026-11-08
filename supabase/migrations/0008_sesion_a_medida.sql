-- Sesiones a medida: el coach diseña una sesión directamente para un paciente, sin plantilla,
-- y puede repetirla en varios días. También puede editar una sesión ya asignada mientras
-- esté pendiente y sin series ni notas registradas.
-- Depende de 0001-0007.

-- ============================================================
-- Rellena los bloques y ejercicios de una sesión (uso interno)
-- ============================================================
create or replace function _fill_workout(p_workout uuid, p_blocks jsonb)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_block jsonb;
  v_item jsonb;
  v_block_id uuid;
  v_bpos int := 0;
  v_ipos int;
  v_n int := 0;
begin
  for v_block in select * from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) loop
    if jsonb_array_length(coalesce(v_block->'items', '[]'::jsonb)) = 0 then continue; end if;
    v_bpos := v_bpos + 1;
    insert into workout_blocks (workout_id, position, name, type, rounds)
    values (p_workout, v_bpos, nullif(trim(v_block->>'name'), ''),
            coalesce(nullif(v_block->>'type', ''), 'normal')::block_type,
            greatest(coalesce((v_block->>'rounds')::int, 1), 1))
    returning id into v_block_id;
    v_ipos := 0;
    for v_item in select * from jsonb_array_elements(v_block->'items') loop
      v_ipos := v_ipos + 1;
      insert into workout_items (block_id, position, exercise_id, sets, target, load_kg, rest_seconds, instructions)
      values (v_block_id, v_ipos, (v_item->>'exercise_id')::uuid,
              greatest(coalesce((v_item->>'sets')::int, 3), 1),
              nullif(trim(v_item->>'target'), ''),
              nullif(v_item->>'load_kg', '')::numeric,
              nullif(v_item->>'rest_seconds', '')::int,
              nullif(trim(v_item->>'instructions'), ''));
      v_n := v_n + 1;
    end loop;
  end loop;
  if v_n = 0 then
    raise exception 'La sesión necesita al menos un ejercicio';
  end if;
  return v_n;
end;
$$;
revoke all on function _fill_workout(uuid, jsonb) from public, anon, authenticated;

-- ============================================================
-- Guardar una sesión a medida.
-- Nueva:  {"patient_id", "name", "coach_message", "dates": ["2026-11-09", ...], "blocks": [...]}
--         crea una sesión igual en cada fecha (máximo 84).
-- Editar: {"id", "name", "coach_message", "date", "blocks": [...]}
--         solo si está pendiente y sin series ni notas del paciente.
-- Devuelve {"ids": [uuid, ...]}
-- ============================================================
create or replace function save_workout(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_patient uuid;
  v_name text := trim(coalesce(p->>'name', ''));
  v_msg text := nullif(trim(p->>'coach_message'), '');
  v_date date;
  v_ids uuid[] := '{}';
  v_new uuid;
begin
  if not is_coach() then
    raise exception 'Solo el coach puede diseñar sesiones';
  end if;
  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'La sesión necesita un nombre';
  end if;

  if v_id is not null then
    perform 1 from workouts where id = v_id for update;
    if not found then raise exception 'Sesión no encontrada'; end if;
    if exists (select 1 from workouts where id = v_id and status <> 'scheduled')
       or exists (select 1 from workout_blocks b join workout_items i on i.block_id = b.id join set_logs l on l.workout_item_id = i.id where b.workout_id = v_id)
       or exists (select 1 from workout_blocks b join workout_items i on i.block_id = b.id join workout_item_feedback f on f.workout_item_id = i.id where b.workout_id = v_id) then
      raise exception 'Esta sesión ya tiene registros del paciente y no se puede editar';
    end if;
    v_date := coalesce(nullif(p->>'date', '')::date, (select scheduled_date from workouts where id = v_id));
    update workouts set name = v_name, coach_message = v_msg, scheduled_date = v_date where id = v_id;
    delete from workout_blocks where workout_id = v_id;
    perform _fill_workout(v_id, p->'blocks');
    return jsonb_build_object('ids', jsonb_build_array(v_id));
  end if;

  v_patient := nullif(p->>'patient_id', '')::uuid;
  if not exists (select 1 from profiles where id = v_patient and role = 'patient') then
    raise exception 'Paciente no encontrado';
  end if;
  if jsonb_array_length(coalesce(p->'dates', '[]'::jsonb)) = 0 then
    raise exception 'Elige al menos un día';
  end if;
  if jsonb_array_length(p->'dates') > 84 then
    raise exception 'Demasiados días de una vez';
  end if;

  for v_date in select distinct (d)::date from jsonb_array_elements_text(p->'dates') d order by 1 loop
    insert into workouts (patient_id, scheduled_date, name, coach_message)
    values (v_patient, v_date, v_name, v_msg)
    returning id into v_new;
    perform _fill_workout(v_new, p->'blocks');
    v_ids := v_ids || v_new;
  end loop;
  return jsonb_build_object('ids', to_jsonb(v_ids));
end;
$$;
