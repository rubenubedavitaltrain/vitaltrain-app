-- El guardián de perfiles bloqueaba también los cambios hechos desde el panel de Supabase
-- (editor SQL o funciones del servidor), donde no hay usuario conectado (auth.uid() es null).
-- Ahora solo se aplica a usuarios con sesión que no son coach. Un visitante sin sesión
-- sigue sin poder cambiar nada porque las reglas de seguridad (RLS) no le dan permiso.

create or replace function guard_profile_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not is_coach() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.email is distinct from old.email
       or new.woo_customer_id is distinct from old.woo_customer_id then
      raise exception 'No tienes permiso para cambiar estos datos';
    end if;
  end if;
  return new;
end;
$$;
