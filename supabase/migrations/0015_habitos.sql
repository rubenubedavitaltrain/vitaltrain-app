-- Motor de hábitos y protocolos (módulo "habits"). Sirve para todos los pilares:
-- alimentación consciente, movimiento, ritmos circadianos, regulación emocional y naturaleza.
-- El coach elige del catálogo (o crea uno nuevo) y lo asigna con su objetivo y sus días.
-- El paciente marca cada día lo que ha hecho. La app no decide qué hábitos tiene nadie.
-- Diseño original en supabase/diseno/fase2_habitos_circadiano_cuestionarios.sql.
-- Depende de 0001-0014.

create type habit_kind as enum ('check', 'number', 'time', 'duration', 'scale');

create table habit_definitions (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid references pillars(id) on delete set null,
  module_slug text references modules(slug) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  short_instruction text check (char_length(short_instruction) <= 200),  -- lo que ve el paciente en una línea
  rationale text check (char_length(rationale) <= 400),                  -- el porqué, para el paciente
  kind habit_kind not null default 'check',
  unit text check (char_length(unit) <= 20),          -- 'min', 'pasos', 'vasos'...
  default_target numeric check (default_target is null or default_target > 0),
  anchor text check (anchor in ('wake', 'sunrise', 'sunset', 'bedtime', 'first_meal', 'last_meal')),
  anchor_offset_minutes int check (anchor_offset_minutes between -720 and 720),
  video_provider video_provider not null default 'none',
  video_id text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table patient_habits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  habit_id uuid not null references habit_definitions(id),
  target numeric check (target is null or target > 0),       -- sustituye a default_target
  days_of_week int[] not null default '{1,2,3,4,5,6,7}'       -- 1 = lunes … 7 = domingo
    check (days_of_week <@ '{1,2,3,4,5,6,7}' and cardinality(days_of_week) > 0),
  window_start time,
  window_end time,
  remind boolean not null default false,
  coach_note text check (char_length(coach_note) <= 300),     -- indicación personal que ve el paciente
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index patient_habits_patient_idx on patient_habits (patient_id, is_active);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  patient_habit_id uuid not null references patient_habits(id) on delete cascade,
  patient_id uuid not null references profiles(id) on delete cascade,
  log_date date not null,
  done boolean,
  value_numeric numeric check (value_numeric is null or value_numeric between 0 and 100000),
  value_time time,
  note text check (char_length(note) <= 300),
  logged_at timestamptz not null default now(),
  unique (patient_habit_id, log_date)
);
create index habit_logs_patient_idx on habit_logs (patient_id, log_date);

alter table habit_definitions enable row level security;
alter table patient_habits enable row level security;
alter table habit_logs enable row level security;

create policy coach_all on habit_definitions for all using (is_coach()) with check (is_coach());
create policy coach_all on patient_habits for all using (is_coach()) with check (is_coach());
create policy coach_all on habit_logs for all using (is_coach()) with check (is_coach());

-- El catálogo no tiene datos personales: lo lee cualquier paciente activo
create policy patient_read on habit_definitions for select using (is_active_patient());

-- Ve sus hábitos asignados si tiene el módulo
create policy patient_read on patient_habits for select
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('habits'));

-- Registra los suyos, de hoy o de la última semana, y solo en hábitos suyos y activos
create policy patient_rw on habit_logs for all
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('habits'))
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('habits')
    and log_date <= hoy_local() and log_date >= hoy_local() - 7
    and exists (select 1 from patient_habits ph where ph.id = patient_habit_id and ph.patient_id = auth.uid() and ph.is_active));

update modules set is_available = true where slug = 'habits';

