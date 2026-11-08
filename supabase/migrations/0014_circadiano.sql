-- Módulo de ritmos circadianos: registro de sueño y de comidas.
-- La luz del día (amanecer, atardecer, ventanas UVA y UVB) se calcula en la app con la ciudad
-- del paciente (patient_settings.latitude/longitude). No se usa GPS ni servicios externos.
-- Diseño original en supabase/diseno/fase2_habitos_circadiano_cuestionarios.sql.
-- Depende de 0001-0013.

create table sleep_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  night_of date not null,                  -- fecha de la noche en que se acuesta
  bedtime timestamptz,
  wake_time timestamptz,
  sleep_latency_minutes int check (sleep_latency_minutes between 0 and 300),
  awakenings int check (awakenings between 0 and 20),
  quality int check (quality between 1 and 5),
  rested int check (rested between 1 and 5),   -- cómo se levanta
  is_free_day boolean,                     -- día libre o laborable (jet lag social)
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, night_of),
  check (wake_time is null or bedtime is null or (wake_time > bedtime and wake_time - bedtime <= interval '20 hours'))
);
create trigger sleep_logs_touch before update on sleep_logs for each row execute function touch_updated_at();

create type meal_kind as enum ('breakfast', 'lunch', 'dinner', 'snack', 'other');

create table meal_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  eaten_at timestamptz not null,
  kind meal_kind not null default 'other',
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index meal_events_patient_idx on meal_events (patient_id, eaten_at);

alter table sleep_logs enable row level security;
alter table meal_events enable row level security;

create policy coach_all on sleep_logs for all using (is_coach()) with check (is_coach());
create policy coach_all on meal_events for all using (is_coach()) with check (is_coach());

-- El paciente registra lo suyo si tiene el módulo activo. Nada en el futuro.
create policy patient_rw on sleep_logs for all
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('circadian'))
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('circadian')
    and night_of <= hoy_local() and (wake_time is null or wake_time <= now() + interval '10 minutes'));
create policy patient_rw on meal_events for all
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('circadian'))
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('circadian')
    and eaten_at <= now() + interval '10 minutes' and eaten_at >= now() - interval '30 days');

-- El módulo pasa a estar disponible para activarlo por paciente
update modules set is_available = true where slug = 'circadian';
