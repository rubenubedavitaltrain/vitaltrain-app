-- Motor de cuestionarios (módulo "questionnaires"): cronotipo (rMEQ), check-in semanal y los que cree el coach.
-- Las preguntas van en JSON (schema). El coach asigna; el paciente responde. La base de datos comprueba las respuestas,
-- calcula la puntuación y, en el rMEQ, guarda el cronotipo en patient_settings.
-- Formato de schema: { "questions": [ { "id": "q1", "text": "...", "type": "single" | "scale" | "text",
--   "options": [ { "label": "...", "value": 3 } ],          -- single
--   "min": 1, "max": 5, "minLabel": "...", "maxLabel": "...", -- scale
--   "scored": true, "required": true } ] }
-- Diseño original en supabase/diseno/fase2_habitos_circadiano_cuestionarios.sql. Depende de 0001-0019.

create table questionnaires (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 1000),
  pillar_id uuid references pillars(id) on delete set null,
  schema jsonb not null check (jsonb_typeof(schema -> 'questions') = 'array'),
  version int not null default 1,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table questionnaire_assignments (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references questionnaires(id),
  patient_id uuid not null references profiles(id) on delete cascade,
  recurrence text check (recurrence in ('weekly')),   -- null = una sola vez
  is_active boolean not null default true,
  coach_note text check (char_length(coach_note) <= 300),
  created_at timestamptz not null default now()
);
create unique index questionnaire_assignments_activa on questionnaire_assignments (patient_id, questionnaire_id) where is_active;

create table questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references questionnaire_assignments(id) on delete cascade,
  questionnaire_id uuid not null references questionnaires(id),
  questionnaire_version int not null,
  patient_id uuid not null references profiles(id) on delete cascade,
  period text not null,                       -- 'unico' o la semana ISO ('2026-W46')
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  score numeric,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, period)
);
create index questionnaire_responses_patient_idx on questionnaire_responses (patient_id, submitted_at desc);

alter table questionnaires enable row level security;
alter table questionnaire_assignments enable row level security;
alter table questionnaire_responses enable row level security;

create policy coach_all on questionnaires for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaire_assignments for all using (is_coach()) with check (is_coach());
create policy coach_all on questionnaire_responses for all using (is_coach()) with check (is_coach());

create policy patient_read on questionnaire_assignments for select
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('questionnaires'));
create policy patient_read on questionnaires for select
  using (is_active_patient() and exists (
    select 1 from questionnaire_assignments a where a.questionnaire_id = questionnaires.id and a.patient_id = auth.uid()));
create policy patient_read_own on questionnaire_responses for select
  using (patient_id = auth.uid() and is_active_patient());
-- Solo responde a lo que tiene asignado y activo. No puede cambiar ni borrar lo enviado.
create policy patient_insert on questionnaire_responses for insert
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('questionnaires') and exists (
    select 1 from questionnaire_assignments a
    where a.id = assignment_id and a.patient_id = auth.uid() and a.is_active and a.questionnaire_id = questionnaire_responses.questionnaire_id));