-- ============================================================
-- Catálogo inicial. Rubén puede cambiar textos, archivar o crear hábitos nuevos desde el panel.
-- ============================================================
insert into habit_definitions (pillar_id, module_slug, name, short_instruction, rationale, kind, unit, default_target, anchor, anchor_offset_minutes)
select p.id, 'habits', h.name, h.instr, h.why, h.kind::habit_kind, h.unit, h.target, h.anchor, h.off
from (values
  -- Alimentación consciente
  ('alimentacion-consciente', 'Comer sentado y sin pantallas', 'En la mesa, despacio, sin móvil ni televisión.', 'Comer con atención pone al cuerpo en modo digestión: más saliva, más jugos digestivos y una señal de saciedad más clara.', 'check', null, null, null, null),
  ('alimentacion-consciente', 'Masticar bien', 'Cada bocado hasta que sea casi líquido.', 'La digestión empieza en la boca. Masticar bien descarga trabajo al estómago y al intestino.', 'check', null, null, null, null),
  ('alimentacion-consciente', 'Cenar pronto', 'Termina de cenar unas 3 horas antes de acostarte.', 'Dormir con la digestión en marcha empeora el sueño y quita al intestino su tiempo de descanso.', 'check', null, null, 'bedtime', -180),
  ('alimentacion-consciente', '12 horas de pausa nocturna', 'Entre la cena y el desayuno, al menos 12 horas.', 'Esa pausa permite al intestino hacer su limpieza nocturna y ayuda a ordenar el reloj de la digestión.', 'check', null, null, null, null),
  ('alimentacion-consciente', 'Verdura en las comidas', 'Cuenta las raciones de verdura del día.', 'La fibra y los polifenoles de las verduras alimentan a tu microbiota.', 'number', 'raciones', 3, null, null),
  ('alimentacion-consciente', 'Agua a lo largo del día', 'Cuenta los vasos. Mejor repartidos que de golpe.', 'Una hidratación suficiente ayuda al tránsito intestinal, a la energía y a la concentración.', 'number', 'vasos', 6, null, null),
  -- Movimiento inteligente
  ('movimiento-inteligente', 'Pasos del día', 'Mira los pasos en tu móvil o reloj al final del día.', 'Caminar a diario es la base del movimiento: mejora la circulación y cómo usa tu cuerpo la glucosa.', 'number', 'pasos', 8000, null, null),
  ('movimiento-inteligente', 'Paseo después de comer', '10 minutos caminando tras la comida principal.', 'Un paseo corto después de comer ayuda a que la glucosa no suba tanto.', 'duration', 'min', 10, null, null),
  ('movimiento-inteligente', 'Romper el tiempo sentado', 'Cada hora sentado, levántate y muévete 2 o 3 minutos.', 'Pasar muchas horas seguidas sentado frena el metabolismo, aunque entrenes.', 'check', null, null, null, null),
  -- Ritmos circadianos
  ('ritmos-circadianos', 'Luz natural al despertar', 'Sal fuera o asómate a una ventana abierta en los primeros 30 minutos.', 'La luz de la mañana pone en hora tu reloj interno: más energía de día y mejor sueño de noche.', 'duration', 'min', 10, 'wake', 30),
  ('ritmos-circadianos', 'Levantarse a la misma hora', 'También el fin de semana. Una hora de margen como mucho.', 'Levantarte siempre a una hora parecida es lo que más ordena el ritmo circadiano.', 'check', null, null, null, null),
  ('ritmos-circadianos', 'Luz tenue al anochecer', 'Luces cálidas y bajas desde una hora antes de dormir.', 'La luz intensa por la noche retrasa la melatonina y con ella el sueño.', 'check', null, null, 'bedtime', -60),
  ('ritmos-circadianos', 'Sin pantallas antes de dormir', 'Móvil y pantallas fuera la última hora del día.', 'La luz y los estímulos de las pantallas mantienen el cerebro en alerta cuando debería prepararse para dormir.', 'check', null, null, 'bedtime', -60),
  ('ritmos-circadianos', 'Dormir a oscuras', 'Habitación oscura, fresca y sin luces de aparatos.', 'La oscuridad completa ayuda a mantener la melatonina alta durante la noche.', 'check', null, null, null, null),
  -- Regulación emocional
  ('regulacion-emocional', 'Respiración lenta', 'Inspira 4-5 segundos y suelta 5-6, por la nariz.', 'Respirar despacio activa el freno del sistema nervioso y ayuda a salir del modo alerta.', 'duration', 'min', 5, null, null),
  ('regulacion-emocional', 'Un rato sin estímulos', 'Sin móvil ni tareas. Solo estar.', 'El sistema nervioso necesita pausas para bajar revoluciones y poder reparar.', 'duration', 'min', 10, null, null),
  ('regulacion-emocional', 'Cómo ha ido el día', 'Del 1 (muy tenso) al 5 (muy tranquilo).', 'Anotarlo cada día ayuda a ver patrones: qué te carga y qué te ayuda.', 'scale', null, null, null, null),
  ('regulacion-emocional', 'Tres cosas del día', 'Antes de dormir, piensa o escribe tres cosas que han ido bien.', 'Llevar la atención a lo que ha ido bien ayuda a bajar el ruido mental antes de dormir.', 'check', null, null, 'bedtime', -30),
  ('regulacion-emocional', 'Tiempo con alguien', 'Una conversación de verdad, en persona o por teléfono.', 'El contacto con otras personas es uno de los reguladores más potentes del sistema nervioso.', 'check', null, null, null, null),
  -- Contacto con la naturaleza
  ('contacto-naturaleza', 'Tiempo al aire libre', 'Fuera de casa y del coche, mejor entre árboles o cerca del agua.', 'Estar en la naturaleza baja la activación del sistema nervioso y suma luz natural.', 'duration', 'min', 30, null, null),
  ('contacto-naturaleza', 'Sol en la piel', 'Dentro de tu ventana UVB, brazos y piernas al sol. Nunca hasta enrojecer.', 'Es la principal fuente de vitamina D. Mira tu ventana UVB en «Mi ritmo».', 'duration', 'min', 15, null, null),
  ('contacto-naturaleza', 'Pies descalzos', 'Sobre hierba, tierra o arena.', 'Estímulo para los pies y una pausa del calzado. Además, suele ir con tiempo al aire libre.', 'duration', 'min', 10, null, null),
  ('contacto-naturaleza', 'Mirar lejos', 'Al aire libre, unos minutos mirando el horizonte.', 'Descansa la vista de las pantallas y relaja la atención.', 'check', null, null, null, null)
) as h(pillar, name, instr, why, kind, unit, target, anchor, off)
join pillars p on p.slug = h.pillar;
