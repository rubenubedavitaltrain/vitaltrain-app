-- Historia clínica y seguimiento de pacientes (CRM clínico). Decidido el 9 nov 2026 con el visto bueno del asesor.
-- Solo la ve y la escribe el coach, y solo con doble factor (sesión aal2: código de 6 dígitos + app de autenticación).
-- Reglas de integridad (Ley 41/2002 y buenas prácticas):
--   - Nada se borra de verdad: la ficha guarda versiones anteriores; una consulta cerrada no se edita (se añaden adendas);
--     un documento solo se puede borrar en las 24 h siguientes a subirlo (para corregir errores).
--   - Un paciente con historia no se puede eliminar (las claves impiden el borrado en cascada).
--   - Cada acceso y cada cambio queda en el registro de accesos, que nadie puede cambiar ni borrar.
-- Depende de 0001-0017.

create or replace function is_coach_mfa() returns boolean
language sql stable security definer set search_path = public as $$
  select is_coach() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create type consultation_modality as enum ('presencial', 'online', 'telefono');
create type consultation_status as enum ('draft', 'closed');
create type clinical_doc_category as enum ('analitica', 'cuestionario', 'estudio_metabolico', 'plan_alimentacion', 'tratamiento', 'test', 'informe', 'otro');

-- ---------- Registro de accesos ----------
create table access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  patient_id uuid references profiles(id) on delete restrict,
  action text not null check (action in ('ver_historia', 'ver_documento', 'crear', 'editar', 'cerrar', 'adenda', 'subir', 'borrar', 'exportar', 'importar')),
  entity text not null,
  entity_id uuid,
  detail text check (char_length(detail) <= 300)
);
create index access_log_patient_idx on access_log (patient_id, at desc);
alter table access_log enable row level security;
create policy coach_read on access_log for select using (is_coach_mfa());
revoke insert, update, delete, truncate on access_log from authenticated, anon;

create or replace function _log(p_patient uuid, p_action text, p_entity text, p_id uuid, p_detail text default null) returns void
language sql security definer set search_path = public as $$
  insert into access_log (patient_id, action, entity, entity_id, detail) values (p_patient, p_action, p_entity, p_id, p_detail);
$$;
revoke execute on function _log(uuid, text, text, uuid, text) from public, authenticated, anon;

