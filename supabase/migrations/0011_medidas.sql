-- Mis medidas: peso, cintura y cadera. Opcional, sin fotos.
-- Es del núcleo (seguimiento común a todos los pilares): cualquier paciente activo con consentimiento puede anotarlas.
-- Una fila por paciente y día; si vuelve a anotar el mismo día, se actualiza.
-- Depende de 0001-0010.

create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2) check (weight_kg between 20 and 350),
  waist_cm numeric(5,1) check (waist_cm between 30 and 250),
  hip_cm numeric(5,1) check (hip_cm between 30 and 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, measured_on),
  check (weight_kg is not null or waist_cm is not null or hip_cm is not null)
);
create trigger body_measurements_touch before update on body_measurements for each row execute function touch_updated_at();

alter table body_measurements enable row level security;
create policy coach_all on body_measurements for all using (is_coach()) with check (is_coach());
create policy patient_rw on body_measurements for all
  using (patient_id = auth.uid() and is_active_patient())
  with check (patient_id = auth.uid() and is_active_patient() and measured_on <= current_date);
