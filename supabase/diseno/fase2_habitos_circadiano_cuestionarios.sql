-- DISEÑO, NO APLICADO. Hábitos, ritmos circadianos y cuestionarios.
-- Depende de 0001 y 0002. Cuando se construya cada módulo, se copia su parte
-- a una migración nueva numerada (supabase/migrations/00NN_...sql) con sus pruebas.

-- Motor de hábitos: aplicado en supabase/migrations/0015_habitos.sql
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
alter table questionnaires enable row level security;
alter table questionnaire_assignments enable row level security;
alter table questionnaire_responses enable row level security;

create policy coach_all on questionnaires for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaire_assignments for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaire_responses for all using (is_coach()) with check (is_coach());


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

