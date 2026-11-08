-- Consentimiento del paciente (art. 9.2.a RGPD).
-- Sin un consentimiento en vigor el paciente no puede leer ni registrar nada de salud:
-- is_active_patient() pasa a exigirlo, y todas las reglas de acceso del paciente dependen de ella.
-- El texto de cada versión vive en la app (src/core/legal/consentimiento.ts) y en docs/legal/.
-- Depende de 0001-0008.

create table consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  version text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz,          -- el paciente lo retiró
  replaced_at timestamptz,           -- aceptó una versión posterior
  user_agent text check (char_length(user_agent) <= 300)
);
-- Como mucho un consentimiento en vigor por paciente
create unique index consents_one_active on consents (patient_id) where withdrawn_at is null and replaced_at is null;

alter table consents enable row level security;
-- Nadie lo escribe directamente: solo con accept_consent y withdraw_consent.
-- El coach lo puede ver, pero no aceptar ni retirar en nombre del paciente.
create policy coach_read on consents for select using (is_coach());
create policy patient_read on consents for select using (patient_id = auth.uid());

-- Paciente con cuenta activa (sin mirar el consentimiento). Uso interno.
create or replace function _is_patient_account_active()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'patient' and status = 'active');
$$;

-- Paciente activo = cuenta activa y consentimiento en vigor
create or replace function is_active_patient()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'patient' and status = 'active')
     and exists (select 1 from consents where patient_id = auth.uid() and withdrawn_at is null and replaced_at is null);
$$;

-- El paciente acepta una versión del texto. Si tenía otra en vigor, queda sustituida.
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
  if coalesce(trim(p_version), '') = '' then
    raise exception 'Falta la versión del texto';
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

-- El paciente retira su consentimiento. Desde ese momento no puede ver ni registrar nada.
create or replace function withdraw_consent()
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'patient') then
    raise exception 'Solo el paciente puede retirar su consentimiento';
  end if;
  update consents set withdrawn_at = now()
  where patient_id = auth.uid() and withdrawn_at is null and replaced_at is null;
  return found;
end;
$$;

revoke all on function _is_patient_account_active() from public, anon, authenticated;
revoke all on function accept_consent(text, text) from public, anon;
revoke all on function withdraw_consent() from public, anon;
grant execute on function accept_consent(text, text) to authenticated;
grant execute on function withdraw_consent() to authenticated;
