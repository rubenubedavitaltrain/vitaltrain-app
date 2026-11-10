-- Dos pendientes de la revisión de seguridad del 8 nov 2026.
--
-- 1. La base de datos exige una versión vigente de las condiciones.
--    consent_versions guarda las versiones válidas. Hoy solo la 1.4 (aprobada por la asesora el 9 nov 2026).
--    Cuando cambien las condiciones: una migración añade la nueva versión (la anterior sigue valiendo),
--    se publica la app con el texto nuevo (pide aceptar de nuevo) y, solo cuando Rubén lo decida,
--    otra migración retira la anterior (retired_at). Así nunca se bloquea a nadie por el orden de los pasos.
--
-- 2. Altas que fallan a medias: perfil y módulo de entrenamiento se crean en un solo paso (_completar_alta),
--    y si quedó una cuenta de acceso sin perfil de un intento anterior, el alta la recupera (_usuario_por_email).
--    Las dos funciones solo las usa la función de servidor «alta-paciente» (clave de servidor).
--
-- No borra ni cambia ningún dato existente. Depende de 0001-0028.

-- 1 ---------------------------------------------------------------
create table consent_versions (
  version text primary key check (char_length(version) between 1 and 40),
  published_at timestamptz not null default now(),
  retired_at timestamptz
);
alter table consent_versions enable row level security;
create policy read_all on consent_versions for select to authenticated using (true);
insert into consent_versions (version) values ('1.4');

create or replace function is_active_patient()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'patient' and status = 'active')
     and exists (select 1 from consents c join consent_versions v on v.version = c.version and v.retired_at is null
                 where c.patient_id = auth.uid() and c.withdrawn_at is null and c.replaced_at is null);
$$;

create or replace function accept_consent(p_version text, p_user_agent text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not _is_patient_account_active() then
    raise exception 'Solo un paciente con la cuenta activa puede aceptar';
  end if;
  if not exists (select 1 from consent_versions where version = trim(coalesce(p_version, '')) and retired_at is null) then
    raise exception 'Esa versión de las condiciones no está vigente';
  end if;
  select id into v_id from consents
  where patient_id = auth.uid() and withdrawn_at is null and replaced_at is null and version = trim(p_version);
  if v_id is not null then return v_id; end if;
  update consents set replaced_at = now()
  where patient_id = auth.uid() and withdrawn_at is null and replaced_at is null;
  insert into consents (patient_id, version, user_agent)
  values (auth.uid(), trim(p_version), left(p_user_agent, 300))
  returning id into v_id;
  return v_id;
end;
$$;

-- 2 ---------------------------------------------------------------
create or replace function _usuario_por_email(p_email text)
returns uuid
language sql stable security definer set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

create or replace function _completar_alta(p_id uuid, p_nombre text, p_email text, p_telefono text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from profiles where id = p_id or lower(email) = lower(trim(p_email))) then
    raise exception 'Ya hay alguien dado de alta con ese email';
  end if;
  insert into profiles (id, role, full_name, email, phone) values (p_id, 'patient', trim(p_nombre), lower(trim(p_email)), p_telefono);
  insert into patient_modules (patient_id, module_slug) values (p_id, 'training') on conflict do nothing;
end;
$$;

revoke execute on function _usuario_por_email(text) from public, anon, authenticated;
revoke execute on function _completar_alta(uuid, text, text, text) from public, anon, authenticated;
do $$
begin
  grant execute on function _usuario_por_email(text) to service_role;
  grant execute on function _completar_alta(uuid, text, text, text) to service_role;
exception when undefined_object then null;  -- en las pruebas no existe ese rol
end;
$$;
