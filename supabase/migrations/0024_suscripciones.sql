-- Suscripciones de WooCommerce → propuesta de módulos (decidido por Rubén el 9 nov 2026).
-- WooCommerce avisa a la app (función «woocommerce») cuando una suscripción se crea, renueva, pausa o cancela.
-- La app solo GUARDA ese estado y PROPONE qué módulos abrir o cerrar a cada paciente.
-- Nada cambia hasta que el coach pulsa «Aplicar» en su panel. Nunca crea cuentas ni borra datos.
-- Depende de 0001-0023.

-- 1. Qué abre cada producto de WooCommerce. Lo edita el coach en Ajustes.
create table plan_products (
  woo_product_id bigint primary key check (woo_product_id > 0),
  plan text not null check (char_length(plan) between 1 and 80),
  modules text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table plan_products enable row level security;
create policy coach_all on plan_products for all using (is_coach()) with check (is_coach());

create or replace function guard_plan_modules()
returns trigger language plpgsql set search_path = public
as $$
begin
  if exists (select 1 from unnest(new.modules) m where m not in (select slug from modules)) then
    raise exception 'Módulo desconocido en el plan';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger plan_products_guard before insert or update on plan_products for each row execute function guard_plan_modules();

-- Comunidad (producto 13847): ritmos circadianos completos, hábitos y cuestionarios.
insert into plan_products (woo_product_id, plan, modules) values
  (13847, 'Comunidad', array['circadian', 'habits', 'questionnaires']);

-- 2. Las suscripciones: se añade la variación (mensual o anual) y cuándo se avisó por última vez.
alter table memberships add column woo_variation_id bigint;
alter table memberships add column received_at timestamptz;

-- 3. Guardar el aviso de WooCommerce. Solo la usa la función «woocommerce» (clave de servidor).
--    Enlaza la suscripción con el paciente que tenga el mismo email. No toca sus módulos.
create or replace function registrar_suscripcion(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(p->'billing'->>'email'));
  v_estado membership_status;
  v_producto bigint;
  v_variacion bigint;
  v_fin date;
  v_id uuid;
begin
  if (p->>'id') is null or v_email is null or v_email = '' then
    raise exception 'Aviso de WooCommerce incompleto';
  end if;
  v_estado := case p->>'status'
    when 'active' then 'active'
    when 'pending-cancel' then 'active'   -- cancelada, pero pagada hasta el final del periodo
    when 'on-hold' then 'on_hold'
    when 'cancelled' then 'cancelled'
    when 'expired' then 'expired'
    else 'pending' end;
  -- El primer producto de la suscripción que tenga plan; si ninguno, el primero
  select (li->>'product_id')::bigint, nullif(li->>'variation_id', '0')::bigint
    into v_producto, v_variacion
    from jsonb_array_elements(coalesce(p->'line_items', '[]'::jsonb)) li
    order by (exists (select 1 from plan_products pp where pp.woo_product_id = (li->>'product_id')::bigint)) desc
    limit 1;
  v_fin := coalesce(nullif(p->>'next_payment_date_gmt', ''), nullif(p->>'end_date_gmt', ''))::date;

  insert into memberships (email, woo_subscription_id, woo_product_id, woo_variation_id, status, current_period_end, raw_event, received_at, updated_at, patient_id)
  values (v_email, (p->>'id')::bigint, v_producto, v_variacion, v_estado, v_fin,
          jsonb_build_object('status', p->>'status', 'date_modified_gmt', p->>'date_modified_gmt'),
          now(), now(),
          (select id from profiles where lower(email) = v_email and role = 'patient'))
  on conflict (woo_subscription_id) do update set
    email = excluded.email, woo_product_id = excluded.woo_product_id, woo_variation_id = excluded.woo_variation_id,
    status = excluded.status, current_period_end = excluded.current_period_end, raw_event = excluded.raw_event,
    received_at = excluded.received_at, updated_at = excluded.updated_at,
    patient_id = coalesce(excluded.patient_id, memberships.patient_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function registrar_suscripcion(jsonb) from public, anon, authenticated;
do $$
begin
  grant execute on function registrar_suscripcion(jsonb) to service_role;
exception when undefined_object then null;  -- en las pruebas no existe ese rol
end;
$$;

-- Si el paciente se da de alta después de pagar, su suscripción se enlaza sola al crear el perfil (solo el enlace).
create or replace function enlazar_suscripciones()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role = 'patient' then
    update memberships set patient_id = new.id where patient_id is null and lower(email) = lower(new.email);
  end if;
  return new;
end;
$$;
create trigger profiles_enlazar_suscripciones after insert on profiles for each row execute function enlazar_suscripciones();

-- 4. Propuestas para el coach: qué abrir y qué cerrar a cada suscriptor, y quién pagó sin tener cuenta.
create or replace function cambios_suscripcion()
returns table (patient_id uuid, nombre text, email text, planes text, activar text[], desactivar text[], sin_cuenta boolean)
language sql stable security definer set search_path = public
as $$
  with m as (
    select ms.patient_id, ms.email, ms.status, pp.plan, coalesce(pp.modules, '{}') modules
    from memberships ms left join plan_products pp on pp.woo_product_id = ms.woo_product_id
  ),
  por_paciente as (
    select m.patient_id,
           string_agg(distinct m.plan || case when m.status = 'active' then '' else ' (' || m.status::text || ')' end, ', ') planes,
           coalesce(array_agg(distinct x) filter (where m.status = 'active' and x is not null), '{}') quiere,
           coalesce(array_agg(distinct x) filter (where m.status <> 'active' and x is not null), '{}') perdio
    from m left join lateral unnest(m.modules) x on true
    where m.patient_id is not null and m.plan is not null
    group by m.patient_id
  )
  select * from (
  select p.id as patient_id, p.full_name as nombre, p.email as email, pp.planes as planes,
         array(select unnest(pp.quiere) except select module_slug from patient_modules pm where pm.patient_id = p.id) as activar,
         array((select unnest(pp.perdio) except select unnest(pp.quiere))
               intersect select module_slug from patient_modules pm where pm.patient_id = p.id) as desactivar,
         false as sin_cuenta
  from por_paciente pp join profiles p on p.id = pp.patient_id
  where is_coach()
  union all
  select null::uuid, null::text, m.email, string_agg(distinct m.plan, ', '), '{}'::text[], '{}'::text[], true
  from m
  where is_coach() and m.patient_id is null and m.status = 'active' and m.plan is not null
  group by m.email
  ) t
  -- Solo los que tienen algo que hacer
  where t.sin_cuenta or cardinality(t.activar) + cardinality(t.desactivar) > 0;
$$;

-- 5. El coach aplica la propuesta de UN paciente. Solo abre o cierra módulos; no borra ningún dato.
create or replace function aplicar_cambio_suscripcion(p_patient uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c record;
begin
  if not is_coach() then raise exception 'Solo el coach puede aplicar cambios de suscripción'; end if;
  select * into c from cambios_suscripcion() where patient_id = p_patient;
  if not found then raise exception 'No hay cambios pendientes para este paciente'; end if;
  insert into patient_modules (patient_id, module_slug)
    select p_patient, unnest(c.activar) on conflict do nothing;
  delete from patient_modules where patient_id = p_patient and module_slug = any (c.desactivar);
  return jsonb_build_object('activados', c.activar, 'desactivados', c.desactivar);
end;
$$;
revoke execute on function cambios_suscripcion() from public, anon;
revoke execute on function aplicar_cambio_suscripcion(uuid) from public, anon;
