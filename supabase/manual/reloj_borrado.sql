-- Reloj del borrado automático (migración 0022): el día 1 de cada mes a las 4:00 (hora UTC).
-- Se aplica una vez en cada proyecto (dev y prod) desde el editor SQL de Supabase, después de 0022.
-- Necesita la extensión pg_cron (ya activa por el reloj de avisos).
select cron.schedule('borrado-datos-bloqueados', '0 4 1 * *', $$select purgar_datos_bloqueados()$$);