-- Comprueba las respuestas, fija el periodo y calcula la puntuación. En el rMEQ guarda el cronotipo.
create or replace function guard_questionnaire_response() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  q record; a record; preg jsonb; v jsonb; total numeric := 0; puntua boolean := false; n numeric;
begin
  select * into q from questionnaires where id = new.questionnaire_id;
  select * into a from questionnaire_assignments where id = new.assignment_id;
  if a.id is null or a.questionnaire_id <> new.questionnaire_id or a.patient_id <> new.patient_id then
    raise exception 'Asignación no válida';
  end if;
  new.questionnaire_version := q.version;
  new.submitted_at := now();
  new.period := case when a.recurrence = 'weekly' then to_char(hoy_local(), 'IYYY-"W"IW') else 'unico' end;

  for preg in select * from jsonb_array_elements(q.schema -> 'questions') loop
    v := new.answers -> (preg ->> 'id');
    if v is null or v = 'null'::jsonb then
      if coalesce((preg ->> 'required')::boolean, true) and (preg ->> 'type') <> 'text' then
        raise exception 'Falta responder: %', preg ->> 'text';
      end if;
      continue;
    end if;
    if preg ->> 'type' = 'text' then
      if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 1000 then raise exception 'Respuesta de texto no válida'; end if;
    else
      if jsonb_typeof(v) <> 'number' then raise exception 'Respuesta no válida en: %', preg ->> 'text'; end if;
      n := (v #>> '{}')::numeric;
      if preg ->> 'type' = 'single' and not exists (
        select 1 from jsonb_array_elements(preg -> 'options') o where (o ->> 'value')::numeric = n) then
        raise exception 'Opción no válida en: %', preg ->> 'text';
      end if;
      if preg ->> 'type' = 'scale' and (n < (preg ->> 'min')::numeric or n > (preg ->> 'max')::numeric) then
        raise exception 'Valor fuera de escala en: %', preg ->> 'text';
      end if;
      if coalesce((preg ->> 'scored')::boolean, false) then total := total + n; puntua := true; end if;
    end if;
  end loop;
  new.score := case when puntua then total else null end;

  if q.slug = 'rmeq' and puntua then
    insert into patient_settings (patient_id, chronotype, chronotype_score)
    values (new.patient_id, case
      when total >= 22 then 'definitely_morning' when total >= 18 then 'moderately_morning'
      when total >= 12 then 'intermediate' when total >= 8 then 'moderately_evening' else 'definitely_evening' end::chronotype, total::int)
    on conflict (patient_id) do update set chronotype = excluded.chronotype, chronotype_score = excluded.chronotype_score;
  end if;
  return new;
end $$;
create trigger questionnaire_responses_guard before insert on questionnaire_responses for each row execute function guard_questionnaire_response();

update modules set is_available = true where slug = 'questionnaires';

-- ============================================================
-- Cuestionarios iniciales
-- ============================================================
-- rMEQ: versión reducida del cuestionario de matutinidad-vespertinidad (Adan y Almirall, 1991). Puntuación 4-25.
insert into questionnaires (slug, title, description, pillar_id, schema)
select 'rmeq', 'Tu cronotipo',
  'Cinco preguntas sobre tus horarios naturales. Ayudan a ajustar tus horarios de luz, comida, entrenamiento y sueño. Responde pensando en cómo te sentirías sin obligaciones.',
  (select id from pillars where slug = 'ritmos-circadianos'),
  $j${"questions": [
    {"id": "q1", "type": "single", "scored": true, "text": "Si pudieras organizar tu día con total libertad, ¿a qué hora te levantarías?",
     "options": [{"label": "Entre las 5:00 y las 6:30", "value": 5}, {"label": "Entre las 6:30 y las 7:45", "value": 4}, {"label": "Entre las 7:45 y las 9:45", "value": 3}, {"label": "Entre las 9:45 y las 11:00", "value": 2}, {"label": "Entre las 11:00 y las 12:00", "value": 1}]},
    {"id": "q2", "type": "single", "scored": true, "text": "Durante la primera media hora después de levantarte, ¿cómo te sientes?",
     "options": [{"label": "Muy cansado", "value": 1}, {"label": "Bastante cansado", "value": 2}, {"label": "Bastante despejado", "value": 3}, {"label": "Muy despejado", "value": 4}]},
    {"id": "q3", "type": "single", "scored": true, "text": "¿A qué hora de la noche empiezas a sentirte cansado y con ganas de dormir?",
     "options": [{"label": "Entre las 20:00 y las 21:00", "value": 5}, {"label": "Entre las 21:00 y las 22:15", "value": 4}, {"label": "Entre las 22:15 y las 0:45", "value": 3}, {"label": "Entre las 0:45 y las 2:00", "value": 2}, {"label": "Entre las 2:00 y las 3:00", "value": 1}]},
    {"id": "q4", "type": "single", "scored": true, "text": "¿A qué hora del día sueles sentirte en tu mejor momento?",
     "options": [{"label": "Entre las 5:00 y las 8:00", "value": 5}, {"label": "Entre las 8:00 y las 10:00", "value": 4}, {"label": "Entre las 10:00 y las 17:00", "value": 3}, {"label": "Entre las 17:00 y las 22:00", "value": 2}, {"label": "Entre las 22:00 y las 5:00", "value": 1}]},
    {"id": "q5", "type": "single", "scored": true, "text": "Hay personas de mañana y personas de noche. ¿Cuál te describe mejor?",
     "options": [{"label": "Claramente de mañana", "value": 6}, {"label": "Más de mañana que de noche", "value": 4}, {"label": "Más de noche que de mañana", "value": 2}, {"label": "Claramente de noche", "value": 0}]}
  ]}$j$::jsonb;

-- Check-in semanal: cinco escalas y una nota. Sin puntuación total: se mira cada una por separado.
insert into questionnaires (slug, title, description, pillar_id, schema)
select 'checkin-semanal', 'Tu semana',
  'Un minuto para contar cómo ha ido la semana. Así Rubén ve la evolución entre consultas.',
  null,
  $j${"questions": [
    {"id": "sueno", "type": "scale", "min": 1, "max": 5, "text": "¿Cómo has dormido?", "minLabel": "Muy mal", "maxLabel": "Muy bien"},
    {"id": "energia", "type": "scale", "min": 1, "max": 5, "text": "¿Cómo has tenido la energía?", "minLabel": "Muy baja", "maxLabel": "Muy alta"},
    {"id": "digestion", "type": "scale", "min": 1, "max": 5, "text": "¿Qué tal la digestión?", "minLabel": "Muy mal", "maxLabel": "Muy bien"},
    {"id": "estres", "type": "scale", "min": 1, "max": 5, "text": "¿Cuánto estrés has notado?", "minLabel": "Nada", "maxLabel": "Mucho"},
    {"id": "dolor", "type": "scale", "min": 1, "max": 5, "text": "¿Cuánto dolor o molestias has tenido?", "minLabel": "Nada", "maxLabel": "Mucho"},
    {"id": "nota", "type": "text", "required": false, "text": "¿Algo que quieras contar? (opcional)"}
  ]}$j$::jsonb;
