-- Módulo de respiración guiada (pilar Regulación emocional).
-- El paciente hace una sesión con temporizador y queda anotada: pauta, duración y cómo se siente antes y después.
-- Depende de 0001-0020.

create table breathing_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  pattern text not null check (pattern in ('lenta', 'suspiro', '478')),
  started_at timestamptz not null default now(),
  seconds int not null check (seconds between 30 and 3600),
  calm_before int check (calm_before between 1 and 5),   -- 1 muy tenso, 5 muy tranquilo
  calm_after int check (calm_after between 1 and 5),
  created_at timestamptz not null default now()
);
create index breathing_sessions_patient_idx on breathing_sessions (patient_id, started_at desc);

alter table breathing_sessions enable row level security;
create policy coach_all on breathing_sessions for all using (is_coach()) with check (is_coach());
-- El paciente ve y anota las suyas con el módulo activo. Solo de los últimos 2 días y nunca en el futuro. No las cambia ni las borra.
create policy patient_read on breathing_sessions for select
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('breathing'));
create policy patient_insert on breathing_sessions for insert
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('breathing')
    and started_at <= now() + interval '5 minutes' and started_at >= now() - interval '2 days');

insert into modules (slug, name, description, is_available)
values ('breathing', 'Respiración guiada', 'Ejercicios de respiración con temporizador', true)
on conflict (slug) do update set is_available = true;
