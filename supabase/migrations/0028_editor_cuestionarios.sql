-- Editor de cuestionarios de seguimiento: el coach crea los suyos desde el panel, sin programar (los de inicio de paciente siguen en Fluent Forms).
-- - La base de datos comprueba que cada cuestionario está bien formado antes de guardarlo.
-- - Los dos del sistema (cronotipo y check-in semanal) no se pueden cambiar: de ellos dependen cálculos y gráficas.
-- - Un cuestionario que ya tiene respuestas no cambia sus preguntas (las respuestas perderían sentido):
--   se edita una copia. Título, descripción, pilar y archivar sí se pueden cambiar.
-- - Cada cuestionario dice si se responde una vez o cada semana (default_recurrence).
-- No borra ni cambia ningún dato existente. Depende de 0001-0027.

alter table questionnaires add column is_system boolean not null default false;
alter table questionnaires add column default_recurrence text check (default_recurrence in ('weekly'));
update questionnaires set is_system = true where slug in ('rmeq', 'checkin-semanal');
update questionnaires set default_recurrence = 'weekly' where slug = 'checkin-semanal';

create or replace function guard_questionnaire() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  preg jsonb; o jsonb; ids text[] := '{}'; valores numeric[]; n int; tipo text;
begin
  -- Cambios hechos desde el panel de Supabase (sin usuario conectado): se permiten, como en el resto de la app
  if auth.uid() is null then return new; end if;

  if tg_op = 'UPDATE' then
    if old.is_system and (new.schema is distinct from old.schema or new.slug is distinct from old.slug
        or new.default_recurrence is distinct from old.default_recurrence or new.is_system is distinct from old.is_system) then
      raise exception 'Este cuestionario es del sistema y no se puede cambiar';
    end if;
    if new.is_system is distinct from old.is_system then raise exception 'No se puede cambiar'; end if;
    if new.schema is distinct from old.schema then
      if exists (select 1 from questionnaire_responses r where r.questionnaire_id = old.id) then
        raise exception 'Este cuestionario ya tiene respuestas: haz una copia para cambiar las preguntas';
      end if;
      new.version := old.version + 1;
    else
      new.version := old.version;
    end if;
  else
    if new.is_system then raise exception 'No se puede crear un cuestionario del sistema'; end if;
    new.version := 1;
  end if;

  -- Forma de las preguntas
  n := jsonb_array_length(new.schema -> 'questions');
  if n < 1 or n > 40 then raise exception 'Un cuestionario tiene entre 1 y 40 preguntas'; end if;
  for preg in select * from jsonb_array_elements(new.schema -> 'questions') loop
    tipo := preg ->> 'type';
    if coalesce(preg ->> 'id', '') !~ '^[a-z0-9_]{1,30}$' then raise exception 'Identificador de pregunta no válido'; end if;
    if (preg ->> 'id') = any (ids) then raise exception 'Hay dos preguntas con el mismo identificador'; end if;
    ids := ids || (preg ->> 'id');
    if char_length(coalesce(preg ->> 'text', '')) not between 2 and 300 then raise exception 'Cada pregunta necesita un texto (2 a 300 caracteres)'; end if;
    if tipo not in ('single', 'scale', 'text') then raise exception 'Tipo de pregunta no válido'; end if;
    if coalesce((preg ->> 'scored')::boolean, false) and tipo = 'text' then raise exception 'Una pregunta de texto no puede puntuar'; end if;
    if tipo = 'single' then
      if jsonb_typeof(preg -> 'options') <> 'array' or jsonb_array_length(preg -> 'options') not between 2 and 12 then
        raise exception 'Las preguntas de opciones necesitan entre 2 y 12 opciones: %', preg ->> 'text';
      end if;
      valores := '{}';
      for o in select * from jsonb_array_elements(preg -> 'options') loop
        if char_length(coalesce(o ->> 'label', '')) not between 1 and 120 then raise exception 'Opción sin texto en: %', preg ->> 'text'; end if;
        if jsonb_typeof(o -> 'value') <> 'number' then raise exception 'Opción sin valor en: %', preg ->> 'text'; end if;
        if (o ->> 'value')::numeric = any (valores) then raise exception 'Dos opciones con el mismo valor en: %', preg ->> 'text'; end if;
        valores := valores || (o ->> 'value')::numeric;
      end loop;
    elsif tipo = 'scale' then
      if jsonb_typeof(preg -> 'min') <> 'number' or jsonb_typeof(preg -> 'max') <> 'number'
         or (preg ->> 'min')::numeric <> trunc((preg ->> 'min')::numeric) or (preg ->> 'max')::numeric <> trunc((preg ->> 'max')::numeric)
         or (preg ->> 'max')::numeric - (preg ->> 'min')::numeric not between 1 and 10 then
        raise exception 'La escala va de un número entero a otro mayor, con 10 pasos como mucho: %', preg ->> 'text';
      end if;
      if char_length(coalesce(preg ->> 'minLabel', '')) > 40 or char_length(coalesce(preg ->> 'maxLabel', '')) > 40 then
        raise exception 'Las etiquetas de la escala tienen 40 caracteres como mucho';
      end if;
    end if;
  end loop;
  return new;
end $$;
create trigger questionnaires_guard before insert or update on questionnaires for each row execute function guard_questionnaire();

-- Un cuestionario con asignaciones o respuestas no se borra: se archiva
create or replace function guard_questionnaire_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.is_system or exists (select 1 from questionnaire_assignments a where a.questionnaire_id = old.id) then
    raise exception 'Este cuestionario está en uso: archívalo en lugar de borrarlo';
  end if;
  return old;
end $$;
create trigger questionnaires_guard_delete before delete on questionnaires for each row execute function guard_questionnaire_delete();
