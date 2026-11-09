-- Borrado solo con autorización del coach (decidido por Rubén el 9 nov 2026).
-- Sustituye el borrado automático de 0022: nada se borra solo.
-- La base de datos solo AVISA de qué pacientes llevan más de cinco años con los datos bloqueados.
-- El coach, con doble factor, revisa la lista y autoriza el borrado de cada paciente, uno a uno.
-- Nunca afecta al coach (solo cuentas de paciente) ni a la historia clínica.
-- Depende de 0001-0022.

-- 1. Fuera el reloj mensual, si se llegó a programar.
do $$
begin
  perform cron.unschedule('borrado-datos-bloqueados');
exception when others then null;  -- no estaba programado, o pg_cron no está instalado
end;
$$;

-- 2. Fuera el borrado en bloque.
drop function if exists purgar_datos_bloqueados();

-- 3. Quién autorizó cada borrado.
alter table purge_log add column autorizado_por uuid;

-- 4. Lista de pacientes pendientes de decidir.
--    _pendientes_de_borrar: interna (la usa la función de avisos para mandar el email al coach).
--    pendientes_de_borrar: la que ve el coach en la app, solo con doble factor.
create or replace function _pendientes_de_borrar()
returns table (patient_id uuid, nombre text, motivo text, bloqueado_desde timestamptz, tiene_historia boolean)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, x.motivo,
         case when x.motivo = 'baja' then p.archived_at
              else (select max(c.withdrawn_at) from consents c where c.patient_id = p.id) end,
         exists (select 1 from clinical_records where patient_id = p.id)
           or exists (select 1 from consultations where patient_id = p.id)
           or exists (select 1 from clinical_documents where patient_id = p.id)
  from _pacientes_a_borrar() x
  join profiles p on p.id = x.patient_id
  -- Si ya se borraron sus datos y no hay nada nuevo, no vuelve a salir
  where (
      exists (select 1 from workouts w where w.patient_id = p.id)
      or exists (select 1 from body_measurements m where m.patient_id = p.id)
      or exists (select 1 from sleep_logs s where s.patient_id = p.id)
      or exists (select 1 from meal_events e where e.patient_id = p.id)
      or exists (select 1 from habit_logs h where h.patient_id = p.id)
      or exists (select 1 from questionnaire_responses q where q.patient_id = p.id)
      or exists (select 1 from breathing_sessions b where b.patient_id = p.id)
      or exists (select 1 from messages g where g.patient_id = p.id)
      or exists (select 1 from monthly_reviews r where r.patient_id = p.id)
      or not exists (select 1 from purge_log l where l.patient_id = p.id)
    )
  order by 4;
$$;

create or replace function pendientes_de_borrar()
returns table (patient_id uuid, nombre text, motivo text, bloqueado_desde timestamptz, tiene_historia boolean)
language sql stable security definer set search_path = public
as $$
  select * from _pendientes_de_borrar() where is_coach_mfa();
$$;

-- 4b. Aviso por email al coach, una vez al mes, si hay pendientes (lo envía la función «avisos»).
alter table notification_log drop constraint if exists notification_log_kind_check;
alter table notification_log add constraint notification_log_kind_check
  check (kind in ('mensaje', 'mensaje_email', 'recordatorio_entreno', 'borrado_pendiente'));

-- 5. Borrar los datos de UN paciente, autorizado por el coach con doble factor.
--    Solo si de verdad lleva más de cinco años bloqueado. Nunca toca la historia clínica.
create or replace function borrar_datos_bloqueados(p_patient uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_motivo text;
  filas jsonb := '{}'::jsonb;
  c integer;
  t text;
  con_historia boolean;
begin
  if not is_coach_mfa() then
    raise exception 'Solo el coach, con doble factor, puede autorizar un borrado';
  end if;
  select motivo into v_motivo from _pacientes_a_borrar() where patient_id = p_patient;
  if v_motivo is null then
    raise exception 'Este paciente no lleva cinco años con los datos bloqueados: no se puede borrar';
  end if;

  foreach t in array array[
    'workouts', 'program_assignments', 'set_logs', 'workout_item_feedback', 'body_measurements',
    'sleep_logs', 'meal_events', 'habit_logs', 'patient_habits', 'questionnaire_responses',
    'questionnaire_assignments', 'breathing_sessions', 'messages', 'checkins', 'monthly_reviews',
    'coach_notes', 'patient_modules', 'patient_settings'
  ] loop
    execute format('delete from %I where patient_id = $1', t) using p_patient;
    get diagnostics c = row_count;
    if c > 0 then filas := filas || jsonb_build_object(t, c); end if;
  end loop;
  delete from push_subscriptions where user_id = p_patient;
  delete from notification_log where user_id = p_patient;

  -- Sin historia clínica ni documentos compartidos, se borra también la cuenta.
  con_historia := exists (select 1 from clinical_records where patient_id = p_patient)
    or exists (select 1 from consultations where patient_id = p_patient)
    or exists (select 1 from clinical_documents where patient_id = p_patient)
    or exists (select 1 from access_log where patient_id = p_patient)
    or exists (select 1 from patient_documents where patient_id = p_patient);
  if not con_historia then
    delete from auth.users where id = p_patient and exists (select 1 from profiles where id = p_patient and role = 'patient');
  end if;

  insert into purge_log (patient_id, motivo, cuenta_borrada, filas, autorizado_por)
    values (p_patient, v_motivo, not con_historia, filas, auth.uid());
  return jsonb_build_object('cuenta_borrada', not con_historia, 'filas', filas);
end;
$$;

revoke execute on function _pendientes_de_borrar() from public, anon, authenticated;
revoke execute on function pendientes_de_borrar() from public, anon;
revoke execute on function borrar_datos_bloqueados(uuid) from public, anon;
grant execute on function pendientes_de_borrar() to authenticated;
grant execute on function borrar_datos_bloqueados(uuid) to authenticated;

-- La función «avisos» (con la clave de servidor) lee la lista interna para pedir autorización por email.
do $$
begin
  grant execute on function _pendientes_de_borrar() to service_role;
exception when undefined_object then null;  -- en las pruebas no existe ese rol
end;
$$;
