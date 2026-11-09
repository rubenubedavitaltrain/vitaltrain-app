-- Resumen mensual por paciente (núcleo, seguimiento).
-- Las cifras del mes (adherencia, esfuerzo, cargas, medidas, sueño, hábitos, notas) se calculan en la app
-- y se guardan como foto fija (snapshot) al guardar, para que el resumen compartido no cambie después.
-- El coach escribe sus conclusiones y los objetivos del mes siguiente y decide si lo comparte.
-- Depende de 0001-0016.

create table monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  conclusions text check (char_length(conclusions) <= 5000),
  next_goals text check (char_length(next_goals) <= 2000),
  snapshot jsonb,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, month)
);
create trigger monthly_reviews_touch before update on monthly_reviews for each row execute function touch_updated_at();

alter table monthly_reviews enable row level security;
create policy coach_all on monthly_reviews for all using (is_coach()) with check (is_coach());
create policy patient_read on monthly_reviews for select
  using (patient_id = auth.uid() and shared_at is not null and is_active_patient());
