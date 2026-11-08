-- Programas de 1 a 12 semanas.
-- Un programa reparte plantillas por días de cada semana y lleva una regla de progresión por semana
-- (porcentaje de carga y una nota para el paciente). Asignarlo crea las sesiones en el calendario
-- del paciente como copias. Se puede cambiar a mitad desde una semana: se quitan solo las sesiones
-- pendientes sin registros desde ese lunes y se asigna otro programa en su lugar.
-- Depende de 0001-0006.

-- ============================================================
-- Tablas
-- ============================================================
create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  weeks int not null check (weeks between 1 and 12),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger programs_touch before update on programs for each row execute function touch_updated_at();

-- Regla de progresión de cada semana
create table program_weeks (
  program_id uuid not null references programs(id) on delete cascade,
  week_number int not null check (week_number between 1 and 12),
  load_change_pct numeric(5,2) not null default 0 check (load_change_pct between -50 and 50),
  note text check (char_length(note) <= 300),
  primary key (program_id, week_number)
);

-- Qué plantilla toca cada día de cada semana (1 = lunes ... 7 = domingo)
create table program_slots (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  week_number int not null check (week_number between 1 and 12),
  day_of_week int not null check (day_of_week between 1 and 7),
  template_id uuid not null references templates(id),
  unique (program_id, week_number, day_of_week, template_id)
);

create type program_assignment_status as enum ('active', 'replaced', 'cancelled');

create table program_assignments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  program_id uuid not null references programs(id),
  start_date date not null check (extract(isodow from start_date) = 1),
  status program_assignment_status not null default 'active',
  replaced_from_week int,
  replaced_by uuid references program_assignments(id),
  created_at timestamptz not null default now()
);
create index program_assignments_patient_idx on program_assignments (patient_id, status);

alter table workouts add column program_assignment_id uuid references program_assignments(id) on delete set null;
alter table workouts add column program_week int check (program_week between 1 and 12);
create index workouts_assignment_idx on workouts (program_assignment_id, scheduled_date);

-- ============================================================
-- Seguridad
-- ============================================================
alter table programs enable row level security;
alter table program_weeks enable row level security;
alter table program_slots enable row level security;
alter table program_assignments enable row level security;

create policy coach_all on programs for all using (is_coach()) with check (is_coach());
create policy coach_all on program_weeks for all using (is_coach()) with check (is_coach());
create policy coach_all on program_slots for all using (is_coach()) with check (is_coach());
create policy coach_all on program_assignments for all using (is_coach()) with check (is_coach());

-- El paciente ve sus asignaciones y el nombre de los programas que tiene asignados (para "semana 3 de 8")
create policy patient_read on program_assignments for select
  using (patient_id = auth.uid() and is_active_patient());
create policy patient_read on programs for select
  using (is_active_patient() and exists (
    select 1 from program_assignments a where a.program_id = programs.id and a.patient_id = auth.uid()));

-- El paciente tampoco puede cambiar a qué programa pertenece una sesión
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
       or new.created_at is distinct from old.created_at
       or new.program_assignment_id is distinct from old.program_assignment_id
       or new.program_week is distinct from old.program_week then
      raise exception 'No tienes permiso para cambiar estos datos';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- Copia interna de una plantilla a una sesión (no se puede llamar desde la app)
-- ============================================================
create or replace function _copy_template_to_workout(
  p_template uuid, p_patient uuid, p_date date, p_message text,
  p_load_pct numeric, p_assignment uuid, p_week int)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_workout uuid;
  v_block record;
  v_new_block uuid;
begin
  insert into workouts (patient_id, source_template_id, scheduled_date, name, coach_message, program_assignment_id, program_week)
  select p_patient, t.id, p_date, t.name, p_message, p_assignment, p_week from templates t where t.id = p_template
  returning id into v_workout;
  if v_workout is null then
    raise exception 'Plantilla no encontrada';
  end if;
  for v_block in select * from template_blocks where template_id = p_template order by position loop
    insert into workout_blocks (workout_id, position, name, type, rounds)
    values (v_workout, v_block.position, v_block.name, v_block.type, v_block.rounds)
    returning id into v_new_block;
    -- La carga se ajusta con el porcentaje de la semana y se redondea a 0,5 kg
    insert into workout_items (block_id, position, exercise_id, sets, target, load_kg, rest_seconds, instructions)
    select v_new_block, position, exercise_id, sets, target,
           case when load_kg is null then null
                else round(load_kg * (1 + coalesce(p_load_pct, 0) / 100) * 2) / 2 end,
           rest_seconds, instructions
    from template_items where block_id = v_block.id;
  end loop;
  return v_workout;
