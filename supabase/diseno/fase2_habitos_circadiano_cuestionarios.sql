-- DISEÑO, NO APLICADO. Hábitos, ritmos circadianos y cuestionarios.
-- Depende de 0001 y 0002. Cuando se construya cada módulo, se copia su parte
-- a una migración nueva numerada (supabase/migrations/00NN_...sql) con sus pruebas.

-- ============================================================
-- Motor de hábitos y protocolos
-- Sirve para cualquier pilar: luz matinal, ventana de comidas, respiración,
-- pasos, hidratación, desconexión de pantallas, contacto con naturaleza...
-- ============================================================
create type habit_kind as enum ('check', 'number', 'time', 'duration', 'scale');

create table habit_definitions (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid references pillars(id) on delete set null,
  module_slug text references modules(slug) on delete set null,
  name text not null,
  short_instruction text,                  -- lo que ve el paciente en una línea
  rationale text,                          -- el porqué, explicado para el paciente
  kind habit_kind not null default 'check',
  unit text,                               -- 'min', 'pasos', 'vasos'...
  default_target numeric,
  anchor text,                             -- 'wake', 'sunrise', 'sunset', 'bedtime', 'first_meal', 'last_meal' o null
  anchor_offset_minutes int,               -- p. ej. sunset -60 = "una hora antes del atardecer"
  video_provider video_provider not null default 'none',
  video_id text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table patient_habits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  habit_id uuid not null references habit_definitions(id),
  target numeric,                          -- sobrescribe default_target
  days_of_week int[] not null default '{1,2,3,4,5,6,7}',
  window_start time,                       -- franja fija, si no se usa ancla
  window_end time,
  remind boolean not null default false,
  coach_note text,                         -- indicación personalizada visible para el paciente
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index patient_habits_patient_idx on patient_habits (patient_id, is_active);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  patient_habit_id uuid not null references patient_habits(id) on delete cascade,
  patient_id uuid not null references profiles(id) on delete cascade,
  log_date date not null,
  done boolean,
  value_numeric numeric,
  value_time time,
  note text,
  logged_at timestamptz not null default now(),
  unique (patient_habit_id, log_date)
);
create index habit_logs_patient_idx on habit_logs (patient_id, log_date);

-- Ritmos circadianos: aplicado en supabase/migrations/0014_circadiano.sql

-- ============================================================
-- Cuestionarios genéricos (cronotipo, check-ins, cuestionarios de consulta)
-- ============================================================
create table questionnaires (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  pillar_id uuid references pillars(id) on delete set null,
  schema jsonb not null,                   -- preguntas, opciones, puntuación
  version int not null default 1,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table questionnaire_assignments (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references questionnaires(id),
  patient_id uuid not null references profiles(id) on delete cascade,
  due_date date,
  recurrence text,                         -- null, 'weekly', 'monthly'
  created_at timestamptz not null default now()
);

create table questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references questionnaire_assignments(id) on delete set null,
  questionnaire_id uuid not null references questionnaires(id),
  questionnaire_version int not null,
  patient_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null,
  score numeric,
  submitted_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table habit_definitions enable row level security;
alter table patient_habits enable row level security;
alter table habit_logs enable row level security;
alter table questionnaires enable row level security;
alter table questionnaire_assignments enable row level security;
alter table questionnaire_responses enable row level security;

create policy coach_all on habit_definitions for all using (is_coach()) with check (is_coach());
create policy coach_all on patient_habits for all using (is_coach()) with check (is_coach());
create policy coach_all on habit_logs for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaires for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaire_assignments for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaire_responses for all using (is_coach()) with check (is_coach());

create policy patient_read on habit_definitions for select using (is_active_patient());

-- Hábitos: ve los suyos y registra si tiene el módulo
create policy patient_read on patient_habits for select
  using (patient_id = auth.uid() and is_active_patient());
create policy patient_rw on habit_logs for all
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('habits'))
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('habits')
    and exists (select 1 from patient_habits ph where ph.id = patient_habit_id and ph.patient_id = auth.uid()));

-- Cuestionarios: ve los asignados y responde los suyos
create policy patient_read on questionnaire_assignments for select
  using (patient_id = auth.uid() and is_active_patient());
create policy patient_read on questionnaires for select
  using (is_active_patient() and exists (
    select 1 from questionnaire_assignments a where a.questionnaire_id = questionnaires.id and a.patient_id = auth.uid()));
create policy patient_read_own on questionnaire_responses for select
  using (patient_id = auth.uid());
create policy patient_insert on questionnaire_responses for insert
  with check (patient_id = auth.uid() and is_active_patient() and exists (
    select 1 from questionnaire_assignments a
    where a.questionnaire_id = questionnaire_responses.questionnaire_id and a.patient_id = auth.uid()));

