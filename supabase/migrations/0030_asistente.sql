-- Asistente del coach (Claude conectado a la app).
-- El asistente lee los datos de los pacientes con la cuenta del coach y PROPONE cambios. Nunca cambia nada por su cuenta:
-- - Cada cambio es una propuesta guardada aquí (assistant_drafts), con su explicación.
-- - Solo se aplica cuando el coach lo aprueba (en Claude o en el panel), con aplicar_propuesta().
-- - Aplicar usa las mismas funciones que la app (save_workout, replace_exercise...): mismas reglas y límites.
-- - Queda registrado qué se propuso, quién lo aprobó y cuándo. Las propuestas no se borran: se descartan.
-- El profesional prescribe; la IA prepara borradores para él (Reglamento UE 2017/745).
-- No borra ni cambia ningún dato existente. Depende de 0001-0029.

create table assistant_drafts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete restrict,
  kind text not null check (kind in ('sesiones', 'cambio_ejercicio', 'mensaje', 'habito')),
  title text not null check (char_length(title) between 1 and 200),
  rationale text check (char_length(rationale) <= 4000),   -- por qué: lo que el asistente ha tenido en cuenta
  payload jsonb not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'aplicada', 'descartada')),
  result jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  decided_at timestamptz,
  decided_by uuid
);
create index assistant_drafts_status_idx on assistant_drafts (status, created_at desc);
create index assistant_drafts_patient_idx on assistant_drafts (patient_id, created_at desc);
alter table assistant_drafts enable row level security;
create policy coach_read on assistant_drafts for select using (is_coach());
create policy coach_create on assistant_drafts for insert with check (
  is_coach() and status = 'pendiente' and decided_at is null and decided_by is null and result is null
  and exists (select 1 from profiles p where p.id = patient_id and p.role = 'patient'));
-- Cambiar o borrar solo con las funciones de abajo
revoke update, delete, truncate on assistant_drafts from authenticated, anon;

-- Aplica una propuesta pendiente. Solo el coach. Todo o nada.
create or replace function aplicar_propuesta(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d assistant_drafts;
  s jsonb;
  v_res jsonb;
  v_ids jsonb := '[]'::jsonb;
  v_n int;
  v_id uuid;
begin
  if not is_coach() then raise exception 'Solo el coach puede aplicar propuestas'; end if;
  select * into d from assistant_drafts where id = p_id for update;
  if not found then raise exception 'Propuesta no encontrada'; end if;
  if d.status <> 'pendiente' then raise exception 'Esta propuesta ya está %', d.status; end if;

  if d.kind = 'sesiones' then
    -- {"sesiones": [{"name", "coach_message", "dates": [...], "blocks": [...]}, ...]}
    if jsonb_typeof(d.payload -> 'sesiones') <> 'array' or jsonb_array_length(d.payload -> 'sesiones') not between 1 and 120 then
      raise exception 'La propuesta necesita entre 1 y 120 sesiones';
    end if;
    for s in select * from jsonb_array_elements(d.payload -> 'sesiones') loop
      if s ? 'id' then raise exception 'Una propuesta solo crea sesiones nuevas'; end if;
      v_res := save_workout(s || jsonb_build_object('patient_id', d.patient_id));
      v_ids := v_ids || coalesce(v_res -> 'ids', '[]'::jsonb);
    end loop;
    v_res := jsonb_build_object('sesiones_creadas', jsonb_array_length(v_ids), 'ids', v_ids);

  elsif d.kind = 'cambio_ejercicio' then
    -- {"from", "to", "from_date", "load_kg", "clear_load", "instructions"}
    v_n := replace_exercise(d.patient_id, (d.payload ->> 'from')::uuid, (d.payload ->> 'to')::uuid,
      coalesce((d.payload ->> 'from_date')::date, hoy_local()), nullif(d.payload ->> 'load_kg', '')::numeric,
      coalesce((d.payload ->> 'clear_load')::boolean, false), nullif(trim(d.payload ->> 'instructions'), ''));
    v_res := jsonb_build_object('ejercicios_cambiados', v_n);

  elsif d.kind = 'mensaje' then
    -- {"body"}
    if char_length(trim(coalesce(d.payload ->> 'body', ''))) not between 1 and 4000 then raise exception 'Mensaje vacío o demasiado largo'; end if;
    insert into messages (patient_id, sender_id, body) values (d.patient_id, auth.uid(), trim(d.payload ->> 'body')) returning id into v_id;
    v_res := jsonb_build_object('mensaje', v_id);

  elsif d.kind = 'habito' then
    -- {"habit_id", "target", "days_of_week", "coach_note", "start_date"}
    if not exists (select 1 from habit_definitions where id = (d.payload ->> 'habit_id')::uuid and not is_archived) then
      raise exception 'Hábito no encontrado';
    end if;
    insert into patient_habits (patient_id, habit_id, target, days_of_week, coach_note, start_date)
    values (d.patient_id, (d.payload ->> 'habit_id')::uuid, nullif(d.payload ->> 'target', '')::numeric,
      coalesce((select array_agg(x::int) from jsonb_array_elements_text(d.payload -> 'days_of_week') x), '{1,2,3,4,5,6,7}'),
      nullif(trim(d.payload ->> 'coach_note'), ''), coalesce((d.payload ->> 'start_date')::date, hoy_local()))
    returning id into v_id;
    v_res := jsonb_build_object('habito', v_id);
  end if;

  update assistant_drafts set status = 'aplicada', result = v_res, decided_at = now(), decided_by = auth.uid() where id = p_id;
  return v_res;
end $$;

create or replace function descartar_propuesta(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_coach() then raise exception 'Solo el coach'; end if;
  update assistant_drafts set status = 'descartada', decided_at = now(), decided_by = auth.uid()
   where id = p_id and status = 'pendiente';
  if not found then raise exception 'Propuesta no encontrada o ya decidida'; end if;
end $$;

revoke execute on function aplicar_propuesta(uuid) from public, anon;
revoke execute on function descartar_propuesta(uuid) from public, anon;
grant execute on function aplicar_propuesta(uuid) to authenticated;
grant execute on function descartar_propuesta(uuid) to authenticated;
