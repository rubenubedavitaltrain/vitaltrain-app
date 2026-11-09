-- Reloj de los recordatorios: cada 15 minutos llama a la función «avisos».
-- Va aparte de las migraciones porque pg_cron, pg_net y Vault solo existen en Supabase (no en la prueba local).
-- Se aplica una vez por proyecto, después de 0019. El secreto lo guarda Rubén desde Ajustes → «Generar claves».
-- Cambia la dirección del proyecto al aplicarlo en producción (la de abajo es vitaltrain-dev). Ver docs/PRODUCCION.md.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('avisos-recordatorios') where exists (select 1 from cron.job where jobname = 'avisos-recordatorios');

select cron.schedule('avisos-recordatorios', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://jlcrmozctsvgnousstbu.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'avisos_cron'), '')
    ),
    body := '{"tipo":"recordatorios"}'::jsonb
  );
$$);
