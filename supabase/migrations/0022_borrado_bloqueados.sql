-- Borrado automático de los datos de la app bloqueados (condiciones 1.4, aprobadas por la asesora el 9 nov 2026).
-- Tras la baja (paciente archivado) o la retirada del consentimiento, los datos de la app quedan bloqueados
-- cinco años y después se borran. La historia clínica nunca se toca: tiene su propio plazo legal.
-- Lo ejecuta un reloj mensual (supabase/manual/reloj_borrado.sql). Nadie puede llamarlo desde la app.
-- Depende de 0001-0021.

-- 1. Fecha de baja: se apunta sola al archivar un paciente y se quita si se reactiva.
alter table profiles add column archived_at timestamptz;
update profiles set archived_at = updated_at where status = 'archived' and archived_at is null;

create or replace function set_archived_at()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.archived_at := case when new.status = 'archived' then now() end;
  elsif new.status is distinct from old.status then
    new.archived_at := case when new.status = 'archived' then now() end;
  else
    new.archived_at := old.archived_at;  -- nadie la cambia a mano
  end if;
  return new;
end;
$$;
create trigger profiles_archived_at before insert or update on profiles
  for each row execute function set_archived_at();

-- 2. Registro de borrados: qué paciente, cuándo y cuántas filas. Sin datos de salud.
--    Sin referencia a profiles: debe quedar aunque se borre la cuenta.
create table purge_log (
  id bigint generated always as identity primary key,
  patient_id uuid not null,
  purged_at timestamptz not null default now(),
  motivo text not null check (motivo in ('consentimiento_retirado', 'baja')),
  cuenta_borrada boolean not null,
  filas jsonb not null
);
alter table purge_log enable row level security;
create policy coach_read on purge_log for select using (is_coach());
revoke insert, update, delete on purge_log from authenticated, anon;

-- 3. Pacientes con datos bloqueados hace más de cinco años.
create or replace function _pacientes_a_borrar()
returns table (patient_id uuid, motivo text)
language sql stable security definer set search_path = public
as $$
  select p.id,
         case when p.status = 'archived' and p.archived_at < now() - interval '5 years' then 'baja'
              else 'consentimiento_retirado' end
  from profiles p
  where p.role = 'patient'
    and (
      -- Baja: archivado hace más de cinco años (tenga o no el consentimiento en vigor)
      (p.status = 'archived' and p.archived_at < now() - interval '5 years')
      -- Consentimiento retirado hace más de cinco años y sin aceptar otro después
      or (
        exists (select 1 from consents c where c.patient_id = p.id)
        and not exists (select 1 from consents c where c.patient_id = p.id and c.withdrawn_at is null and c.replaced_at is null)
        and (select max(c.withdrawn_at) from consents c where c.patient_id = p.id) < now() - interval '5 years'
      )
    );
$$;

-- 4. El borrado. Devuelve cuántos pacientes ha tratado.
create or replace function purgar_datos_bloqueados()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  n integer := 0;
  filas jsonb;
  c integer;
  t text;
  con_historia boolean;
begin
  for r in select * from _pacientes_a_borrar() loop
    filas := '{}'::jsonb;
    -- Datos de la app, de lo más dependiente a lo menos. Los ejercicios con series se pueden borrar aquí
    -- porque el guardián de 0013 solo actúa con un usuario conectado y este proceso no lo tiene.
    foreach t in array array[
      'workouts', 'program_assignments', 'set_logs', 'workout_item_feedback', 'body_measurements',
      'sleep_logs', 'meal_events', 'habit_logs', 'patient_habits', 'questionnaire_responses',
      'questionnaire_assignments', 'breathing_sessions', 'messages', 'checkins', 'monthly_reviews',
      'coach_notes', 'patient_modules', 'patient_settings'
    ] loop
      execute format('delete from %I where patient_id = $1', t) using r.patient_id;
      get diagnostics c = row_count;
      if c > 0 then filas := filas || jsonb_build_object(t, c); end if;
    end loop;
    delete from push_subscriptions where user_id = r.patient_id;
    delete from notification_log where user_id = r.patient_id;

    -- Si no hay historia clínica ni documentos compartidos, se borra también la cuenta (nombre, email,
    -- consentimientos). Con historia clínica, el perfil se queda: la historia lo necesita.
    -- Los documentos compartidos (PDF) se borran a mano: los archivos solo se pueden borrar con la app.
    con_historia := exists (select 1 from clinical_records where patient_id = r.patient_id)
      or exists (select 1 from consultations where patient_id = r.patient_id)
      or exists (select 1 from clinical_documents where patient_id = r.patient_id)
      or exists (select 1 from access_log where patient_id = r.patient_id)
      or exists (select 1 from patient_documents where patient_id = r.patient_id);
    -- Ya borrado otro mes y sin nada nuevo: no se repite en el registro.
    if filas = '{}'::jsonb and con_historia then continue; end if;
    if not con_historia then
      delete from auth.users where id = r.patient_id;
    end if;

    insert into purge_log (patient_id, motivo, cuenta_borrada, filas)
      values (r.patient_id, r.motivo, not con_historia, filas);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Solo lo ejecuta el reloj de la base de datos, nunca la app.
revoke execute on function purgar_datos_bloqueados() from public, authenticated, anon;
revoke execute on function _pacientes_a_borrar() from public, authenticated, anon;
