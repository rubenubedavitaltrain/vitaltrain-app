-- Plataforma Vitaltrain — núcleo modular: pilares, módulos y ajustes del paciente
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

-- Hábitos, ritmos circadianos y cuestionarios están diseñados en
-- supabase/diseno/fase2_habitos_circadiano_cuestionarios.sql y se aplicarán
-- como migración nueva cuando se construya cada módulo.

-- ============================================================
-- Row Level Security
-- ============================================================
alter table pillars enable row level security;
alter table modules enable row level security;
alter table patient_modules enable row level security;
alter table patient_settings enable row level security;

-- Coach: todo
create policy coach_all on pillars for all using (is_coach()) with check (is_coach());
create policy coach_all on modules for all using (is_coach()) with check (is_coach());
create policy coach_all on patient_modules for all using (is_coach()) with check (is_coach());
create policy coach_all on patient_settings for all using (is_coach()) with check (is_coach());

-- Paciente activo: lectura de catálogos
create policy patient_read on pillars for select using (is_active_patient());
create policy patient_read on modules for select using (is_active_patient());
create policy patient_read on patient_modules for select using (patient_id = auth.uid());

-- Paciente activo: sus ajustes
create policy patient_rw on patient_settings for all
  using (patient_id = auth.uid() and is_active_patient())
  with check (patient_id = auth.uid() and is_active_patient());

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
