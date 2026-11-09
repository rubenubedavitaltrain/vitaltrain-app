-- Cuenta de coach en un proyecto nuevo (producción).
-- Antes: crear el usuario en Supabase → Authentication → Add user, con este email y «Auto confirm».
-- Se ejecuta en el editor SQL del proyecto (sin usuario conectado, el guardián de perfiles lo permite desde 0005).
insert into profiles (id, role, full_name, email)
select id, 'coach', 'Rubén Úbeda Rubio', email from auth.users where email = 'ruben.ubeda@vitaltrain.com'
on conflict (id) do update set role = 'coach', status = 'active';

select id, role, status, email from profiles where role = 'coach';