end;
$$;
revoke all on function _copy_template_to_workout(uuid, uuid, date, text, numeric, uuid, int) from public, anon, authenticated;

-- ============================================================
-- Guardar un programa completo de una vez.
-- {"id", "name", "description", "weeks",
--  "week_rules": [{"week_number","load_change_pct","note"}],
--  "slots": [{"week_number","day_of_week","template_id"}]}
-- Los programas ya asignados no cambian: sus sesiones son copias.
-- ============================================================
create or replace function save_program(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_weeks int := (p->>'weeks')::int;
begin
  if not is_coach() then
    raise exception 'Solo el coach puede guardar programas';
  end if;
  if coalesce(trim(p->>'name'), '') = '' then
    raise exception 'El programa necesita un nombre';
  end if;
  if v_weeks is null or v_weeks < 1 or v_weeks > 12 then
    raise exception 'Un programa dura de 1 a 12 semanas';
  end if;

  if v_id is null then
    insert into programs (name, description, weeks) values (trim(p->>'name'), nullif(trim(p->>'description'), ''), v_weeks)
    returning id into v_id;
  else
    update programs set name = trim(p->>'name'), description = nullif(trim(p->>'description'), ''), weeks = v_weeks
    where id = v_id;
    if not found then raise exception 'Programa no encontrado'; end if;
    if not (p ? 'slots') then return v_id; end if;
    delete from program_weeks where program_id = v_id;
    delete from program_slots where program_id = v_id;
  end if;

  insert into program_weeks (program_id, week_number, load_change_pct, note)
  select v_id, (r->>'week_number')::int, coalesce(nullif(r->>'load_change_pct', '')::numeric, 0), nullif(trim(r->>'note'), '')
  from jsonb_array_elements(coalesce(p->'week_rules', '[]'::jsonb)) r
  where (r->>'week_number')::int between 1 and v_weeks;

  insert into program_slots (program_id, week_number, day_of_week, template_id)
  select distinct v_id, (s->>'week_number')::int, (s->>'day_of_week')::int, (s->>'template_id')::uuid
  from jsonb_array_elements(coalesce(p->'slots', '[]'::jsonb)) s
  where (s->>'week_number')::int between 1 and v_weeks;

  return v_id;
end;
$$;

-- ============================================================
-- Crea las sesiones de un programa para un paciente a partir de un lunes (uso interno)
-- ============================================================
create or replace function _create_program_sessions(p_assignment uuid, p_message text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  a record;
  s record;
  v_n int := 0;
begin
  select pa.*, pr.weeks into a from program_assignments pa join programs pr on pr.id = pa.program_id where pa.id = p_assignment;
  for s in
    select sl.week_number, sl.day_of_week, sl.template_id, coalesce(w.load_change_pct, 0) pct, w.note
    from program_slots sl
    left join program_weeks w on w.program_id = sl.program_id and w.week_number = sl.week_number
    where sl.program_id = a.program_id and sl.week_number <= a.weeks
    order by sl.week_number, sl.day_of_week
  loop
    perform _copy_template_to_workout(
      s.template_id, a.patient_id,
      a.start_date + (s.week_number - 1) * 7 + (s.day_of_week - 1),
      nullif(concat_ws(' ', nullif(trim(p_message), ''), s.note), ''),
      s.pct, p_assignment, s.week_number);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function _create_program_sessions(uuid, text) from public, anon, authenticated;

-- ============================================================
-- Asignar un programa a un paciente desde un lunes
-- ============================================================
create or replace function assign_program(p_program uuid, p_patient uuid, p_start_monday date, p_message text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_coach() then
    raise exception 'Solo el coach puede asignar programas';
  end if;
  if not exists (select 1 from profiles where id = p_patient and role = 'patient') then
    raise exception 'Paciente no encontrado';
  end if;
  if not exists (select 1 from programs where id = p_program and not is_archived) then
    raise exception 'Programa no encontrado';
  end if;
  if extract(isodow from p_start_monday) <> 1 then
    raise exception 'Los programas empiezan en lunes';
  end if;
  insert into program_assignments (patient_id, program_id, start_date) values (p_patient, p_program, p_start_monday)
  returning id into v_id;
  perform _create_program_sessions(v_id, p_message);
  return v_id;
end;
$$;

-- ============================================================
-- Cambiar un programa en curso desde una semana (la actual o una futura).
-- Quita solo las sesiones de esa asignación desde ese lunes que estén pendientes y sin registros
-- ni notas. Las hechas, en curso o con registros se quedan siempre.
-- Si se indica otro programa, empieza ese mismo lunes.
-- Devuelve {"removed": n, "kept": n, "new_assignment": uuid|null}
-- ============================================================
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
  if v_monday < date_trunc('week', current_date)::date then
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
