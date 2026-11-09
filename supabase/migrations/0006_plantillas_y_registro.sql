-- Plantillas por bloques, asignación, copia de semana y registro del paciente.
-- Depende de 0001-0005.

-- ============================================================
-- Carga pautada por ejercicio (se precarga en el entrenamiento del paciente)
-- ============================================================
alter table template_items add column load_kg numeric(6,2) check (load_kg >= 0);
alter table workout_items add column load_kg numeric(6,2) check (load_kg >= 0);

-- ============================================================
-- Asignar plantilla: ahora copia también la carga y comprueba que el destino es un paciente
-- ============================================================
create or replace function assign_template(p_template uuid, p_patient uuid, p_date date, p_message text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_workout uuid;
  v_block record;
  v_new_block uuid;
begin
  if not is_coach() then
    raise exception 'Solo el coach puede asignar entrenamientos';
  end if;
  if not exists (select 1 from profiles where id = p_patient and role = 'patient') then
    raise exception 'Paciente no encontrado';
  end if;
  insert into workouts (patient_id, source_template_id, scheduled_date, name, coach_message)
  select p_patient, t.id, p_date, t.name, p_message from templates t where t.id = p_template
  returning id into v_workout;
  if v_workout is null then
    raise exception 'Plantilla no encontrada';
  end if;
  for v_block in select * from template_blocks where template_id = p_template order by position loop
    insert into workout_blocks (workout_id, position, name, type, rounds)
    values (v_workout, v_block.position, v_block.name, v_block.type, v_block.rounds)
    returning id into v_new_block;
    insert into workout_items (block_id, position, exercise_id, sets, target, load_kg, rest_seconds, instructions)
    select v_new_block, position, exercise_id, sets, target, load_kg, rest_seconds, instructions
    from template_items where block_id = v_block.id;
  end loop;
  return v_workout;
end;
$$;

-- ============================================================
-- Guardar una plantilla completa (cabecera, bloques y ejercicios) de una vez.
-- Formato: {"id": uuid|null, "name", "description",
--           "blocks": [{"name","type","rounds","items":[{"exercise_id","sets","target","load_kg","rest_seconds","instructions"}]}]}
-- Los entrenamientos ya asignados no cambian: son copias.
-- ============================================================
create or replace function save_template(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_block jsonb;
  v_item jsonb;
  v_block_id uuid;
  v_bpos int := 0;
  v_ipos int;
begin
  if not is_coach() then
    raise exception 'Solo el coach puede guardar plantillas';
  end if;
  if coalesce(trim(p->>'name'), '') = '' then
    raise exception 'La plantilla necesita un nombre';
  end if;

  if v_id is null then
    insert into templates (name, description) values (trim(p->>'name'), nullif(trim(p->>'description'), ''))
    returning id into v_id;
  else
    update templates set name = trim(p->>'name'), description = nullif(trim(p->>'description'), '')
    where id = v_id;
    if not found then raise exception 'Plantilla no encontrada'; end if;
    -- Solo se rehacen los bloques si vienen en la petición (renombrar no borra el contenido)
    if not (p ? 'blocks') then return v_id; end if;
    delete from template_blocks where template_id = v_id;
  end if;

  for v_block in select * from jsonb_array_elements(coalesce(p->'blocks', '[]'::jsonb)) loop
    v_bpos := v_bpos + 1;
    insert into template_blocks (template_id, position, name, type, rounds)
    values (v_id, v_bpos, nullif(trim(v_block->>'name'), ''),
            coalesce(nullif(v_block->>'type', ''), 'normal')::block_type,
            greatest(coalesce((v_block->>'rounds')::int, 1), 1))
    returning id into v_block_id;
    v_ipos := 0;
    for v_item in select * from jsonb_array_elements(coalesce(v_block->'items', '[]'::jsonb)) loop
      v_ipos := v_ipos + 1;
      insert into template_items (block_id, position, exercise_id, sets, target, load_kg, rest_seconds, instructions)
      values (v_block_id, v_ipos, (v_item->>'exercise_id')::uuid,
              greatest(coalesce((v_item->>'sets')::int, 3), 1),
              nullif(trim(v_item->>'target'), ''),
              nullif(v_item->>'load_kg', '')::numeric,
              nullif(v_item->>'rest_seconds', '')::int,
              nullif(trim(v_item->>'instructions'), ''));
    end loop;
  end loop;
  return v_id;
end;
$$;

-- ============================================================
-- Copiar la semana de un paciente a otra semana (mismo día de la semana).
-- Copia lo pautado, no lo registrado: las copias empiezan como pendientes.
-- ============================================================
create or replace function copy_week(p_patient uuid, p_from_monday date, p_to_monday date)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_w record;
  v_b record;
  v_new_w uuid;
  v_new_b uuid;
  v_n int := 0;
begin
  if not is_coach() then
    raise exception 'Solo el coach puede copiar semanas';
  end if;
  if extract(isodow from p_from_monday) <> 1 or extract(isodow from p_to_monday) <> 1 then
    raise exception 'Las semanas empiezan en lunes';
  end if;
  if p_from_monday = p_to_monday then
    raise exception 'La semana de origen y la de destino son la misma';
  end if;
  if not exists (select 1 from profiles where id = p_patient and role = 'patient') then
    raise exception 'Paciente no encontrado';
  end if;
  for v_w in select * from workouts w
             where w.patient_id = p_patient and w.scheduled_date between p_from_monday and p_from_monday + 6
               -- No duplicar: se salta si ese día ya tiene una sesión con el mismo nombre
               and not exists (
                 select 1 from workouts d
                 where d.patient_id = p_patient
                   and d.scheduled_date = p_to_monday + (w.scheduled_date - p_from_monday)
                   and d.name = w.name)
             order by w.scheduled_date loop
    insert into workouts (patient_id, source_template_id, scheduled_date, name, coach_message)
    values (p_patient, v_w.source_template_id, p_to_monday + (v_w.scheduled_date - p_from_monday), v_w.name, v_w.coach_message)
    returning id into v_new_w;
    for v_b in select * from workout_blocks where workout_id = v_w.id order by position loop
      insert into workout_blocks (workout_id, position, name, type, rounds)
      values (v_new_w, v_b.position, v_b.name, v_b.type, v_b.rounds)
      returning id into v_new_b;
      insert into workout_items (block_id, position, exercise_id, sets, target, load_kg, rest_seconds, instructions)
      select v_new_b, position, exercise_id, sets, target, load_kg, rest_seconds, instructions
      from workout_items where block_id = v_b.id;
    end loop;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ============================================================
-- El paciente solo puede cambiar de su entrenamiento: estado, inicio, fin, esfuerzo, sensaciones y notas
-- ============================================================
create or replace function guard_workout_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not is_coach() then
    if new.id is distinct from old.id
       or new.patient_id is distinct from old.patient_id
       or new.source_template_id is distinct from old.source_template_id
       or new.scheduled_date is distinct from old.scheduled_date
       or new.name is distinct from old.name
       or new.coach_message is distinct from old.coach_message
       or new.created_at is distinct from old.created_at then
      raise exception 'No tienes permiso para cambiar estos datos';
    end if;
  end if;
  return new;
end;
$$;
create trigger workouts_guard before update on workouts
  for each row execute function guard_workout_columns();

-- ============================================================
-- Nota del paciente y "No puedo hacerlo" por ejercicio asignado
-- ============================================================
create type cannot_do_reason as enum ('pain', 'no_equipment', 'dont_know', 'other');

create table workout_item_feedback (
  id uuid primary key default gen_random_uuid(),
  workout_item_id uuid not null unique references workout_items(id) on delete cascade,
  patient_id uuid not null references profiles(id) on delete cascade,
  note text check (char_length(note) <= 1000),
  cannot_do boolean not null default false,
  reason cannot_do_reason,
  read_by_coach_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cannot_do or reason is null)
);
create trigger workout_item_feedback_touch before update on workout_item_feedback
  for each row execute function touch_updated_at();

alter table workout_item_feedback enable row level security;
create policy coach_all on workout_item_feedback for all using (is_coach()) with check (is_coach());
create policy patient_rw on workout_item_feedback for all
  using (patient_id = auth.uid() and is_active_patient())
  with check (patient_id = auth.uid() and is_active_patient() and exists (
    select 1 from workout_items i
    join workout_blocks b on b.id = i.block_id
    join workouts w on w.id = b.workout_id
    where i.id = workout_item_id and w.patient_id = auth.uid()));

-- El paciente no puede marcar como leída su propia nota
create or replace function guard_feedback_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not is_coach() then
    if tg_op = 'INSERT' then
      new.read_by_coach_at := null;
    elsif new.read_by_coach_at is distinct from old.read_by_coach_at then
      raise exception 'No tienes permiso para cambiar estos datos';
    end if;
  end if;
  return new;
end;
$$;
create trigger workout_item_feedback_guard before insert or update on workout_item_feedback
  for each row execute function guard_feedback_columns();

-- ============================================================
-- Ajustes de perfiles
-- ============================================================
-- Un paciente en pausa o archivado no puede cambiar su perfil
drop policy patient_update_own_profile on profiles;
create policy patient_update_own_profile on profiles for update
  using (id = auth.uid() and (is_coach() or is_active_patient()))
  with check (id = auth.uid());

-- El email no se puede repetir aunque cambien mayúsculas
create unique index profiles_email_lower on profiles (lower(email));
