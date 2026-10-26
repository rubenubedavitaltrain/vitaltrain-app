-- App Vitaltrain — esquema inicial
-- Postgres / Supabase. Región UE.

-- gen_random_uuid() es nativo desde Postgres 13: no hace falta pgcrypto

-- ============================================================
-- Tipos
-- ============================================================
create type user_role as enum ('coach', 'patient');
create type access_status as enum ('active', 'paused', 'archived');
create type video_provider as enum ('youtube', 'bunny', 'none');
create type block_type as enum ('normal', 'superset', 'circuit');
create type workout_status as enum ('scheduled', 'in_progress', 'completed', 'skipped');
create type membership_status as enum ('active', 'on_hold', 'cancelled', 'expired', 'pending');

-- ============================================================
-- Perfiles
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'patient',
  full_name text not null,
  email text not null unique,
  phone text,
  status access_status not null default 'active',
  woo_customer_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table coach_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Funciones auxiliares para las políticas
create or replace function is_coach()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'coach');
$$;

create or replace function is_active_patient()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'patient' and status = 'active');
$$;

-- ============================================================
-- Biblioteca de ejercicios
-- ============================================================
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  video_provider video_provider not null default 'none',
  video_id text,                          -- id de YouTube o de Bunny
  thumbnail_url text,
  muscle_groups text[] not null default '{}',
  equipment text[] not null default '{}',
  tags text[] not null default '{}',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exercises_tags_idx on exercises using gin (tags);
create index exercises_muscles_idx on exercises using gin (muscle_groups);

-- ============================================================
-- Plantillas
-- ============================================================
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  tags text[] not null default '{}',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table template_blocks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  position int not null,
  name text,
  type block_type not null default 'normal',
  rounds int not null default 1 check (rounds >= 1),
  unique (template_id, position)
);

create table template_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references template_blocks(id) on delete cascade,
  position int not null,
  exercise_id uuid not null references exercises(id),
  sets int not null default 3 check (sets >= 1),
  target text,                            -- "8-10 reps RIR 2", "40 s", etc.
  rest_seconds int check (rest_seconds in (0, 30, 45, 60, 90, 120, 180, 240, 300)),
  instructions text,
  unique (block_id, position)
);

-- ============================================================
-- Entrenamientos asignados (copia de la plantilla)
-- ============================================================
create table workouts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  source_template_id uuid references templates(id) on delete set null,
  scheduled_date date not null,
  name text not null,
  coach_message text,                     -- indicación visible para el paciente
  status workout_status not null default 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  rpe int check (rpe between 1 and 10),
  feeling text,
  patient_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_patient_date_idx on workouts (patient_id, scheduled_date);

create table workout_blocks (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  position int not null,
  name text,
  type block_type not null default 'normal',
  rounds int not null default 1 check (rounds >= 1),
  unique (workout_id, position)
);

create table workout_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references workout_blocks(id) on delete cascade,
  position int not null,
  exercise_id uuid not null references exercises(id),
  sets int not null default 3 check (sets >= 1),
  target text,
  rest_seconds int check (rest_seconds in (0, 30, 45, 60, 90, 120, 180, 240, 300)),
  instructions text,
  unique (block_id, position)
);

create table set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_item_id uuid not null references workout_items(id) on delete cascade,
  patient_id uuid not null references profiles(id) on delete cascade,
  set_number int not null check (set_number >= 1),
  reps int check (reps >= 0),
  load_kg numeric(6,2) check (load_kg >= 0),
  duration_seconds int check (duration_seconds >= 0),
  rir int check (rir between 0 and 10),
  done boolean not null default true,
  logged_at timestamptz not null default now(),
  unique (workout_item_id, set_number)
);
create index set_logs_patient_idx on set_logs (patient_id, logged_at);

-- ============================================================
-- Check-in semanal PNI
-- ============================================================
create table checkins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  sleep int check (sleep between 1 and 5),
  energy int check (energy between 1 and 5),
  digestion int check (digestion between 1 and 5),
  stress int check (stress between 1 and 5),
  pain int check (pain between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  unique (patient_id, week_start)
);

-- ============================================================
-- Mensajes
-- ============================================================
create table messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,  -- conversación = paciente
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_patient_idx on messages (patient_id, created_at);

-- ============================================================
-- Estado del pago (WooCommerce)
-- ============================================================
create table memberships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references profiles(id) on delete set null,
  email text not null,
  woo_subscription_id bigint unique,
  woo_product_id bigint,
  status membership_status not null default 'pending',
  current_period_end date,
  raw_event jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Notificaciones push
