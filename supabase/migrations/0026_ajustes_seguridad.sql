-- Ajustes pendientes de la revisión de seguridad del 8 nov 2026 (prioridad baja).
-- 1. Para registrar entrenamiento (series, notas por ejercicio, terminar sesión) el paciente necesita
--    el módulo de entrenamiento activo. Leer su historial sigue igual.
-- 2. Límites de longitud en los textos que escribe el paciente o el coach y que aún no tenían.
-- 3. El paciente no puede poner fechas de inicio o fin de sesión en el futuro.
-- No borra ni cambia ningún dato existente: los límites solo se aplican a lo que se escriba a partir de ahora.
-- Depende de 0001-0025.

-- 1 ---------------------------------------------------------------
drop policy patient_rw_set_logs on set_logs;
create policy patient_read_set_logs on set_logs for select
  using (patient_id = auth.uid() and is_active_patient());
create policy patient_write_set_logs on set_logs for insert
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('training') and exists (
    select 1 from workout_items i join workout_blocks b on b.id = i.block_id join workouts w on w.id = b.workout_id
    where i.id = workout_item_id and w.patient_id = auth.uid()));
create policy patient_update_set_logs on set_logs for update
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('training'))
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('training') and exists (
    select 1 from workout_items i join workout_blocks b on b.id = i.block_id join workouts w on w.id = b.workout_id
    where i.id = workout_item_id and w.patient_id = auth.uid()));
create policy patient_delete_set_logs on set_logs for delete
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('training'));

drop policy patient_rw on workout_item_feedback;
create policy patient_read on workout_item_feedback for select
  using (patient_id = auth.uid() and is_active_patient());
create policy patient_insert on workout_item_feedback for insert
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('training') and exists (
    select 1 from workout_items i join workout_blocks b on b.id = i.block_id join workouts w on w.id = b.workout_id
    where i.id = workout_item_id and w.patient_id = auth.uid()));
create policy patient_update on workout_item_feedback for update
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('training'))
  with check (patient_id = auth.uid() and is_active_patient() and patient_has_module('training'));
create policy patient_delete on workout_item_feedback for delete
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('training'));

-- 3 (y 1): terminar o empezar una sesión exige el módulo y fechas no futuras
drop policy patient_update_workouts on workouts;
create policy patient_update_workouts on workouts for update
  using (patient_id = auth.uid() and is_active_patient() and patient_has_module('training'))
  with check (patient_id = auth.uid()
    and (started_at is null or started_at <= now() + interval '1 hour')
    and (completed_at is null or completed_at <= now() + interval '1 hour'));

-- 2 ---------------------------------------------------------------
alter table workouts add constraint workouts_feeling_largo check (char_length(feeling) <= 500) not valid;
alter table workouts add constraint workouts_notas_largo check (char_length(patient_notes) <= 2000) not valid;
alter table coach_notes add constraint coach_notes_largo check (char_length(body) between 1 and 4000) not valid;