-- Lo llama la app al abrir una historia o un documento
create or replace function registrar_acceso(p_patient uuid, p_action text, p_entity text, p_id uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_coach_mfa() then raise exception 'Solo el coach con doble factor'; end if;
  if p_action not in ('ver_historia', 'ver_documento', 'exportar') then raise exception 'Acción no válida'; end if;
  perform _log(p_patient, p_action, p_entity, p_id);
end $$;

-- ---------- Ficha clínica (una por paciente) ----------
create table clinical_records (
  patient_id uuid primary key references profiles(id) on delete restrict,
  main_reason text check (char_length(main_reason) <= 5000),          -- motivo de consulta
  personal_history text check (char_length(personal_history) <= 10000), -- antecedentes personales
  family_history text check (char_length(family_history) <= 5000),
  medication text check (char_length(medication) <= 5000),
  supplements text check (char_length(supplements) <= 5000),
  allergies text check (char_length(allergies) <= 2000),
  lifestyle text check (char_length(lifestyle) <= 5000),               -- hábitos, trabajo, contexto
  observations text check (char_length(observations) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- Versiones anteriores de la ficha: cada cambio guarda cómo estaba
create table clinical_record_versions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete restrict,
  old_row jsonb not null,
  changed_at timestamptz not null default now(),
  changed_by uuid default auth.uid()
);

-- ---------- Consultas de seguimiento ----------
create table consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete restrict,
  happened_at timestamptz not null default now(),
  modality consultation_modality not null default 'presencial',
  duration_minutes int check (duration_minutes between 1 and 600),
  reason text check (char_length(reason) <= 2000),        -- motivo de esta consulta
  subjective text check (char_length(subjective) <= 10000), -- lo que cuenta el paciente, evolución
  findings text check (char_length(findings) <= 10000),     -- valoración, hallazgos, pruebas revisadas
  plan text check (char_length(plan) <= 10000),             -- pautas
  goals text check (char_length(goals) <= 5000),            -- objetivos hasta la próxima
  next_review date,
  status consultation_status not null default 'draft',
  closed_at timestamptz,
  author uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consultations_patient_idx on consultations (patient_id, happened_at desc);

create table consultation_addenda (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations(id) on delete restrict,
  patient_id uuid not null references profiles(id) on delete restrict,
  text text not null check (char_length(text) between 1 and 5000),
  author uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Documentos clínicos (analíticas, informes...) ----------
create table clinical_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete restrict,
  category clinical_doc_category not null default 'otro',
  title text not null check (char_length(title) between 1 and 160),
  document_date date,
  note text check (char_length(note) <= 1000),
  storage_path text not null unique check (storage_path like patient_id::text || '/%'),
  size_bytes int check (size_bytes between 1 and 52428800),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  consultation_id uuid references consultations(id) on delete set null,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index clinical_documents_patient_idx on clinical_documents (patient_id, document_date desc);

-- ---------- Seguridad: solo el coach con doble factor ----------
alter table clinical_records enable row level security;
alter table clinical_record_versions enable row level security;
alter table consultations enable row level security;
alter table consultation_addenda enable row level security;
alter table clinical_documents enable row level security;

create policy coach_mfa on clinical_records for all using (is_coach_mfa()) with check (is_coach_mfa());
create policy coach_mfa_read on clinical_record_versions for select using (is_coach_mfa());
create policy coach_mfa on consultations for all using (is_coach_mfa()) with check (is_coach_mfa());
create policy coach_mfa_read on consultation_addenda for select using (is_coach_mfa());
create policy coach_mfa_insert on consultation_addenda for insert with check (is_coach_mfa());
create policy coach_mfa on clinical_documents for all using (is_coach_mfa()) with check (is_coach_mfa());
revoke insert, update, delete on clinical_record_versions from authenticated, anon;
revoke update, delete on consultation_addenda from authenticated, anon;

-- ---------- Reglas de integridad y registro automático ----------
create or replace function guard_clinical_record() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'La ficha clínica no se puede borrar'; end if;
  if tg_op = 'UPDATE' then
    insert into clinical_record_versions (patient_id, old_row) values (old.patient_id, to_jsonb(old));
    new.updated_at := now(); new.updated_by := auth.uid();
    perform _log(new.patient_id, 'editar', 'ficha', null);
  else
    perform _log(new.patient_id, 'crear', 'ficha', null);
  end if;
  return new;
end $$;
create trigger clinical_records_guard before insert or update or delete on clinical_records for each row execute function guard_clinical_record();

create or replace function guard_consultation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'closed' then raise exception 'Una consulta cerrada no se puede borrar'; end if;
    perform _log(old.patient_id, 'borrar', 'consulta', old.id, 'borrador');
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'closed' then raise exception 'La consulta está cerrada: añade una adenda'; end if;
    if new.patient_id <> old.patient_id then raise exception 'No se puede cambiar el paciente de una consulta'; end if;
    new.updated_at := now();
    if new.status = 'closed' then new.closed_at := now(); perform _log(new.patient_id, 'cerrar', 'consulta', new.id);
    else perform _log(new.patient_id, 'editar', 'consulta', new.id); end if;
  else
    new.author := auth.uid();
    if new.status = 'closed' then new.closed_at := now(); end if;
    perform _log(new.patient_id, 'crear', 'consulta', new.id);
  end if;
  return new;
end $$;
create trigger consultations_guard before insert or update or delete on consultations for each row execute function guard_consultation();

create or replace function guard_addendum() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from consultations c where c.id = new.consultation_id and c.patient_id = new.patient_id and c.status = 'closed') then
    raise exception 'Las adendas son para consultas cerradas del mismo paciente';
  end if;
  new.author := auth.uid(); new.created_at := now();
  perform _log(new.patient_id, 'adenda', 'consulta', new.consultation_id);
  return new;
end $$;
create trigger consultation_addenda_guard before insert on consultation_addenda for each row execute function guard_addendum();

create or replace function guard_clinical_document() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.created_at < now() - interval '24 hours' then raise exception 'Pasadas 24 horas, un documento clínico no se puede borrar'; end if;
    perform _log(old.patient_id, 'borrar', 'documento', old.id, old.title);
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.storage_path <> old.storage_path or new.patient_id <> old.patient_id then raise exception 'No se puede cambiar el archivo ni el paciente'; end if;
    perform _log(new.patient_id, 'editar', 'documento', new.id);
  else
    new.uploaded_by := auth.uid(); new.created_at := now();
    perform _log(new.patient_id, 'subir', 'documento', new.id, new.title);
  end if;
  return new;
end $$;
create trigger clinical_documents_guard before insert or update or delete on clinical_documents for each row execute function guard_clinical_document();

-- ---------- Almacén privado de la historia ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('historia', 'historia', false, 52428800, '{application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document}')
on conflict (id) do nothing;

create policy historia_leer on storage.objects for select to authenticated using (bucket_id = 'historia' and is_coach_mfa());
create policy historia_subir on storage.objects for insert to authenticated with check (bucket_id = 'historia' and is_coach_mfa());
-- Solo se borra un archivo que ya no tiene ficha (su documento se borró en las primeras 24 h, o la subida falló)
create policy historia_borrar on storage.objects for delete to authenticated using (
  bucket_id = 'historia' and is_coach_mfa()
  and not exists (select 1 from clinical_documents d where d.storage_path = storage.objects.name));
