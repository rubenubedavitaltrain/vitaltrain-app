-- Plataforma Vitaltrain — núcleo modular, hábitos, ritmos circadianos y cuestionarios
-- Depende de 0001_schema.sql

-- ============================================================
-- Pilares del método (configurables por el coach)
-- ============================================================
create table pillars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  color text,                              -- hex, para la UI
  position int not null default 0
);

-- ============================================================
-- Módulos y activación por paciente
-- ============================================================
create table modules (
  slug text primary key,                   -- 'training', 'circadian', 'habits', 'questionnaires', 'education'...
  name text not null,
  description text,
  is_available boolean not null default false   -- el coach lo ha activado en la plataforma
);

create table patient_modules (
  patient_id uuid not null references profiles(id) on delete cascade,
  module_slug text not null references modules(slug) on delete cascade,
  enabled_at timestamptz not null default now(),
  primary key (patient_id, module_slug)
);

create or replace function patient_has_module(p_module text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from patient_modules pm
    join modules m on m.slug = pm.module_slug
    where pm.patient_id = auth.uid() and pm.module_slug = p_module and m.is_available);
$$;

-- ============================================================
-- Ajustes del paciente (zona horaria, ubicación, cronotipo)
-- ============================================================
create type chronotype as enum ('definitely_morning', 'moderately_morning', 'intermediate', 'moderately_evening', 'definitely_evening');

create table patient_settings (
  patient_id uuid primary key references profiles(id) on delete cascade,
  timezone text not null default 'Europe/Madrid',
  city text,
  latitude numeric(8,5),                   -- de la ciudad, no del GPS; sirve para calcular amanecer y atardecer
  longitude numeric(8,5),
  chronotype chronotype,
  chronotype_score int,
  workdays int[] not null default '{1,2,3,4,5}',   -- 1 = lunes ... 7 = domingo
  updated_at timestamptz not null default now()
);
create trigger patient_settings_touch before update on patient_settings
  for each row execute function touch_updated_at();

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

-- ============================================================
-- Ritmos circadianos: sueño y comidas
-- ============================================================
create table sleep_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  night_of date not null,                  -- fecha de la noche en que se acuesta
  bedtime timestamptz,
  wake_time timestamptz,
  sleep_latency_minutes int check (sleep_latency_minutes >= 0),
  awakenings int check (awakenings >= 0),
  quality int check (quality between 1 and 5),
  rested int check (rested between 1 and 5),   -- cómo se levanta
  is_free_day boolean,                     -- día libre vs laborable (jet lag social)
  note text,
  created_at timestamptz not null default now(),
  unique (patient_id, night_of),
  check (wake_time is null or bedtime is null or wake_time > bedtime)
);

create type meal_kind as enum ('breakfast', 'lunch', 'dinner', 'snack', 'other');

create table meal_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  eaten_at timestamptz not null,
  kind meal_kind not null default 'other',
  note text,
  created_at timestamptz not null default now()
);
create index meal_events_patient_idx on meal_events (patient_id, eaten_at);

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
alter table pillars enable row level security;
alter table modules enable row level security;
alter table patient_modules enable row level security;
alter table patient_settings enable row level security;
alter table habit_definitions enable row level security;
alter table patient_habits enable row level security;
alter table habit_logs enable row level security;
alter table sleep_logs enable row level security;
alter table meal_events enable row level security;
alter table questionnaires enable row level security;
alter table questionnaire_assignments enable row level security;
alter table questionnaire_responses enable row level security;

-- Coach: todo
create policy coach_all on pillars for all using (is_coach()) with check (is_coach());
create policy coach_all on modules for all using (is_coach()) with check (is_coach());
create policy coach_all on patient_modules for all using (is_coach()) with check (is_coach());
create policy coach_all on patient_settings for all using (is_coach()) with check (is_coach());
create policy coach_all on habit_definitions for all using (is_coach()) with check (is_coach());
create policy coach_all on patient_habits for all using (is_coach()) with check (is_coach());
create policy coach_all on habit_logs for all using (is_coach()) with check (is_coach());
create policy coach_all on sleep_logs for all using (is_coach()) with check (is_coach());
create policy coach_all on meal_events for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaires for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaire_assignments for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaire_responses for all using (is_coach()) with check (is_coach());

-- Paciente activo: lectura de catálogos
create policy patient_read on pillars for select using (is_active_patient());
create policy patient_read on modules for select using (is_active_patient());
create policy patient_read on patient_modules for select using (patient_id = auth.uid());
create policy patient_read on habit_definitions for select using (is_active_patient());

-- Paciente activo: sus ajustes
create policy patient_rw on patient_settings for all
  using (patient_id = auth.uid() and is_active_patient())
  with check (patient_id = auth.uid() and is_active_patient());

-- Hábitos: ve los suyos y registra si tiene el módulo
create policy patient_read on patient_habits for select
  using (patient_id = auth.uid() and is_active_patient());
create policy patient_rw on habit_logs for all
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('habits'))
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('habits')
    and exists (select 1 from patient_habits ph where ph.id = patient_habit_id and ph.patient_id = auth.uid()));

-- Circadiano
create policy patient_rw on sleep_logs for all
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('circadian'))
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('circadian'));
create policy patient_rw on meal_events for all
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('circadian'))
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('circadian'));

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

-- ============================================================
-- Datos iniciales
-- ============================================================
insert into modules (slug, name, description, is_available) values
  ('training', 'Entrenamiento', 'Planes de entrenamiento, vídeos y registro de series', true),
  ('circadian', 'Ritmos circadianos', 'Sueño, luz, horarios de comida y anclas del día', false),
  ('habits', 'Hábitos', 'Protocolos diarios asignados por pilar', false),
  ('questionnaires', 'Cuestionarios', 'Cronotipo, check-ins y cuestionarios de consulta', false),
  ('education', 'Aprendizaje', 'Contenidos explicativos por pilar', false),
  ('messages', 'Mensajes', 'Conversación con el coach', false);

insert into pillars (slug, name, position) values
  ('alimentacion-consciente', 'Alimentación consciente', 1),
  ('movimiento-inteligente', 'Movimiento inteligente', 2),
  ('ritmos-circadianos', 'Ritmos circadianos', 3),
  ('regulacion-emocional', 'Regulación emocional', 4),
  ('contacto-naturaleza', 'Contacto con la naturaleza', 5);