-- ============================================================
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- updated_at automático
-- ============================================================
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();
create trigger exercises_touch before update on exercises for each row execute function touch_updated_at();
create trigger templates_touch before update on templates for each row execute function touch_updated_at();
create trigger workouts_touch before update on workouts for each row execute function touch_updated_at();

-- ============================================================
-- Asignar plantilla a paciente (copia completa)
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

    insert into workout_items (block_id, position, exercise_id, sets, target, rest_seconds, instructions)
    select v_new_block, position, exercise_id, sets, target, rest_seconds, instructions
    from template_items where block_id = v_block.id;
  end loop;

  return v_workout;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table exercises enable row level security;
alter table templates enable row level security;
alter table template_blocks enable row level security;
alter table template_items enable row level security;
alter table workouts enable row level security;
alter table workout_blocks enable row level security;
alter table workout_items enable row level security;
alter table set_logs enable row level security;
alter table checkins enable row level security;
alter table messages enable row level security;
alter table memberships enable row level security;
alter table push_subscriptions enable row level security;

-- Coach: acceso total a todo
create policy coach_all_profiles on profiles for all using (is_coach()) with check (is_coach());
create policy coach_all_exercises on exercises for all using (is_coach()) with check (is_coach());
create policy coach_all_templates on templates for all using (is_coach()) with check (is_coach());
create policy coach_all_template_blocks on template_blocks for all using (is_coach()) with check (is_coach());
create policy coach_all_template_items on template_items for all using (is_coach()) with check (is_coach());
create policy coach_all_workouts on workouts for all using (is_coach()) with check (is_coach());
create policy coach_all_workout_blocks on workout_blocks for all using (is_coach()) with check (is_coach());
create policy coach_all_workout_items on workout_items for all using (is_coach()) with check (is_coach());
create policy coach_all_set_logs on set_logs for all using (is_coach()) with check (is_coach());
create policy coach_all_checkins on checkins for all using (is_coach()) with check (is_coach());
create policy coach_all_messages on messages for all using (is_coach()) with check (is_coach());
create policy coach_all_memberships on memberships for all using (is_coach()) with check (is_coach());
create policy coach_all_push on push_subscriptions for all using (is_coach()) with check (is_coach());

-- Paciente: su perfil (lectura). No puede cambiar rol ni estado.
create policy patient_read_own_profile on profiles for select using (id = auth.uid());

-- Paciente activo: biblioteca en lectura (para ver vídeos)
create policy patient_read_exercises on exercises for select using (is_active_patient());

-- Paciente activo: sus entrenamientos
create policy patient_read_workouts on workouts for select
  using (patient_id = auth.uid() and is_active_patient());
create policy patient_update_workouts on workouts for update
  using (patient_id = auth.uid() and is_active_patient())
  with check (patient_id = auth.uid());

create policy patient_read_workout_blocks on workout_blocks for select
  using (is_active_patient() and exists (
    select 1 from workouts w where w.id = workout_id and w.patient_id = auth.uid()));

create policy patient_read_workout_items on workout_items for select
  using (is_active_patient() and exists (
    select 1 from workout_blocks b join workouts w on w.id = b.workout_id
    where b.id = block_id and w.patient_id = auth.uid()));

-- Paciente activo: sus registros de series
create policy patient_rw_set_logs on set_logs for all
  using (patient_id = auth.uid() and is_active_patient())
  with check (patient_id = auth.uid() and is_active_patient() and exists (
    select 1 from workout_items i
    join workout_blocks b on b.id = i.block_id
    join workouts w on w.id = b.workout_id
    where i.id = workout_item_id and w.patient_id = auth.uid()));

-- Paciente activo: sus check-ins
create policy patient_rw_checkins on checkins for all
  using (patient_id = auth.uid() and is_active_patient())
  with check (patient_id = auth.uid() and is_active_patient());

-- Paciente activo: su conversación
create policy patient_read_messages on messages for select
  using (patient_id = auth.uid() and is_active_patient());
create policy patient_send_messages on messages for insert
  with check (patient_id = auth.uid() and sender_id = auth.uid() and is_active_patient());

-- Paciente: sus dispositivos push
create policy patient_rw_push on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Paciente: su estado de pago (lectura)
create policy patient_read_membership on memberships for select using (patient_id = auth.uid());

-- Paciente: puede editar su nombre y teléfono, nada más
create policy patient_update_own_profile on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function guard_profile_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not is_coach() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.email is distinct from old.email
       or new.woo_customer_id is distinct from old.woo_customer_id then
      raise exception 'No tienes permiso para cambiar estos datos';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on profiles
  for each row execute function guard_profile_columns();

-- Notas privadas del coach: tabla aparte, el paciente no tiene ninguna política
alter table coach_notes enable row level security;
create policy coach_all_notes on coach_notes for all using (is_coach()) with check (is_coach());
